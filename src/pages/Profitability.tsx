import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLogger'

// ── Types ─────────────────────────────────────────────────────────────────
interface IncomeRow {
  id: string
  month: string
  description: string
  client: string | null
  project: string | null
  amount: number
}

interface ExpenseRow {
  id: string
  month: string
  category: string
  description: string | null
  project: string | null
  amount: number
}

// Expense pulled from the transactions tracker (read-only here)
interface TrackerExpense {
  id: string
  date: string
  type: 'out' | 'expense'
  category: string | null
  note: string | null
  amount: number
}

// Cash-in pulled from the transactions tracker (read-only here)
interface TrackerIncome {
  id: string
  date: string
  category: string | null
  note: string | null
  amount: number
}

const EXPENSE_CATEGORIES = [
  'Payroll', 'Software', 'Equipment', 'Internet', 'Office', 'Rent',
  'Utilities', 'Recruitment', 'Training', 'Taxes', 'Other',
]

// ── Helpers ─────────────────────────────────────────────────────────────────
const php = (n: number) =>
  `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const usd = (n: number, rate: number) =>
  rate > 0 ? `$${(n / rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''

const pct = (n: number) => `${n.toFixed(1)}%`

const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const monthRange = (m: string) => {
  const [y, mo] = m.split('-').map(Number)
  const first = `${y}-${String(mo).padStart(2, '0')}-01`
  const lastDay = new Date(y, mo, 0).getDate()
  const last = `${y}-${String(mo).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { first, last }
}

const last6Months = (m: string): string[] => {
  const [y, mo] = m.split('-').map(Number)
  const months: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(y, mo - 1 - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

const UNALLOCATED = 'Unallocated'

export default function Profitability() {
  const [month, setMonth] = useState(currentMonth())
  const [rate, setRate] = useState(56)
  const [rateInfo, setRateInfo] = useState<{ live: boolean; loading: boolean; updated: string | null }>({ live: false, loading: true, updated: null })
  const [income, setIncome] = useState<IncomeRow[]>([])
  const [expenses, setExpenses] = useState<ExpenseRow[]>([])
  const [trackerExpenses, setTrackerExpenses] = useState<TrackerExpense[]>([])
  const [trackerIncome, setTrackerIncome] = useState<TrackerIncome[]>([])
  const [loading, setLoading] = useState(true)
  const [trend, setTrend] = useState<Array<{ month: string; income: number; expenses: number; profit: number }>>([])

  // Modals
  const [showIncomeModal, setShowIncomeModal] = useState(false)
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [editIncome, setEditIncome] = useState<IncomeRow | null>(null)
  const [editExpense, setEditExpense] = useState<ExpenseRow | null>(null)

  // Income form
  const [iDesc, setIDesc] = useState('')
  const [iClient, setIClient] = useState('')
  const [iProject, setIProject] = useState('')
  const [iAmount, setIAmount] = useState('')

  // Expense form
  const [eCategory, setECategory] = useState('Payroll')
  const [eDesc, setEDesc] = useState('')
  const [eProject, setEProject] = useState('')
  const [eAmount, setEAmount] = useState('')

  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [month])
  useEffect(() => { fetchLiveRate() }, [])

  // Fetch the live USD -> PHP exchange rate (free, no-key APIs, with fallback)
  const fetchLiveRate = async () => {
    setRateInfo(r => ({ ...r, loading: true }))
    // Try primary then fallback source
    const sources: Array<() => Promise<number | null>> = [
      async () => {
        const res = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=PHP')
        const d = await res.json()
        return d?.rates?.PHP ?? null
      },
      async () => {
        const res = await fetch('https://open.er-api.com/v6/latest/USD')
        const d = await res.json()
        return d?.rates?.PHP ?? null
      },
      async () => {
        const res = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json')
        const d = await res.json()
        return d?.usd?.php ?? null
      },
    ]
    for (const src of sources) {
      try {
        const php = await src()
        if (php && php > 0) {
          setRate(Number(php.toFixed(2)))
          setRateInfo({ live: true, loading: false, updated: new Date().toLocaleTimeString() })
          return
        }
      } catch { /* try next source */ }
    }
    // All failed — keep manual rate
    setRateInfo({ live: false, loading: false, updated: null })
  }

  const loadData = async () => {
    setLoading(true)
    const months6 = last6Months(month)
    const { first, last } = monthRange(month)
    const [inc, exp, tracker, trackerIn, trendRes] = await Promise.all([
      supabase.from('pl_income').select('*').eq('month', month).order('created_at'),
      supabase.from('pl_expenses').select('*').eq('month', month).order('created_at'),
      supabase.from('transactions').select('id,date,type,category,note,amount')
        .in('type', ['out', 'expense']).gte('date', first).lte('date', last)
        .order('date', { ascending: false }),
      supabase.from('transactions').select('id,date,category,note,amount')
        .eq('type', 'in').gte('date', first).lte('date', last)
        .order('date', { ascending: false }),
      Promise.all(months6.map(async (mo) => {
        const r = monthRange(mo)
        const [i, e, t, ti] = await Promise.all([
          supabase.from('pl_income').select('amount').eq('month', mo),
          supabase.from('pl_expenses').select('amount').eq('month', mo),
          supabase.from('transactions').select('amount').in('type', ['out', 'expense']).gte('date', r.first).lte('date', r.last),
          supabase.from('transactions').select('amount').eq('type', 'in').gte('date', r.first).lte('date', r.last),
        ])
        const inManual = (i.data ?? []).reduce((s: number, x: { amount: number }) => s + Number(x.amount), 0)
        const inTracker = (ti.data ?? []).reduce((s: number, x: { amount: number }) => s + Number(x.amount), 0)
        const inSum = inManual + inTracker
        const exManual = (e.data ?? []).reduce((s: number, x: { amount: number }) => s + Number(x.amount), 0)
        const exTracker = (t.data ?? []).reduce((s: number, x: { amount: number }) => s + Number(x.amount), 0)
        const exSum = exManual + exTracker
        return { month: mo, income: inSum, expenses: exSum, profit: inSum - exSum }
      })),
    ])
    setIncome((inc.data ?? []) as IncomeRow[])
    setExpenses((exp.data ?? []) as ExpenseRow[])
    setTrackerExpenses((tracker.data ?? []) as TrackerExpense[])
    setTrackerIncome((trackerIn.data ?? []) as TrackerIncome[])
    setTrend(trendRes)
    setLoading(false)
  }

  // ── Totals ─────────────────────────────────────────────────────────────────
  const manualIncome = useMemo(() => income.reduce((s, r) => s + Number(r.amount), 0), [income])
  const trackerIncomeTotal = useMemo(() => trackerIncome.reduce((s, r) => s + Number(r.amount), 0), [trackerIncome])
  const totalIncome = manualIncome + trackerIncomeTotal
  const manualExpenses = useMemo(() => expenses.reduce((s, r) => s + Number(r.amount), 0), [expenses])
  const trackerExpensesTotal = useMemo(() => trackerExpenses.reduce((s, r) => s + Number(r.amount), 0), [trackerExpenses])
  const totalExpenses = manualExpenses + trackerExpensesTotal
  const netProfit = totalIncome - totalExpenses
  const margin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {}
    for (const e of expenses) map[e.category] = (map[e.category] ?? 0) + Number(e.amount)
    for (const t of trackerExpenses) {
      const key = t.category || (t.type === 'out' ? 'Cash Out' : 'Expense')
      map[key] = (map[key] ?? 0) + Number(t.amount)
    }
    return Object.entries(map).map(([cat, amt]) => ({ cat, amt })).sort((a, b) => b.amt - a.amt)
  }, [expenses, trackerExpenses])

  // ── Per-project breakdown ───────────────────────────────────────────────
  const projectStats = useMemo(() => {
    const map: Record<string, { income: number; expenses: number }> = {}
    const ensure = (k: string) => (map[k] ??= { income: 0, expenses: 0 })
    for (const r of income) ensure(r.project?.trim() || UNALLOCATED).income += Number(r.amount)
    for (const e of expenses) ensure(e.project?.trim() || UNALLOCATED).expenses += Number(e.amount)
    // tracker income/expenses are not project-tagged -> Unallocated
    if (trackerIncomeTotal > 0) ensure(UNALLOCATED).income += trackerIncomeTotal
    if (trackerExpensesTotal > 0) ensure(UNALLOCATED).expenses += trackerExpensesTotal
    return Object.entries(map)
      .map(([project, v]) => ({ project, income: v.income, expenses: v.expenses, profit: v.income - v.expenses }))
      .sort((a, b) => b.profit - a.profit)
  }, [income, expenses, trackerIncomeTotal, trackerExpensesTotal])

  const maxTrend = useMemo(() => Math.max(...trend.map(t => Math.max(t.income, t.expenses)), 1), [trend])

  // ── Income CRUD ──────────────────────────────────────────────────────────
  const openIncome = (r?: IncomeRow) => {
    setEditIncome(r ?? null)
    setIDesc(r?.description ?? '')
    setIClient(r?.client ?? '')
    setIProject(r?.project ?? '')
    setIAmount(r?.amount?.toString() ?? '')
    setShowIncomeModal(true)
  }

  const saveIncome = async () => {
    if (!iDesc.trim()) { alert('Description is required'); return }
    if (!iAmount || isNaN(Number(iAmount))) { alert('Valid amount required'); return }
    setSaving(true)
    const payload = {
      month,
      description: iDesc.trim(),
      client: iClient.trim() || null,
      project: iProject.trim() || null,
      amount: Number(iAmount),
    }
    if (editIncome) {
      const { error } = await supabase.from('pl_income').update(payload).eq('id', editIncome.id)
      if (error) { alert(error.message); setSaving(false); return }
      await logActivity('UPDATE', 'P&L Income', `Updated income: ${php(Number(iAmount))} — ${iDesc}`, payload)
    } else {
      const { error } = await supabase.from('pl_income').insert(payload)
      if (error) { alert(error.message); setSaving(false); return }
      await logActivity('CREATE', 'P&L Income', `Added income: ${php(Number(iAmount))} — ${iDesc}`, payload)
    }
    setSaving(false)
    setShowIncomeModal(false)
    await loadData()
  }

  const deleteIncome = async (r: IncomeRow) => {
    if (!confirm(`Delete income "${r.description}" of ${php(Number(r.amount))}?`)) return
    await supabase.from('pl_income').delete().eq('id', r.id)
    await logActivity('DELETE', 'P&L Income', `Deleted income: ${php(Number(r.amount))} — ${r.description}`, { id: r.id })
    await loadData()
  }

  // ── Expense CRUD ─────────────────────────────────────────────────────────
  const openExpense = (r?: ExpenseRow) => {
    setEditExpense(r ?? null)
    setECategory(r?.category ?? 'Payroll')
    setEDesc(r?.description ?? '')
    setEProject(r?.project ?? '')
    setEAmount(r?.amount?.toString() ?? '')
    setShowExpenseModal(true)
  }

  const saveExpense = async () => {
    if (!eAmount || isNaN(Number(eAmount))) { alert('Valid amount required'); return }
    setSaving(true)
    const payload = {
      month,
      category: eCategory,
      description: eDesc.trim() || null,
      project: eProject.trim() || null,
      amount: Number(eAmount),
    }
    if (editExpense) {
      const { error } = await supabase.from('pl_expenses').update(payload).eq('id', editExpense.id)
      if (error) { alert(error.message); setSaving(false); return }
      await logActivity('UPDATE', 'P&L Expenses', `Updated expense: ${eCategory} ${php(Number(eAmount))}`, payload)
    } else {
      const { error } = await supabase.from('pl_expenses').insert(payload)
      if (error) { alert(error.message); setSaving(false); return }
      await logActivity('CREATE', 'P&L Expenses', `Added expense: ${eCategory} ${php(Number(eAmount))}`, payload)
    }
    setSaving(false)
    setShowExpenseModal(false)
    await loadData()
  }

  const deleteExpense = async (r: ExpenseRow) => {
    if (!confirm(`Delete ${r.category} expense of ${php(Number(r.amount))}?`)) return
    await supabase.from('pl_expenses').delete().eq('id', r.id)
    await logActivity('DELETE', 'P&L Expenses', `Deleted expense: ${r.category} ${php(Number(r.amount))}`, { id: r.id })
    await loadData()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Profit &amp; Loss</h2>
          <p className="text-sm text-gray-600">Income, expenses, and per-project profitability</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="input-field" />
          <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5">
            <span className="text-xs font-medium text-gray-600">USD Rate:</span>
            <span className="text-xs text-gray-500">₱</span>
            <input type="number" min="1" step="0.01" value={rate} onChange={e => { setRate(Number(e.target.value) || 56); setRateInfo(r => ({ ...r, live: false })) }} className="w-16 border-0 p-0 text-sm font-medium text-gray-900 focus:ring-0" />
            <span className="text-xs text-gray-500">= $1</span>
            <button onClick={fetchLiveRate} title="Refresh live rate" className="ml-1 text-gray-400 hover:text-blue-600">
              <svg className={`h-4 w-4 ${rateInfo.loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            </button>
            {rateInfo.live && !rateInfo.loading && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700" title={rateInfo.updated ? `Updated ${rateInfo.updated}` : ''}>● Live</span>
            )}
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl p-5 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
          <p className="text-xs font-medium opacity-80">Total Income</p>
          <p className="text-2xl font-bold mt-1">{php(totalIncome)}</p>
          <p className="text-xs opacity-70 mt-0.5">{usd(totalIncome, rate)}</p>
        </div>
        <div className="rounded-xl p-5 bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg">
          <p className="text-xs font-medium opacity-80">Total Expenses</p>
          <p className="text-2xl font-bold mt-1">{php(totalExpenses)}</p>
          <p className="text-xs opacity-70 mt-0.5">{usd(totalExpenses, rate)}</p>
        </div>
        <div className={`rounded-xl p-5 text-white shadow-lg bg-gradient-to-br ${netProfit >= 0 ? 'from-green-500 to-green-600' : 'from-red-600 to-red-700'}`}>
          <p className="text-xs font-medium opacity-80">{netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</p>
          <p className="text-2xl font-bold mt-1">{php(netProfit)}</p>
          <p className="text-xs opacity-70 mt-0.5">{usd(netProfit, rate)} • {pct(margin)} margin</p>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-500">Loading...</div>
      ) : (
        <>
          {/* Per-project profitability */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-gray-900">Per-Project Profitability</h3>
              <p className="text-xs text-gray-500">Tag income (and manual expenses) with a project to break it down. Tracker cash-in and expenses appear under "{UNALLOCATED}".</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Project', 'Income', 'Expenses', 'Profit', 'Margin'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {projectStats.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-500">No data for this month.</td></tr>
                  ) : projectStats.map(ps => {
                    const m = ps.income > 0 ? (ps.profit / ps.income) * 100 : 0
                    return (
                      <tr key={ps.project} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{ps.project}</td>
                        <td className="px-4 py-3 text-sm text-gray-900"><div>{php(ps.income)}</div><div className="text-xs text-gray-400">{usd(ps.income, rate)}</div></td>
                        <td className="px-4 py-3 text-sm text-gray-900"><div>{php(ps.expenses)}</div><div className="text-xs text-gray-400">{usd(ps.expenses, rate)}</div></td>
                        <td className={`px-4 py-3 text-sm font-semibold ${ps.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}><div>{php(ps.profit)}</div><div className="text-xs opacity-70">{usd(ps.profit, rate)}</div></td>
                        <td className={`px-4 py-3 text-sm font-semibold ${m >= 0 ? 'text-gray-700' : 'text-red-600'}`}>{ps.income > 0 ? pct(m) : '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Two columns: Income and Expenses */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Income */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-blue-50">
                <h3 className="text-base font-semibold text-blue-900">Income</h3>
                <button onClick={() => openIncome()} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">+ Add Income</button>
              </div>
              <div className="divide-y divide-gray-100">
                {/* Tracker-pulled cash-in */}
                {trackerIncome.map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 bg-emerald-50/40">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">Cash In</span>
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">From Tracker</span>
                        {t.category && <span className="text-sm text-gray-700 truncate">{t.category}</span>}
                      </div>
                      {t.note && <p className="text-xs text-gray-500 truncate mt-0.5">{t.note}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{php(Number(t.amount))}</p>
                      <p className="text-xs text-gray-400">{usd(Number(t.amount), rate)}</p>
                    </div>
                  </div>
                ))}
                {/* Manual P&L income */}
                {income.map(r => (
                  <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-gray-50">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Manual</span>
                        <p className="text-sm font-medium text-gray-900 truncate">{r.description}</p>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        {[r.client, r.project].filter(Boolean).join(' • ') || '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">{php(Number(r.amount))}</p>
                        <p className="text-xs text-gray-400">{usd(Number(r.amount), rate)}</p>
                      </div>
                      <button onClick={() => openIncome(r)} className="text-blue-600 hover:underline text-xs">Edit</button>
                      <button onClick={() => deleteIncome(r)} className="text-red-600 hover:underline text-xs">Delete</button>
                    </div>
                  </div>
                ))}
                {trackerIncome.length === 0 && income.length === 0 && (
                  <p className="px-5 py-8 text-center text-sm text-gray-500">No income this month. Add one, or record cash-in in the tracker.</p>
                )}
              </div>
              {totalIncome > 0 && (
                <div className="border-t border-gray-200 bg-gray-50 px-5 py-3 space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>From Tracker</span><span>{php(trackerIncomeTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Manual</span><span>{php(manualIncome)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-200 pt-1">
                    <span className="text-sm font-semibold text-gray-700">Total Income</span>
                    <span className="text-sm font-bold text-blue-700">{php(totalIncome)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Expenses */}
            <div className="rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-red-50">
                <h3 className="text-base font-semibold text-red-900">Expenses</h3>
                <button onClick={() => openExpense()} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700">+ Add Expense</button>
              </div>
              <div className="divide-y divide-gray-100">
                {/* Tracker-pulled expenses */}
                {trackerExpenses.map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 bg-amber-50/40">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.type === 'expense' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                          {t.type === 'expense' ? 'Expense' : 'Cash Out'}
                        </span>
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">From Tracker</span>
                        {t.category && <span className="text-sm text-gray-700 truncate">{t.category}</span>}
                      </div>
                      {t.note && <p className="text-xs text-gray-500 truncate mt-0.5">{t.note}</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{php(Number(t.amount))}</p>
                      <p className="text-xs text-gray-400">{usd(Number(t.amount), rate)}</p>
                    </div>
                  </div>
                ))}
                {/* Manual P&L expenses */}
                {expenses.map(r => (
                  <div key={r.id} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-gray-50">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Manual</span>
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{r.category}</span>
                        {r.project && <span className="text-xs text-purple-600">{r.project}</span>}
                        {r.description && <span className="text-sm text-gray-700 truncate">{r.description}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">{php(Number(r.amount))}</p>
                        <p className="text-xs text-gray-400">{usd(Number(r.amount), rate)}</p>
                      </div>
                      <button onClick={() => openExpense(r)} className="text-blue-600 hover:underline text-xs">Edit</button>
                      <button onClick={() => deleteExpense(r)} className="text-red-600 hover:underline text-xs">Delete</button>
                    </div>
                  </div>
                ))}
                {trackerExpenses.length === 0 && expenses.length === 0 && (
                  <p className="px-5 py-8 text-center text-sm text-gray-500">No expenses this month. Add one, or record them in the tracker.</p>
                )}
              </div>
              {totalExpenses > 0 && (
                <div className="border-t border-gray-200 bg-gray-50 px-5 py-3 space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>From Tracker</span><span>{php(trackerExpensesTotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>Manual</span><span>{php(manualExpenses)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-200 pt-1">
                    <span className="text-sm font-semibold text-gray-700">Total Expenses</span>
                    <span className="text-sm font-bold text-red-700">{php(totalExpenses)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Expense breakdown + trend */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-gray-200 bg-white shadow-lg p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">Expenses by Category</h3>
              {expenseByCategory.length === 0 ? (
                <p className="text-sm text-gray-500">No expenses this month.</p>
              ) : (
                <div className="space-y-3">
                  {expenseByCategory.map(({ cat, amt }) => (
                    <div key={cat}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700">{cat}</span>
                        <span className="text-xs text-gray-600">{php(amt)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full bg-gradient-to-r from-red-400 to-red-500" style={{ width: `${totalExpenses > 0 ? (amt / totalExpenses) * 100 : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white shadow-lg p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-1">Last 6 Months</h3>
              <div className="flex gap-4 text-xs text-gray-500 mb-4">
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded bg-blue-500"></span>Income</span>
                <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded bg-red-400"></span>Expenses</span>
              </div>
              {trend.every(t => t.income === 0 && t.expenses === 0) ? (
                <p className="text-sm text-gray-500">No data yet.</p>
              ) : (
                <div className="flex items-end gap-2 h-40">
                  {trend.map((t, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex items-end justify-center gap-0.5 h-28">
                        <div title={`Income: ${php(t.income)}`} className="flex-1 rounded-t bg-blue-500" style={{ height: `${(t.income / maxTrend) * 100}%`, minHeight: t.income > 0 ? '4px' : '0' }} />
                        <div title={`Expenses: ${php(t.expenses)}`} className="flex-1 rounded-t bg-red-400" style={{ height: `${(t.expenses / maxTrend) * 100}%`, minHeight: t.expenses > 0 ? '4px' : '0' }} />
                      </div>
                      <span className={`text-xs font-medium ${t.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{t.profit >= 0 ? '+' : ''}{Math.round(t.profit / 1000)}k</span>
                      <span className="text-xs text-gray-500 whitespace-nowrap">{t.month.slice(5)}/{t.month.slice(2, 4)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Income Modal */}
      {showIncomeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-6">
              <h3 className="text-xl font-bold">{editIncome ? 'Edit Income' : 'Add Income'}</h3>
              <button onClick={() => setShowIncomeModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium">Description *</label>
                <input value={iDesc} onChange={e => setIDesc(e.target.value)} className="input-field w-full" placeholder="e.g. Monthly retainer" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Client / Label</label>
                  <input value={iClient} onChange={e => setIClient(e.target.value)} className="input-field w-full" placeholder="Optional" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Project</label>
                  <input value={iProject} onChange={e => setIProject(e.target.value)} className="input-field w-full" placeholder="Optional" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Amount (₱) *</label>
                <input type="number" min="0" step="0.01" value={iAmount} onChange={e => setIAmount(e.target.value)} className="input-field w-full" placeholder="0.00" />
                {iAmount && !isNaN(Number(iAmount)) && rate > 0 && (
                  <p className="text-xs text-gray-500 mt-1">≈ {usd(Number(iAmount), rate)}</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t p-6">
              <button onClick={() => setShowIncomeModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveIncome} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editIncome ? 'Update' : 'Add Income'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-6">
              <h3 className="text-xl font-bold">{editExpense ? 'Edit Expense' : 'Add Expense'}</h3>
              <button onClick={() => setShowExpenseModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Category *</label>
                  <select value={eCategory} onChange={e => setECategory(e.target.value)} className="input-field w-full">
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Amount (₱) *</label>
                  <input type="number" min="0" step="0.01" value={eAmount} onChange={e => setEAmount(e.target.value)} className="input-field w-full" placeholder="0.00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Project</label>
                  <input value={eProject} onChange={e => setEProject(e.target.value)} className="input-field w-full" placeholder="Optional" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Description</label>
                  <input value={eDesc} onChange={e => setEDesc(e.target.value)} className="input-field w-full" placeholder="Optional note" />
                </div>
              </div>
              {eAmount && !isNaN(Number(eAmount)) && rate > 0 && (
                <p className="text-xs text-gray-500">≈ {usd(Number(eAmount), rate)}</p>
              )}
            </div>
            <div className="flex justify-end gap-3 border-t p-6">
              <button onClick={() => setShowExpenseModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveExpense} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editExpense ? 'Update' : 'Add Expense'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
