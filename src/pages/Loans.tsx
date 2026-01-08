import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Employee, Loan, LoanPayment } from '@/types'

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

export default function Loans() {
  const [loans, setLoans] = useState<Loan[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loanPayments, setLoanPayments] = useState<LoanPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null)
  const [viewingLoan, setViewingLoan] = useState<Loan | null>(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [showViewModal, setShowViewModal] = useState(false)

  // Form fields
  const [employeeId, setEmployeeId] = useState('')
  const [loanType, setLoanType] = useState<'cash_advance' | 'emergency_loan' | 'salary_loan' | 'equipment_loan' | 'other'>('cash_advance')
  const [principalAmount, setPrincipalAmount] = useState('')
  const [interestRate, setInterestRate] = useState('0')
  const [monthlyDeduction, setMonthlyDeduction] = useState('')
  const [loanDate, setLoanDate] = useState(new Date().toISOString().split('T')[0])
  const [startDeductionDate, setStartDeductionDate] = useState(new Date().toISOString().split('T')[0])
  const [purpose, setPurpose] = useState('')
  const [notes, setNotes] = useState('')

  // Manual payment fields
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0])
  const [paymentNotes, setPaymentNotes] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const [loansRes, employeesRes, paymentsRes] = await Promise.all([
        supabase.from('loans').select('*').order('created_at', { ascending: false }),
        supabase.from('employees').select('*').order('name'),
        supabase.from('loan_payments').select('*').order('payment_date', { ascending: false })
      ])

      if (loansRes.error) throw loansRes.error
      if (employeesRes.error) throw employeesRes.error
      if (paymentsRes.error) throw paymentsRes.error

      setLoans((loansRes.data ?? []) as Loan[])
      setEmployees((employeesRes.data ?? []) as Employee[])
      setLoanPayments((paymentsRes.data ?? []) as LoanPayment[])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const openModal = (loan?: Loan) => {
    if (loan) {
      setEditingLoan(loan)
      setEmployeeId(loan.employee_id)
      setLoanType(loan.loan_type)
      setPrincipalAmount(loan.principal_amount.toString())
      setInterestRate(loan.interest_rate.toString())
      setMonthlyDeduction(loan.monthly_deduction.toString())
      setLoanDate(loan.loan_date)
      setStartDeductionDate(loan.start_deduction_date)
      setPurpose(loan.purpose || '')
      setNotes(loan.notes || '')
    } else {
      resetForm()
    }
    setShowModal(true)
  }

  const resetForm = () => {
    setEditingLoan(null)
    setEmployeeId('')
    setLoanType('cash_advance')
    setPrincipalAmount('')
    setInterestRate('0')
    setMonthlyDeduction('')
    setLoanDate(new Date().toISOString().split('T')[0])
    setStartDeductionDate(new Date().toISOString().split('T')[0])
    setPurpose('')
    setNotes('')
  }

  const calculateTotalAmount = () => {
    const principal = Number(principalAmount) || 0
    const rate = Number(interestRate) || 0
    const monthly = Number(monthlyDeduction) || 0
    
    if (principal <= 0 || monthly <= 0) return principal
    
    // Simple interest calculation
    const months = Math.ceil(principal / monthly)
    const interest = (principal * rate * months) / (12 * 100)
    return principal + interest
  }

  const handleSave = async () => {
    if (!employeeId || !principalAmount || !monthlyDeduction) {
      alert('Please fill in all required fields')
      return
    }

    const principal = Number(principalAmount)
    const monthly = Number(monthlyDeduction)
    const rate = Number(interestRate) || 0
    const totalAmount = calculateTotalAmount()

    if (principal <= 0 || monthly <= 0) {
      alert('Principal amount and monthly deduction must be greater than 0')
      return
    }

    const payload: Partial<Loan> = {
      employee_id: employeeId,
      loan_type: loanType,
      principal_amount: principal,
      interest_rate: rate,
      total_amount: totalAmount,
      monthly_deduction: monthly,
      remaining_balance: editingLoan ? editingLoan.remaining_balance : totalAmount,
      loan_date: loanDate,
      start_deduction_date: startDeductionDate,
      purpose: purpose.trim() || null,
      notes: notes.trim() || null,
      status: editingLoan ? editingLoan.status : 'active',
      approved_by: 'System', // You can modify this based on your auth system
      approved_at: new Date().toISOString()
    }

    try {
      if (editingLoan) {
        const { error } = await supabase
          .from('loans')
          .update(payload)
          .eq('id', editingLoan.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('loans')
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

  const handleManualPayment = async () => {
    if (!viewingLoan || !paymentAmount || !paymentDate) {
      alert('Please fill in all payment fields')
      return
    }

    const amount = Number(paymentAmount)
    if (amount <= 0 || amount > viewingLoan.remaining_balance) {
      alert('Payment amount must be greater than 0 and not exceed remaining balance')
      return
    }

    const balanceBefore = viewingLoan.remaining_balance
    const balanceAfter = balanceBefore - amount

    try {
      // Create payment record
      const { error: paymentError } = await supabase
        .from('loan_payments')
        .insert({
          loan_id: viewingLoan.id,
          payment_date: paymentDate,
          amount: amount,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          payment_type: 'manual_payment',
          notes: paymentNotes.trim() || null
        })

      if (paymentError) throw paymentError

      // Update loan balance
      const newStatus = balanceAfter <= 0 ? 'completed' : 'active'
      const { error: loanError } = await supabase
        .from('loans')
        .update({ 
          remaining_balance: balanceAfter,
          status: newStatus,
          end_date: newStatus === 'completed' ? paymentDate : null
        })
        .eq('id', viewingLoan.id)

      if (loanError) throw loanError

      setShowPaymentModal(false)
      setPaymentAmount('')
      setPaymentDate(new Date().toISOString().split('T')[0])
      setPaymentNotes('')
      await loadData()
      
      // Update viewing loan
      const updatedLoan = { ...viewingLoan, remaining_balance: balanceAfter, status: newStatus as 'active' | 'completed' | 'cancelled' }
      setViewingLoan(updatedLoan)
    } catch (err: any) {
      alert(err.message)
    }
  }

  const deleteLoan = async (loanId: string) => {
    if (!confirm('Are you sure you want to delete this loan? This will also delete all payment records.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('loans')
        .delete()
        .eq('id', loanId)
      
      if (error) throw error
      await loadData()
    } catch (err: any) {
      alert(err.message)
    }
  }

  const getEmployee = (employeeId: string) => {
    return employees.find(emp => emp.id === employeeId)
  }

  const getLoanPayments = (loanId: string) => {
    return loanPayments.filter(payment => payment.loan_id === loanId)
  }

  const getLoanTypeLabel = (type: string) => {
    const labels = {
      cash_advance: 'Cash Advance',
      emergency_loan: 'Emergency Loan',
      salary_loan: 'Salary Loan',
      equipment_loan: 'Equipment Loan',
      other: 'Other'
    }
    return labels[type as keyof typeof labels] || type
  }

  const getStatusBadge = (status: string) => {
    const badges = {
      active: 'bg-green-100 text-green-800',
      completed: 'bg-blue-100 text-blue-800',
      cancelled: 'bg-red-100 text-red-800'
    }
    return badges[status as keyof typeof badges] || 'bg-gray-100 text-gray-800'
  }

  const activeLoans = loans.filter(loan => loan.status === 'active')
  const totalActiveAmount = activeLoans.reduce((sum, loan) => sum + loan.remaining_balance, 0)
  const totalLoanedAmount = loans.reduce((sum, loan) => sum + loan.total_amount, 0)
  const totalPaidAmount = totalLoanedAmount - loans.reduce((sum, loan) => sum + loan.remaining_balance, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Loans Management</h2>
          <p className="text-sm text-gray-600">Manage employee loans and automatic payroll deductions</p>
        </div>
        <button
          onClick={() => openModal()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
        >
          + New Loan
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Active Loans</p>
              <p className="mt-2 text-3xl font-bold text-blue-900">{activeLoans.length}</p>
            </div>
            <div className="rounded-full bg-blue-200 p-3">
              <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-green-100 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Outstanding Balance</p>
              <p className="mt-2 text-3xl font-bold text-green-900">{moneyFmt(totalActiveAmount)}</p>
            </div>
            <div className="rounded-full bg-green-200 p-3">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Total Loaned</p>
              <p className="mt-2 text-3xl font-bold text-purple-900">{moneyFmt(totalLoanedAmount)}</p>
            </div>
            <div className="rounded-full bg-purple-200 p-3">
              <svg className="h-8 w-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-indigo-200 bg-gradient-to-br from-indigo-50 to-indigo-100 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-indigo-600">Total Paid</p>
              <p className="mt-2 text-3xl font-bold text-indigo-900">{moneyFmt(totalPaidAmount)}</p>
            </div>
            <div className="rounded-full bg-indigo-200 p-3">
              <svg className="h-8 w-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Loans List */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-lg">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">All Loans</h3>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500">Loading loans...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-600">{error}</p>
            </div>
          ) : loans.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No loans found. Create your first loan!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Employee</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Type</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Total Amount</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Monthly Deduction</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Remaining</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">Status</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {loans.map((loan) => {
                    const employee = getEmployee(loan.employee_id)
                    const progress = ((loan.total_amount - loan.remaining_balance) / loan.total_amount) * 100
                    
                    return (
                      <tr key={loan.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-semibold">
                              {employee?.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{employee?.name}</div>
                              <div className="text-sm text-gray-500">{employee?.position}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex rounded-full bg-gray-100 px-2 text-xs font-semibold text-gray-800">
                            {getLoanTypeLabel(loan.loan_type)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                          {moneyFmt(loan.total_amount)}
                        </td>
                        <td className="px-6 py-4 text-right text-sm text-gray-900">
                          {moneyFmt(loan.monthly_deduction)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="text-sm font-medium text-gray-900">{moneyFmt(loan.remaining_balance)}</div>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                            <div 
                              className="bg-blue-600 h-2 rounded-full" 
                              style={{ width: `${progress}%` }}
                            ></div>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">{progress.toFixed(1)}% paid</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusBadge(loan.status)}`}>
                            {loan.status.charAt(0).toUpperCase() + loan.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center text-sm">
                          <button
                            onClick={() => { setViewingLoan(loan); setShowViewModal(true); }}
                            className="mr-3 text-blue-600 hover:text-blue-800"
                          >
                            View
                          </button>
                          <button
                            onClick={() => openModal(loan)}
                            className="mr-3 text-indigo-600 hover:text-indigo-800"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => deleteLoan(loan.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {/* Create/Edit Loan Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">
                {editingLoan ? 'Edit Loan' : 'Create New Loan'}
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee *</label>
                  <select
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Employee</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} - {emp.position}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loan Type *</label>
                  <select
                    value={loanType}
                    onChange={(e) => setLoanType(e.target.value as any)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  >
                    <option value="cash_advance">Cash Advance</option>
                    <option value="emergency_loan">Emergency Loan</option>
                    <option value="salary_loan">Salary Loan</option>
                    <option value="equipment_loan">Equipment Loan</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Principal Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={principalAmount}
                    onChange={(e) => setPrincipalAmount(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="0.00"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Interest Rate (% per year)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Deduction *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={monthlyDeduction}
                    onChange={(e) => setMonthlyDeduction(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              {principalAmount && monthlyDeduction && (
                <div className="rounded-lg bg-blue-50 p-4">
                  <div className="text-sm text-blue-800">
                    <strong>Calculation Preview:</strong>
                    <div className="mt-2 grid grid-cols-2 gap-4">
                      <div>Principal: {moneyFmt(Number(principalAmount))}</div>
                      <div>Total Amount: {moneyFmt(calculateTotalAmount())}</div>
                      <div>Monthly Payment: {moneyFmt(Number(monthlyDeduction))}</div>
                      <div>Estimated Months: {Math.ceil(Number(principalAmount) / Number(monthlyDeduction))}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loan Date *</label>
                  <input
                    type="date"
                    value={loanDate}
                    onChange={(e) => setLoanDate(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Deduction Date *</label>
                  <input
                    type="date"
                    value={startDeductionDate}
                    onChange={(e) => setStartDeductionDate(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Purpose of the loan"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Additional notes"
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
                {editingLoan ? 'Update Loan' : 'Create Loan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Loan Details Modal */}
      {showViewModal && viewingLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900">Loan Details</h3>
                <p className="text-sm text-gray-600">
                  {getEmployee(viewingLoan.employee_id)?.name} - {getLoanTypeLabel(viewingLoan.loan_type)}
                </p>
              </div>
              <div className="flex gap-2">
                {viewingLoan.status === 'active' && (
                  <button
                    onClick={() => setShowPaymentModal(true)}
                    className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                  >
                    Add Payment
                  </button>
                )}
                <button
                  onClick={() => { setShowViewModal(false); setViewingLoan(null); }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Loan Summary */}
            <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-lg bg-blue-50 p-4">
                <div className="text-sm text-blue-600">Total Amount</div>
                <div className="text-xl font-bold text-blue-900">{moneyFmt(viewingLoan.total_amount)}</div>
              </div>
              <div className="rounded-lg bg-green-50 p-4">
                <div className="text-sm text-green-600">Remaining</div>
                <div className="text-xl font-bold text-green-900">{moneyFmt(viewingLoan.remaining_balance)}</div>
              </div>
              <div className="rounded-lg bg-purple-50 p-4">
                <div className="text-sm text-purple-600">Monthly Deduction</div>
                <div className="text-xl font-bold text-purple-900">{moneyFmt(viewingLoan.monthly_deduction)}</div>
              </div>
              <div className="rounded-lg bg-indigo-50 p-4">
                <div className="text-sm text-indigo-600">Progress</div>
                <div className="text-xl font-bold text-indigo-900">
                  {(((viewingLoan.total_amount - viewingLoan.remaining_balance) / viewingLoan.total_amount) * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Loan Information */}
            <div className="mb-6 rounded-lg border border-gray-200 p-4">
              <h4 className="mb-3 text-lg font-semibold text-gray-900">Loan Information</h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Principal Amount:</span>
                  <div className="font-medium">{moneyFmt(viewingLoan.principal_amount)}</div>
                </div>
                <div>
                  <span className="text-gray-500">Interest Rate:</span>
                  <div className="font-medium">{viewingLoan.interest_rate}% per year</div>
                </div>
                <div>
                  <span className="text-gray-500">Loan Date:</span>
                  <div className="font-medium">{formatDate(viewingLoan.loan_date)}</div>
                </div>
                <div>
                  <span className="text-gray-500">Start Deduction:</span>
                  <div className="font-medium">{formatDate(viewingLoan.start_deduction_date)}</div>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>
                  <div className="font-medium">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusBadge(viewingLoan.status)}`}>
                      {viewingLoan.status.charAt(0).toUpperCase() + viewingLoan.status.slice(1)}
                    </span>
                  </div>
                </div>
                {viewingLoan.end_date && (
                  <div>
                    <span className="text-gray-500">End Date:</span>
                    <div className="font-medium">{formatDate(viewingLoan.end_date)}</div>
                  </div>
                )}
                {viewingLoan.purpose && (
                  <div className="md:col-span-3">
                    <span className="text-gray-500">Purpose:</span>
                    <div className="font-medium">{viewingLoan.purpose}</div>
                  </div>
                )}
                {viewingLoan.notes && (
                  <div className="md:col-span-3">
                    <span className="text-gray-500">Notes:</span>
                    <div className="font-medium">{viewingLoan.notes}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Payment History */}
            <div className="rounded-lg border border-gray-200 p-4">
              <h4 className="mb-3 text-lg font-semibold text-gray-900">Payment History</h4>
              {(() => {
                const payments = getLoanPayments(viewingLoan.id)
                return payments.length === 0 ? (
                  <p className="text-gray-500">No payments recorded yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Date</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-700">Amount</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-700">Balance Before</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-700">Balance After</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Type</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((payment) => (
                          <tr key={payment.id} className="border-b border-gray-100">
                            <td className="px-3 py-2">{formatDate(payment.payment_date)}</td>
                            <td className="px-3 py-2 text-right font-mono">{moneyFmt(payment.amount)}</td>
                            <td className="px-3 py-2 text-right font-mono">{moneyFmt(payment.balance_before)}</td>
                            <td className="px-3 py-2 text-right font-mono">{moneyFmt(payment.balance_after)}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                                payment.payment_type === 'payroll_deduction' ? 'bg-blue-100 text-blue-800' :
                                payment.payment_type === 'manual_payment' ? 'bg-green-100 text-green-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {payment.payment_type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </span>
                            </td>
                            <td className="px-3 py-2">{payment.notes || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Manual Payment Modal */}
      {showPaymentModal && viewingLoan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900">Add Manual Payment</h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4 rounded-lg bg-gray-50 p-3">
              <div className="text-sm text-gray-600">Current Balance</div>
              <div className="text-xl font-bold text-gray-900">{moneyFmt(viewingLoan.remaining_balance)}</div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  max={viewingLoan.remaining_balance}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date *</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Payment notes"
                />
              </div>

              {paymentAmount && (
                <div className="rounded-lg bg-blue-50 p-3">
                  <div className="text-sm text-blue-800">
                    <strong>After Payment:</strong>
                    <div className="mt-1">
                      New Balance: {moneyFmt(viewingLoan.remaining_balance - Number(paymentAmount))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="rounded-md bg-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={handleManualPayment}
                className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Add Payment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}