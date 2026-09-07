import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLogger'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { Project, ProjectTransaction } from '@/types'

const money = (n: number) => `₱${(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (n: number) => `${n.toFixed(1)}%`
const currentMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` }
const monthsBack = (m: string, n: number) => {
  const [y, mo] = m.split('-').map(Number); const out: string[] = []
  for (let i = n - 1; i >= 0; i--) { const d = new Date(y, mo - 1 - i, 1); out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }
  return out
}

interface Row extends ProjectTransaction {}

// Per-project computed figures for a month
interface ProjStat {
  project: Project
  revenue: number
  expenses: number
  liabilities: number
  shared: number
  profit: number
  margin: number | null
  byCategory: Record<string, number>
  rows: Row[]
}

export default function ProjectPnL({ mode }: { mode: 'project' | 'comparison' }) {
  const { currentUser } = useCurrentUser()
  const role = currentUser?.role || ''
  const isPM = role === 'project_manager'

  const [projects, setProjects] = useState<Project[]>([])
  const [pmProjectIds, setPmProjectIds] = useState<string[] | null>(null) // null = all allowed
  const [month, setMonth] = useState(currentMonth())
  const [txns, setTxns] = useState<Row[]>([])
  const [sharedAllocs, setSharedAllocs] = useState<Array<{ project_id: string; amount_php: number; shared_expense_id: string }>>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  // filters
  const [fProject, setFProject] = useState('')
  const [fClient, setFClient] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fCurrency, setFCurrency] = useState('')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  // comparison
  const [cmpProjects, setCmpProjects] = useState<string[]>([])

  useEffect(() => { init() }, [])
  useEffect(() => { load() }, [month])

  const init = async () => {
    // project-manager scoping
    if (isPM && currentUser?.id) {
      const { data } = await supabase.from('project_managers').select('project_id').eq('user_id', currentUser.id)
      setPmProjectIds((data ?? []).map((d: any) => d.project_id))
    }
    const { data: projs } = await supabase.from('projects').select('*').order('name')
    setProjects((projs ?? []) as Project[])
  }

  const load = async () => {
    setLoading(true)
    const [{ data: t }, { data: sa }] = await Promise.all([
      supabase.from('project_transactions').select('*').eq('month', month),
      // shared expense allocations for approved shared expenses in this month
      supabase.from('shared_expense_allocations').select('project_id,amount_php,shared_expense_id'),
    ])
    setTxns((t ?? []) as Row[])
    // filter shared allocs to approved shared expenses of this month
    const sharedIds = new Set<string>()
    const { data: shared } = await supabase.from('shared_expenses').select('id').eq('month', month).eq('status', 'approved')
    for (const s of (shared ?? []) as any[]) sharedIds.add(s.id)
    setSharedAllocs(((sa ?? []) as any[]).filter(x => sharedIds.has(x.shared_expense_id)))
    setLoading(false)
  }

  const allowedProjects = useMemo(() => {
    let list = projects
    if (pmProjectIds) list = list.filter(p => pmProjectIds.includes(p.id))
    return list
  }, [projects, pmProjectIds])

  // Build per-project stats (only approved/paid transactions count)
  const stats = useMemo<ProjStat[]>(() => {
    const counted = txns.filter(t => t.status === 'approved' || t.status === 'paid')
    return allowedProjects
      .filter(p => (!fProject || p.id === fProject))
      .filter(p => (!fClient || (p.client_name || '').toLowerCase().includes(fClient.toLowerCase())))
      .filter(p => (!fCurrency || p.billing_currency === fCurrency))
      .map(p => {
        const rows = counted.filter(t => t.project_id === p.id)
          .filter(t => (!fStatus || t.status === fStatus))
        const revenue = rows.filter(r => r.kind === 'revenue').reduce((s, r) => s + Number(r.amount_php), 0)
        const directExp = rows.filter(r => r.kind === 'expense').reduce((s, r) => s + Number(r.amount_php), 0)
        const adjustments = rows.filter(r => r.kind === 'adjustment').reduce((s, r) => s + Number(r.amount_php), 0)
        const liabilities = rows.filter(r => r.kind === 'liability').reduce((s, r) => s + Number(r.amount_php), 0)
        const shared = sharedAllocs.filter(sa => sa.project_id === p.id).reduce((s, sa) => s + Number(sa.amount_php), 0)
        const expenses = directExp + shared - adjustments // adjustments reduce expense; simple model
        const profit = revenue - expenses
        const margin = revenue > 0 ? (profit / revenue) * 100 : null
        const byCategory: Record<string, number> = {}
        for (const r of rows.filter(r => r.kind === 'expense')) byCategory[r.category || 'Other'] = (byCategory[r.category || 'Other'] ?? 0) + Number(r.amount_php)
        if (shared > 0) byCategory['Allocated Shared Expenses'] = shared
        return { project: p, revenue, expenses, liabilities, shared, profit, margin, byCategory, rows }
      })
  }, [allowedProjects, txns, sharedAllocs, fProject, fClient, fStatus, fCurrency])

  // Dashboard aggregates
  const dash = useMemo(() => {
    const totalRev = stats.reduce((s, x) => s + x.revenue, 0)
    const totalExp = stats.reduce((s, x) => s + x.expenses, 0)
    const totalLiab = stats.reduce((s, x) => s + x.liabilities, 0)
    const profit = totalRev - totalExp
    const margin = totalRev > 0 ? (profit / totalRev) * 100 : null
    const withRev = stats.filter(s => s.revenue > 0 || s.expenses > 0)
    const mostProfitable = withRev.slice().sort((a, b) => b.profit - a.profit)[0]
    const highestExpense = stats.slice().sort((a, b) => b.expenses - a.expenses)[0]
    const atLoss = stats.filter(s => s.profit < 0)
    return { totalRev, totalExp, totalLiab, profit, margin, mostProfitable, highestExpense, atLoss }
  }, [stats])

  // 6-month trend across allowed projects
  const [trend, setTrend] = useState<Array<{ month: string; rev: number; exp: number; profit: number }>>([])
  useEffect(() => { loadTrend() }, [month, allowedProjects.length])
  const loadTrend = async () => {
    const months = monthsBack(month, 6)
    const allowedIds = allowedProjects.map(p => p.id)
    const results = await Promise.all(months.map(async mo => {
      const { data } = await supabase.from('project_transactions').select('project_id,kind,amount_php,status').eq('month', mo)
      const counted = (data ?? []).filter((r: any) => (r.status === 'approved' || r.status === 'paid') && (allowedIds.length === 0 || allowedIds.includes(r.project_id)))
      const rev = counted.filter((r: any) => r.kind === 'revenue').reduce((s: number, r: any) => s + Number(r.amount_php), 0)
      const exp = counted.filter((r: any) => r.kind === 'expense').reduce((s: number, r: any) => s + Number(r.amount_php), 0)
      return { month: mo, rev, exp, profit: rev - exp }
    }))
    setTrend(results)
  }
  const maxTrend = useMemo(() => Math.max(...trend.map(t => Math.max(t.rev, t.exp)), 1), [trend])

  // Sync payroll -> project P&L for this month
  const syncPayroll = async () => {
    if (!confirm(`Post approved payroll costs for ${month} to project P&L? Existing auto rows for these payslips are refreshed (no duplicates).`)) return
    setSyncing(true)
    const { data, error } = await supabase.rpc('post_month_payroll_to_projects', { p_month: month, p_actor: currentUser?.email || 'system' })
    setSyncing(false)
    if (error) { alert(error.message); return }
    await logActivity('updated', 'Project P&L', `Synced payroll to project P&L for ${month}`, data)
    alert(`Synced. Rows posted: ${data?.rows ?? 0}`)
    await load(); await loadTrend()
  }

  // ── Exports ────────────────────────────────────────────────────────────────
  const exportExcel = async () => {
    const XLSX = await import('xlsx')
    const rows = stats.map(s => ({
      Project: s.project.name, Code: s.project.code || '', Client: s.project.client_name || '', Month: month,
      Revenue: s.revenue, Expenses: s.expenses, Liabilities: s.liabilities,
      Profit: s.profit, 'Margin %': s.margin == null ? 'N/A' : Number(s.margin.toFixed(1)),
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Project P&L')
    XLSX.writeFile(wb, `Project-PnL_${month}.xlsx`)
    await logActivity('exported', 'Project P&L', `Exported Project P&L Excel for ${month}`)
  }

  const exportPdf = async () => {
    const { default: jsPDF } = await import('jspdf')
    const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' })
    doc.setFontSize(14); doc.text(`Project P&L — ${month}`, 14, 16)
    doc.setFontSize(9)
    let y = 28
    doc.text('Project', 14, y); doc.text('Revenue', 90, y); doc.text('Expenses', 120, y); doc.text('Profit', 152, y); doc.text('Margin', 182, y)
    y += 4; doc.line(14, y, 200, y); y += 5
    stats.forEach(s => {
      if (y > 190) { doc.addPage(); y = 20 }
      doc.text((s.project.name || '').slice(0, 40), 14, y)
      doc.text(money(s.revenue), 90, y); doc.text(money(s.expenses), 120, y); doc.text(money(s.profit), 152, y)
      doc.text(s.margin == null ? 'N/A' : pct(s.margin), 182, y); y += 6
    })
    y += 2; doc.line(14, y, 200, y); y += 6
    doc.setFont(undefined as any, 'bold')
    doc.text('TOTAL', 14, y); doc.text(money(dash.totalRev), 90, y); doc.text(money(dash.totalExp), 120, y); doc.text(money(dash.profit), 152, y)
    doc.text(dash.margin == null ? 'N/A' : pct(dash.margin), 182, y)
    doc.save(`Project-PnL_${month}.pdf`)
    await logActivity('exported', 'Project P&L', `Exported Project P&L PDF for ${month}`)
  }

  const clients = useMemo(() => Array.from(new Set(projects.map(p => p.client_name).filter(Boolean))) as string[], [projects])
  const currencies = useMemo(() => Array.from(new Set(projects.map(p => p.billing_currency))), [projects])

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white p-3">
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input-field" />
        <select value={fProject} onChange={e => setFProject(e.target.value)} className="input-field"><option value="">All projects</option>{allowedProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <select value={fClient} onChange={e => setFClient(e.target.value)} className="input-field"><option value="">All clients</option>{clients.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <select value={fStatus} onChange={e => setFStatus(e.target.value)} className="input-field"><option value="">Approved + Paid</option><option value="approved">Approved only</option><option value="paid">Paid only</option></select>
        <select value={fCurrency} onChange={e => setFCurrency(e.target.value)} className="input-field"><option value="">All currencies</option>{currencies.map(c => <option key={c} value={c}>{c}</option>)}</select>
        <div className="ml-auto flex gap-2">
          {!isPM && <button onClick={syncPayroll} disabled={syncing} className="btn-secondary">{syncing ? 'Syncing…' : 'Sync Payroll'}</button>}
          <button onClick={exportExcel} className="btn-secondary">Excel</button>
          <button onClick={exportPdf} className="btn-secondary">PDF</button>
        </div>
      </div>

      {/* Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card title="Total Revenue" value={money(dash.totalRev)} tone="blue" />
        <Card title="Total Expenses" value={money(dash.totalExp)} tone="red" />
        <Card title="Outstanding Liabilities" value={money(dash.totalLiab)} tone="amber" />
        <Card title={dash.profit >= 0 ? 'Overall Profit' : 'Overall Loss'} value={money(dash.profit)} tone={dash.profit >= 0 ? 'green' : 'red'} />
        <Card title="Overall Margin" value={dash.margin == null ? 'N/A' : pct(dash.margin)} tone="slate" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <div className="rounded-lg border border-gray-200 bg-white p-3"><p className="text-xs text-gray-500">Most Profitable</p><p className="font-semibold text-gray-900">{dash.mostProfitable ? `${dash.mostProfitable.project.name} (${money(dash.mostProfitable.profit)})` : '—'}</p></div>
        <div className="rounded-lg border border-gray-200 bg-white p-3"><p className="text-xs text-gray-500">Highest Expenses</p><p className="font-semibold text-gray-900">{dash.highestExpense ? `${dash.highestExpense.project.name} (${money(dash.highestExpense.expenses)})` : '—'}</p></div>
        <div className="rounded-lg border border-gray-200 bg-white p-3"><p className="text-xs text-gray-500">Projects at a Loss</p><p className="font-semibold text-gray-900">{dash.atLoss.length === 0 ? 'None' : dash.atLoss.map(s => s.project.name).join(', ')}</p></div>
      </div>

      {loading ? <p className="py-8 text-center text-sm text-gray-500">Loading...</p> : mode === 'project' ? (
        /* ── PROJECT P&L ── */
        <div className="space-y-3">
          {stats.length === 0 ? <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">No projects match the filters.</div> :
            stats.map(s => (
              <div key={s.project.id} className="rounded-xl border border-gray-200 bg-white shadow-sm">
                <button onClick={() => setExpanded(e => ({ ...e, [s.project.id]: !e[s.project.id] }))} className="flex w-full items-center justify-between px-5 py-4 text-left">
                  <div>
                    <p className="font-bold text-gray-900">{s.project.name} <span className="text-xs font-normal text-gray-500">{s.project.code || ''} • {s.project.client_name || 'No client'}</span></p>
                    <p className="text-xs text-gray-500">{month}</p>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <span className="text-blue-700">{money(s.revenue)}</span>
                    <span className="text-red-700">{money(s.expenses)}</span>
                    <span className={s.profit >= 0 ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>{money(s.profit)}</span>
                    <span className="text-gray-600">{s.margin == null ? 'N/A' : pct(s.margin)}</span>
                    <span className="text-gray-400">{expanded[s.project.id] ? '▲' : '▼'}</span>
                  </div>
                </button>
                {expanded[s.project.id] && (
                  <div className="border-t border-gray-100 px-5 py-4 text-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="mb-1 font-semibold text-gray-700">Expense Breakdown</p>
                        {Object.keys(s.byCategory).length === 0 ? <p className="text-gray-400">None</p> : Object.entries(s.byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
                          <div key={cat} className="flex justify-between py-0.5"><span className="text-gray-600">{cat}</span><span className="text-gray-900">{money(amt)}</span></div>
                        ))}
                        <div className="mt-1 flex justify-between border-t border-gray-100 pt-1 font-medium"><span>Liabilities</span><span>{money(s.liabilities)}</span></div>
                      </div>
                      <div>
                        <p className="mb-1 font-semibold text-gray-700">Transactions & Employees</p>
                        <div className="max-h-52 overflow-y-auto">
                          {s.rows.map(r => (
                            <div key={r.id} className="flex justify-between py-0.5 text-xs">
                              <span className="text-gray-600">{r.txn_date} • {r.kind} • {r.category || r.description || '—'}{r.source === 'auto_payroll' ? ' (payroll)' : ''}</span>
                              <span className="text-gray-900">{money(Number(r.amount_php))}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
        </div>
      ) : (
        /* ── COMPARISON ── */
        <div className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="mb-2 text-sm font-medium text-gray-700">Select projects to compare</p>
            <div className="flex flex-wrap gap-2">
              {allowedProjects.map(p => (
                <label key={p.id} className={`cursor-pointer rounded-full border px-3 py-1 text-xs ${cmpProjects.includes(p.id) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600'}`}>
                  <input type="checkbox" className="mr-1" checked={cmpProjects.includes(p.id)} onChange={e => setCmpProjects(list => e.target.checked ? [...list, p.id] : list.filter(x => x !== p.id))} />
                  {p.name}
                </label>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50"><tr>{['Project', 'Revenue', 'Expenses', 'Liabilities', 'Profit/Loss', 'Margin'].map(h => <th key={h} className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600">{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-gray-100">
                {stats.filter(s => cmpProjects.length === 0 || cmpProjects.includes(s.project.id)).map(s => (
                  <tr key={s.project.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-medium text-gray-900">{s.project.name}</td>
                    <td className="px-4 py-2 text-blue-700">{money(s.revenue)}</td>
                    <td className="px-4 py-2 text-red-700">{money(s.expenses)}</td>
                    <td className="px-4 py-2 text-amber-700">{money(s.liabilities)}</td>
                    <td className={`px-4 py-2 font-semibold ${s.profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{money(s.profit)}</td>
                    <td className="px-4 py-2 text-gray-600">{s.margin == null ? 'N/A' : pct(s.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Trend */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="mb-1 text-sm font-medium text-gray-700">6-Month Trend (selected scope)</p>
            <div className="flex gap-4 text-xs text-gray-500 mb-3"><span><span className="inline-block h-2 w-4 rounded bg-blue-500 align-middle"></span> Revenue</span><span><span className="inline-block h-2 w-4 rounded bg-red-400 align-middle"></span> Expenses</span></div>
            <div className="flex items-end gap-2 h-40">
              {trend.map((t, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center gap-0.5 h-28">
                    <div title={`Rev ${money(t.rev)}`} className="flex-1 rounded-t bg-blue-500" style={{ height: `${(t.rev / maxTrend) * 100}%`, minHeight: t.rev > 0 ? '4px' : '0' }} />
                    <div title={`Exp ${money(t.exp)}`} className="flex-1 rounded-t bg-red-400" style={{ height: `${(t.exp / maxTrend) * 100}%`, minHeight: t.exp > 0 ? '4px' : '0' }} />
                  </div>
                  <span className={`text-xs ${t.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{Math.round(t.profit / 1000)}k</span>
                  <span className="text-[10px] text-gray-500">{t.month.slice(5)}/{t.month.slice(2, 4)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Card({ title, value, tone }: { title: string; value: string; tone: 'blue' | 'red' | 'green' | 'amber' | 'slate' }) {
  const map: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600', red: 'from-red-500 to-red-600', green: 'from-green-500 to-green-600',
    amber: 'from-amber-500 to-amber-600', slate: 'from-slate-600 to-slate-700',
  }
  return (
    <div className={`rounded-xl p-4 bg-gradient-to-br ${map[tone]} text-white shadow`}>
      <p className="text-xs font-medium opacity-80">{title}</p>
      <p className="text-lg font-bold mt-1">{value}</p>
    </div>
  )
}
