import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLogger'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { Project, ProjectTransaction, ProjectTxnKind, ProjectTxnStatus } from '@/types'

const KINDS: { key: ProjectTxnKind; label: string }[] = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'expense', label: 'Expense' },
  { key: 'liability', label: 'Liability' },
  { key: 'adjustment', label: 'Adjustment' },
]
const STATUSES: ProjectTxnStatus[] = ['draft', 'approved', 'paid', 'cancelled']
const CURRENCIES = ['PHP', 'USD', 'EUR', 'GBP', 'AUD', 'SGD']
const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700', approved: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700',
}
const money = (n: number) => `₱${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const currentMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }

export default function ProjectTransactionsTab({ projects }: { projects: Project[] }) {
  const { currentUser } = useCurrentUser()
  const canApprove = ['super_admin', 'admin', 'hr'].includes(currentUser?.role || '') // payroll/accounting == admin/hr here

  const [month, setMonth] = useState(currentMonth())
  const [projectFilter, setProjectFilter] = useState('')
  const [rows, setRows] = useState<ProjectTransaction[]>([])
  const [loading, setLoading] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<ProjectTransaction | null>(null)
  const [form, setForm] = useState<Partial<ProjectTransaction>>({})
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [month, projectFilter])

  const load = async () => {
    setLoading(true)
    let q = supabase.from('project_transactions').select('*').eq('month', month).order('txn_date', { ascending: false })
    if (projectFilter) q = q.eq('project_id', projectFilter)
    const { data } = await q
    setRows((data ?? []) as ProjectTransaction[])
    setLoading(false)
  }

  const projectName = (id: string) => {
    const p = projects.find(x => x.id === id)
    return p ? `${p.name}${p.code ? ` (${p.code})` : ''}` : '—'
  }
  const projStatus = (id: string) => projects.find(x => x.id === id)?.status

  const openModal = (t?: ProjectTransaction) => {
    setEditing(t ?? null)
    setFile(null)
    setForm(t ? { ...t } : {
      kind: 'revenue', status: 'draft', currency: 'PHP', exchange_rate: 1, amount: 0,
      txn_date: new Date().toISOString().slice(0, 10), month,
    })
    setShowModal(true)
  }

  const amountPhp = (amount: number, rate: number) => Math.round(((Number(amount) || 0) * (Number(rate) || 1)) * 100) / 100

  const uploadAttachment = async (txnId: string): Promise<string | null> => {
    if (!file) return null
    const path = `${form.project_id || 'misc'}/${txnId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`
    const { error } = await supabase.storage.from('project-files').upload(path, file, { upsert: true })
    if (error) { alert('Attachment upload failed: ' + error.message); return null }
    return path
  }

  const save = async () => {
    if (!form.project_id) { alert('Select a project'); return }
    // Block posting to archived/completed/cancelled projects
    const ps = projStatus(form.project_id)
    if (ps === 'completed' || ps === 'cancelled') { alert('This project is archived/closed. Reopen it (set Active) before adding transactions.'); return }
    if (form.amount == null || isNaN(Number(form.amount))) { alert('Valid amount required'); return }
    setSaving(true)
    try {
      const rate = Number(form.exchange_rate) || 1
      const payload: any = {
        project_id: form.project_id,
        kind: form.kind || 'revenue',
        category: form.category?.trim() || null,
        description: form.description?.trim() || null,
        txn_date: form.txn_date || new Date().toISOString().slice(0, 10),
        month: form.month || month,
        currency: form.currency || 'PHP',
        exchange_rate: rate,
        amount: Number(form.amount) || 0,
        amount_php: amountPhp(Number(form.amount) || 0, rate),
        invoice_ref: form.invoice_ref?.trim() || null,
        status: form.status || 'draft',
        due_date: form.due_date || null,
        payment_date: form.payment_date || null,
        source: 'manual',
        created_by: currentUser?.email || null,
      }
      if (form.status === 'approved' && !editing?.approved_at) {
        payload.approved_by = currentUser?.email || null
        payload.approved_at = new Date().toISOString()
      }

      let txnId = editing?.id
      const oldPhp = editing?.amount_php ?? null
      if (editing) {
        const { error } = await supabase.from('project_transactions').update(payload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('project_transactions').insert(payload).select('id').single()
        if (error) throw error
        txnId = data.id
      }
      // attachment
      if (file && txnId) {
        const path = await uploadAttachment(txnId)
        if (path) await supabase.from('project_transactions').update({ attachment_path: path }).eq('id', txnId)
      }
      // audit
      await supabase.from('project_transaction_audit').insert({
        transaction_id: txnId, action: editing ? 'updated' : 'created', actor: currentUser?.email || null,
        old_amount_php: oldPhp, new_amount_php: payload.amount_php,
      })
      await logActivity(editing ? 'updated' : 'created', 'Project P&L', `${editing ? 'Updated' : 'Added'} ${payload.kind} for ${projectName(form.project_id)} — ${money(payload.amount_php)}`)
      setShowModal(false)
      await load()
    } catch (e: any) {
      alert(e.message || 'Failed to save')
    } finally { setSaving(false) }
  }

  const changeStatus = async (t: ProjectTransaction, status: ProjectTxnStatus) => {
    const patch: any = { status }
    if (status === 'approved' && !t.approved_at) { patch.approved_by = currentUser?.email || null; patch.approved_at = new Date().toISOString() }
    if (status === 'paid') patch.payment_date = t.payment_date || new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('project_transactions').update(patch).eq('id', t.id)
    if (error) { alert(error.message); return }
    await supabase.from('project_transaction_audit').insert({ transaction_id: t.id, action: 'status_change', actor: currentUser?.email || null, detail: { to: status } })
    await load()
  }

  const del = async (t: ProjectTransaction) => {
    if (!confirm('Delete this transaction?')) return
    await supabase.from('project_transactions').delete().eq('id', t.id)
    await logActivity('deleted', 'Project P&L', `Deleted ${t.kind} ${money(t.amount_php)}`)
    await load()
  }

  const viewAttachment = async (path: string) => {
    const { data, error } = await supabase.storage.from('project-files').createSignedUrl(path, 60)
    if (error) { alert(error.message); return }
    window.open(data.signedUrl, '_blank')
  }

  // Totals — only APPROVED/PAID count toward figures
  const totals = useMemo(() => {
    const counted = rows.filter(r => r.status === 'approved' || r.status === 'paid')
    const rev = counted.filter(r => r.kind === 'revenue').reduce((s, r) => s + Number(r.amount_php), 0)
    const exp = counted.filter(r => r.kind === 'expense').reduce((s, r) => s + Number(r.amount_php), 0)
    const liab = counted.filter(r => r.kind === 'liability').reduce((s, r) => s + Number(r.amount_php), 0)
    const adj = counted.filter(r => r.kind === 'adjustment').reduce((s, r) => s + Number(r.amount_php), 0)
    return { rev, exp, liab, adj }
  }, [rows])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input-field" />
          <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="input-field">
            <option value="">All projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ''}</option>)}
          </select>
        </div>
        <button onClick={() => openModal()} className="btn-primary">+ Add Transaction</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div className="rounded-lg border border-gray-200 bg-white p-3"><p className="text-xs text-gray-500">Approved Revenue</p><p className="font-bold text-blue-700">{money(totals.rev)}</p></div>
        <div className="rounded-lg border border-gray-200 bg-white p-3"><p className="text-xs text-gray-500">Approved Expense</p><p className="font-bold text-red-700">{money(totals.exp)}</p></div>
        <div className="rounded-lg border border-gray-200 bg-white p-3"><p className="text-xs text-gray-500">Liabilities</p><p className="font-bold text-amber-700">{money(totals.liab)}</p></div>
        <div className="rounded-lg border border-gray-200 bg-white p-3"><p className="text-xs text-gray-500">Adjustments</p><p className="font-bold text-gray-700">{money(totals.adj)}</p></div>
      </div>
      <p className="text-xs text-gray-500">Only <strong>Approved</strong> and <strong>Paid</strong> transactions affect P&amp;L totals. Draft and cancelled are excluded.</p>

      {loading ? <p className="py-8 text-center text-sm text-gray-500">Loading...</p> : rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">No transactions for this month.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>{['Date', 'Project', 'Kind', 'Category', 'Amount', 'PHP', 'Status', 'Ref', ''].map(h => <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 whitespace-nowrap">{t.txn_date}</td>
                  <td className="px-3 py-2">{projectName(t.project_id)}</td>
                  <td className="px-3 py-2 capitalize">{t.kind}</td>
                  <td className="px-3 py-2">{t.category || '-'}{t.source === 'auto_payroll' && <span className="ml-1 rounded bg-purple-100 px-1 text-[10px] text-purple-700">auto</span>}</td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">{t.currency} {Number(t.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-3 py-2 text-right font-medium whitespace-nowrap">{money(Number(t.amount_php))}</td>
                  <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[t.status]}`}>{t.status}</span></td>
                  <td className="px-3 py-2">{t.attachment_path ? <button onClick={() => viewAttachment(t.attachment_path!)} className="text-blue-600 hover:underline">file</button> : (t.invoice_ref || '-')}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">
                    {canApprove && t.status === 'draft' && <button onClick={() => changeStatus(t, 'approved')} className="mr-2 text-blue-600 hover:underline">Approve</button>}
                    {canApprove && t.status === 'approved' && <button onClick={() => changeStatus(t, 'paid')} className="mr-2 text-green-600 hover:underline">Paid</button>}
                    {t.source === 'manual' && <button onClick={() => openModal(t)} className="mr-2 text-gray-600 hover:underline">Edit</button>}
                    {t.source === 'manual' && <button onClick={() => del(t)} className="text-red-600 hover:underline">Del</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-6">
              <h3 className="text-xl font-bold">{editing ? 'Edit Transaction' : 'Add Project Transaction'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-4 p-6">
              <F label="Project *">
                <select value={form.project_id || ''} onChange={e => setForm(f => ({ ...f, project_id: e.target.value }))} className="input-field w-full">
                  <option value="">Select…</option>
                  {projects.filter(p => p.status !== 'completed' && p.status !== 'cancelled').map(p => <option key={p.id} value={p.id}>{p.name}{p.code ? ` (${p.code})` : ''}</option>)}
                </select>
              </F>
              <F label="Kind *">
                <select value={form.kind || 'revenue'} onChange={e => setForm(f => ({ ...f, kind: e.target.value as ProjectTxnKind }))} className="input-field w-full">
                  {KINDS.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
                </select>
              </F>
              <F label="Category"><input value={form.category || ''} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="input-field w-full" placeholder="e.g. Client Billing, Software, Rent" /></F>
              <F label="Transaction Date"><input type="date" value={form.txn_date || ''} onChange={e => setForm(f => ({ ...f, txn_date: e.target.value }))} className="input-field w-full" /></F>
              <F label="Reporting Month"><input type="month" value={form.month || month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} className="input-field w-full" /></F>
              <F label="Currency">
                <select value={form.currency || 'PHP'} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} className="input-field w-full">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </F>
              <F label="Amount"><input type="number" step="0.01" value={form.amount ?? 0} onChange={e => setForm(f => ({ ...f, amount: Number(e.target.value) || 0 }))} className="input-field w-full" /></F>
              <F label="Exchange Rate (PHP per unit)"><input type="number" step="0.0001" value={form.exchange_rate ?? 1} onChange={e => setForm(f => ({ ...f, exchange_rate: Number(e.target.value) || 1 }))} className="input-field w-full" disabled={(form.currency || 'PHP') === 'PHP'} /></F>
              <div className="col-span-2 text-xs text-gray-500">PHP-converted: <strong>{money(amountPhp(Number(form.amount) || 0, Number(form.exchange_rate) || 1))}</strong></div>
              <F label="Invoice / Reference #"><input value={form.invoice_ref || ''} onChange={e => setForm(f => ({ ...f, invoice_ref: e.target.value }))} className="input-field w-full" /></F>
              <F label="Status">
                <select value={form.status || 'draft'} onChange={e => setForm(f => ({ ...f, status: e.target.value as ProjectTxnStatus }))} className="input-field w-full">
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </F>
              <F label="Due Date"><input type="date" value={form.due_date || ''} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="input-field w-full" /></F>
              <F label="Payment Date"><input type="date" value={form.payment_date || ''} onChange={e => setForm(f => ({ ...f, payment_date: e.target.value }))} className="input-field w-full" /></F>
              <div className="col-span-2">
                <F label="Attachment (stored privately)"><input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="w-full text-sm" /></F>
                {editing?.attachment_path && !file && <button onClick={() => viewAttachment(editing.attachment_path!)} className="mt-1 text-xs text-blue-600 hover:underline">View current attachment</button>}
              </div>
              <div className="col-span-2"><F label="Description"><textarea value={form.description || ''} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="input-field w-full" /></F></div>
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

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>{children}</div>
}
