import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/types'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/Pagination'

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

  const pagination = usePagination(items)

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

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="page-heading">Monthly Summary</h2>
          <p className="page-subheading">Credit, debit, and remaining balance for the selected month.</p>
        </div>
        <div className="flex items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">Month</label>
            <input
              type="month"
              value={month}
              onChange={(e) => { setMonth(e.target.value); pagination.resetPage() }}
              className="input-field w-auto"
            />
          </div>
          <button
            onClick={() => setShowTextInput(!showTextInput)}
            className="btn-secondary"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Import
          </button>
        </div>
      </div>

      {/* ── Month label pill ────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <span className="badge badge-info">
          {new Date(month + '-02').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        </span>
        <span className="text-xs text-gray-400">{items.length} transaction{items.length !== 1 ? 's' : ''}</span>
      </div>

      {/* ── Processing indicator ─────────────────────────────────────────── */}
      {uploading && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Processing data…
        </div>
      )}

      {/* ── Paste text panel ────────────────────────────────────────────── */}
      {showTextInput && (
        <div className="panel p-5">
          <h3 className="mb-1 text-sm font-semibold text-gray-900">Paste Transaction Data</h3>
          <p className="mb-3 text-xs text-gray-500">
            Copy rows from your PDF (Date · Description · Debit · Credit) and paste below.
          </p>
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            placeholder={"01/15/2024  Cash on hand  5000.00\n01/16/2024  Payroll  2000.00  1500.00"}
            className="input-field mb-3 h-40 font-mono text-xs"
          />
          <div className="flex gap-2">
            <button onClick={() => { setShowTextInput(false); setPastedText('') }} className="btn-secondary">Cancel</button>
            <button onClick={handleTextParse} disabled={uploading || !pastedText.trim()} className="btn-primary">Parse Data</button>
          </div>
        </div>
      )}

      {/* ── Import preview ───────────────────────────────────────────────── */}
      {showPreview && parsedData.length > 0 && (
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <h3 className="text-sm font-semibold text-gray-900">
              Preview — {parsedData.length} transaction{parsedData.length !== 1 ? 's' : ''} found
            </h3>
            <div className="flex gap-2">
              <button onClick={() => { setShowPreview(false); setParsedData([]) }} className="btn-secondary">Discard</button>
              <button onClick={handleImportTransactions} disabled={uploading} className="btn-success">Import All</button>
            </div>
          </div>
          <div className="max-h-80 overflow-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="th">Date</th>
                  <th className="th">Description</th>
                  <th className="th-right">Debit</th>
                  <th className="th-right">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {parsedData.map((item, idx) => (
                  <tr key={idx} className="table-row-hover">
                    <td className="td">{item.date}</td>
                    <td className="td">{item.description}</td>
                    <td className="td-right">{item.debit  > 0 ? `₱${item.debit.toLocaleString(undefined,  { minimumFractionDigits: 2 })}` : '—'}</td>
                    <td className="td-right">{item.credit > 0 ? `₱${item.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Stat cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="stat-card border-emerald-100">
          <p className="stat-label">Credit — Cash In</p>
          <p className="stat-value text-emerald-700">₱{credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="stat-card border-amber-100">
          <p className="stat-label">Debit — Cash Out &amp; Expenses</p>
          <p className="stat-value text-amber-700">₱{debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        <div className={`stat-card ${remaining >= 0 ? 'border-emerald-200' : 'border-red-200'}`}>
          <p className="stat-label">Remaining</p>
          <p className={`stat-value ${remaining >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
            ₱{remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* ── Transactions table ──────────────────────────────────────────── */}
      <div className="table-container">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="th">Date</th>
              <th className="th">Type</th>
              <th className="th-right">Amount</th>
              <th className="th">Category</th>
              <th className="th">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {loading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-gray-400">Loading…</td></tr>
            )}
            {error && !loading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-red-500">{error}</td></tr>
            )}
            {!loading && !error && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <p className="text-sm text-gray-400">No transactions for this month.</p>
                </td>
              </tr>
            )}
            {!loading && !error && pagination.pageItems.map((t) => (
              <tr key={t.id} className="table-row-hover">
                <td className="td whitespace-nowrap">{t.date}</td>
                <td className="td">
                  <span className={
                    t.type === 'in'  ? 'badge badge-success' :
                    t.type === 'out' ? 'badge badge-warning' :
                                       'badge badge-danger'
                  }>
                    {t.type === 'in' ? 'Cash In' : t.type === 'out' ? 'Cash Out' : 'Expense'}
                  </span>
                </td>
                <td className="td-right">₱{t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                <td className="td">{t.category ?? ''}</td>
                <td className="td text-gray-400">{t.note ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
          totalPages={pagination.totalPages}
          from={pagination.from}
          to={pagination.to}
          onPageChange={pagination.setPage}
          onPageSizeChange={pagination.setPageSize}
        />
      </div>
    </div>
  )
}
