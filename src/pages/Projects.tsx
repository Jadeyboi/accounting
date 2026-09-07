import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLogger'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { Project, ProjectStatus } from '@/types'
import ProjectTransactionsTab from '@/pages/ProjectTransactionsTab'
import SharedExpensesTab from '@/pages/SharedExpensesTab'
import ProjectRosterTab from '@/pages/ProjectRosterTab'

const STATUS_OPTS: { key: ProjectStatus; label: string }[] = [
  { key: 'active', label: 'Active' },
  { key: 'on_hold', label: 'On Hold' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
]
const STATUS_STYLE: Record<ProjectStatus, string> = {
  active: 'bg-green-100 text-green-700',
  on_hold: 'bg-amber-100 text-amber-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
}
const CURRENCIES = ['PHP', 'USD', 'EUR', 'GBP', 'AUD', 'SGD']

const money = (n: number, cur = 'PHP') => {
  const sym = cur === 'PHP' ? '₱' : cur === 'USD' ? '$' : `${cur} `
  return `${sym}${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface PreviewRow { department: string; employee_count: number; project_exists: boolean }

export default function Projects() {
  const { isAdminOrHR, currentUser } = useCurrentUser()
  const isAdmin = currentUser?.role === 'super_admin' || currentUser?.role === 'admin'

  const [tab, setTab] = useState<'projects' | 'roster' | 'transactions' | 'shared'>('projects')
  const [projects, setProjects] = useState<Project[]>([])
  const [assignmentCounts, setAssignmentCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [showArchived, setShowArchived] = useState(false)

  // Modal
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [form, setForm] = useState<Partial<Project>>({})
  const [saving, setSaving] = useState(false)

  // Migration
  const [showMigration, setShowMigration] = useState(false)
  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [migrating, setMigrating] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
    setProjects((data ?? []) as Project[])
    // count current (open) assignments per project
    const { data: asgs } = await supabase.from('employee_project_assignments').select('project_id').is('end_date', null)
    const counts: Record<string, number> = {}
    for (const a of (asgs ?? []) as { project_id: string }[]) counts[a.project_id] = (counts[a.project_id] ?? 0) + 1
    setAssignmentCounts(counts)
    setLoading(false)
  }

  const visible = useMemo(
    () => projects.filter(p => showArchived ? true : (p.status !== 'completed' && p.status !== 'cancelled')),
    [projects, showArchived])

  const openModal = (p?: Project) => {
    setEditing(p ?? null)
    setForm(p ? { ...p } : { status: 'active', billing_currency: 'PHP', monthly_billing: 0 })
    setShowModal(true)
  }

  const saveProject = async () => {
    if (!form.name?.trim()) { alert('Project name is required'); return }
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      code: form.code?.trim() || null,
      client_name: form.client_name?.trim() || null,
      project_manager: form.project_manager?.trim() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
      status: form.status || 'active',
      billing_currency: form.billing_currency || 'PHP',
      monthly_billing: Number(form.monthly_billing) || 0,
      notes: form.notes?.trim() || null,
    }
    try {
      if (editing) {
        const { error } = await supabase.from('projects').update(payload).eq('id', editing.id)
        if (error) throw error
        await logActivity('updated', 'Projects', `Updated project: ${payload.name}`, payload)
      } else {
        const { error } = await supabase.from('projects').insert(payload)
        if (error) throw error
        await logActivity('created', 'Projects', `Created project: ${payload.name}`, payload)
      }
      setShowModal(false)
      await load()
    } catch (e: any) {
      alert(e.message || 'Failed to save project')
    } finally { setSaving(false) }
  }

  const setStatus = async (p: Project, status: ProjectStatus) => {
    const verb = status === 'active' ? 'reactivate' : status === 'completed' ? 'complete' : status === 'cancelled' ? 'cancel' : 'put on hold'
    if (!confirm(`Are you sure you want to ${verb} "${p.name}"?`)) return
    const { error } = await supabase.from('projects').update({ status }).eq('id', p.id)
    if (error) { alert(error.message); return }
    await logActivity('updated', 'Projects', `Set project "${p.name}" status to ${status}`)
    await load()
  }

  // ── Migration review ────────────────────────────────────────────────────
  const openMigration = async () => {
    setShowMigration(true)
    const { data, error } = await supabase.rpc('preview_department_migration')
    if (error) { alert('Could not load preview. Did you run projects-phase1-setup.sql?\n\n' + error.message); return }
    setPreview((data ?? []) as PreviewRow[])
  }

  const runMigration = async () => {
    if (!confirm('Run the department → project migration now?\n\nThis creates a project for each department and assigns employees. It does NOT delete department data and can be rolled back.')) return
    setMigrating(true)
    const { data, error } = await supabase.rpc('migrate_departments_to_projects', { p_actor: currentUser?.email || 'system' })
    setMigrating(false)
    if (error) { alert(error.message); return }
    await logActivity('created', 'Projects', `Ran department→project migration`, data)
    alert(`Migration complete.\nProjects created: ${data?.projects_created ?? 0}\nAssignments created: ${data?.assignments_created ?? 0}`)
    setShowMigration(false)
    await load()
  }

  const rollbackMigration = async () => {
    if (!confirm('Roll back the migration? This removes ONLY auto-created projects and their migrated assignments. Department data stays intact.')) return
    setMigrating(true)
    const { data, error } = await supabase.rpc('rollback_department_migration')
    setMigrating(false)
    if (error) { alert(error.message); return }
    await logActivity('deleted', 'Projects', `Rolled back department→project migration`, data)
    alert(`Rollback complete. Projects removed: ${data?.projects_removed ?? 0}`)
    await openMigration()
    await load()
  }

  if (!isAdminOrHR) {
    return <div className="p-8 text-center text-gray-600">You do not have permission to manage projects.</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Projects</h2>
          <p className="text-sm text-gray-600">Central project list for HRIS assignments and project-based financials</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && tab === 'projects' && <button onClick={openMigration} className="btn-secondary">Department Migration</button>}
          {tab === 'projects' && <button onClick={() => openModal()} className="btn-primary">+ New Project</button>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([['projects', 'Projects'], ['roster', 'Roster'], ['transactions', 'Transactions'], ['shared', 'Shared Expenses']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === k ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'roster' && <ProjectRosterTab projects={projects} />}
      {tab === 'transactions' && <ProjectTransactionsTab projects={projects} />}
      {tab === 'shared' && <SharedExpensesTab projects={projects} />}

      {tab === 'projects' && (<>
      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
        Show completed / cancelled
      </label>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-500">Loading...</div>
      ) : visible.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-gray-500">No projects yet.</p>
          <button onClick={() => openModal()} className="mt-4 btn-primary">+ Create your first project</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map(p => (
            <div key={p.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-gray-900 truncate">{p.name}</h3>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_STYLE[p.status]}`}>{STATUS_OPTS.find(s => s.key === p.status)?.label}</span>
                  </div>
                  <p className="text-xs text-gray-500">{p.code || 'No code'} • {p.client_name || 'No client'}</p>
                </div>
              </div>
              <div className="mt-3 space-y-1 text-sm text-gray-600">
                <div className="flex justify-between"><span className="text-gray-400">Manager</span><span>{p.project_manager || '-'}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Monthly Billing</span><span className="font-medium text-gray-900">{money(Number(p.monthly_billing), p.billing_currency)}</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Assigned</span><span>{assignmentCounts[p.id] ?? 0} employee(s)</span></div>
                <div className="flex justify-between"><span className="text-gray-400">Duration</span><span>{p.start_date || '—'} → {p.end_date || 'ongoing'}</span></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-3 border-t border-gray-100 pt-3 text-xs">
                <button onClick={() => openModal(p)} className="text-blue-600 hover:underline">Edit</button>
                {p.status !== 'active' && <button onClick={() => setStatus(p, 'active')} className="text-green-600 hover:underline">Reactivate</button>}
                {p.status === 'active' && <button onClick={() => setStatus(p, 'on_hold')} className="text-amber-600 hover:underline">Put On Hold</button>}
                {p.status !== 'completed' && <button onClick={() => setStatus(p, 'completed')} className="text-blue-600 hover:underline">Complete</button>}
                {p.status !== 'cancelled' && <button onClick={() => setStatus(p, 'cancelled')} className="text-red-600 hover:underline">Cancel</button>}
              </div>
            </div>
          ))}
        </div>
      )}
      </>)}

      {/* Project modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-6">
              <h3 className="text-xl font-bold">{editing ? 'Edit Project' : 'New Project'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-4 p-6">
              <F label="Project Name *"><input value={form.name || ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field w-full" /></F>
              <F label="Project Code"><input value={form.code || ''} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className="input-field w-full" placeholder="e.g. PRJ-001" /></F>
              <F label="Client Name"><input value={form.client_name || ''} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} className="input-field w-full" /></F>
              <F label="Project Manager"><input value={form.project_manager || ''} onChange={e => setForm(f => ({ ...f, project_manager: e.target.value }))} className="input-field w-full" /></F>
              <F label="Start Date"><input type="date" value={form.start_date || ''} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="input-field w-full" /></F>
              <F label="End Date"><input type="date" value={form.end_date || ''} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="input-field w-full" /></F>
              <F label="Status">
                <select value={form.status || 'active'} onChange={e => setForm(f => ({ ...f, status: e.target.value as ProjectStatus }))} className="input-field w-full">
                  {STATUS_OPTS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
              </F>
              <F label="Billing Currency">
                <select value={form.billing_currency || 'PHP'} onChange={e => setForm(f => ({ ...f, billing_currency: e.target.value }))} className="input-field w-full">
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </F>
              <F label="Monthly Client Billing"><input type="number" min="0" step="0.01" value={form.monthly_billing ?? 0} onChange={e => setForm(f => ({ ...f, monthly_billing: Number(e.target.value) || 0 }))} className="input-field w-full" /></F>
              <div className="col-span-2">
                <F label="Notes"><textarea value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className="input-field w-full" /></F>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t p-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveProject} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Migration review */}
      {showMigration && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-6">
              <div>
                <h3 className="text-xl font-bold">Department → Project Migration</h3>
                <p className="text-sm text-gray-500">Review before running. Department data is preserved and this is reversible.</p>
              </div>
              <button onClick={() => setShowMigration(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                For each department below, a project will be created (if it doesn't already exist) and employees will be assigned with an open assignment effective from their hire date. Employees who already have an open assignment are skipped. Nothing is deleted.
              </div>
              {preview.length === 0 ? (
                <p className="text-sm text-gray-500">No department values found to migrate (or preview not loaded).</p>
              ) : (
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Department</th>
                      <th className="px-3 py-2 text-right font-semibold text-gray-600">Employees</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-600">Project</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.map((r, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 text-gray-900">{r.department}</td>
                        <td className="px-3 py-2 text-right">{r.employee_count}</td>
                        <td className="px-3 py-2">{r.project_exists ? <span className="text-green-600">Exists</span> : <span className="text-blue-600">Will be created</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="flex justify-between gap-3 border-t p-6">
              <button onClick={rollbackMigration} disabled={migrating} className="text-sm text-red-600 hover:underline">Roll back migration</button>
              <div className="flex gap-3">
                <button onClick={() => setShowMigration(false)} className="btn-secondary">Close</button>
                <button onClick={runMigration} disabled={migrating || preview.length === 0} className="btn-primary">{migrating ? 'Running...' : 'Run Migration'}</button>
              </div>
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
