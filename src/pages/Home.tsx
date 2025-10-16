import { useEffect, useState } from 'react'
import SummaryCards from '@/components/SummaryCards'
import TransactionForm from '@/components/TransactionForm'
import TransactionList from '@/components/TransactionList'
import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/types'

export default function Home() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [summaryItems, setSummaryItems] = useState<Transaction[]>([])
  const [loadingSummary, setLoadingSummary] = useState(true)
  const [summaryError, setSummaryError] = useState<string | null>(null)

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

  return (
    <div className="space-y-6">
      <div>
        {loadingSummary ? (
          <div className="text-sm text-gray-600">Loading summary...</div>
        ) : summaryError ? (
          <div className="text-sm text-red-600">{summaryError}</div>
        ) : (
          <SummaryCards transactions={summaryItems} />
        )}
      </div>

      <TransactionForm onCreated={bump} />

      <TransactionList refreshKey={refreshKey} onChanged={bump} />
    </div>
  )
}
