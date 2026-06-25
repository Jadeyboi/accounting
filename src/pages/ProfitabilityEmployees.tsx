import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { PmEmployeeCost, PmProject, PmClient, Employee } from '@/types'

const fmt = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const currentMonth = () => new Date().toISOString().slice(0, 7)
const totalCost = (e: PmEmployeeCost) =>
  e.basic_salary + e.sss + e.philhealth + e.pagibig + e.ot_pay + e.night_differential + e.incentives + e.other_costs

export default function ProfitabilityEmployees() {
  const [employees, setEmployees] = useState<PmEmployeeCost[]>([])
  const [projects, setProjects] = useState<PmProject[]>([])
  const [clients, setClients] = useState<PmClient[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())
  const [filterProject, setFilterProject] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<PmEmployeeCost | null>(null)

  // HRIS Import state
  const [showImportModal, setShowImportModal] = useState(false)
  const [hrisEmployees, setHrisEmployees] = useState<Employee[]>([])
  const [importProject, setImportProject] = useState('')
  const [importMonth, setImportMonth] = useState(currentMonth())
  const [selectedHrisIds, setSelectedHrisIds] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  // Per-employee overrides during import
  const [importOverrides, setImportOverrides] = useState<Record<string, { sss: string; philhealth: string; pagibig: string; ot: string; nd: string; incentives: string; other: string }>>({})

  // Form
  const [fProject, setFProject] = useState('')
  const [fMonth, setFMonth] = useState(currentMonth())
  const [fName, setFName] = useState('')
  const [fPosition, setFPosition] = useState('')
  const [fSalary, setFSalary] = useState('')
  const [fSSS, setFSSS] = useState('')
  const [fPhilHealth, setFPhilHealth] = useState('')
  const [fPagibig, setFPagibig] = useState('')
  const [fOT, setFOT] = useState('')
  const [fND, setFND] = useState('')
  const [fIncentives, setFIncentives] = useState('')
  const [fOther, setFOther] = useState('')

  useEffect(() => { loadAll() }, [])

  const loadAll = async () => {
    setLoading(true)
    const [e, p, c] = await Promise.all([
      supabase.from('pm_employee_costs').select('*').order('employee_name'),
      supabase.from('pm_projects').select('*').order('name'),
      supabase.from('pm_clients').select('*').order('name'),
    ])
    setEmployees((e.data ?? []) as PmEmployeeCost[])
    setProjects((p.data ?? []) as PmProject[])
    setClients((c.data ?? []) as PmClient[])
    setLoading(false)
  }

  const openImportModal = async () => {
    setImportProject('')
    setImportMonth(selectedMonth)
    setSelectedHrisIds(new Set())
    setImportOverrides({})
    setShowImportModal(true)
    // Load HRIS active employees
    const { data } = await supabase
      .from('employees')
      .select('*')
      .neq('status', 'terminated')
      .order('name')
    setHrisEmployees((data ?? []) as Employee[])
  }

  const toggleHrisEmployee = (id: string, emp: Employee) => {
    setSelectedHrisIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        // Pre-fill overrides with 0 for new selections
        if (!importOverrides[id]) {
          setImportOverrides(o => ({
            ...o,
            [id]: { sss: '0', philhealth: '0', pagibig: '0', ot: '0', nd: '0', incentives: '0', other: '0' }
          }))
        }
      }
      return next
    })
  }

  const updateOverride = (id: string, field: string, value: string) => {
    setImportOverrides(o => ({ ...o, [id]: { ...o[id], [field]: value } }))
  }

  const handleImport = async () => {
    if (!importProject) { alert('Please select a project'); return }
    if (selectedHrisIds.size === 0) { alert('Select at least one employee'); return }
    setImporting(true)
    const records = Array.from(selectedHrisIds).map(id => {
      const emp = hrisEmployees.find(e => e.id === id)!
      const ov = importOverrides[id] ?? {}
      return {
        project_id: importProject,
        month: importMonth,
        employee_name: emp.name,
        position: emp.position ?? null,
        basic_salary: emp.base_salary ?? 0,
        sss: Number(ov.sss ?? 0),
        philhealth: Number(ov.philhealth ?? 0),
        pagibig: Number(ov.pagibig ?? 0),
        ot_pay: Number(ov.ot ?? 0),
        night_differential: Number(ov.nd ?? 0),
        incentives: Number(ov.incentives ?? 0),
        other_costs: Number(ov.other ?? 0),
        updated_at: new Date().toISOString(),
      }
    })
    const { error } = await supabase.from('pm_employee_costs').insert(records)
    setImporting(false)
    if (error) { alert(error.message); return }
    setShowImportModal(false)
    setSelectedMonth(importMonth)
    await loadAll()
  }

  const filtered = useMemo(() => employees.filter(e => {
    const mMatch = e.month === selectedMonth
    const pMatch = filterProject === 'all' || e.project_id === filterProject
    return mMatch && pMatch
  }), [employees, selectedMonth, filterProject])

  const projectName = (id: string) => {
    const p = projects.find(x => x.id === id)
    if (!p) return '-'
    const c = clients.find(x => x.id === p.client_id)
    return c ? `${p.name} (${c.name})` : p.name
  }

  const openModal = (e?: PmEmployeeCost) => {
    setEditing(e ?? null)
    setFProject(e?.project_id ?? ''); setFMonth(e?.month ?? selectedMonth)
    setFName(e?.employee_name ?? ''); setFPosition(e?.position ?? '')
    setFSalary(e?.basic_salary?.toString() ?? '0'); setFSSS(e?.sss?.toString() ?? '0')
    setFPhilHealth(e?.philhealth?.toString() ?? '0'); setFPagibig(e?.pagibig?.toString() ?? '0')
    setFOT(e?.ot_pay?.toString() ?? '0'); setFND(e?.night_differential?.toString() ?? '0')
    setFIncentives(e?.incentives?.toString() ?? '0'); setFOther(e?.other_costs?.toString() ?? '0')
    setShowModal(true)
  }

  const save = async () => {
    if (!fName.trim() || !fProject || !fMonth) { alert('Name, project, and month required'); return }
    const payload = {
      project_id: fProject, month: fMonth, employee_name: fName.trim(), position: fPosition.trim()||null,
      basic_salary: Number(fSalary)||0, sss: Number(fSSS)||0, philhealth: Number(fPhilHealth)||0,
      pagibig: Number(fPagibig)||0, ot_pay: Number(fOT)||0, night_differential: Number(fND)||0,
      incentives: Number(fIncentives)||0, other_costs: Number(fOther)||0, updated_at: new Date().toISOString()
    }
    if (editing) {
      const { error } = await supabase.from('pm_employee_costs').update(payload).eq('id', editing.id)
      if (error) { alert(error.message); return }
    } else {
      const { error } = await supabase.from('pm_employee_costs').insert(payload)
      if (error) { alert(error.message); return }
    }
    setShowModal(false); await loadAll()
  }

  const del = async (id: string) => {
    if (!confirm('Delete this employee cost record?')) return
    await supabase.from('pm_employee_costs').delete().eq('id', id); await loadAll()
  }

  const liveTotal = Number(fSalary||0) + Number(fSSS||0) + Number(fPhilHealth||0) + Number(fPagibig||0) +
    Number(fOT||0) + Number(fND||0) + Number(fIncentives||0) + Number(fOther||0)

  const monthTotal = filtered.reduce((s, e) => s + totalCost(e), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Employee Costs</h2>
          <p className="text-sm text-gray-600">Monthly payroll costs per project</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openImportModal} className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700">
            ↓ Import from HRIS
          </button>
          <button onClick={() => openModal()} className="btn-primary">+ Add Manually</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Month:</label>
          <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="rounded-lg border-gray-300 px-3 py-1.5 text-sm" />
        </div>
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} className="rounded-lg border-gray-300 px-3 py-1.5 text-sm">
          <option value="all">All Projects</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-gray-600">Total Cost ({selectedMonth}):</span>
          <span className="text-sm font-bold text-red-700">{fmt(monthTotal)}</span>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Employee','Position','Project','Month','Salary','SSS','PhilHealth','Pag-IBIG','OT','Night Diff','Incentives','Other','Total Cost','Actions'].map(h => (
                <th key={h} className="px-3 py-3 text-left text-xs font-semibold uppercase text-gray-600 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? <tr><td colSpan={14} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            : filtered.length === 0 ? <tr><td colSpan={14} className="px-4 py-8 text-center text-gray-500">No records for {selectedMonth}.</td></tr>
            : filtered.map(e => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-900">{e.employee_name}</td>
                <td className="px-3 py-2 text-gray-600">{e.position || '-'}</td>
                <td className="px-3 py-2 text-gray-600">{projectName(e.project_id)}</td>
                <td className="px-3 py-2 text-gray-600">{e.month}</td>
                <td className="px-3 py-2 text-right">{fmt(e.basic_salary)}</td>
                <td className="px-3 py-2 text-right">{fmt(e.sss)}</td>
                <td className="px-3 py-2 text-right">{fmt(e.philhealth)}</td>
                <td className="px-3 py-2 text-right">{fmt(e.pagibig)}</td>
                <td className="px-3 py-2 text-right">{fmt(e.ot_pay)}</td>
                <td className="px-3 py-2 text-right">{fmt(e.night_differential)}</td>
                <td className="px-3 py-2 text-right">{fmt(e.incentives)}</td>
                <td className="px-3 py-2 text-right">{fmt(e.other_costs)}</td>
                <td className="px-3 py-2 text-right font-bold text-red-700">{fmt(totalCost(e))}</td>
                <td className="px-3 py-2">
                  <button onClick={() => openModal(e)} className="mr-2 text-blue-600 hover:underline">Edit</button>
                  <button onClick={() => del(e.id)} className="text-red-600 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-6">
              <h3 className="text-xl font-bold">{editing ? 'Edit' : 'Add'} Employee Cost</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1 block text-sm font-medium">Month *</label>
                  <input type="month" value={fMonth} onChange={e => setFMonth(e.target.value)} className="input-field w-full" /></div>
                <div><label className="mb-1 block text-sm font-medium">Project *</label>
                  <select value={fProject} onChange={e => setFProject(e.target.value)} className="input-field w-full">
                    <option value="">Select project...</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1 block text-sm font-medium">Employee Name *</label>
                  <input value={fName} onChange={e => setFName(e.target.value)} className="input-field w-full" /></div>
                <div><label className="mb-1 block text-sm font-medium">Position</label>
                  <input value={fPosition} onChange={e => setFPosition(e.target.value)} className="input-field w-full" /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[['Basic Salary',fSalary,setFSalary],['SSS',fSSS,setFSSS],['PhilHealth',fPhilHealth,setFPhilHealth],
                  ['Pag-IBIG',fPagibig,setFPagibig],['OT Pay',fOT,setFOT],['Night Differential',fND,setFND],
                  ['Incentives',fIncentives,setFIncentives],['Other Costs',fOther,setFOther]
                ].map(([label, val, setter]) => (
                  <div key={label as string}><label className="mb-1 block text-sm font-medium">{label as string} (₱)</label>
                    <input type="number" min="0" step="0.01" value={val as string} onChange={e => (setter as Function)(e.target.value)} className="input-field w-full" /></div>
                ))}
              </div>
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-center">
                <span className="text-sm text-blue-700 font-medium">Total Cost: </span>
                <span className="text-lg font-bold text-blue-900">{fmt(liveTotal)}</span>
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t p-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={save} className="btn-primary">{editing ? 'Update' : 'Add'}</button>
            </div>
          </div>
        </div>
      )}

      {/* HRIS Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Import Employees from HRIS</h3>
                <p className="text-sm text-gray-500 mt-0.5">Select employees and assign them to a project. Base salary is auto-filled.</p>
              </div>
              <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Project *</label>
                  <select value={importProject} onChange={e => setImportProject(e.target.value)} className="input-field w-full">
                    <option value="">Select project...</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Month *</label>
                  <input type="month" value={importMonth} onChange={e => setImportMonth(e.target.value)} className="input-field w-full" />
                </div>
              </div>

              {hrisEmployees.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">No active employees found in HRIS.</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-700">{hrisEmployees.length} active employees — select to import:</p>
                    <button
                      onClick={() => {
                        if (selectedHrisIds.size === hrisEmployees.length) {
                          setSelectedHrisIds(new Set())
                        } else {
                          const all = new Set(hrisEmployees.map(e => e.id))
                          setSelectedHrisIds(all)
                          const overrides: typeof importOverrides = {}
                          hrisEmployees.forEach(e => {
                            if (!importOverrides[e.id]) overrides[e.id] = { sss: '0', philhealth: '0', pagibig: '0', ot: '0', nd: '0', incentives: '0', other: '0' }
                          })
                          setImportOverrides(o => ({ ...o, ...overrides }))
                        }
                      }}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {selectedHrisIds.size === hrisEmployees.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  {hrisEmployees.map(emp => {
                    const selected = selectedHrisIds.has(emp.id)
                    const ov = importOverrides[emp.id]
                    return (
                      <div key={emp.id} className={`rounded-lg border p-3 transition-colors ${selected ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-white'}`}>
                        <div className="flex items-center gap-3 mb-2">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleHrisEmployee(emp.id, emp)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600"
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-gray-900">{emp.name}</span>
                            <span className="ml-2 text-xs text-gray-500">{emp.position ?? ''}</span>
                          </div>
                          <span className="text-sm font-medium text-gray-700">{emp.base_salary ? fmt(emp.base_salary) : 'No salary'}</span>
                        </div>
                        {selected && ov && (
                          <div className="grid grid-cols-4 gap-2 ml-7 mt-2">
                            {[['SSS','sss'],['PhilHealth','philhealth'],['Pag-IBIG','pagibig'],['OT Pay','ot'],['Night Diff','nd'],['Incentives','incentives'],['Other','other']].map(([label, field]) => (
                              <div key={field}>
                                <label className="text-xs text-gray-500">{label}</label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={ov[field as keyof typeof ov]}
                                  onChange={e => updateOverride(emp.id, field, e.target.value)}
                                  className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="sticky bottom-0 flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-4">
              <span className="text-sm text-gray-600">{selectedHrisIds.size} employee(s) selected</span>
              <div className="flex gap-3">
                <button onClick={() => setShowImportModal(false)} className="btn-secondary">Cancel</button>
                <button
                  onClick={handleImport}
                  disabled={importing || selectedHrisIds.size === 0 || !importProject}
                  className="btn-primary disabled:opacity-50"
                >
                  {importing ? 'Importing...' : `Import ${selectedHrisIds.size} Employee(s)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
