import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/types'

function formatYYYYMM(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function firstAndLastOfMonth(yyyyMm: string) {
  const [y, m] = yyyyMm.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const last = new Date(y, m, 0)
  const toISO = (x: Date) => x.toISOString().slice(0, 10)
  return { first: toISO(first), last: toISO(last) }
}

export default function Monthly() {
  const [month, setMonth] = useState<string>(() => formatYYYYMM(new Date()))
  const [items, setItems] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      const { first, last } = firstAndLastOfMonth(month)
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('date', first)
        .lte('date', last)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (error) setError(error.message)
      else setItems((data ?? []) as Transaction[])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [month])

  const { credit, debit, remaining } = useMemo(() => {
    const sums = items.reduce(
      (acc, t) => {
        if (t.type === 'in') acc.credit += t.amount
        else acc.debit += t.amount
        return acc
      },
      { credit: 0, debit: 0 }
    )
    return { ...sums, remaining: sums.credit - sums.debit }
  }, [items])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Monthly Summary</h2>
          <p className="text-sm text-gray-600">Credit, debit, and remaining for selected month.</p>
        </div>
        <div>
          <label className="block text-sm text-gray-600">Month</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Credit (Cash In)</div>
          <div className="mt-2 text-2xl font-semibold">₱ {credit.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        </div>
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Debit (Cash Out + Expenses)</div>
          <div className="mt-2 text-2xl font-semibold">₱ {debit.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        </div>
        <div className={`rounded-lg border p-4 shadow-sm ${remaining >= 0 ? 'border-green-200 bg-white' : 'border-red-200 bg-white'}`}>
          <div className="text-sm text-gray-500">Remaining</div>
          <div className="mt-2 text-2xl font-semibold">₱ {remaining.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Date</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Type</th>
              <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Amount</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Category</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-600">Loading...</td>
              </tr>
            )}
            {error && !loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-red-600">{error}</td>
              </tr>
            )}
            {!loading && !error && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">No transactions for this month.</td>
              </tr>
            )}
            {!loading && !error && items.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2 text-sm text-gray-800">{t.date}</td>
                <td className="px-4 py-2 text-sm">
                  <span className={
                    t.type === 'in'
                      ? 'rounded bg-green-100 px-2 py-1 text-green-800'
                      : t.type === 'out'
                      ? 'rounded bg-yellow-100 px-2 py-1 text-yellow-800'
                      : 'rounded bg-red-100 px-2 py-1 text-red-800'
                  }>
                    {t.type}
                  </span>
                </td>
                <td className="px-4 py-2 text-right text-sm font-medium text-gray-900">₱ {t.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                <td className="px-4 py-2 text-sm text-gray-700">{t.category ?? ''}</td>
                <td className="px-4 py-2 text-sm text-gray-700">{t.note ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
