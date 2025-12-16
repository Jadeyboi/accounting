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

  const card = (
    label: string, 
    value: number, 
    icon: React.ReactNode, 
    bgColor: string, 
    textColor: string,
    accentColor: string
  ) => (
    <div className={`group relative overflow-hidden rounded-xl border bg-white p-6 shadow-sm transition-all hover:shadow-md ${bgColor}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</div>
          <div className={`mt-3 text-3xl font-bold ${textColor}`}>₱{fmt(value)}</div>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-full ${accentColor} transition-transform group-hover:scale-110`}>
          {icon}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-1 text-xs text-gray-500">
        <span>{transactions.filter(t => 
          (label === 'Cash In' && t.type === 'in') ||
          (label === 'Cash Out' && t.type === 'out') ||
          (label === 'Expenses' && t.type === 'expense')
        ).length} transactions</span>
      </div>
    </div>
  )

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {card(
        'Cash In', 
        totals.in,
        <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
        </svg>,
        'border-emerald-100 hover:border-emerald-200',
        'text-emerald-700',
        'bg-emerald-100'
      )}
      {card(
        'Cash Out', 
        totals.out,
        <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
        </svg>,
        'border-amber-100 hover:border-amber-200',
        'text-amber-700',
        'bg-amber-100'
      )}
      {card(
        'Expenses', 
        totals.expense,
        <svg className="h-6 w-6 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>,
        'border-rose-100 hover:border-rose-200',
        'text-rose-700',
        'bg-rose-100'
      )}
      {card(
        'Balance', 
        balance,
        <svg className={`h-6 w-6 ${balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>,
        balance >= 0 ? 'border-emerald-200 hover:border-emerald-300' : 'border-rose-200 hover:border-rose-300',
        balance >= 0 ? 'text-emerald-700' : 'text-rose-700',
        balance >= 0 ? 'bg-emerald-100' : 'bg-rose-100'
      )}
    </div>
  )
}
