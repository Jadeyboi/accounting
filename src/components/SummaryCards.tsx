import { Transaction } from '@/types'

interface Props {
  transactions: Transaction[]
}

export default function SummaryCards({ transactions }: Props) {
  const totals = transactions.reduce(
    (acc, t) => {
      if (t.type === 'in') acc.in += t.amount
      if (t.type === 'out') acc.out += t.amount
      if (t.type === 'expense') acc.expense += t.amount
      return acc
    },
    { in: 0, out: 0, expense: 0 }
  )
  const balance = totals.in - (totals.out + totals.expense)

  const fmt = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const card = (label: string, value: number, classes: string, accent: string) => (
    <div className={`relative overflow-hidden rounded-xl border bg-white p-5 shadow-sm ${classes}`}>
      <div className="absolute inset-x-0 bottom-0 h-1" style={{ background: accent }} />
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold text-gray-900">₱ {fmt(value)}</div>
    </div>
  )

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {card('Cash In', totals.in, 'border-emerald-100', 'linear-gradient(90deg,#34d399,#10b981)')}
      {card('Cash Out', totals.out, 'border-amber-100', 'linear-gradient(90deg,#f59e0b,#fbbf24)')}
      {card('Expenses', totals.expense, 'border-rose-100', 'linear-gradient(90deg,#f43f5e,#fb7185)')}
      {card('Balance', balance, balance >= 0 ? 'border-emerald-200' : 'border-rose-200', balance >= 0 ? 'linear-gradient(90deg,#22c55e,#16a34a)' : 'linear-gradient(90deg,#fb7185,#f43f5e)')}
    </div>
  )
}
