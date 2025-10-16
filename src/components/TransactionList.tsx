import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/types'

interface Props {
  refreshKey: number
  onChanged: () => void
}

export default function TransactionList({ refreshKey, onChanged }: Props) {
  const [items, setItems] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isCancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
      if (isCancelled) return
      if (error) {
        setError(error.message)
      } else {
        setItems((data ?? []) as Transaction[])
      }
      setLoading(false)
    }
    load()
    return () => {
      isCancelled = true
    }
  }, [refreshKey])

  const onDelete = async (id: string) => {
    if (!confirm('Delete this transaction?')) return
    const { error } = await supabase.from('transactions').delete().eq('id', id)
    if (error) {
      alert(error.message)
    } else {
      onChanged()
    }
  }

  if (loading) return <div className="mt-4 text-sm text-slate-600">Loading...</div>
  if (error) return <div className="mt-4 text-sm text-rose-600">{error}</div>

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Date</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Type</th>
            <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">Amount</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Category</th>
            <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Note</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {items.map((t, idx) => (
            <tr key={t.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50 hover:bg-slate-100'}>
              <td className="px-4 py-2 text-sm text-slate-800">{t.date}</td>
              <td className="px-4 py-2 text-sm">
                <span className={
                  t.type === 'in'
                    ? 'rounded bg-emerald-100 px-2 py-1 text-emerald-800'
                    : t.type === 'out'
                    ? 'rounded bg-amber-100 px-2 py-1 text-amber-800'
                    : 'rounded bg-rose-100 px-2 py-1 text-rose-800'
                }>
                  {t.type}
                </span>
              </td>
              <td className="px-4 py-2 text-right text-sm font-medium text-slate-900">₱ {t.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td className="px-4 py-2 text-sm text-slate-700">{t.category ?? ''}</td>
              <td className="px-4 py-2 text-sm text-slate-700">{t.note ?? ''}</td>
              <td className="px-4 py-2 text-right">
                <button onClick={() => onDelete(t.id)} className="rounded-md bg-rose-50 px-3 py-1 text-sm text-rose-700 hover:bg-rose-100">Delete</button>
              </td>
            </tr>
          ))}
          {items.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-6 text-center text-sm text-slate-500">No transactions yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
