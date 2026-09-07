import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLogger'

interface ExpenseItem {
  id: string
  name: string
  category: string | null
  default_amount: number
  active: boolean
  sort_order: number
}

interface Payment {
  id: string
  item_id: string
  month: string
  amount: number
  status: string
  paid_date: string | null
}

const php = (n: number) =>
  `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const usd = (n: number, rate: number) =>
  rate > 0 ? `$${(n / rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''

const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const today = () => new Date().toISOString().slice(0, 10)

const monthLabel = (m: string) => {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' })
}

export default function MonthlyExpenses() {
  const [month, setMonth] = useState(currentMonth())
  const [items, setItems] = useState<ExpenseItem[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [rate, setRate] = useState(56)
  const [rateInfo, setRateInfo] = useState<{ live: boolean; loading: boolean }>({ live: false, loading: true })

  // Item modal
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<ExpenseItem | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [defaultAmount, setDefaultAmount] = useState('')
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadData() }, [month])
  useEffect(() => { fetchLiveRate() }, [])

  const fetchLiveRate = async () => {
    setRateInfo(r => ({ ...r, loading: true }))
    const sources: Array<() => Promise<number | null>> = [
      async () => (await (await fetch('https://api.exchangerate.host/latest?base=USD&symbols=PHP')).json())?.rates?.PHP ?? null,
      async () => (await (await fetch('https://open.er-api.com/v6/latest/USD')).json())?.rates?.PHP ?? null,
      async () => (await (await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json')).json())?.usd?.php ?? null,
    ]
    for (const src of sources) {
      try {
        const p = await src()
        if (p && p > 0) { setRate(Number(p.toFixed(2))); setRateInfo({ live: true, loading: false }); return }
      } catch { /* next */ }
    }
    setRateInfo({ live: false, loading: false })
  }

  const loadData = async () => {
    setLoading(true)
    const [it, pay] = await Promise.all([
      supabase.from('monthly_expense_items').select('*').order('sort_order').order('name'),
      supabase.from('monthly_expense_payments').select('*').eq('month', month),
    ])
    setItems((it.data ?? []) as ExpenseItem[])
    setPayments((pay.data ?? []) as Payment[])
    setLoading(false)
  }

  const paymentFor = (itemId: string) => payments.find(p => p.item_id === itemId)
  const activeItems = useMemo(() => items.filter(i => i.active), [items])

  // ── Summary ─────────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    let due = 0, paid = 0
    for (const i of activeItems) {
      const pmt = paymentFor(i.id)
      due += pmt ? Number(pmt.amount) : Number(i.default_amount)
      if (pmt) paid += Number(pmt.amount)
    }
    return { due, paid, unpaid: due - paid, paidCount: activeItems.filter(i => paymentFor(i.id)).length }
  }, [activeItems, payments])

  // ── Item CRUD ─────────────────────────────────────────────────────────────
  const openModal = (i?: ExpenseItem) => {
    setEditing(i ?? null)
    setName(i?.name ?? '')
    setCategory(i?.category ?? '')
    setDefaultAmount(i?.default_amount?.toString() ?? '')
    setActive(i?.active ?? true)
    setShowModal(true)
  }

  const saveItem = async () => {
    if (!name.trim()) { alert('Name is required'); return }
    if (defaultAmount === '' || isNaN(Number(defaultAmount))) { alert('Valid amount required'); return }
    setSaving(true)
    const payload = {
      name: name.trim(),
      category: category.trim() || null,
      default_amount: Number(defaultAmount),
      active,
    }
    if (editing) {
      const { error } = await supabase.from('monthly_expense_items').update(payload).eq('id', editing.id)
      if (error) { alert(error.message); setSaving(false); return }
      await logActivity('UPDATE', 'Monthly Expenses', `Updated item: ${name} — ${php(Number(defaultAmount))}`, payload)
    } else {
      const { error } = await supabase.from('monthly_expense_items').insert({ ...payload, sort_order: items.length })
      if (error) { alert(error.message); setSaving(false); return }
      await logActivity('CREATE', 'Monthly Expenses', `Added item: ${name} — ${php(Number(defaultAmount))}`, payload)
    }
    setSaving(false)
    setShowModal(false)
    await loadData()
  }

  const deleteItem = async (i: ExpenseItem) => {
    if (!confirm(`Delete "${i.name}" and all its payment history?`)) return
    await supabase.from('monthly_expense_items').delete().eq('id', i.id)
    await logActivity('DELETE', 'Monthly Expenses', `Deleted item: ${i.name}`, { id: i.id })
    await loadData()
  }

  // ── Payment actions ─────────────────────────────────────────────────────
  const markPaid = async (i: ExpenseItem) => {
    if (paymentFor(i.id)) return
    const amount = Number(i.default_amount)
    const input = prompt(`Amount paid for ${i.name} (${monthLabel(month)}):`, amount ? amount.toString() : '')
    if (input === null) return
    const amt = Number(input)
    if (isNaN(amt) || amt < 0) { alert('Invalid amount'); return }
    const payload = { item_id: i.id, month, amount: amt, status: 'paid', paid_date: today() }
    // Internal guide only — do NOT record in the transactions tracker.
    const { error } = await supabase.from('monthly_expense_payments').upsert(payload, { onConflict: 'item_id,month' })
    if (error) { alert(error.message); return }
    await logActivity('UPDATE', 'Monthly Expenses', `Marked PAID: ${i.name} ${month} — ${php(amt)}`, payload)
    await loadData()
  }

  const markUnpaid = async (i: ExpenseItem) => {
    const pmt = paymentFor(i.id)
    if (!pmt) return
    if (!confirm(`Mark ${i.name} for ${monthLabel(month)} as UNPAID?`)) return
    const { error } = await supabase.from('monthly_expense_payments').delete().eq('id', pmt.id)
    if (error) { alert(error.message); return }
    await logActivity('DELETE', 'Monthly Expenses', `Reverted to unpaid: ${i.name} ${month}`, { id: pmt.id })
    await loadData()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Monthly Expenses</h2>
          <p className="text-sm text-gray-600">Internal guide to track recurring bills — this does not affect the main tracker or reports</p>
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
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-semibold text-green-700">● Live</span>
            )}
          </div>
          <button onClick={() => openModal()} className="btn-primary">+ Add Expense Item</button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl p-5 bg-gradient-to-br from-slate-600 to-slate-700 text-white shadow-lg">
          <p className="text-xs font-medium opacity-80">Total Due ({monthLabel(month)})</p>
          <p className="text-2xl font-bold mt-1">{php(summary.due)}</p>
          <p className="text-xs opacity-70 mt-0.5">{usd(summary.due, rate)} • {activeItems.length} item{activeItems.length === 1 ? '' : 's'}</p>
        </div>
        <div className="rounded-xl p-5 bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg">
          <p className="text-xs font-medium opacity-80">Paid</p>
          <p className="text-2xl font-bold mt-1">{php(summary.paid)}</p>
          <p className="text-xs opacity-70 mt-0.5">{usd(summary.paid, rate)} • {summary.paidCount} of {activeItems.length} paid</p>
        </div>
        <div className="rounded-xl p-5 bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg">
          <p className="text-xs font-medium opacity-80">Still Unpaid</p>
          <p className="text-2xl font-bold mt-1">{php(summary.unpaid)}</p>
          <p className="text-xs opacity-70 mt-0.5">{usd(summary.unpaid, rate)}</p>
        </div>
      </div>

      {/* Items table */}
      {loading ? (
        <div className="py-16 text-center text-sm text-gray-500">Loading...</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-gray-500">No expense items yet. Add your recurring bills (Rent, CUSA, Internet, etc.).</p>
          <button onClick={() => openModal()} className="mt-4 btn-primary">+ Add your first item</button>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white shadow-lg overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Expense', 'Category', 'Amount', 'Status', 'Paid Date', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {items.map(i => {
                const pmt = paymentFor(i.id)
                const isPaid = !!pmt
                const amount = pmt ? Number(pmt.amount) : Number(i.default_amount)
                const inactive = !i.active
                return (
                  <tr key={i.id} className={`hover:bg-gray-50 ${inactive ? 'opacity-50' : ''} ${isPaid ? 'bg-green-50/40' : ''}`}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {i.name}
                      {inactive && <span className="ml-2 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">inactive</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{i.category || '-'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                      <div>{php(amount)}</div>
                      <div className="text-xs font-normal text-gray-400">{usd(amount, rate)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${isPaid ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {isPaid ? '✓ Paid' : '● Unpaid'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{pmt?.paid_date || '-'}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {isPaid ? (
                        <button onClick={() => markUnpaid(i)} className="mr-3 text-amber-600 hover:underline">Mark Unpaid</button>
                      ) : (
                        <button onClick={() => markPaid(i)} className="mr-3 text-green-600 hover:underline font-medium">Mark Paid</button>
                      )}
                      <button onClick={() => openModal(i)} className="mr-3 text-blue-600 hover:underline">Edit</button>
                      <button onClick={() => deleteItem(i)} className="text-red-600 hover:underline">Delete</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-medium">
                <td colSpan={2} className="px-4 py-3 text-sm text-gray-700">Total ({monthLabel(month)})</td>
                <td className="px-4 py-3 text-sm font-bold text-gray-900">
                  <div>{php(summary.due)}</div>
                  <div className="text-xs font-normal text-gray-400">{usd(summary.due, rate)}</div>
                </td>
                <td colSpan={3} className="px-4 py-3 text-sm text-gray-600">
                  <span className="text-green-700">{php(summary.paid)} paid</span>
                  {summary.unpaid > 0 && <span className="text-amber-700"> • {php(summary.unpaid)} unpaid</span>}
                  <div className="text-xs text-gray-400">{usd(summary.paid, rate)} paid{summary.unpaid > 0 ? ` • ${usd(summary.unpaid, rate)} unpaid` : ''}</div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Item Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-6">
              <h3 className="text-xl font-bold">{editing ? 'Edit Expense Item' : 'Add Expense Item'}</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium">Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} className="input-field w-full" placeholder="e.g. Rent, CUSA, Internet" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Category</label>
                  <input value={category} onChange={e => setCategory(e.target.value)} className="input-field w-full" placeholder="Optional" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Default Amount (₱) *</label>
                  <input type="number" min="0" step="0.01" value={defaultAmount} onChange={e => setDefaultAmount(e.target.value)} className="input-field w-full" placeholder="0.00" />
                  {defaultAmount && !isNaN(Number(defaultAmount)) && rate > 0 && (
                    <p className="mt-1 text-xs text-gray-500">≈ {usd(Number(defaultAmount), rate)}</p>
                  )}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="rounded border-gray-300" />
                Active (include in monthly total)
              </label>
            </div>
            <div className="flex justify-end gap-3 border-t p-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveItem} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editing ? 'Update' : 'Add Item'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
