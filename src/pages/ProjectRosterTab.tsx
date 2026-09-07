import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { Project, Employee } from '@/types'

const php = (n: number) => `₱${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const usd = (n: number, rate: number) => rate > 0 ? `$${(n / rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'

export default function ProjectRosterTab({ projects }: { projects: Project[] }) {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [rate, setRate] = useState(56)
  const [rateInfo, setRateInfo] = useState<{ live: boolean; loading: boolean }>({ live: false, loading: true })
  const [loading, setLoading] = useState(true)

  useEffect(() => { load(); fetchLiveRate() }, [])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('employees').select('*').neq('status', 'terminated').order('name')
    setEmployees((data ?? []) as Employee[])
    setLoading(false)
  }

  const fetchLiveRate = async () => {
    setRateInfo(r => ({ ...r, loading: true }))
    const sources: Array<() => Promise<number | null>> = [
      async () => (await (await fetch('https://api.exchangerate.host/latest?base=USD&symbols=PHP')).json())?.rates?.PHP ?? null,
      async () => (await (await fetch('https://open.er-api.com/v6/latest/USD')).json())?.rates?.PHP ?? null,
      async () => (await (await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json')).json())?.usd?.php ?? null,
    ]
    for (const src of sources) {
      try { const p = await src(); if (p && p > 0) { setRate(Number(p.toFixed(2))); setRateInfo({ live: true, loading: false }); return } } catch { /* next */ }
    }
    setRateInfo({ live: false, loading: false })
  }

  // Group employees by their current project; unassigned bucketed separately
  const groups = useMemo(() => {
    const byProject = new Map<string, Employee[]>()
    const unassigned: Employee[] = []
    for (const e of employees) {
      const pid = (e as any).current_project_id as string | null
      if (pid && projects.some(p => p.id === pid)) {
        if (!byProject.has(pid)) byProject.set(pid, [])
        byProject.get(pid)!.push(e)
      } else {
        unassigned.push(e)
      }
    }
    const ordered = projects
      .filter(p => byProject.has(p.id))
      .map(p => ({ project: p, members: byProject.get(p.id)! }))
    return { ordered, unassigned }
  }, [employees, projects])

  const grandTotal = useMemo(() => employees.reduce((s, e) => s + (Number(e.base_salary) || 0), 0), [employees])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-gray-600">Employees grouped by project, with monthly salary.</p>
        <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5">
          <span className="text-xs font-medium text-gray-600">USD Rate:</span>
          <span className="text-xs text-gray-500">₱</span>
          <input type="number" min="1" step="0.01" value={rate} onChange={e => { setRate(Number(e.target.value) || 56); setRateInfo(r => ({ ...r, live: false })) }} className="w-16 border-0 p-0 text-sm font-medium text-gray-900 focus:ring-0" />
          <span className="text-xs text-gray-500">= $1</span>
          <button onClick={fetchLiveRate} title="Refresh live rate" className="ml-1 text-gray-400 hover:text-blue-600">
            <svg className={`h-4 w-4 ${rateInfo.loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          </button>
          {rateInfo.live && !rateInfo.loading && <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">● Live</span>}
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500">Loading...</p>
      ) : groups.ordered.length === 0 && groups.unassigned.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">No employees found.</div>
      ) : (
        <div className="space-y-6">
          {groups.ordered.map(({ project, members }) => {
            const subtotal = members.reduce((s, e) => s + (Number(e.base_salary) || 0), 0)
            return (
              <div key={project.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center justify-between bg-slate-800 px-5 py-3 text-white">
                  <div>
                    <h3 className="font-bold">{project.name}{project.code ? ` (${project.code})` : ''}</h3>
                    <p className="text-xs text-slate-300">{members.length} employee{members.length === 1 ? '' : 's'} • {project.status}</p>
                  </div>
                  <div className="text-right text-xs text-slate-300">
                    <p>Payer: {project.client_name || 'AvenseTech'}</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600">Employee Name</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600">Position</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-600">Salary (PHP)</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-600">Salary (USD)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {members.map(e => (
                        <tr key={e.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 font-medium text-gray-900">{e.name}</td>
                          <td className="px-4 py-2 text-gray-600">{e.position || '-'}</td>
                          <td className="px-4 py-2 text-right text-gray-900">{php(Number(e.base_salary) || 0)}</td>
                          <td className="px-4 py-2 text-right text-gray-500">{usd(Number(e.base_salary) || 0, rate)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                        <td className="px-4 py-2 text-gray-700" colSpan={2}>Subtotal — {members.length} employee(s)</td>
                        <td className="px-4 py-2 text-right text-gray-900">{php(subtotal)}</td>
                        <td className="px-4 py-2 text-right text-gray-600">{usd(subtotal, rate)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )
          })}

          {groups.unassigned.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-dashed border-gray-300 bg-white shadow-sm">
              <div className="bg-gray-100 px-5 py-3">
                <h3 className="font-bold text-gray-700">Unassigned</h3>
                <p className="text-xs text-gray-500">{groups.unassigned.length} employee(s) not assigned to any project</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600">Employee Name</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600">Position</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-600">Salary (PHP)</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-600">Salary (USD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {groups.unassigned.map(e => (
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-900">{e.name}</td>
                        <td className="px-4 py-2 text-gray-600">{e.position || '-'}</td>
                        <td className="px-4 py-2 text-right text-gray-900">{php(Number(e.base_salary) || 0)}</td>
                        <td className="px-4 py-2 text-right text-gray-500">{usd(Number(e.base_salary) || 0, rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Grand total */}
          <div className="flex items-center justify-between rounded-xl bg-slate-900 px-5 py-4 text-white">
            <span className="font-semibold">Total Monthly Salaries ({employees.length} employees)</span>
            <div className="text-right">
              <p className="text-lg font-bold">{php(grandTotal)}</p>
              <p className="text-xs text-slate-300">{usd(grandTotal, rate)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
