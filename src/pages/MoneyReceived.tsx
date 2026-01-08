import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { MoneyReceived } from '@/types'

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = date.getFullYear()
  return `${month}-${day}-${year}`
}

const moneyFmt = (v: number | null | undefined) => 
  `₱ ${(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const today = () => new Date().toISOString().slice(0, 10)

export default function MoneyReceived() {
  const [moneyReceived, setMoneyReceived] = useState<MoneyReceived[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingRecord, setEditingRecord] = useState<MoneyReceived | null>(null)
  const [showViewModal, setShowViewModal] = useState(false)
  const [viewingRecord, setViewingRecord] = useState<MoneyReceived | null>(null)

  // Form fields
  const [dateReceived, setDateReceived] = useState(today())
  const [amount, setAmount] = useState('')
  const [senderName, setSenderName] = useState('')
  const [senderContact, setSenderContact] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'cash' | 'check' | 'gcash' | 'paymaya' | 'paypal' | 'other'>('bank_transfer')
  const [referenceNumber, setReferenceNumber] = useState('')
  const [purpose, setPurpose] = useState('')
  const [category, setCategory] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'pending' | 'confirmed' | 'cleared'>('confirmed')

  // Filter states
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterMethod, setFilterMethod] = useState<string>('all')
  const [filterDateFrom, setFilterDateFrom] = useState('')
  const [filterDateTo, setFilterDateTo] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const { data, error } = await supabase
        .from('money_received')
        .select('*')
        .order('date_received', { ascending: false })

      if (error) throw error
      setMoneyReceived((data ?? []) as MoneyReceived[])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const openModal = (record?: MoneyReceived) => {
    if (record) {
      setEditingRecord(record)
      setDateReceived(record.date_received)
      setAmount(record.amount.toString())
      setSenderName(record.sender_name)
      setSenderContact(record.sender_contact || '')
      setPaymentMethod(record.payment_method)
      setReferenceNumber(record.reference_number || '')
      setPurpose(record.purpose)
      setCategory(record.category || '')
      setNotes(record.notes || '')
      setStatus(record.status)
    } else {
      resetForm()
    }
    setShowModal(true)
  }

  const resetForm = () => {
    setEditingRecord(null)
    setDateReceived(today())
    setAmount('')
    setSenderName('')
    setSenderContact('')
    setPaymentMethod('bank_transfer')
    setReferenceNumber('')
    setPurpose('')
    setCategory('')
    setNotes('')
    setStatus('confirmed')
  }

  const handleSave = async () => {
    if (!dateReceived || !amount || !senderName || !purpose) {
      alert('Please fill in all required fields')
      return
    }

    const amountNum = Number(amount)
    if (amountNum <= 0) {
      alert('Amount must be greater than 0')
      return
    }

    const payload: Partial<MoneyReceived> = {
      date_received: dateReceived,
      amount: amountNum,
      sender_name: senderName.trim(),
      sender_contact: senderContact.trim() || null,
      payment_method: paymentMethod,
      reference_number: referenceNumber.trim() || null,
      purpose: purpose.trim(),
      category: category.trim() || null,
      notes: notes.trim() || null,
      status: status
    }

    try {
      if (editingRecord) {
        const { error } = await supabase
          .from('money_received')
          .update(payload)
          .eq('id', editingRecord.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('money_received')
          .insert(payload)
        if (error) throw error
      }

      setShowModal(false)
      resetForm()
      await loadData()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const deleteRecord = async (id: string) => {
    if (!confirm('Are you sure you want to delete this record?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('money_received')
        .delete()
        .eq('id', id)
      
      if (error) throw error
      await loadData()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const getPaymentMethodLabel = (method: string) => {
    const labels = {
      bank_transfer: 'Bank Transfer',
      cash: 'Cash',
      check: 'Check',
      gcash: 'GCash',
      paymaya: 'PayMaya',
      paypal: 'PayPal',
      other: 'Other'
    }
    return labels[method as keyof typeof labels] || method
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800',
      confirmed: 'bg-green-100 text-green-800',
      cleared: 'bg-blue-100 text-blue-800'
    }
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800'
  }

  // Filter records
  const filteredRecords = moneyReceived.filter(record => {
    if (filterStatus !== 'all' && record.status !== filterStatus) return false
    if (filterMethod !== 'all' && record.payment_method !== filterMethod) return false
    if (filterDateFrom && record.date_received < filterDateFrom) return false
    if (filterDateTo && record.date_received > filterDateTo) return false
    return true
  })

  // Calculate totals
  const totalAmount = filteredRecords.reduce((sum, record) => sum + record.amount, 0)
  const totalPending = filteredRecords.filter(r => r.status === 'pending').reduce((sum, record) => sum + record.amount, 0)
  const totalConfirmed = filteredRecords.filter(r => r.status === 'confirmed').reduce((sum, record) => sum + record.amount, 0)
  const totalCleared = filteredRecords.filter(r => r.status === 'cleared').reduce((sum, record) => sum + record.amount, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Money Received</h2>
          <p className="text-sm text-gray-600">Track all incoming payments and transfers</p>
        </div>
        <button
          onClick={() => openModal()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
        >
          + Add Record
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Received</p>
              <p className="mt-2 text-3xl font-bold text-blue-900">{moneyFmt(totalAmount)}</p>
            </div>
            <div className="rounded-full bg-blue-200 p-3">
              <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-yellow-200 bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-600">Pending</p>
              <p className="mt-2 text-3xl font-bold text-yellow-900">{moneyFmt(totalPending)}</p>
            </div>
            <div className="rounded-full bg-yellow-200 p-3">
              <svg className="h-8 w-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-green-100 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Confirmed</p>
              <p className="mt-2 text-3xl font-bold text-green-900">{moneyFmt(totalConfirmed)}</p>
            </div>
            <div className="rounded-full bg-green-200 p-3">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-indigo-600">Cleared</p>
              <p className="mt-2 text-3xl font-bold text-indigo-900">{moneyFmt(totalCleared)}</p>
            </div>
            <div className="rounded-full bg-indigo-200 p-3">
              <svg className="h-8 w-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="cleared">Cleared</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="all">All Methods</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="check">Check</option>
              <option value="gcash">GCash</option>
              <option value="paymaya">PayMaya</option>
              <option value="paypal">PayPal</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => {
              setFilterStatus('all')
              setFilterMethod('all')
              setFilterDateFrom('')
              setFilterDateTo('')
            }}
            className="rounded-md bg-gray-200 px-3 py-1 text-sm text-gray-700 hover:bg-gray-300"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Records List */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-lg">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Money Received Records ({filteredRecords.length})
          </h3>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading records...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600">{error}</p>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No records found. Add your first money received record!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Date</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Sender</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Method</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Purpose</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">Status</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatDate(record.date_received)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                        {moneyFmt(record.amount)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{record.sender_name}</div>
                        {record.sender_contact && (
                          <div className="text-sm text-gray-500">{record.sender_contact}</div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-full bg-gray-100 px-2 text-xs font-semibold text-gray-800">
                          {getPaymentMethodLabel(record.payment_method)}
                        </span>
                        {record.reference_number && (
                          <div className="text-xs text-gray-500 mt-1">Ref: {record.reference_number}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="max-w-xs truncate">{record.purpose}</div>
                        {record.category && (
                          <div className="text-xs text-gray-500">{record.category}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusBadge(record.status)}`}>
                          {record.status.charAt(0).toUpperCase() + record.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-sm">
                        <button
                          onClick={() => { setViewingRecord(record); setShowViewModal(true); }}
                          className="mr-3 text-blue-600 hover:text-blue-800"
                        >
                          View
                        </button>
                        <button
                          onClick={() => openModal(record)}
                          className="mr-3 text-indigo-600 hover:text-indigo-800"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteRecord(record.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">
                {editingRecord ? 'Edit Record' : 'Add Money Received'}
              </h3>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date Received *</label>
                  <input
                    type="date"
                    value={dateReceived}
                    onChange={(e) => setDateReceived(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sender Name *</label>
                  <input
                    type="text"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Person or company name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Sender Contact</label>
                  <input
                    type="text"
                    value={senderContact}
                    onChange={(e) => setSenderContact(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Phone, email, or other contact"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cash">Cash</option>
                    <option value="check">Check</option>
                    <option value="gcash">GCash</option>
                    <option value="paymaya">PayMaya</option>
                    <option value="paypal">PayPal</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                  <input
                    type="text"
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="Transaction reference"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purpose *</label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="What is this payment for?"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="e.g., Client Payment, Loan, Investment"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="cleared">Cleared</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Additional notes or details"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="rounded-md bg-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {editingRecord ? 'Update Record' : 'Add Record'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Details Modal */}
      {showViewModal && viewingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Money Received Details</h3>
              <button
                onClick={() => { setShowViewModal(false); setViewingRecord(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500">Date Received:</span>
                  <div className="font-medium">{formatDate(viewingRecord.date_received)}</div>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Amount:</span>
                  <div className="font-medium text-lg">{moneyFmt(viewingRecord.amount)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm text-gray-500">Sender:</span>
                  <div className="font-medium">{viewingRecord.sender_name}</div>
                  {viewingRecord.sender_contact && (
                    <div className="text-sm text-gray-600">{viewingRecord.sender_contact}</div>
                  )}
                </div>
                <div>
                  <span className="text-sm text-gray-500">Payment Method:</span>
                  <div className="font-medium">{getPaymentMethodLabel(viewingRecord.payment_method)}</div>
                  {viewingRecord.reference_number && (
                    <div className="text-sm text-gray-600">Ref: {viewingRecord.reference_number}</div>
                  )}
                </div>
              </div>

              <div>
                <span className="text-sm text-gray-500">Purpose:</span>
                <div className="font-medium">{viewingRecord.purpose}</div>
              </div>

              {viewingRecord.category && (
                <div>
                  <span className="text-sm text-gray-500">Category:</span>
                  <div className="font-medium">{viewingRecord.category}</div>
                </div>
              )}

              <div>
                <span className="text-sm text-gray-500">Status:</span>
                <div>
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusBadge(viewingRecord.status)}`}>
                    {viewingRecord.status.charAt(0).toUpperCase() + viewingRecord.status.slice(1)}
                  </span>
                </div>
              </div>

              {viewingRecord.notes && (
                <div>
                  <span className="text-sm text-gray-500">Notes:</span>
                  <div className="font-medium">{viewingRecord.notes}</div>
                </div>
              )}

              <div className="text-xs text-gray-500">
                Created: {formatDate(viewingRecord.created_at)}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => { setShowViewModal(false); setViewingRecord(null); }}
                className="rounded-md bg-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}