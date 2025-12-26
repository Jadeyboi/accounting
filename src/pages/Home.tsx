import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SummaryCards from '@/components/SummaryCards'
import TransactionForm from '@/components/TransactionForm'
import TransactionList from '@/components/TransactionList'
import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/types'

const formatDate = (dateString: string): string => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = date.getFullYear()
  return `${month}-${day}-${year}`
}

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [summaryItems, setSummaryItems] = useState<Transaction[]>([])
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoadingSummary(true)
      setSummaryError(null)
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
      if (cancelled) return
      if (error) setSummaryError(error.message)
      else setSummaryItems((data ?? []) as Transaction[])
      setLoadingSummary(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const bump = () => setRefreshKey((k) => k + 1)

  const recentTransactions = summaryItems
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-700 p-8 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold">Welcome Back!</h2>
            <p className="mt-2 text-blue-100">
              Track your finances and manage your business accounting with ease
            </p>
          </div>
          <div className="hidden md:block">
            <div className="text-right">
              <div className="text-sm text-blue-100">Today</div>
              <div className="text-2xl font-semibold">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'long', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div>
        {loadingSummary ? (
          <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-12">
            <div className="text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
              <p className="mt-3 text-sm text-gray-600">Loading your financial summary...</p>
            </div>
          </div>
        ) : summaryError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <div className="flex items-start gap-3">
              <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-semibold text-red-900">Connection Error</h3>
                <p className="mt-1 text-sm text-red-700">{summaryError}</p>
                <p className="mt-2 text-xs text-red-600">
                  Please check your Supabase configuration in .env.local
                </p>
              </div>
            </div>
          </div>
        ) : (
          <SummaryCards transactions={summaryItems} />
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          onClick={() => setShowForm(!showForm)}
          className="group flex items-center gap-4 rounded-xl border-2 border-dashed border-gray-300 bg-white p-5 transition-all hover:border-blue-500 hover:bg-blue-50"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-600 group-hover:bg-blue-600 group-hover:text-white">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div className="text-left">
            <div className="font-semibold text-gray-900">Add Transaction</div>
            <div className="text-xs text-gray-500">Record income or expense</div>
          </div>
        </button>

        <Link
          to="/invoice"
          className="group flex items-center gap-4 rounded-xl border-2 border-dashed border-gray-300 bg-white p-5 transition-all hover:border-emerald-500 hover:bg-emerald-50"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="text-left">
            <div className="font-semibold text-gray-900">Create Invoice</div>
            <div className="text-xs text-gray-500">Generate client invoice</div>
          </div>
        </Link>

        <Link
          to="/reports"
          className="group flex items-center gap-4 rounded-xl border-2 border-dashed border-gray-300 bg-white p-5 transition-all hover:border-purple-500 hover:bg-purple-50"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100 text-purple-600 group-hover:bg-purple-600 group-hover:text-white">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="text-left">
            <div className="font-semibold text-gray-900">View Reports</div>
            <div className="text-xs text-gray-500">Financial insights</div>
          </div>
        </Link>

        <Link
          to="/payroll"
          className="group flex items-center gap-4 rounded-xl border-2 border-dashed border-gray-300 bg-white p-5 transition-all hover:border-amber-500 hover:bg-amber-50"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 group-hover:bg-amber-600 group-hover:text-white">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <div className="text-left">
            <div className="font-semibold text-gray-900">Manage Payroll</div>
            <div className="text-xs text-gray-500">Employee payments</div>
          </div>
        </Link>
      </div>

      {/* Transaction Form - Collapsible */}
      {showForm && (
        <div className="animate-fadeIn">
          <TransactionForm onCreated={() => { bump(); setShowForm(false); }} />
        </div>
      )}

      {/* Recent Activity Section */}
      {!loadingSummary && !summaryError && recentTransactions.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            <span className="text-xs text-gray-500">{recentTransactions.length} recent transactions</span>
          </div>
          <div className="space-y-3">
            {recentTransactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between rounded-lg border border-gray-100 p-4 hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    t.type === 'in' ? 'bg-emerald-100 text-emerald-600' :
                    t.type === 'out' ? 'bg-amber-100 text-amber-600' :
                    'bg-rose-100 text-rose-600'
                  }`}>
                    {t.type === 'in' ? '↓' : '↑'}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{t.category || 'Uncategorized'}</div>
                    <div className="text-xs text-gray-500">{formatDate(t.date)} {t.note && `• ${t.note}`}</div>
                  </div>
                </div>
                <div className={`text-lg font-semibold ${
                  t.type === 'in' ? 'text-emerald-600' : 'text-gray-900'
                }`}>
                  {t.type === 'in' ? '+' : '-'}₱{t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Transactions List */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">All Transactions</h3>
          <button
            onClick={() => setShowForm(!showForm)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            {showForm ? 'Hide Form' : 'Add New'}
          </button>
        </div>
        <TransactionList refreshKey={refreshKey} onChanged={bump} />
      </div>
    </div>
  )
}
