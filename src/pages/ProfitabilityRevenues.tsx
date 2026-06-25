import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLogger'
import type { PmClient, PmProject, PmRevenue } from '@/types'

const fmt = (n: number) =>
  `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function ProfitabilityRevenues() {
  const [revenues, setRevenues] = useState<PmRevenue[]>([])
  const [clients, setClients] = useState<PmClient[]>([])
  const [projects, setProjects] = useState<PmProject[]>([])
  const [loading, setLoading] = useState(true)

  const [filterMonth, setFilterMonth] = useState(currentMonth())

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<PmRevenue | null>(null)
  const [fMonth, setFMonth] = useState(currentMonth())
  const [fProjectId, setFProjectId] = useState('')
  const [fClientId, setFClientId] = useState('')
  const [fAmount, setFAmount] = useState('')
  const [fNotes, setFNotes] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    const [r, c, p] = await Promise.all([
      supabase.from('pm_revenues').select('*').order('month', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('pm_clients').select('*').order('name'),
      supabase.from('pm_projects').select('*').order('name'),
    ])
    setRevenues((r.data ?? []) as PmRevenue[])
    setClients((c.data ?? []) as PmClient[])
    setProjects((p.data ?? []) as PmProject[])
    setLoading(false)
  }

  const filtered = useMemo(() =>
    revenues.filter(r => !filterMonth || r.month === filterMonth),
    [revenues, filterMonth]
  )

  const openModal = (r?: PmRevenue) => {
    setEditing(r ?? null)
    setFMonth(r?.month ?? filterMonth ?? currentMonth())
    setFProjectId(r?.project_id ?? '')
    setFClientId(r?.client_id ?? '')
    setFAmount(r?.amount?.toString() ?? '')
    setFNotes(r?.notes ?? '')
    setShowModal(true)
  }

  const closeModal = () => { setShowModal(false); setEditing(null) }

  const handleProjectChange = (projectId: string) => {
    setFProjectId(projectId)
    const proj = projects.find(p => p.id === projectId)
    if (proj) setFClientId(proj.client_id)
  }

  const handleSave = async () => {
    if (!fProjectId) { alert('Please select a project'); return }
    if (!fAmount || isNaN(Number(fAmount))) { alert('Valid amount required'); return }
    if (!fClientId) { alert('Unable to determine client from project'); return }
    setSaving(true)
    const payload = {
      project_id: fProjectId,
      client_id: fClientId,
      month: fMonth,
      amount: Number(fAmount),
      notes: fNotes.trim() || null,
    }
    if (editing) {
      const { error } = await supabase.from('pm_revenues').update(payload).eq('id', editing.id)
      if (error) { alert(error.message); setSaving(false); return }
      await logActivity('UPDATE', 'Profitability Revenues', `Updated revenue: ${fmt(Number(fAmount))} for project ${projects.find(p => p.id === fProjectId)?.name ?? fProjectId} - ${fMonth}`, payload)
    } else {
      const { error } = await supabase.from('pm_revenues').insert(payload)
      if (error) { alert(error.message); setSaving(false); return }
      await logActivity('CREATE', 'Profitability Revenues', `Added revenue: ${fmt(Number(fAmount))} for project ${projects.find(p => p.id === fProjectId)?.name ?? fProjectId} - ${fMonth}`, payload)
    }
    setSaving(false)
    closeModal()
    await loadAll()
  }

  const handleDelete = async (r: PmRevenue) => {
    if (!confirm(`Delete revenue of ${fmt(r.amount)} for ${r.month}?`)) return
    await supabase.from('pm_revenues').delete().eq('id', r.id)
    await logActivity('DELETE', 'Profitability Revenues', `Deleted revenue: ${fmt(r.amount)} for ${r.month}`, { id: r.id })
    await loadAll()
  }

  const projectName = (id: string) => projects.find(p => p.id === id)?.name ?? '-'
  const clientName = (id: string) => clients.find(c => c.id === id)?.name ?? '-'
  const targetRevenue = (projectId: string) => projects.find(p => p.id === projectId)?.monthly_revenue_target ?? 0

  const totalRevenue = useMemo(() => filtered.reduce((s, r) => s + r.amount, 0), [filtered])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Monthly Revenues</h2>
          <p className="text-sm text-gray-600">Record actual revenue per project per month</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary">+ Add Revenue</button>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Month</label>
          <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="input-field" />
        </div>
        {filterMonth && (
          <button onClick={() => setFilterMonth('')} className="btn-secondary text-xs">Show All</button>
        )}
      </div>

      {/* Summary */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="rounded-xl p-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
            <p className="text-xs font-medium opacity-80">Total Revenue</p>
            <p className="text-xl font-bold mt-1">{fmt(totalRevenue)}</p>
          </div>
          <div className="rounded-xl p-4 bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg">
            <p className="text-xs font-medium opacity-80">Entries</p>
            <p className="text-xl font-bold mt-1">{filtered.length}</p>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Month', 'Project', 'Client', 'Actual Revenue', 'Target Revenue', 'Variance', 'Notes', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">No revenues for this month. Add one!</td></tr>
              ) : filtered.map(r => {
                const target = targetRevenue(r.project_id)
                const variance = r.amount - target
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">{r.month}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{projectName(r.project_id)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{clientName(r.client_id)}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">{fmt(r.amount)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{target > 0 ? fmt(target) : '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      {target > 0 ? (
                        <span className={`font-semibold ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {variance >= 0 ? '+' : ''}{fmt(variance)}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">{r.notes || '-'}</td>
                    <td className="px-4 py-3 text-sm">
                      <button onClick={() => openModal(r)} className="mr-3 text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => handleDelete(r)} className="text-red-600 hover:underline">Delete</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-6">
              <h3 className="text-xl font-bold">{editing ? 'Edit Revenue' : 'Add Revenue'}</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Month *</label>
                  <input type="month" value={fMonth} onChange={e => setFMonth(e.target.value)} className="input-field w-full" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Amount (₱) *</label>
                  <input type="number" min="0" step="0.01" value={fAmount} onChange={e => setFAmount(e.target.value)} className="input-field w-full" placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Project *</label>
                <select value={fProjectId} onChange={e => handleProjectChange(e.target.value)} className="input-field w-full">
                  <option value="">Select project...</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              {fClientId && (
                <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-700">
                  Client: <strong>{clientName(fClientId)}</strong>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium">Notes</label>
                <textarea value={fNotes} onChange={e => setFNotes(e.target.value)} rows={2} className="input-field w-full" placeholder="Optional notes..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t p-6">
              <button onClick={closeModal} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editing ? 'Update' : 'Add Revenue'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
