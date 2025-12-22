import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/types'

interface ParsedTransaction {
  date: string
  description: string
  debit: number
  credit: number
}

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
  const [uploading, setUploading] = useState(false)
  const [parsedData, setParsedData] = useState<ParsedTransaction[]>([])
  const [showPreview, setShowPreview] = useState(false)
  const [showTextInput, setShowTextInput] = useState(false)
  const [pastedText, setPastedText] = useState('')

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

  const handleTextParse = () => {
    if (!pastedText.trim()) {
      setError('Please paste some text first')
      return
    }

    setUploading(true)
    setError(null)

    try {
      const parsed = parseTransactionText(pastedText)
      if (parsed.length === 0) {
        setError('No transactions found. Please check the format.')
      } else {
        setParsedData(parsed)
        setShowPreview(true)
        setShowTextInput(false)
        setPastedText('')
      }
    } catch (err) {
      setError('Failed to parse text. Please check the format.')
      console.error(err)
    } finally {
      setUploading(false)
    }
  }

  const parseTransactionText = (text: string): ParsedTransaction[] => {
    const lines = text.split('\n').filter(line => line.trim())
    const transactions: ParsedTransaction[] = []
    
    const datePattern = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      if (line.match(/^(DATE|DESCRIPTION|DEBIT|CREDIT|TOTAL|CASH ON HAND)/i)) {
        continue
      }
      
      const dateMatch = line.match(datePattern)
      
      if (dateMatch) {
        const dateStr = dateMatch[1]
        const restOfLine = line.substring(dateMatch.index! + dateStr.length).trim()
        
        const numberMatches = restOfLine.match(/[\d,]+\.?\d*/g)
        const numbers = numberMatches?.map(n => parseFloat(n.replace(/,/g, ''))) || []
        
        let description = restOfLine
        if (numbers.length > 0 && numberMatches) {
          const firstNumberPos = restOfLine.indexOf(numberMatches[0])
          if (firstNumberPos > 0) {
            description = restOfLine.substring(0, firstNumberPos).trim()
          }
        }
        
        const dateParts = dateStr.split(/[\/\-]/)
        let formattedDate = ''
        if (dateParts.length === 3) {
          const [m, d, y] = dateParts
          const year = y.length === 2 ? `20${y}` : y
          formattedDate = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
        }
        
        if (formattedDate && description && numbers.length > 0) {
          let debit = 0
          let credit = 0
          
          if (numbers.length >= 2) {
            debit = numbers[0]
            credit = numbers[1]
          } else if (numbers.length === 1) {
            credit = numbers[0]
          }
          
          transactions.push({
            date: formattedDate,
            description,
            debit,
            credit
          })
        }
      }
    }
    
    return transactions
  }

  const handleImportTransactions = async () => {
    if (parsedData.length === 0) return

    setUploading(true)
    setError(null)

    try {
      const transactionsToInsert = parsedData.map(item => ({
        date: item.date,
        type: item.credit > 0 && item.debit === 0 ? 'in' : item.debit > 0 ? 'expense' : 'out',
        amount: item.credit > 0 && item.debit === 0 ? item.credit : item.debit,
        category: 'Imported',
        note: item.description
      }))

      const { error: insertError } = await supabase
        .from('transactions')
        .insert(transactionsToInsert)

      if (insertError) throw insertError

      const { first, last } = firstAndLastOfMonth(month)
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .gte('date', first)
        .lte('date', last)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
      
      setItems((data ?? []) as Transaction[])
      setShowPreview(false)
      setParsedData([])
    } catch (err: any) {
      setError(err.message || 'Failed to import transactions')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Monthly Summary</h2>
          <p className="text-sm text-gray-600">Credit, debit, and remaining for selected month.</p>
        </div>
        <div className="flex gap-3">
          <div>
            <label className="block text-sm text-gray-600">Month</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Import Data</label>
            <button
              onClick={() => setShowTextInput(!showTextInput)}
              className="mt-1 flex items-center gap-2 rounded border bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Paste Text
            </button>
          </div>
        </div>
      </div>

      {uploading && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center text-blue-800">
          Processing data...
        </div>
      )}

      {showTextInput && (
        <div className="rounded-lg border border-blue-200 bg-white p-6 shadow-sm">
          <h3 className="mb-3 text-lg font-semibold text-gray-900">Paste Transaction Data</h3>
          <p className="mb-3 text-sm text-gray-600">
            Copy text from your PDF (Date | Description | Debit | Credit format) and paste below:
          </p>
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder="Example:&#10;01/15/2024 Cash on hand 5000.00&#10;01/16/2024 Payroll 2000.00 1500.00"
            className="mb-3 h-48 w-full rounded border p-3 font-mono text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setShowTextInput(false); setPastedText('') }}
              className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleTextParse}
              disabled={uploading || !pastedText.trim()}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Parse Data
            </button>
          </div>
        </div>
      )}

      {showPreview && parsedData.length > 0 && (
        <div className="rounded-lg border border-green-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Preview Imported Data ({parsedData.length} transactions)</h3>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowPreview(false); setParsedData([]) }}
                className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleImportTransactions}
                disabled={uploading}
                className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
              >
                Import All
              </button>
            </div>
          </div>
          <div className="max-h-96 overflow-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-600">Description</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-600">Debit</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-600">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {parsedData.map((item, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-sm text-gray-800">{item.date}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">{item.description}</td>
                    <td className="px-4 py-2 text-right text-sm text-gray-900">
                      {item.debit > 0 ? `₱ ${item.debit.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-gray-900">
                      {item.credit > 0 ? `₱ ${item.credit.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
