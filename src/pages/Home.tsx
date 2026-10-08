import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SummaryCards from '@/components/SummaryCards'
import TransactionForm from '@/components/TransactionForm'
import TransactionList from '@/components/TransactionList'
import Notifications from '@/components/Notifications'
import StorageStatus from '@/components/StorageStatus'
import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/types'

const formatDate = (dateString: string): string => {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [summaryItems, setSummaryItems] = useState<Transaction[]>([])
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [userName, setUserName] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoadingSummary(true)
      setSummaryError(null)
      const { data, error } = await supabase.from('transactions').select('*')
      if (cancelled) return
      if (error) setSummaryError(error.message)
      else setSummaryItems((data ?? []) as Transaction[])
      setLoadingSummary(false)
    }
    load()
    return () => { cancelled = true }
  }, [refreshKey])

  useEffect(() => {
    const fetchUserName = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data: userData } = await supabase
        .from('users').select('full_name').eq('id', session.user.id).single()
      if (userData?.full_name) {
        setUserName(userData.full_name)
      } else {
        setUserName(
          session.user.user_metadata?.full_name ||
          session.user.email?.split('@')[0] ||
          'there'
        )
      }
    }
    fetchUserName()
  }, [])

  const bump = () => setRefreshKey((k) => k + 1)

  const recentTransactions = [...summaryItems]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)

  return (
    <div className="space-y-6">

      {/* ── Welcome banner ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-xl bg-blue-600 px-6 py-5 text-white shadow-sm">
        <div>
          <h2 className="text-xl font-semibold">
            Good {greeting()}{userName ? `, ${userName}` : ''}
          </h2>
          <p className="mt-0.5 text-sm text-blue-100">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="hidden sm:inline-flex items-center gap-2 rounded-lg bg-white/20 px-4 py-2 text-sm font-medium text-white ring-1 ring-inset ring-white/30 hover:bg-white/30 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Transaction
        </button>
      </div>

      {/* ── Notifications ───────────────────────────────────────────────── */}
      <Notifications />

      {/* ── Summary cards ──────────────────────────────────────────────── */}
      {loadingSummary ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="loading-shimmer h-28 rounded-xl" />
          ))}
        </div>
      ) : summaryError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="font-medium text-red-900">Could not load transactions</p>
              <p className="mt-0.5 text-sm text-red-700">{summaryError}</p>
            </div>
          </div>
        </div>
      ) : (
        <SummaryCards transactions={summaryItems} />
      )}

      {/* ── Primary action (feature navigation now lives in the sidebar) ─ */}
      <div className="panel overflow-hidden">
        <ul className="divide-y divide-gray-100">
          <QuickItem
            label="Add Transaction"
            sub="Record income or expense"
            color="blue"
            icon={<path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />}
            onClick={() => setShowForm(!showForm)}
          />
        </ul>
      </div>

      {/* ── Collapsible transaction form ────────────────────────────────── */}
      {showForm && (
        <div className="animate-fadeIn space-y-4">
          <StorageStatus />
          <TransactionForm onCreated={() => { bump(); setShowForm(false) }} />
        </div>
      )}

      {/* ── Recent activity ─────────────────────────────────────────────── */}
      {!loadingSummary && !summaryError && recentTransactions.length > 0 && (
        <div className="panel">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
            <span className="badge badge-neutral">{recentTransactions.length} transactions</span>
          </div>
          <ul className="divide-y divide-gray-100">
            {recentTransactions.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold
                    ${t.type === 'in'  ? 'bg-emerald-100 text-emerald-700' :
                      t.type === 'out' ? 'bg-amber-100   text-amber-700'   :
                                         'bg-rose-100    text-rose-700'}`}>
                    {t.type === 'in' ? '↑' : '↓'}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{t.category || 'Uncategorized'}</p>
                    <p className="text-xs text-gray-400">{formatDate(t.date)}{t.note ? ` · ${t.note}` : ''}</p>
                  </div>
                </div>
                <span className={`ml-4 flex-shrink-0 text-sm font-semibold tabular-nums
                  ${t.type === 'in' ? 'text-emerald-600' : 'text-gray-800'}`}>
                  {t.type === 'in' ? '+' : '−'}₱{t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── All transactions ─────────────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">All Transactions</h3>
          <button onClick={() => setShowForm(!showForm)} className="text-sm text-blue-600 hover:text-blue-700 hover:underline">
            {showForm ? 'Hide form' : '+ Add new'}
          </button>
        </div>
        <TransactionList refreshKey={refreshKey} onChanged={bump} />
      </div>
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

const colorMap: Record<string, { bg: string; text: string; hover: string }> = {
  blue:    { bg: 'bg-blue-100',    text: 'text-blue-600',    hover: 'hover:bg-blue-50'    },
  emerald: { bg: 'bg-emerald-100', text: 'text-emerald-600', hover: 'hover:bg-emerald-50' },
  purple:  { bg: 'bg-purple-100',  text: 'text-purple-600',  hover: 'hover:bg-purple-50'  },
  amber:   { bg: 'bg-amber-100',   text: 'text-amber-600',   hover: 'hover:bg-amber-50'   },
  indigo:  { bg: 'bg-indigo-100',  text: 'text-indigo-600',  hover: 'hover:bg-indigo-50'  },
  rose:    { bg: 'bg-rose-100',    text: 'text-rose-600',    hover: 'hover:bg-rose-50'    },
}

interface QuickItemProps {
  label: string
  sub: string
  color: string
  icon: React.ReactNode
  to?: string
  onClick?: () => void
}

function QuickItem({ label, sub, color, icon, to, onClick }: QuickItemProps) {
  const c = colorMap[color] ?? colorMap['blue']
  const inner = (
    <>
      <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${c.bg} ${c.text}`}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>{icon}</svg>
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-gray-900" dangerouslySetInnerHTML={{ __html: label }} />
        <span className="block text-xs text-gray-400">{sub}</span>
      </span>
      <svg className="ml-auto h-4 w-4 flex-shrink-0 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </>
  )
  const base = `flex items-center gap-3 px-5 py-3 w-full text-left transition-colors ${c.hover}`
  return to ? (
    <li><Link to={to} className={base}>{inner}</Link></li>
  ) : (
    <li><button type="button" onClick={onClick} className={base}>{inner}</button></li>
  )
}
