import { useEffect, useState, useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import type { PmClient, PmProject, PmRevenue, PmEmployeeCost, PmExpense } from '@/types'

const fmt = (n: number) =>
  `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const fmtUSD = (n: number, rate: number) =>
  rate > 0 ? `$${(n / rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''

const fmtBoth = (n: number, rate: number) => {
  const php = fmt(n)
  const usd = fmtUSD(n, rate)
  return usd ? `${php} (${usd})` : php
}

const fmtPct = (n: number) => `${n.toFixed(1)}%`

const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const prevMonth = (m: string) => {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(y, mo - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const last6Months = (m: string): string[] => {
  const months: string[] = []
  let [y, mo] = m.split('-').map(Number)
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, mo - 1 - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

const totalEmpCost = (e: PmEmployeeCost) =>
  e.basic_salary + e.sss + e.philhealth + e.pagibig +
  e.ot_pay + e.night_differential + e.incentives + e.other_costs

interface ProjectStats {
  project: PmProject
  clientName: string
  revenue: number
  payrollCost: number
  operatingExpenses: number
  totalExpenses: number
  netProfit: number
  profitMargin: number
}

interface ClientStats {
  client: PmClient
  revenue: number
  expenses: number
  profit: number
  margin: number
}

export default function Profitability() {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())
  const [exchangeRate, setExchangeRate] = useState<number>(56)
  const [clients, setClients] = useState<PmClient[]>([])
  const [projects, setProjects] = useState<PmProject[]>([])
  const [revenues, setRevenues] = useState<PmRevenue[]>([])
  const [empCosts, setEmpCosts] = useState<PmEmployeeCost[]>([])
  const [expenses, setExpenses] = useState<PmExpense[]>([])
  const [prevRevenues, setPrevRevenues] = useState<PmRevenue[]>([])
  const [loading, setLoading] = useState(true)
  const [trendData, setTrendData] = useState<Array<{ month: string; revenue: number; expenses: number; profit: number }>>([])

  useEffect(() => {
    loadData()
  }, [selectedMonth])

  const loadData = async () => {
    setLoading(true)
    const pm = prevMonth(selectedMonth)
    const months6 = last6Months(selectedMonth)
    const [cl, pr, rv, ec, ex, prv, trend] = await Promise.all([
      supabase.from('pm_clients').select('*').order('name'),
      supabase.from('pm_projects').select('*').order('name'),
      supabase.from('pm_revenues').select('*').eq('month', selectedMonth),
      supabase.from('pm_employee_costs').select('*').eq('month', selectedMonth),
      supabase.from('pm_expenses').select('*').eq('month', selectedMonth),
      supabase.from('pm_revenues').select('*').eq('month', pm),
      Promise.all(months6.map(async (mo) => {
        const [r, ec2, ex2] = await Promise.all([
          supabase.from('pm_revenues').select('amount').eq('month', mo),
          supabase.from('pm_employee_costs').select('basic_salary,sss,philhealth,pagibig,ot_pay,night_differential,incentives,other_costs').eq('month', mo),
          supabase.from('pm_expenses').select('amount').eq('month', mo),
        ])
        const rev = (r.data ?? []).reduce((s: number, x: { amount: number }) => s + x.amount, 0)
        const payroll = (ec2.data ?? []).reduce((s: number, x: any) => s + totalEmpCost(x as PmEmployeeCost), 0)
        const opex = (ex2.data ?? []).reduce((s: number, x: { amount: number }) => s + x.amount, 0)
        const exp = payroll + opex
        return { month: mo, revenue: rev, expenses: exp, profit: rev - exp }
      }))
    ])
    setClients((cl.data ?? []) as PmClient[])
    setProjects((pr.data ?? []) as PmProject[])
    setRevenues((rv.data ?? []) as PmRevenue[])
    setEmpCosts((ec.data ?? []) as PmEmployeeCost[])
    setExpenses((ex.data ?? []) as PmExpense[])
    setPrevRevenues((prv.data ?? []) as PmRevenue[])
    setTrendData(trend)
    setLoading(false)
  }

  // ── Derived calculations ───────────────────────────────────────────────────

  const projectStats = useMemo((): ProjectStats[] => {
    return projects.map(proj => {
      const client = clients.find(c => c.id === proj.client_id)
      const revenue = revenues.filter(r => r.project_id === proj.id).reduce((s, r) => s + r.amount, 0)
      const payrollCost = empCosts.filter(e => e.project_id === proj.id).reduce((s, e) => s + totalEmpCost(e), 0)
      const operatingExpenses = expenses.filter(ex => ex.scope === 'project' && ex.project_id === proj.id).reduce((s, ex) => s + ex.amount, 0)
      const totalExpenses = payrollCost + operatingExpenses
      const netProfit = revenue - totalExpenses
      const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0
      return {
        project: proj,
        clientName: client?.name ?? '-',
        revenue,
        payrollCost,
        operatingExpenses,
        totalExpenses,
        netProfit,
        profitMargin,
      }
    }).sort((a, b) => b.netProfit - a.netProfit)
  }, [projects, clients, revenues, empCosts, expenses])

  const clientStats = useMemo((): ClientStats[] => {
    return clients.map(cl => {
      const clientProjs = projects.filter(p => p.client_id === cl.id)
      const clientProjStats = projectStats.filter(ps => clientProjs.some(cp => cp.id === ps.project.id))
      const revenue = clientProjStats.reduce((s, ps) => s + ps.revenue, 0)
      const projExpenses = clientProjStats.reduce((s, ps) => s + ps.totalExpenses, 0)
      const clientScopedExpenses = expenses.filter(ex => ex.scope === 'client' && ex.client_id === cl.id).reduce((s, ex) => s + ex.amount, 0)
      const totalExpenses = projExpenses + clientScopedExpenses
      const profit = revenue - totalExpenses
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0
      return { client: cl, revenue, expenses: totalExpenses, profit, margin }
    }).sort((a, b) => b.profit - a.profit)
  }, [clients, projects, projectStats, expenses])

  const kpis = useMemo(() => {
    const totalRevenue = revenues.reduce((s, r) => s + r.amount, 0)
    const totalPayroll = empCosts.reduce((s, e) => s + totalEmpCost(e), 0)
    // Gross profit = Revenue - Payroll (direct labour cost)
    const grossProfit = totalRevenue - totalPayroll
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0
    // Operating expenses = ALL pm_expenses (project + client + company scoped)
    const totalOpex = expenses.reduce((s, ex) => s + ex.amount, 0)
    // Project-scoped opex (already inside projectStats but shown separately here)
    const projectOpex = expenses.filter(ex => ex.scope === 'project').reduce((s, ex) => s + ex.amount, 0)
    const clientOpex = expenses.filter(ex => ex.scope === 'client').reduce((s, ex) => s + ex.amount, 0)
    const companyOpex = expenses.filter(ex => ex.scope === 'company').reduce((s, ex) => s + ex.amount, 0)
    // Net profit = Revenue - Payroll - ALL opex
    const totalProfit = totalRevenue - totalPayroll - totalOpex
    const avgMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
    return { totalRevenue, totalPayroll, grossProfit, grossMargin, totalOpex, projectOpex, clientOpex, companyOpex, totalProfit, avgMargin }
  }, [revenues, empCosts, expenses])

  const alerts = useMemo(() => {
    const list: Array<{ type: 'error' | 'warning'; message: string }> = []
    for (const ps of projectStats) {
      if (ps.revenue === 0 && ps.totalExpenses === 0) continue
      if (ps.netProfit < 0) {
        list.push({ type: 'error', message: `${ps.project.name} is operating at a loss of ${fmt(Math.abs(ps.netProfit))}` })
      }
      if (ps.revenue > 0 && ps.payrollCost / ps.revenue > 0.7) {
        list.push({ type: 'warning', message: `${ps.project.name}: payroll is ${fmtPct((ps.payrollCost / ps.revenue) * 100)} of revenue (>70%)` })
      }
      if (ps.revenue > 0 && ps.profitMargin < 15 && ps.netProfit >= 0) {
        list.push({ type: 'warning', message: `${ps.project.name}: margin is only ${fmtPct(ps.profitMargin)} (<15%)` })
      }
    }
    // Month-over-month revenue decrease
    for (const proj of projects) {
      const currRev = revenues.filter(r => r.project_id === proj.id).reduce((s, r) => s + r.amount, 0)
      const prevRev = prevRevenues.filter(r => r.project_id === proj.id).reduce((s, r) => s + r.amount, 0)
      if (prevRev > 0 && currRev < prevRev) {
        list.push({ type: 'warning', message: `${proj.name}: revenue decreased from ${fmt(prevRev)} to ${fmt(currRev)} vs last month` })
      }
    }
    return list
  }, [projectStats, projects, revenues, prevRevenues])

  const topEmployees = useMemo(() => {
    return [...empCosts]
      .sort((a, b) => totalEmpCost(b) - totalEmpCost(a))
      .slice(0, 5)
      .map(e => ({
        name: e.employee_name,
        project: projects.find(p => p.id === e.project_id)?.name ?? '-',
        cost: totalEmpCost(e),
      }))
  }, [empCosts, projects])

  const costByProject = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of empCosts) {
      map[e.project_id] = (map[e.project_id] ?? 0) + totalEmpCost(e)
    }
    return Object.entries(map)
      .map(([pid, cost]) => ({ name: projects.find(p => p.id === pid)?.name ?? pid, cost }))
      .sort((a, b) => b.cost - a.cost)
  }, [empCosts, projects])

  const expensesByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    for (const ex of expenses) {
      map[ex.category] = (map[ex.category] ?? 0) + ex.amount
    }
    return Object.entries(map)
      .map(([cat, amount]) => ({ cat, amount }))
      .sort((a, b) => b.amount - a.amount)
  }, [expenses])

  const maxCostByProject = useMemo(() => Math.max(...costByProject.map(x => x.cost), 1), [costByProject])
  const maxExpCat = useMemo(() => Math.max(...expensesByCategory.map(x => x.amount), 1), [expensesByCategory])
  const maxTrend = useMemo(() => Math.max(...trendData.map(t => Math.max(t.revenue, t.expenses)), 1), [trendData])

  const marginClass = (m: number) =>
    m > 30 ? 'text-green-600 font-semibold' : m >= 10 ? 'text-yellow-600 font-semibold' : 'text-red-600 font-semibold'

  const rowBg = (ps: ProjectStats) => {
    if (ps.revenue === 0 && ps.totalExpenses === 0) return ''
    if (ps.netProfit < 0) return 'bg-red-50'
    if (ps.profitMargin < 15) return 'bg-yellow-50'
    if (ps.profitMargin > 30) return 'bg-green-50'
    return ''
  }

  const subNavClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${isActive ? 'bg-blue-600 text-white' : 'bg-white text-blue-700 border border-blue-200 hover:border-blue-400'}`

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Profitability Dashboard</h2>
          <p className="text-sm text-gray-600">Revenue, costs, and profit analysis</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="input-field"
          />
          <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5">
            <span className="text-xs font-medium text-gray-600">USD Rate:</span>
            <span className="text-xs text-gray-500">₱</span>
            <input
              type="number"
              min="1"
              step="0.01"
              value={exchangeRate}
              onChange={e => setExchangeRate(Number(e.target.value) || 56)}
              className="w-16 border-0 p-0 text-sm font-medium text-gray-900 focus:ring-0"
            />
            <span className="text-xs text-gray-500">= $1</span>
          </div>
          <button onClick={loadData} className="btn-secondary text-xs">↻ Refresh</button>
        </div>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-2 flex-wrap">
        <NavLink to="/profitability/clients" className={subNavClass}>Clients & Projects</NavLink>
        <NavLink to="/profitability/revenues" className={subNavClass}>Revenues</NavLink>
        <NavLink to="/profitability/employees" className={subNavClass}>Employee Costs</NavLink>
        <NavLink to="/profitability/expenses" className={subNavClass}>Expenses</NavLink>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-500">Loading data...</div>
      ) : (
        <>
          {/* P&L Summary Statement */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-base font-semibold text-gray-900">Profit & Loss Statement — {selectedMonth}</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {/* Revenue */}
              <div className="flex items-center justify-between px-6 py-3 bg-blue-50">
                <span className="text-sm font-semibold text-blue-900">Total Revenue</span>
                <div className="text-right">
                  <span className="text-sm font-bold text-blue-900">{fmt(kpis.totalRevenue)}</span>
                  <div className="text-xs text-blue-500">{fmtUSD(kpis.totalRevenue, exchangeRate)}</div>
                </div>
              </div>
              {/* Less: Payroll */}
              <div className="flex items-center justify-between px-6 py-3 pl-10">
                <span className="text-sm text-gray-600">Less: Payroll / Labour Cost</span>
                <div className="text-right">
                  <span className="text-sm text-red-600">({fmt(kpis.totalPayroll)})</span>
                  <div className="text-xs text-gray-400">{fmtUSD(kpis.totalPayroll, exchangeRate)}</div>
                </div>
              </div>
              {/* Gross Profit */}
              <div className={`flex items-center justify-between px-6 py-3 ${kpis.grossProfit >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <div>
                  <span className={`text-sm font-semibold ${kpis.grossProfit >= 0 ? 'text-green-800' : 'text-red-800'}`}>Gross Profit</span>
                  <span className="ml-2 text-xs text-gray-500">({fmtPct(kpis.grossMargin)} margin)</span>
                </div>
                <div className="text-right">
                  <span className={`text-sm font-bold ${kpis.grossProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(kpis.grossProfit)}</span>
                  <div className="text-xs text-gray-400">{fmtUSD(kpis.grossProfit, exchangeRate)}</div>
                </div>
              </div>
              {/* Less: Operating Expenses breakdown */}
              {kpis.projectOpex > 0 && (
                <div className="flex items-center justify-between px-6 py-2 pl-10">
                  <span className="text-xs text-gray-500">Less: Project Operating Expenses</span>
                  <span className="text-xs text-red-500">({fmt(kpis.projectOpex)})</span>
                </div>
              )}
              {kpis.clientOpex > 0 && (
                <div className="flex items-center justify-between px-6 py-2 pl-10">
                  <span className="text-xs text-gray-500">Less: Client Operating Expenses</span>
                  <span className="text-xs text-red-500">({fmt(kpis.clientOpex)})</span>
                </div>
              )}
              {kpis.companyOpex > 0 && (
                <div className="flex items-center justify-between px-6 py-2 pl-10">
                  <span className="text-xs text-gray-500">Less: Company Operating Expenses</span>
                  <span className="text-xs text-red-500">({fmt(kpis.companyOpex)})</span>
                </div>
              )}
              {/* Total Opex subtotal */}
              <div className="flex items-center justify-between px-6 py-3 pl-10 bg-gray-50">
                <span className="text-sm text-gray-700 font-medium">Total Operating Expenses</span>
                <div className="text-right">
                  <span className="text-sm text-red-600 font-medium">({fmt(kpis.totalOpex)})</span>
                  <div className="text-xs text-gray-400">{fmtUSD(kpis.totalOpex, exchangeRate)}</div>
                </div>
              </div>
              {/* Net Profit */}
              <div className={`flex items-center justify-between px-6 py-4 ${kpis.totalProfit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                <div>
                  <span className={`text-base font-bold ${kpis.totalProfit >= 0 ? 'text-green-900' : 'text-red-900'}`}>
                    {kpis.totalProfit >= 0 ? 'Net Profit' : 'Net Loss'}
                  </span>
                  <span className="ml-2 text-xs text-gray-600">({fmtPct(kpis.avgMargin)} net margin)</span>
                </div>
                <div className="text-right">
                  <span className={`text-base font-bold ${kpis.totalProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(kpis.totalProfit)}</span>
                  <div className="text-xs text-gray-500">{fmtUSD(kpis.totalProfit, exchangeRate)}</div>
                </div>
              </div>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-xl p-4 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
              <p className="text-xs font-medium opacity-80">Total Revenue</p>
              <p className="text-lg font-bold mt-1 break-all">{fmt(kpis.totalRevenue)}</p>
              <p className="text-xs opacity-70 mt-0.5">{fmtUSD(kpis.totalRevenue, exchangeRate)}</p>
            </div>
            <div className="rounded-xl p-4 bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg">
              <p className="text-xs font-medium opacity-80">Total Payroll</p>
              <p className="text-lg font-bold mt-1 break-all">{fmt(kpis.totalPayroll)}</p>
              <p className="text-xs opacity-70 mt-0.5">{fmtUSD(kpis.totalPayroll, exchangeRate)}</p>
            </div>
            <div className="rounded-xl p-4 bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg">
              <p className="text-xs font-medium opacity-80">Total Expenses</p>
              <p className="text-lg font-bold mt-1 break-all">{fmt(kpis.totalPayroll + kpis.totalOpex)}</p>
              <p className="text-xs opacity-70 mt-0.5">{fmtUSD(kpis.totalPayroll + kpis.totalOpex, exchangeRate)}</p>
            </div>
            <div className={`rounded-xl p-4 text-white shadow-lg bg-gradient-to-br ${kpis.totalProfit >= 0 ? 'from-green-500 to-green-600' : 'from-red-600 to-red-700'}`}>
              <p className="text-xs font-medium opacity-80">{kpis.totalProfit >= 0 ? 'Net Profit' : 'Net Loss'}</p>
              <p className="text-lg font-bold mt-1 break-all">{fmt(kpis.totalProfit)}</p>
              <p className="text-xs opacity-70 mt-0.5">{fmtPct(kpis.avgMargin)} margin</p>
            </div>
          </div>

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-gray-800">⚠ Alerts</h3>
              {alerts.map((a, i) => (
                <div
                  key={i}
                  className={`rounded-lg px-4 py-3 text-sm font-medium border ${
                    a.type === 'error'
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-yellow-50 border-yellow-200 text-yellow-700'
                  }`}
                >
                  {a.type === 'error' ? '🔴' : '🟡'} {a.message}
                </div>
              ))}
            </div>
          )}

          {/* Client Profitability Table */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-lg overflow-x-auto">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Client Profitability</h3>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Client', 'Revenue', 'Expenses', 'Profit', 'Margin %'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {clientStats.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No client data for this month.</td></tr>
                ) : clientStats.map(cs => (
                  <tr key={cs.client.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{cs.client.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-900"><div>{fmt(cs.revenue)}</div><div className="text-xs text-gray-400">{fmtUSD(cs.revenue, exchangeRate)}</div></td>
                    <td className="px-4 py-3 text-sm text-gray-900"><div>{fmt(cs.expenses)}</div><div className="text-xs text-gray-400">{fmtUSD(cs.expenses, exchangeRate)}</div></td>
                    <td className={`px-4 py-3 text-sm font-semibold ${cs.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}><div>{fmt(cs.profit)}</div><div className="text-xs opacity-70">{fmtUSD(cs.profit, exchangeRate)}</div></td>
                    <td className={`px-4 py-3 text-sm ${marginClass(cs.margin)}`}>{fmtPct(cs.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Project Profitability Table */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-lg overflow-x-auto">
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Project Profitability</h3>
            </div>
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['Project', 'Client', 'Revenue', 'Payroll', 'Op. Expenses', 'Total Expenses', 'Net Profit', 'Margin %'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {projectStats.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">No project data for this month.</td></tr>
                ) : projectStats.map(ps => (
                  <tr key={ps.project.id} className={`${rowBg(ps)} hover:opacity-90`}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{ps.project.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{ps.clientName}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap"><div>{fmt(ps.revenue)}</div><div className="text-xs text-gray-400">{fmtUSD(ps.revenue, exchangeRate)}</div></td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap"><div>{fmt(ps.payrollCost)}</div><div className="text-xs text-gray-400">{fmtUSD(ps.payrollCost, exchangeRate)}</div></td>
                    <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap"><div>{fmt(ps.operatingExpenses)}</div><div className="text-xs text-gray-400">{fmtUSD(ps.operatingExpenses, exchangeRate)}</div></td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap"><div>{fmt(ps.totalExpenses)}</div><div className="text-xs text-gray-400">{fmtUSD(ps.totalExpenses, exchangeRate)}</div></td>
                    <td className={`px-4 py-3 text-sm font-semibold whitespace-nowrap ${ps.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}><div>{fmt(ps.netProfit)}</div><div className="text-xs opacity-70">{fmtUSD(ps.netProfit, exchangeRate)}</div></td>
                    <td className={`px-4 py-3 text-sm whitespace-nowrap ${marginClass(ps.profitMargin)}`}>{fmtPct(ps.profitMargin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Employee Cost Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top 5 employees */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-lg p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Top 5 Highest Cost Employees</h3>
              {topEmployees.length === 0 ? (
                <p className="text-sm text-gray-500">No employee cost data for this month.</p>
              ) : (
                <div className="space-y-3">
                  {topEmployees.map((e, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex-shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{i + 1}</span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{e.name}</p>
                          <p className="text-xs text-gray-500 truncate">{e.project}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-gray-900 whitespace-nowrap">{fmt(e.cost)}</div>
                        <div className="text-xs text-gray-400">{fmtUSD(e.cost, exchangeRate)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cost by project bar chart */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-lg p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Payroll Cost by Project</h3>
              {costByProject.length === 0 ? (
                <p className="text-sm text-gray-500">No payroll data for this month.</p>
              ) : (
                <div className="space-y-3">
                  {costByProject.map((cp, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700 truncate max-w-[55%]">{cp.name}</span>
                        <div className="text-right">
                          <div className="text-xs text-gray-600 whitespace-nowrap">{fmt(cp.cost)}</div>
                          <div className="text-xs text-gray-400 whitespace-nowrap">{fmtUSD(cp.cost, exchangeRate)}</div>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500"
                          style={{ width: `${(cp.cost / maxCostByProject) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Expense Analysis */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-lg p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Expense Analysis by Category</h3>
            {expensesByCategory.length === 0 ? (
              <p className="text-sm text-gray-500">No expense data for this month.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {expensesByCategory.map((ec, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-700 capitalize">{ec.cat}</span>
                      <div className="text-right">
                        <div className="text-xs text-gray-600">{fmt(ec.amount)}</div>
                        <div className="text-xs text-gray-400">{fmtUSD(ec.amount, exchangeRate)}</div>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-red-400 to-red-500"
                        style={{ width: `${(ec.amount / maxExpCat) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Revenue Trend - Last 6 months */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-lg p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Revenue Trend — Last 6 Months</h3>
            <div className="flex gap-4 text-xs text-gray-500 mb-4">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded bg-blue-500"></span>Revenue</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded bg-red-400"></span>Expenses</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded bg-green-500"></span>Profit</span>
            </div>
            {trendData.every(t => t.revenue === 0 && t.expenses === 0) ? (
              <p className="text-sm text-gray-500">No trend data available.</p>
            ) : (
              <div className="flex items-end gap-2 h-40 overflow-x-auto">
                {trendData.map((t, i) => (
                  <div key={i} className="flex-1 min-w-[60px] flex flex-col items-center gap-1">
                    <div className="w-full flex items-end justify-center gap-0.5 h-28">
                      <div
                        title={`Revenue: ${fmt(t.revenue)}`}
                        className="flex-1 rounded-t bg-blue-500 transition-all"
                        style={{ height: `${maxTrend > 0 ? (t.revenue / maxTrend) * 100 : 0}%`, minHeight: t.revenue > 0 ? '4px' : '0' }}
                      />
                      <div
                        title={`Expenses: ${fmt(t.expenses)}`}
                        className="flex-1 rounded-t bg-red-400 transition-all"
                        style={{ height: `${maxTrend > 0 ? (t.expenses / maxTrend) * 100 : 0}%`, minHeight: t.expenses > 0 ? '4px' : '0' }}
                      />
                      <div
                        title={`Profit: ${fmt(t.profit)}`}
                        className={`flex-1 rounded-t transition-all ${t.profit >= 0 ? 'bg-green-500' : 'bg-red-700'}`}
                        style={{ height: `${maxTrend > 0 ? (Math.abs(t.profit) / maxTrend) * 100 : 0}%`, minHeight: Math.abs(t.profit) > 0 ? '4px' : '0' }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 whitespace-nowrap">{t.month.slice(5)}/{t.month.slice(2, 4)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
