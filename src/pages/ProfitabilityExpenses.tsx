import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLogger'
import type { PmClient, PmProject, PmExpense } from '@/types'

const fmt = (n: number) =>
  `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const CATEGORIES: PmExpense['category'][] = [
  'recruitment', 'software', 'equipment', 'internet', 'office', 'training', 'miscellaneous',
]

const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function ProfitabilityExpenses() {
  const [expenses, setExpenses] = useState<PmExpense[]>([])
  const [clients, setClients] = useState<PmClient[]>([])
  const [projects, setProjects] = useState<PmProject[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [filterMonth, setFilterMonth] = useState(currentMonth())
  const [filterScope, setFilterScope] = useState<'' | PmExpense['scope']>('')
  const [filterProject, setFilterProject] = useState('')
  const [filterClient, setFilterClient] = useState('')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<PmExpense | null>(null)
  const [fMonth, setFMonth] = useState(currentMonth())
  const [fCategory, setFCategory] = useState<PmExpense['category']>('miscellaneous')
  const [fAmount, setFAmount] = useState('')
  const [fDescription, setFDescription] = useState('')
  const [fScope, setFScope] = useState<PmExpense['scope']>('company')
  const [fProjectId, setFProjectId] = useState('')
  const [fClientId, setFClientId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    const [e, c, p] = await Promise.all([
      supabase.from('pm_expenses').select('*').order('month', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('pm_clients').select('*').order('name'),
      supabase.from('pm_projects').select('*').order('name'),
    ])
    setExpenses((e.data ?? []) as PmExpense[])
    setClients((c.data ?? []) as PmClient[])
    setProjects((p.data ?? []) as PmProject[])
    setLoading(false)
  }

  const filtered = useMemo(() => {
    return expenses.filter(ex => {
      if (filterMonth && ex.month !== filterMonth) return false
      if (filterScope && ex.scope !== filterScope) return false
      if (filterProject && ex.project_id !== filterProject) return false
      if (filterClient && ex.client_id !== filterClient) return false
      return true
    })
  }, [expenses, filterMonth, filterScope, filterProject, filterClient])

  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {}
    for (const cat of CATEGORIES) totals[cat] = 0
    for (const ex of filtered) totals[ex.category] = (totals[ex.category] ?? 0) + ex.amount
    return totals
  }, [filtered])

  const openModal = (ex?: PmExpense) => {
    setEditing(ex ?? null)
    setFMonth(ex?.month ?? filterMonth ?? currentMonth())
    setFCategory(ex?.category ?? 'miscellaneous')
    setFAmount(ex?.amount?.toString() ?? '')
    setFDescription(ex?.description ?? '')
    setFScope(ex?.scope ?? 'company')
    setFProjectId(ex?.project_id ?? '')
    setFClientId(ex?.client_id ?? '')
    setShowModal(true)
  }

  const closeModal = () => { setShowModal(false); setEditing(null) }

  const handleSave = async () => {
    if (!fAmount || isNaN(Number(fAmount))) { alert('Valid amount required'); return }
    if (fScope === 'project' && !fProjectId) { alert('Please select a project'); return }
    if (fScope === 'client' && !fClientId) { alert('Please select a client'); return }
    setSaving(true)
    const payload = {
      month: fMonth,
      category: fCategory,
      amount: Number(fAmount),
      description: fDescription.trim() || null,
      scope: fScope,
      project_id: fScope === 'project' ? fProjectId : null,
      client_id: fScope === 'client' ? fClientId : null,
      updated_at: new Date().toISOString(),
    }
    if (editing) {
      const { error } = await supabase.from('pm_expenses').update(payload).eq('id', editing.id)
      if (error) { alert(error.message); setSaving(false); return }
      await logActivity('UPDATE', 'Profitability Expenses', `Updated expense: ${fCategory} ${fmt(Number(fAmount))} for ${fMonth}`, payload)
    } else {
      const { error } = await supabase.from('pm_expenses').insert(payload)
      if (error) { alert(error.message); setSaving(false); return }
      await logActivity('CREATE', 'Profitability Expenses', `Added expense: ${fCategory} ${fmt(Number(fAmount))} for ${fMonth}`, payload)
    }
    setSaving(false)
    closeModal()
    await loadAll()
  }

  const handleDelete = async (ex: PmExpense) => {
    if (!confirm(`Delete this ${ex.category} expense of ${fmt(ex.amount)}?`)) return
    await supabase.from('pm_expenses').delete().eq('id', ex.id)
    await logActivity('DELETE', 'Profitability Expenses', `Deleted expense: ${ex.category} ${fmt(ex.amount)} for ${ex.month}`, { id: ex.id })
    await loadAll()
  }

  const projectName = (id?: string | null) => projects.find(p => p.id === id)?.name ?? '-'
  const clientName = (id?: string | null) => clients.find(c => c.id === id)?.name ?? '-'
  const scopeLabel = (ex: PmExpense) => {
    if (ex.scope === 'project') return projectName(ex.project_id)
    if (ex.scope === 'client') return clientName(ex.client_id)
    return 'Company-wide'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Operating Expenses</h2>
          <p className="text-sm text-gray-600">Track project, client, and company-wide operating costs</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary">+ Add Expense</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Month</label>
          <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="input-field" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Scope</label>
          <select value={filterScope} onChange={e => setFilterScope(e.target.value as '' | PmExpense['scope'])} className="input-field">
            <option value="">All scopes</option>
            <option value="project">Project</option>
            <option value="client">Client</option>
            <option value="company">Company</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Project</label>
          <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="input-field">
            <option value="">All projects</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Client</label>
          <select value={filterClient} onChange={e => setFilterClient(e.target.value)} className="input-field">
            <option value="">All clients</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {(filterMonth || filterScope || filterProject || filterClient) && (
          <div className="flex items-end">
            <button onClick={() => { setFilterMonth(currentMonth()); setFilterScope(''); setFilterProject(''); setFilterClient('') }} className="btn-secondary text-xs">Clear Filters</button>
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Month', 'Category', 'Description', 'Amount', 'Scope', 'Project / Client', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">No expenses found for the selected filters.</td></tr>
              ) : filtered.map(ex => (
                <tr key={ex.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-700">{ex.month}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 capitalize">{ex.category}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{ex.description || '-'}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{fmt(ex.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${ex.scope === 'project' ? 'bg-purple-100 text-purple-700' : ex.scope === 'client' ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-600'}`}>
                      {ex.scope}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{scopeLabel(ex)}</td>
                  <td className="px-4 py-3 text-sm">
                    <button onClick={() => openModal(ex)} className="mr-3 text-blue-600 hover:underline">Edit</button>
                    <button onClick={() => handleDelete(ex)} className="text-red-600 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Category Totals */}
      {!loading && filtered.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-lg p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Category Totals</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {CATEGORIES.map(cat => (
              <div key={cat} className="rounded-lg bg-gray-50 p-3 border border-gray-100">
                <p className="text-xs font-medium text-gray-500 capitalize">{cat}</p>
                <p className="text-lg font-bold text-gray-900 mt-1">{fmt(categoryTotals[cat] ?? 0)}</p>
              </div>
            ))}
            <div className="rounded-lg bg-blue-50 p-3 border border-blue-200 col-span-2 sm:col-span-1">
              <p className="text-xs font-medium text-blue-600">Total</p>
              <p className="text-lg font-bold text-blue-700 mt-1">
                {fmt(filtered.reduce((s, ex) => s + ex.amount, 0))}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-6">
              <h3 className="text-xl font-bold">{editing ? 'Edit Expense' : 'Add Expense'}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Month *</label>
                  <input type="month" value={fMonth} onChange={e => setFMonth(e.target.value)} className="input-field w-full" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Category *</label>
                  <select value={fCategory} onChange={e => setFCategory(e.target.value as PmExpense['category'])} className="input-field w-full">
                    {CATEGORIES.map(c => <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Amount (₱) *</label>
                  <input type="number" min="0" step="0.01" value={fAmount} onChange={e => setFAmount(e.target.value)} className="input-field w-full" placeholder="0.00" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Scope *</label>
                  <select value={fScope} onChange={e => { setFScope(e.target.value as PmExpense['scope']); setFProjectId(''); setFClientId('') }} className="input-field w-full">
                    <option value="company">Company-wide</option>
                    <option value="project">Project</option>
                    <option value="client">Client</option>
                  </select>
                </div>
              </div>
              {fScope === 'project' && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Project *</label>
                  <select value={fProjectId} onChange={e => setFProjectId(e.target.value)} className="input-field w-full">
                    <option value="">Select project...</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              {fScope === 'client' && (
                <div>
                  <label className="mb-1 block text-sm font-medium">Client *</label>
                  <select value={fClientId} onChange={e => setFClientId(e.target.value)} className="input-field w-full">
                    <option value="">Select client...</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium">Description</label>
                <textarea value={fDescription} onChange={e => setFDescription(e.target.value)} rows={2} className="input-field w-full" placeholder="Optional description..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t p-6">
              <button onClick={closeModal} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editing ? 'Update' : 'Add Expense'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
