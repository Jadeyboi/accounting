import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLogger'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { Project, SharedExpense, AllocationMethod } from '@/types'

const METHODS: { key: AllocationMethod; label: string }[] = [
  { key: 'equal', label: 'Equal split' },
  { key: 'headcount', label: 'By employee headcount' },
  { key: 'revenue', label: 'By project revenue' },
  { key: 'custom', label: 'Custom percentage' },
]
const CURRENCIES = ['PHP', 'USD', 'EUR', 'GBP', 'AUD', 'SGD']
const money = (n: number) => `₱${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const currentMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

interface AllocLine { project_id: string; allocation_pct: number }

export default function SharedExpensesTab({ projects }: { projects: Project[] }) {
  const { currentUser } = useCurrentUser()
  const [month, setMonth] = useState(currentMonth())
  const [rows, setRows] = useState<SharedExpense[]>([])
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<SharedExpense | null>(null)
  const [form, setForm] = useState<Partial<SharedExpense>>({})
  const [lines, setLines] = useState<AllocLine[]>([])
  const [saving, setSaving] = useState(false)

  const activeProjects = projects.filter(p => p.status === 'active' || p.status === 'on_hold')

  useEffect(() => { load() }, [month])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('shared_expenses').select('*').eq('month', month).order('created_at', { ascending: false })
    setRows((data ?? []) as SharedExpense[])
    setLoading(false)
  }

  const amountPhp = (amount: number, rate: number) => Math.round(((Number(amount) || 0) * (Number(rate) || 1)) * 100) / 100

  const openModal = async (s?: SharedExpense) => {
    setEditing(s ?? null)
    setForm(s ? { ...s } : { month, currency: 'PHP', exchange_rate: 1, amount: 0, allocation_method: 'equal', status: 'draft' })
    if (s) {
      const { data } = await supabase.from('shared_expense_allocations').select('project_id,allocation_pct').eq('shared_expense_id', s.id)
      setLines((data ?? []).map((d: any) => ({ project_id: d.project_id, allocation_pct: Number(d.allocation_pct) })))
    } else {
      setLines(activeProjects.map(p => ({ project_id: p.id, allocation_pct: 0 })))
    }
    setShowModal(true)
  }

  // Compute allocation percentages based on the chosen method
  const computeLines = async (method: AllocationMethod): Promise<AllocLine[]> => {
    const projIds = activeProjects.map(p => p.id)
    if (projIds.length === 0) return []
    if (method === 'equal') {
      const pct = Math.round((100 / projIds.length) * 100) / 100
      return projIds.map((id, i) => ({ project_id: id, allocation_pct: i === projIds.length - 1 ? Math.round((100 - pct * (projIds.length - 1)) * 100) / 100 : pct }))
    }
    if (method === 'headcount') {
      const { data } = await supabase.from('employee_project_assignments').select('project_id').is('end_date', null).in('project_id', projIds)
      const counts: Record<string, number> = {}
      for (const a of (data ?? []) as { project_id: string }[]) counts[a.project_id] = (counts[a.project_id] ?? 0) + 1
      const total = Object.values(counts).reduce((s, n) => s + n, 0)
      if (total === 0) return projIds.map(id => ({ project_id: id, allocation_pct: 0 }))
      return projIds.map(id => ({ project_id: id, allocation_pct: Math.round(((counts[id] ?? 0) / total) * 10000) / 100 }))
    }
    if (method === 'revenue') {
      const { data } = await supabase.from('project_transactions').select('project_id,amount_php,kind,status').eq('month', month).eq('kind', 'revenue').in('project_id', projIds)
      const rev: Record<string, number> = {}
      for (const t of (data ?? []) as any[]) if (t.status === 'approved' || t.status === 'paid') rev[t.project_id] = (rev[t.project_id] ?? 0) + Number(t.amount_php)
      const total = Object.values(rev).reduce((s, n) => s + n, 0)
      if (total === 0) return projIds.map(id => ({ project_id: id, allocation_pct: 0 }))
      return projIds.map(id => ({ project_id: id, allocation_pct: Math.round(((rev[id] ?? 0) / total) * 10000) / 100 }))
    }
    return lines // custom: keep current
  }

  const applyMethod = async (method: AllocationMethod) => {
    setForm(f => ({ ...f, allocation_method: method }))
    if (method !== 'custom') setLines(await computeLines(method))
  }

  const totalPct = Math.round(lines.reduce((s, l) => s + (Number(l.allocation_pct) || 0), 0) * 100) / 100
  const totalPhp = amountPhp(Number(form.amount) || 0, Number(form.exchange_rate) || 1)

  const save = async () => {
    if (!form.description?.trim()) { alert('Description is required'); return }
    const active = lines.filter(l => l.project_id && Number(l.allocation_pct) > 0)
    if (active.length === 0) { alert('Add at least one project allocation'); return }
    if (totalPct !== 100) { alert(`Allocation must total 100% (currently ${totalPct}%).`); return }
    setSaving(true)
    try {
      const payload: any = {
        description: form.description.trim(),
        category: form.category?.trim() || null,
        month: form.month || month,
        currency: form.currency || 'PHP',
        exchange_rate: Number(form.exchange_rate) || 1,
        amount: Number(form.amount) || 0,
        amount_php: totalPhp,
        allocation_method: form.allocation_method || 'equal',
        status: form.status || 'draft',
        notes: form.notes?.trim() || null,
        created_by: currentUser?.email || null,
      }
      if (form.status === 'approved' && !editing?.approved_at) { payload.approved_by = currentUser?.email || null; payload.approved_at = new Date().toISOString() }

      let sharedId = editing?.id
      if (editing) {
        const { error } = await supabase.from('shared_expenses').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('shared_expenses').insert(payload).select('id').single()
        if (error) throw error
        sharedId = data.id
      }
      // replace allocation lines (no duplicates)
      await supabase.from('shared_expense_allocations').delete().eq('shared_expense_id', sharedId)
      const allocRows = active.map(l => ({
        shared_expense_id: sharedId, project_id: l.project_id,
        allocation_pct: Number(l.allocation_pct),
        amount_php: Math.round((totalPhp * (Number(l.allocation_pct) / 100)) * 100) / 100,
      }))
      const { error: aErr } = await supabase.from('shared_expense_allocations').insert(allocRows)
      if (aErr) throw aErr
      await logActivity(editing ? 'updated' : 'created', 'Project P&L', `${editing ? 'Updated' : 'Added'} shared expense: ${payload.description} — ${money(totalPhp)}`)
      setShowModal(false)
      await load()
    } catch (e: any) {
      alert(e.message || 'Failed to save')
    } finally { setSaving(false) }
  }

  const del = async (s: SharedExpense) => {
    if (!confirm('Delete this shared expense and its allocations?')) return
    await supabase.from('shared_expenses').delete().eq('id', s.id)
    await logActivity('deleted', 'Project P&L', `Deleted shared expense: ${s.description}`)
    await load()
  }

  const projectName = (id: string) => { const p = projects.find(x => x.id === id); return p ? `${p.name}${p.code ? ` (${p.code})` : ''}` : '—' }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input-field" />
        <button onClick={() => openModal()} className="btn-primary">+ Add Shared Expense</button>
      </div>
      <p className="text-xs text-gray-500">Shared costs (rent, utilities, software, admin) split across projects. Only <strong>Approved</strong> shared expenses count toward Project P&amp;L.</p>

      {loading ? <p className="py-8 text-center text-sm text-gray-500">Loading...</p> : rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">No shared expenses for this month.</div>
      ) : (
        <div className="space-y-3">
          {rows.map(s => (
            <div key={s.id} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{s.description}</p>
                  <p className="text-xs text-gray-500">{s.category || '-'} • {METHODS.find(m => m.key === s.allocation_method)?.label} • <span className={`rounded px-1.5 py-0.5 ${s.status === 'approved' ? 'bg-blue-100 text-blue-700' : s.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{s.status}</span></p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">{money(Number(s.amount_php))}</p>
                  <div className="mt-1 flex gap-3 text-xs">
                    <button onClick={() => openModal(s)} className="text-blue-600 hover:underline">Edit</button>
                    <button onClick={() => del(s)} className="text-red-600 hover:underline">Delete</button>
                  </div>
                </div>
              </div>
              <SharedAllocList sharedId={s.id} projectName={projectName} />
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-6">
              <h3 className="text-xl font-bold">{editing ? 'Edit Shared Expense' : 'Add Shared Expense'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-4 p-6">
              <div className="col-span-2"><F label="Description *"><input value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="input-field w-full" placeholder="e.g. Office rent, AWS subscription" /></F></div>
              <F label="Category"><input value={form.category || ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="input-field w-full" /></F>
              <F label="Reporting Month"><input type="month" value={form.month || month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} className="input-field w-full" /></F>
              <F label="Currency"><select value={form.currency || 'PHP'} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="input-field w-full">{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select></F>
              <F label="Amount"><input type="number" step="0.01" value={form.amount ?? 0} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) || 0 }))} className="input-field w-full" /></F>
              <F label="Exchange Rate"><input type="number" step="0.0001" value={form.exchange_rate ?? 1} onChange={e => setForm(f => ({ ...f, exchange_rate: Number(e.target.value) || 1 }))} className="input-field w-full" disabled={(form.currency || 'PHP') === 'PHP'} /></F>
              <F label="Status"><select value={form.status || 'draft'} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))} className="input-field w-full"><option value="draft">draft</option><option value="approved">approved</option><option value="cancelled">cancelled</option></select></F>
              <div className="col-span-2 text-xs text-gray-500">Total PHP to allocate: <strong>{money(totalPhp)}</strong></div>

              <div className="col-span-2">
                <F label="Allocation Method">
                  <select value={form.allocation_method || 'equal'} onChange={e => applyMethod(e.target.value as AllocationMethod)} className="input-field w-full">
                    {METHODS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </F>
              </div>

              <div className="col-span-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">Project Allocation</span>
                  <span className={`text-xs font-medium ${totalPct === 100 ? 'text-green-600' : 'text-amber-600'}`}>Total: {totalPct}%{totalPct === 100 ? ' ✓' : ' (must equal 100%)'}</span>
                </div>
                <div className="space-y-2">
                  {lines.map((l, i) => (
                    <div key={i} className="grid grid-cols-[1fr_6rem_8rem] items-center gap-2 text-sm">
                      <span className="truncate text-gray-700">{projectName(l.project_id)}</span>
                      <input type="number" step="0.01" value={l.allocation_pct} disabled={form.allocation_method !== 'custom'} onChange={e => setLines(ls => ls.map((x, j) => j === i ? { ...x, allocation_pct: Number(e.target.value) || 0 } : x))} className="input-field text-right" />
                      <span className="text-right text-gray-500">{money(Math.round((totalPhp * (Number(l.allocation_pct) / 100)) * 100) / 100)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t p-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editing ? 'Update' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SharedAllocList({ sharedId, projectName }: { sharedId: string; projectName: (id: string) => string }) {
  const [allocs, setAllocs] = useState<Array<{ project_id: string; allocation_pct: number; amount_php: number }>>([])
  useEffect(() => {
    supabase.from('shared_expense_allocations').select('project_id,allocation_pct,amount_php').eq('shared_expense_id', sharedId)
      .then(({ data }) => setAllocs((data ?? []) as any))
  }, [sharedId])
  if (allocs.length === 0) return null
  return (
    <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-2 text-xs text-gray-600">
      {allocs.map((a, i) => <span key={i} className="rounded bg-gray-100 px-2 py-0.5">{projectName(a.project_id)}: {a.allocation_pct}% ({money(Number(a.amount_php))})</span>)}
    </div>
  )
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>{children}</div>
}
