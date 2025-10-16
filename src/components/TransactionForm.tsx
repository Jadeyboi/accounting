import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { TransactionType } from '@/types'

interface Props {
  onCreated: () => void
}

export default function TransactionForm({ onCreated }: Props) {
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [type, setType] = useState<TransactionType>('in')
  const [amount, setAmount] = useState<string>('')
  const [category, setCategory] = useState<string>('')
  const [note, setNote] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const amt = Number(amount)
    if (!amt || amt <= 0) {
      setError('Amount must be a positive number')
      return
    }
    setLoading(true)
    const { error: insertError } = await supabase.from('transactions').insert({
      date,
      type,
      amount: amt,
      category: category || null,
      note: note || null,
    })
    setLoading(false)
    if (insertError) {
      setError(insertError.message)
      return
    }
    setAmount('')
    setCategory('')
    setNote('')
    onCreated()
  }

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">Add Transaction</h3>
        <span className="text-xs text-slate-500">Quick entry</span>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
        <div className="sm:col-span-1">
          <label className="block text-sm text-slate-600">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1 w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-sm text-slate-600">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value as TransactionType)} className="mt-1 w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500">
            <option value="in">Cash In</option>
            <option value="out">Cash Out</option>
            <option value="expense">Expense</option>
          </select>
        </div>
        <div className="sm:col-span-1">
          <label className="block text-sm text-slate-600">Amount</label>
          <div className="mt-1 flex rounded-md shadow-sm">
            <span className="inline-flex items-center rounded-l-md border border-r-0 border-slate-300 bg-slate-50 px-3 text-slate-500">₱</span>
            <input type="number" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-r-md border border-slate-300 focus:border-blue-500 focus:ring-blue-500" />
          </div>
        </div>
        <div className="sm:col-span-1">
          <label className="block text-sm text-slate-600">Category</label>
          <input type="text" placeholder="e.g. Salary, Supplies" value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
        </div>
        <div className="sm:col-span-1">
          <label className="block text-sm text-slate-600">Note</label>
          <input type="text" placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} className="mt-1 w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500" />
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      <div className="mt-4">
        <button disabled={loading} type="submit" className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60">
          {loading ? 'Saving...' : 'Add Transaction'}
        </button>
      </div>
    </form>
  )
}
