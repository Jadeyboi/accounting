import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import type { OakridgeBilling } from '@/types'

const formatDate = (d: string | null | undefined): string => {
  if (!d) return '-'
  const date = new Date(d)
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${date.getFullYear()}`
}

const moneyFmt = (n: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(n)

const categoryLabel: Record<string, string> = {
  rent: 'Rent',
  cusa: 'CUSA',
  electricity: 'Electricity',
  water: 'Water',
  internet: 'Internet',
  garbage: 'Garbage Collection',
  ftm: 'FTM',
  utilities: 'Utilities',
  other: 'Other',
}

const getDocPath = (url: string): string => {
  if (url.startsWith('http')) {
    const match = url.match(/\/oakridge-docs\/(.+)$/)
    return match ? match[1] : url
  }
  return url
}

const computeStatus = (
  amountDue: number,
  amountPaid: number,
  dueDate: string
): OakridgeBilling['status'] => {
  if (amountPaid >= amountDue && amountDue > 0) return 'paid'
  if (amountPaid > 0 && amountPaid < amountDue) return 'partial'
  if (amountPaid === 0 && dueDate && dueDate < new Date().toISOString().slice(0, 10)) return 'overdue'
  return 'unpaid'
}

const currentMonth = () => new Date().toISOString().slice(0, 7)

export default function Oakridge() {
  const [billings, setBillings] = useState<OakridgeBilling[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth())
  const [showModal, setShowModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState<OakridgeBilling | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [fMonth, setFMonth] = useState(currentMonth())
  const [fCategory, setFCategory] = useState<OakridgeBilling['category']>('rent')
  const [fDescription, setFDescription] = useState('')
  const [fAmountDue, setFAmountDue] = useState('')
  const [fAmountPaid, setFAmountPaid] = useState('')
  const [fDueDate, setFDueDate] = useState('')
  const [fPaymentDate, setFPaymentDate] = useState('')
  const [fNotes, setFNotes] = useState('')
  const [fBillingFile, setFBillingFile] = useState<File | null>(null)
  const [fReceiptFile, setFReceiptFile] = useState<File | null>(null)
  const [uploadingBilling, setUploadingBilling] = useState(false)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('oakridge_billings')
      .select('*')
      .order('billing_month', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) { setError(error.message); setLoading(false); return }
    setBillings((data ?? []) as OakridgeBilling[])
    setLoading(false)
  }

  const monthOptions = useMemo(() => {
    const months = new Set(billings.map(b => b.billing_month))
    months.add(currentMonth())
    return Array.from(months).sort((a, b) => b.localeCompare(a))
  }, [billings])

  const filtered = useMemo(() => {
    if (selectedMonth === 'all') return billings
    return billings.filter(b => (b.billing_month || '').slice(0, 7) === selectedMonth)
  }, [billings, selectedMonth])

  const totalDue = useMemo(() => filtered.reduce((s, b) => s + b.amount_due, 0), [filtered])
  const totalPaid = useMemo(() => filtered.reduce((s, b) => s + b.amount_paid, 0), [filtered])
  const remaining = totalDue - totalPaid
  const overdueCount = useMemo(() =>
    filtered.filter(b => computeStatus(b.amount_due, b.amount_paid, b.due_date || '') === 'overdue').length,
    [filtered]
  )

  const resetForm = () => {
    setEditingRecord(null)
    setFMonth(selectedMonth)
    setFCategory('rent')
    setFDescription('')
    setFAmountDue('')
    setFAmountPaid('')
    setFDueDate('')
    setFPaymentDate('')
    setFNotes('')
    setFBillingFile(null)
    setFReceiptFile(null)
  }

  const openModal = (record?: OakridgeBilling) => {
    if (record) {
      setEditingRecord(record)
      setFMonth(record.billing_month)
      setFCategory(record.category)
      setFDescription(record.description || '')
      setFAmountDue(record.amount_due.toString())
      setFAmountPaid(record.amount_paid.toString())
      setFDueDate(record.due_date || '')
      setFPaymentDate(record.payment_date || '')
      setFNotes(record.notes || '')
      setFBillingFile(null)
      setFReceiptFile(null)
    } else {
      resetForm()
    }
    setShowModal(true)
  }

  const uploadFile = async (
    file: File,
    folder: string,
    setUploading: (v: boolean) => void
  ): Promise<string | null> => {
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('oakridge-docs').upload(path, file)
    setUploading(false)
    if (error) { alert('Upload failed: ' + error.message); return null }
    return path
  }

  const handleSave = async () => {
    if (!fMonth || !fCategory || !fAmountDue) {
      alert('Please fill in Billing Month, Category, and Amount Due.')
      return
    }
    setSaving(true)

    const amountDue = Number(fAmountDue) || 0
    const amountPaid = Number(fAmountPaid) || 0
    const status = computeStatus(amountDue, amountPaid, fDueDate)

    let billingStatementUrl = editingRecord?.billing_statement_url ?? null
    let receiptUrl = editingRecord?.receipt_url ?? null

    if (fBillingFile) {
      const path = await uploadFile(fBillingFile, 'billing-statements', setUploadingBilling)
      if (path) billingStatementUrl = path
    }
    if (fReceiptFile) {
      const path = await uploadFile(fReceiptFile, 'receipts', setUploadingReceipt)
      if (path) receiptUrl = path
    }

    const payload = {
      billing_month: fMonth,
      category: fCategory,
      description: fDescription.trim() || null,
      amount_due: amountDue,
      amount_paid: amountPaid,
      due_date: fDueDate || null,
      payment_date: fPaymentDate || null,
      status,
      billing_statement_url: billingStatementUrl,
      receipt_url: receiptUrl,
      notes: fNotes.trim() || null,
      updated_at: new Date().toISOString(),
    }

    try {
      if (editingRecord) {
        const { error } = await supabase.from('oakridge_billings').update(payload).eq('id', editingRecord.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('oakridge_billings').insert(payload)
        if (error) throw error
      }
      setShowModal(false)
      resetForm()
      setSelectedMonth(fMonth)
      await loadData()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this billing record? This cannot be undone.')) return
    const { error } = await supabase.from('oakridge_billings').delete().eq('id', id)
    if (error) { alert(error.message); return }
    await loadData()
  }

  const viewDoc = async (url: string) => {
    const path = getDocPath(url)
    const { data } = await supabase.storage.from('oakridge-docs').createSignedUrl(path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    else alert('Could not generate signed URL.')
  }

  const statusBadge = (status: OakridgeBilling['status']) => {
    switch (status) {
      case 'paid':    return <span className="badge-success">Paid</span>
      case 'partial': return <span className="badge-warning">Partial</span>
      case 'overdue': return <span className="badge-danger">Overdue</span>
      default:        return <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">Unpaid</span>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Oakridge Payables</h2>
          <p className="text-sm text-gray-600">Manage monthly billing obligations for Oakridge</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary">
          + Add Billing
        </button>
      </div>

      {/* Month Filter */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Billing Month:</label>
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="input-field w-auto"
        >
          <option value="all">All Months</option>
          {monthOptions.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card-hover rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Obligations</p>
              <p className="mt-1 text-2xl font-bold text-blue-900">{moneyFmt(totalDue)}</p>
              <p className="text-xs text-blue-600 mt-1">{selectedMonth}</p>
            </div>
            <div className="rounded-full bg-blue-200 p-3">
              <svg className="h-7 w-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card-hover rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-green-100 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Total Paid</p>
              <p className="mt-1 text-2xl font-bold text-green-900">{moneyFmt(totalPaid)}</p>
              <p className="text-xs text-green-600 mt-1">{filtered.filter(b => b.status === 'paid').length} fully paid</p>
            </div>
            <div className="rounded-full bg-green-200 p-3">
              <svg className="h-7 w-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card-hover rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Remaining Balance</p>
              <p className="mt-1 text-2xl font-bold text-purple-900">{moneyFmt(remaining)}</p>
              <p className="text-xs text-purple-600 mt-1">{filtered.filter(b => b.status !== 'paid').length} unpaid items</p>
            </div>
            <div className="rounded-full bg-purple-200 p-3">
              <svg className="h-7 w-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card-hover rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-red-100 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">Overdue</p>
              <p className="mt-1 text-2xl font-bold text-red-900">{overdueCount}</p>
              <p className="text-xs text-red-600 mt-1">items past due date</p>
            </div>
            <div className="rounded-full bg-red-200 p-3">
              <svg className="h-7 w-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Billing Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-lg">
        <div className="p-6">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">
            Billing Records — {selectedMonth} ({filtered.length})
          </h3>

          {loading ? (
            <div className="py-10 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
              <p className="mt-2 text-sm text-gray-500">Loading...</p>
            </div>
          ) : error ? (
            <div className="py-10 text-center text-red-600">{error}</div>
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center text-gray-500">
              No billing records for {selectedMonth}. Click "+ Add Billing" to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Description</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Amount Due</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Amount Paid</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Remaining</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Due Date</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">Docs</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filtered.map(b => (
                    <tr key={b.id} className="table-row-hover">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{categoryLabel[b.category] ?? b.category}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{b.description || '-'}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">{moneyFmt(b.amount_due)}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-green-700">{moneyFmt(b.amount_paid)}</td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-red-700">{moneyFmt(b.amount_due - b.amount_paid)}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{formatDate(b.due_date)}</td>
                      <td className="px-4 py-3 text-center">{statusBadge(b.status)}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {b.billing_statement_url && (
                            <button
                              onClick={() => viewDoc(b.billing_statement_url!)}
                              className="text-xs text-blue-600 hover:underline"
                              title="View Billing Statement"
                            >
                              Bill
                            </button>
                          )}
                          {b.receipt_url && (
                            <button
                              onClick={() => viewDoc(b.receipt_url!)}
                              className="text-xs text-green-600 hover:underline"
                              title="View Receipt"
                            >
                              Receipt
                            </button>
                          )}
                          {!b.billing_statement_url && !b.receipt_url && (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openModal(b)}
                            className="rounded bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-200"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(b.id)}
                            className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-gray-700">Totals</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{moneyFmt(totalDue)}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-green-700">{moneyFmt(totalPaid)}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-red-700">{moneyFmt(remaining)}</td>
                    <td colSpan={4}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between border-b border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900">
                {editingRecord ? 'Edit Billing Record' : 'Add Billing Record'}
              </h3>
              <button
                onClick={() => { setShowModal(false); resetForm() }}
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Billing Month */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Billing Month <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="month"
                    value={fMonth}
                    onChange={e => setFMonth(e.target.value)}
                    className="input-field"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={fCategory}
                    onChange={e => setFCategory(e.target.value as OakridgeBilling['category'])}
                    className="input-field"
                  >
                    <option value="rent">Rent</option>
                    <option value="cusa">CUSA</option>
                    <option value="electricity">Electricity</option>
                    <option value="water">Water</option>
                    <option value="internet">Internet</option>
                    <option value="garbage">Garbage Collection</option>
                    <option value="ftm">FTM</option>
                    <option value="utilities">Utilities</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Description */}
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
                  <input
                    type="text"
                    value={fDescription}
                    onChange={e => setFDescription(e.target.value)}
                    placeholder="e.g. May 2025 Rent"
                    className="input-field"
                  />
                </div>

                {/* Amount Due */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Amount Due (₱) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={fAmountDue}
                    onChange={e => setFAmountDue(e.target.value)}
                    placeholder="0.00"
                    className="input-field"
                  />
                </div>

                {/* Amount Paid */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Amount Paid (₱)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={fAmountPaid}
                    onChange={e => setFAmountPaid(e.target.value)}
                    placeholder="0.00"
                    className="input-field"
                  />
                  {fAmountDue && (
                    <p className="mt-1 text-xs text-gray-500">
                      Auto-status: <strong>{computeStatus(Number(fAmountDue) || 0, Number(fAmountPaid) || 0, fDueDate)}</strong>
                    </p>
                  )}
                </div>

                {/* Due Date */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Due Date</label>
                  <input
                    type="date"
                    value={fDueDate}
                    onChange={e => setFDueDate(e.target.value)}
                    className="input-field"
                  />
                </div>

                {/* Payment Date */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Payment Date</label>
                  <input
                    type="date"
                    value={fPaymentDate}
                    onChange={e => setFPaymentDate(e.target.value)}
                    className="input-field"
                  />
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
                  <textarea
                    value={fNotes}
                    onChange={e => setFNotes(e.target.value)}
                    rows={3}
                    placeholder="Any additional notes..."
                    className="input-field resize-none"
                  />
                </div>

                {/* Billing Statement Upload */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Billing Statement
                    {editingRecord?.billing_statement_url && (
                      <button
                        type="button"
                        onClick={() => viewDoc(editingRecord.billing_statement_url!)}
                        className="ml-2 text-xs text-blue-600 hover:underline"
                      >
                        (View current)
                      </button>
                    )}
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={e => setFBillingFile(e.target.files?.[0] ?? null)}
                    className="input-field text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-400">PDF, image, or doc. Replaces existing if uploaded.</p>
                </div>

                {/* Receipt Upload */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Payment Receipt
                    {editingRecord?.receipt_url && (
                      <button
                        type="button"
                        onClick={() => viewDoc(editingRecord.receipt_url!)}
                        className="ml-2 text-xs text-green-600 hover:underline"
                      >
                        (View current)
                      </button>
                    )}
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={e => setFReceiptFile(e.target.files?.[0] ?? null)}
                    className="input-field text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-400">PDF or image. Replaces existing if uploaded.</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 p-6">
              <button
                onClick={() => { setShowModal(false); resetForm() }}
                className="btn-secondary"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="btn-primary"
                disabled={saving || uploadingBilling || uploadingReceipt}
              >
                {saving || uploadingBilling || uploadingReceipt ? 'Saving...' : editingRecord ? 'Save Changes' : 'Add Billing'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
