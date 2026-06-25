import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { PmClient, PmProject } from '@/types'

const fmt = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (d?: string | null) => {
  if (!d) return '-'
  const dt = new Date(d)
  return `${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}-${dt.getFullYear()}`
}

export default function ProfitabilityClients() {
  const [clients, setClients] = useState<PmClient[]>([])
  const [projects, setProjects] = useState<PmProject[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'clients'|'projects'>('clients')

  // Client form
  const [showClientModal, setShowClientModal] = useState(false)
  const [editingClient, setEditingClient] = useState<PmClient | null>(null)
  const [cName, setCName] = useState('')
  const [cStart, setCStart] = useState('')
  const [cMonthlyRev, setCMonthlyRev] = useState('')
  const [cContractVal, setCContractVal] = useState('')
  const [cStatus, setCStatus] = useState<'active'|'inactive'>('active')
  const [cNotes, setCNotes] = useState('')

  // Project form
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [editingProject, setEditingProject] = useState<PmProject | null>(null)
  const [pClientId, setPClientId] = useState('')
  const [pName, setPName] = useState('')
  const [pStart, setPStart] = useState('')
  const [pEnd, setPEnd] = useState('')
  const [pStatus, setPStatus] = useState<'active'|'inactive'|'completed'>('active')
  const [pTarget, setPTarget] = useState('')
  const [pNotes, setPNotes] = useState('')

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    const [c, p] = await Promise.all([
      supabase.from('pm_clients').select('*').order('name'),
      supabase.from('pm_projects').select('*').order('name'),
    ])
    setClients((c.data ?? []) as PmClient[])
    setProjects((p.data ?? []) as PmProject[])
    setLoading(false)
  }

  const openClientModal = (c?: PmClient) => {
    setEditingClient(c ?? null)
    setCName(c?.name ?? ''); setCStart(c?.contract_start_date ?? ''); setCMonthlyRev(c?.monthly_revenue?.toString() ?? '0')
    setCContractVal(c?.contract_value?.toString() ?? '0'); setCStatus(c?.status ?? 'active'); setCNotes(c?.notes ?? '')
    setShowClientModal(true)
  }

  const saveClient = async () => {
    if (!cName.trim()) { alert('Client name required'); return }
    const payload = { name: cName.trim(), contract_start_date: cStart||null, monthly_revenue: Number(cMonthlyRev)||0, contract_value: Number(cContractVal)||0, status: cStatus, notes: cNotes.trim()||null, updated_at: new Date().toISOString() }
    if (editingClient) {
      const { error } = await supabase.from('pm_clients').update(payload).eq('id', editingClient.id)
      if (error) { alert(error.message); return }
    } else {
      const { error } = await supabase.from('pm_clients').insert(payload)
      if (error) { alert(error.message); return }
    }
    setShowClientModal(false); await loadAll()
  }

  const deleteClient = async (id: string) => {
    if (!confirm('Delete this client and all its projects?')) return
    await supabase.from('pm_clients').delete().eq('id', id); await loadAll()
  }

  const openProjectModal = (p?: PmProject, clientId?: string) => {
    setEditingProject(p ?? null)
    setPClientId(p?.client_id ?? clientId ?? ''); setPName(p?.name ?? ''); setPStart(p?.start_date ?? '')
    setPEnd(p?.end_date ?? ''); setPStatus(p?.status ?? 'active'); setPTarget(p?.monthly_revenue_target?.toString() ?? '0'); setPNotes(p?.notes ?? '')
    setShowProjectModal(true)
  }

  const saveProject = async () => {
    if (!pName.trim() || !pClientId) { alert('Project name and client required'); return }
    const payload = { client_id: pClientId, name: pName.trim(), start_date: pStart||null, end_date: pEnd||null, status: pStatus, monthly_revenue_target: Number(pTarget)||0, notes: pNotes.trim()||null, updated_at: new Date().toISOString() }
    if (editingProject) {
      const { error } = await supabase.from('pm_projects').update(payload).eq('id', editingProject.id)
      if (error) { alert(error.message); return }
    } else {
      const { error } = await supabase.from('pm_projects').insert(payload)
      if (error) { alert(error.message); return }
    }
    setShowProjectModal(false); await loadAll()
  }

  const deleteProject = async (id: string) => {
    if (!confirm('Delete this project?')) return
    await supabase.from('pm_projects').delete().eq('id', id); await loadAll()
  }

  const clientName = (id: string) => clients.find(c => c.id === id)?.name ?? '-'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Clients & Projects</h2>
          <p className="text-sm text-gray-600">Manage clients and their associated projects</p>
        </div>
        <button onClick={() => tab === 'clients' ? openClientModal() : openProjectModal()} className="btn-primary">
          + {tab === 'clients' ? 'Add Client' : 'Add Project'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['clients','projects'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}>
            {t.charAt(0).toUpperCase()+t.slice(1)} ({t === 'clients' ? clients.length : projects.length})
          </button>
        ))}
      </div>

      {loading ? <p className="text-sm text-gray-500">Loading...</p> : tab === 'clients' ? (
        <div className="rounded-xl border border-gray-200 bg-white shadow-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Client Name','Contract Start','Monthly Revenue','Contract Value','Projects','Status','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {clients.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">No clients yet. Add your first client!</td></tr>
              ) : clients.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{fmtDate(c.contract_start_date)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{fmt(c.monthly_revenue)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{fmt(c.contract_value)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{projects.filter(p => p.client_id === c.id).length}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{c.status}</span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <button onClick={() => openClientModal(c)} className="mr-2 text-blue-600 hover:underline">Edit</button>
                    <button onClick={() => openProjectModal(undefined, c.id)} className="mr-2 text-green-600 hover:underline">+ Project</button>
                    <button onClick={() => deleteClient(c.id)} className="text-red-600 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Project','Client','Start','End','Revenue Target','Status','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {projects.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-500">No projects yet.</td></tr>
              ) : projects.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{clientName(p.client_id)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{fmtDate(p.start_date)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{fmtDate(p.end_date)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{fmt(p.monthly_revenue_target)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${p.status === 'active' ? 'bg-green-100 text-green-700' : p.status === 'completed' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{p.status}</span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <button onClick={() => openProjectModal(p)} className="mr-2 text-blue-600 hover:underline">Edit</button>
                    <button onClick={() => deleteProject(p.id)} className="text-red-600 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Client Modal */}
      {showClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-6">
              <h3 className="text-xl font-bold">{editingClient ? 'Edit Client' : 'Add Client'}</h3>
              <button onClick={() => setShowClientModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4 p-6">
              <div><label className="mb-1 block text-sm font-medium">Client Name *</label>
                <input value={cName} onChange={e => setCName(e.target.value)} className="input-field w-full" placeholder="Client name" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1 block text-sm font-medium">Contract Start</label>
                  <input type="date" value={cStart} onChange={e => setCStart(e.target.value)} className="input-field w-full" /></div>
                <div><label className="mb-1 block text-sm font-medium">Status</label>
                  <select value={cStatus} onChange={e => setCStatus(e.target.value as 'active'|'inactive')} className="input-field w-full">
                    <option value="active">Active</option><option value="inactive">Inactive</option>
                  </select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1 block text-sm font-medium">Monthly Revenue (₱)</label>
                  <input type="number" value={cMonthlyRev} onChange={e => setCMonthlyRev(e.target.value)} className="input-field w-full" /></div>
                <div><label className="mb-1 block text-sm font-medium">Contract Value (₱)</label>
                  <input type="number" value={cContractVal} onChange={e => setCContractVal(e.target.value)} className="input-field w-full" /></div>
              </div>
              <div><label className="mb-1 block text-sm font-medium">Notes</label>
                <textarea value={cNotes} onChange={e => setCNotes(e.target.value)} rows={2} className="input-field w-full" /></div>
            </div>
            <div className="flex justify-end gap-3 border-t p-6">
              <button onClick={() => setShowClientModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveClient} className="btn-primary">{editingClient ? 'Update' : 'Add Client'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-6">
              <h3 className="text-xl font-bold">{editingProject ? 'Edit Project' : 'Add Project'}</h3>
              <button onClick={() => setShowProjectModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4 p-6">
              <div><label className="mb-1 block text-sm font-medium">Client *</label>
                <select value={pClientId} onChange={e => setPClientId(e.target.value)} className="input-field w-full">
                  <option value="">Select client...</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select></div>
              <div><label className="mb-1 block text-sm font-medium">Project Name *</label>
                <input value={pName} onChange={e => setPName(e.target.value)} className="input-field w-full" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1 block text-sm font-medium">Start Date</label>
                  <input type="date" value={pStart} onChange={e => setPStart(e.target.value)} className="input-field w-full" /></div>
                <div><label className="mb-1 block text-sm font-medium">End Date</label>
                  <input type="date" value={pEnd} onChange={e => setPEnd(e.target.value)} className="input-field w-full" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1 block text-sm font-medium">Monthly Rev Target (₱)</label>
                  <input type="number" value={pTarget} onChange={e => setPTarget(e.target.value)} className="input-field w-full" /></div>
                <div><label className="mb-1 block text-sm font-medium">Status</label>
                  <select value={pStatus} onChange={e => setPStatus(e.target.value as 'active'|'inactive'|'completed')} className="input-field w-full">
                    <option value="active">Active</option><option value="inactive">Inactive</option><option value="completed">Completed</option>
                  </select></div>
              </div>
              <div><label className="mb-1 block text-sm font-medium">Notes</label>
                <textarea value={pNotes} onChange={e => setPNotes(e.target.value)} rows={2} className="input-field w-full" /></div>
            </div>
            <div className="flex justify-end gap-3 border-t p-6">
              <button onClick={() => setShowProjectModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveProject} className="btn-primary">{editingProject ? 'Update' : 'Add Project'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
