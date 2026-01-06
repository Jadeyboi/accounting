import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Employee, LeaveRequest } from '@/types'

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = date.getFullYear()
  return `${month}-${day}-${year}`
}

const calculateDays = (startDate: string, endDate: string): number => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  return diffDays
}

export default function Leave() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [filterEmployee, setFilterEmployee] = useState<string>('all')

  // Form state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('')
  const [leaveType, setLeaveType] = useState<'sick' | 'vacation' | 'birthday' | 'emergency' | 'unpaid'>('sick')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    
    const [empRes, leaveRes] = await Promise.all([
      supabase.from('employees').select('*').order('name', { ascending: true }),
      supabase.from('leave_requests').select('*').order('created_at', { ascending: false })
    ])

    if (empRes.error) setError(empRes.error.message)
    if (leaveRes.error) setError(leaveRes.error.message)

    setEmployees((empRes.data ?? []) as Employee[])
    setLeaveRequests((leaveRes.data ?? []) as LeaveRequest[])
    setLoading(false)
  }

  const resetForm = () => {
    setSelectedEmployeeId(employees[0]?.id ?? '')
    setLeaveType('sick')
    setStartDate('')
    setEndDate('')
    setReason('')
  }

  const handleSubmit = async () => {
    if (!selectedEmployeeId || !startDate || !endDate) {
      alert('Please fill in all required fields')
      return
    }

    const daysCount = calculateDays(startDate, endDate)
    const employee = employees.find(e => e.id === selectedEmployeeId)

    // Check leave balance
    if (leaveType === 'sick' && (employee?.sick_leave_balance ?? 0) < daysCount) {
      if (!confirm(`Insufficient sick leave balance. Employee has ${employee?.sick_leave_balance ?? 0} days remaining. Continue anyway?`)) {
        return
      }
    }
    if (leaveType === 'vacation' && (employee?.vacation_leave_balance ?? 0) < daysCount) {
      if (!confirm(`Insufficient vacation leave balance. Employee has ${employee?.vacation_leave_balance ?? 0} days remaining. Continue anyway?`)) {
        return
      }
    }
    if (leaveType === 'birthday' && (employee?.birthday_leave_balance ?? 0) < daysCount) {
      if (!confirm(`Insufficient birthday leave balance. Employee has ${employee?.birthday_leave_balance ?? 0} days remaining. Continue anyway?`)) {
        return
      }
    }

    const payload: Partial<LeaveRequest> = {
      employee_id: selectedEmployeeId,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      days_count: daysCount,
      reason: reason.trim() || null,
      status: 'pending'
    }

    const { error } = await supabase.from('leave_requests').insert(payload)
    
    if (error) {
      alert(error.message)
      return
    }

    setShowModal(false)
    resetForm()
    await loadData()
  }

  const handleApprove = async (leave: LeaveRequest) => {
    const employee = employees.find(e => e.id === leave.employee_id)
    if (!employee) return

    // Update leave balance
    let newSickBalance = employee.sick_leave_balance ?? 2
    let newVacationBalance = employee.vacation_leave_balance ?? 2
    let newBirthdayBalance = employee.birthday_leave_balance ?? 1

    if (leave.leave_type === 'sick') {
      newSickBalance -= leave.days_count
    } else if (leave.leave_type === 'vacation') {
      newVacationBalance -= leave.days_count
    } else if (leave.leave_type === 'birthday') {
      newBirthdayBalance -= leave.days_count
    }

    const { error: empError } = await supabase
      .from('employees')
      .update({
        sick_leave_balance: newSickBalance,
        vacation_leave_balance: newVacationBalance,
        birthday_leave_balance: newBirthdayBalance
      })
      .eq('id', leave.employee_id)

    if (empError) {
      alert(empError.message)
      return
    }

    const { error: leaveError } = await supabase
      .from('leave_requests')
      .update({
        status: 'approved',
        approved_at: new Date().toISOString(),
        approved_by: 'Admin'
      })
      .eq('id', leave.id)

    if (leaveError) {
      alert(leaveError.message)
      return
    }

    await loadData()
  }

  const handleReject = async (leaveId: string) => {
    const { error } = await supabase
      .from('leave_requests')
      .update({ status: 'rejected' })
      .eq('id', leaveId)

    if (error) {
      alert(error.message)
      return
    }

    await loadData()
  }

  const handleDelete = async (leaveId: string) => {
    if (!confirm('Delete this leave request?')) return

    // Get the leave request details before deleting
    const leaveToDelete = leaveRequests.find(l => l.id === leaveId)
    if (!leaveToDelete) return

    // If the leave was approved, we need to restore the balance
    if (leaveToDelete.status === 'approved') {
      const employee = employees.find(e => e.id === leaveToDelete.employee_id)
      if (employee) {
        let newSickBalance = employee.sick_leave_balance ?? 2
        let newVacationBalance = employee.vacation_leave_balance ?? 2
        let newBirthdayBalance = employee.birthday_leave_balance ?? 1

        // Restore the balance based on leave type
        if (leaveToDelete.leave_type === 'sick') {
          newSickBalance += leaveToDelete.days_count
        } else if (leaveToDelete.leave_type === 'vacation') {
          newVacationBalance += leaveToDelete.days_count
        } else if (leaveToDelete.leave_type === 'birthday') {
          newBirthdayBalance += leaveToDelete.days_count
        }

        // Update employee balances
        const { error: empError } = await supabase
          .from('employees')
          .update({
            sick_leave_balance: newSickBalance,
            vacation_leave_balance: newVacationBalance,
            birthday_leave_balance: newBirthdayBalance
          })
          .eq('id', leaveToDelete.employee_id)

        if (empError) {
          alert(`Error restoring leave balance: ${empError.message}`)
          return
        }
      }
    }

    // Delete the leave request
    const { error } = await supabase
      .from('leave_requests')
      .delete()
      .eq('id', leaveId)

    if (error) {
      alert(error.message)
      return
    }

    await loadData()
  }

  const filteredLeaves = leaveRequests.filter(leave => {
    if (filterStatus !== 'all' && leave.status !== filterStatus) return false
    if (filterEmployee !== 'all' && leave.employee_id !== filterEmployee) return false
    return true
  })

  const recalculateAllBalances = async () => {
    if (!confirm('Recalculate all employee leave balances? This will reset all balances to default and then subtract approved leaves.')) return

    for (const employee of employees) {
      // Set default balances based on employment status
      const isRegular = employee.employment_status === 'regular'
      let sickLeave = isRegular ? 6 : 2
      let vacationLeave = isRegular ? 6 : 2
      let birthdayLeave = 1

      // Calculate total approved leaves for this employee
      const approvedLeaves = leaveRequests.filter(
        l => l.employee_id === employee.id && l.status === 'approved'
      )

      // Subtract approved leaves from balances
      for (const leave of approvedLeaves) {
        if (leave.leave_type === 'sick') {
          sickLeave -= leave.days_count
        } else if (leave.leave_type === 'vacation') {
          vacationLeave -= leave.days_count
        } else if (leave.leave_type === 'birthday') {
          birthdayLeave -= leave.days_count
        }
      }

      // Update employee balances
      const { error } = await supabase
        .from('employees')
        .update({
          sick_leave_balance: sickLeave,
          vacation_leave_balance: vacationLeave,
          birthday_leave_balance: birthdayLeave
        })
        .eq('id', employee.id)

      if (error) {
        alert(`Error updating balances for ${employee.name}: ${error.message}`)
        return
      }
    }

    await loadData()
    alert('All leave balances have been recalculated successfully!')
  }

  const resetEmployeeBalances = async (employeeId: string) => {
    const employee = employees.find(e => e.id === employeeId)
    if (!employee) return

    if (!confirm(`Reset leave balances for ${employee.name}? This will set balances to default values based on employment status.`)) return

    // Set default balances based on employment status
    // Regular employees get more leave days
    const isRegular = employee.employment_status === 'regular'
    const sickLeave = isRegular ? 6 : 2
    const vacationLeave = isRegular ? 6 : 2
    const birthdayLeave = 1

    const { error } = await supabase
      .from('employees')
      .update({
        sick_leave_balance: sickLeave,
        vacation_leave_balance: vacationLeave,
        birthday_leave_balance: birthdayLeave
      })
      .eq('id', employeeId)

    if (error) {
      alert(`Error resetting balances: ${error.message}`)
      return
    }

    await loadData()
  }

  const totalPending = leaveRequests.filter(l => l.status === 'pending').length
  const totalApproved = leaveRequests.filter(l => l.status === 'approved').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Leave Management</h2>
          <p className="text-sm text-gray-600">Track sick leave and vacation requests</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={recalculateAllBalances}
            className="btn-secondary"
          >
            Recalculate All Balances
          </button>
          <button
            onClick={() => { resetForm(); setShowModal(true); }}
            className="btn-primary"
          >
            + New Leave Request
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <div className="card-hover rounded-xl border border-yellow-200 bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-yellow-600">Pending</p>
              <p className="mt-2 text-3xl font-bold text-yellow-900">{totalPending}</p>
            </div>
            <div className="rounded-full bg-yellow-200 p-3">
              <svg className="h-8 w-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card-hover rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-green-100 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Approved</p>
              <p className="mt-2 text-3xl font-bold text-green-900">{totalApproved}</p>
            </div>
            <div className="rounded-full bg-green-200 p-3">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card-hover rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Requests</p>
              <p className="mt-2 text-3xl font-bold text-blue-900">{leaveRequests.length}</p>
            </div>
            <div className="rounded-full bg-blue-200 p-3">
              <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card-hover rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Employees</p>
              <p className="mt-2 text-3xl font-bold text-purple-900">{employees.length}</p>
            </div>
            <div className="rounded-full bg-purple-200 p-3">
              <svg className="h-8 w-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Filter by Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Filter by Employee</label>
            <select
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Employees</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Leave Requests Table */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Employee</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Leave Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Period</th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">Days</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Reason</th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                    <div className="loading-shimmer mx-auto h-8 w-48 rounded"></div>
                  </td>
                </tr>
              )}
              {error && !loading && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-red-600">{error}</td>
                </tr>
              )}
              {!loading && !error && filteredLeaves.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-8 text-center text-sm text-gray-500">
                    No leave requests found
                  </td>
                </tr>
              )}
              {!loading && !error && filteredLeaves.map((leave) => {
                const employee = employees.find(e => e.id === leave.employee_id)
                return (
                  <tr key={leave.id} className="table-row-hover">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{employee?.name ?? 'Unknown'}</div>
                      <div className="text-xs text-gray-500">{employee?.position ?? ''}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                        leave.leave_type === 'sick' ? 'bg-red-100 text-red-800' :
                        leave.leave_type === 'vacation' ? 'bg-blue-100 text-blue-800' :
                        leave.leave_type === 'birthday' ? 'bg-pink-100 text-pink-800' :
                        leave.leave_type === 'emergency' ? 'bg-orange-100 text-orange-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {leave.leave_type.charAt(0).toUpperCase() + leave.leave_type.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {formatDate(leave.start_date)} to {formatDate(leave.end_date)}
                    </td>
                    <td className="px-6 py-4 text-center text-sm font-medium text-gray-900">
                      {leave.days_count}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {leave.reason || '-'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`rounded-full px-3 py-1 text-xs font-medium ${
                        leave.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        leave.status === 'approved' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {leave.status.charAt(0).toUpperCase() + leave.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm">
                      {leave.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleApprove(leave)}
                            className="mr-2 text-green-600 hover:text-green-800"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleReject(leave.id)}
                            className="mr-2 text-red-600 hover:text-red-800"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(leave.id)}
                        className="text-gray-600 hover:text-gray-800"
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
      </div>

      {/* Employee Leave Balances */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
        <h3 className="mb-4 text-lg font-bold text-gray-900">Employee Leave Balances</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {employees.map(emp => (
            <div key={emp.id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium text-gray-900">{emp.name}</span>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-1 text-xs font-medium ${
                    emp.employment_status === 'regular' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {emp.employment_status === 'regular' ? 'Regular' : 'Probationary'}
                  </span>
                  <button
                    onClick={() => resetEmployeeBalances(emp.id)}
                    className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                    title="Reset to default balances"
                  >
                    Reset
                  </button>
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Sick Leave:</span>
                <span className="font-medium text-red-600">{emp.sick_leave_balance ?? 2} days</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Vacation Leave:</span>
                <span className="font-medium text-blue-600">{emp.vacation_leave_balance ?? 2} days</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Birthday Leave:</span>
                <span className="font-medium text-pink-600">{emp.birthday_leave_balance ?? 1} day</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New Leave Request Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">New Leave Request</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Employee *</label>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Leave Type *</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as any)}
                  className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="sick">Sick Leave</option>
                  <option value="vacation">Vacation Leave</option>
                  <option value="birthday">Birthday Leave</option>
                  <option value="emergency">Emergency Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Start Date *</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">End Date *</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {startDate && endDate && (
                <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
                  Total days: <strong>{calculateDays(startDate, endDate)}</strong>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Reason</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Optional reason for leave"
                  className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                className="btn-primary"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
