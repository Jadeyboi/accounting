import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { PmEmployeeCost, PmProject, PmClient } from '@/types'

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
        <button onClick={() => openModal()} className="btn-primary">+ Add Employee Cost</button>
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
    </div>
  )
}
