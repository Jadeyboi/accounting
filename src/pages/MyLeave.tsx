import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLogger'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { Employee, LeaveRequest } from '@/types'
import { usePagination } from '@/hooks/usePagination'
import Pagination from '@/components/Pagination'

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
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
}

export default function MyLeave() {
  const { currentUser, loading: userLoading } = useCurrentUser()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [leaveType, setLeaveType] = useState<LeaveRequest['leave_type']>('sick')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (!userLoading && currentUser) {
      loadData()
    }
  }, [userLoading, currentUser])

  const loadData = async () => {
    if (!currentUser?.employeeId) {
      setError('Your account is not linked to an employee record. Please contact HR.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const [empRes, leaveRes] = await Promise.all([
      supabase
        .from('employees')
        .select('*')
        .eq('id', currentUser.employeeId)
        .single(),
      supabase
        .from('leave_requests')
        .select('*')
        .eq('employee_id', currentUser.employeeId)
        .order('created_at', { ascending: false }),
    ])

    if (empRes.error) { setError(empRes.error.message); setLoading(false); return }
    if (leaveRes.error) { setError(leaveRes.error.message); setLoading(false); return }

    setEmployee(empRes.data as Employee)
    setLeaveRequests((leaveRes.data ?? []) as LeaveRequest[])
    setLoading(false)
  }

  const resetForm = () => {
    setLeaveType('sick')
    setStartDate('')
    setEndDate('')
    setReason('')
  }

  const handleSubmit = async () => {
    if (!currentUser?.employeeId || !employee) return
    if (!startDate || !endDate) {
      alert('Please select start and end dates.')
      return
    }
    if (new Date(endDate) < new Date(startDate)) {
      alert('End date cannot be before start date.')
      return
    }

    const daysCount = calculateDays(startDate, endDate)

    if (leaveType === 'sick' && (employee.sick_leave_balance ?? 0) < daysCount) {
      if (!confirm(`Insufficient sick leave balance (${employee.sick_leave_balance ?? 0} days remaining). Submit anyway as unpaid?`)) return
    }
    if (leaveType === 'vacation' && (employee.vacation_leave_balance ?? 0) < daysCount) {
      if (!confirm(`Insufficient vacation leave balance (${employee.vacation_leave_balance ?? 0} days remaining). Submit anyway?`)) return
    }
    if (leaveType === 'birthday' && (employee.birthday_leave_balance ?? 0) < daysCount) {
      if (!confirm(`Insufficient birthday leave balance. Submit anyway?`)) return
    }

    setSubmitting(true)
    const { error } = await supabase.from('leave_requests').insert({
      employee_id: currentUser.employeeId,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      days_count: daysCount,
      reason: reason.trim() || null,
      status: 'pending',
    })

    if (error) {
      alert(error.message)
      setSubmitting(false)
      return
    }

    await logActivity('created', 'MyLeave', `Submitted ${leaveType} leave request (${daysCount} days)`)
    setShowModal(false)
    resetForm()
    await loadData()
    setSubmitting(false)
  }

  const handleCancel = async (leaveId: string) => {
    if (!confirm('Cancel this leave request?')) return

    const { error } = await supabase
      .from('leave_requests')
      .update({ status: 'rejected' })
      .eq('id', leaveId)
      .eq('status', 'pending')

    if (error) { alert(error.message); return }

    await logActivity('updated', 'MyLeave', 'Cancelled pending leave request')
    await loadData()
  }

  const pagination = usePagination(leaveRequests)

  if (userLoading || loading) {
    return (
      <div className="py-16 text-center text-sm text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
        Loading your leave information...
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="text-red-700 font-medium">{error}</p>
      </div>
    )
  }

  const daysPreview = startDate && endDate && new Date(endDate) >= new Date(startDate)
    ? calculateDays(startDate, endDate)
    : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Leave</h2>
          {employee && (
            <p className="text-sm text-gray-600">{employee.name} — {employee.position ?? 'Employee'}</p>
          )}
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700"
        >
          + Request Leave
        </button>
      </div>

      {/* Leave Balance Cards */}
      {employee && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Sick Leave</p>
            <p className="text-3xl font-bold text-blue-900 mt-1">{employee.sick_leave_balance ?? 0}</p>
            <p className="text-xs text-blue-600 mt-1">days remaining</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">Vacation Leave</p>
            <p className="text-3xl font-bold text-emerald-900 mt-1">{employee.vacation_leave_balance ?? 0}</p>
            <p className="text-xs text-emerald-600 mt-1">days remaining</p>
          </div>
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-purple-600">Birthday Leave</p>
            <p className="text-3xl font-bold text-purple-900 mt-1">{employee.birthday_leave_balance ?? 0}</p>
            <p className="text-xs text-purple-600 mt-1">days remaining</p>
          </div>
        </div>
      )}

      {/* Leave Request History */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-lg">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">My Leave Requests</h3>

          {leaveRequests.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="font-medium">No leave requests yet</p>
              <p className="text-sm">Submit a leave request using the button above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Period</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">Days</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Reason</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {pagination.pageItems.map((leave) => (
                    <tr key={leave.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 capitalize">
                        {leave.leave_type.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDate(leave.start_date)} – {formatDate(leave.end_date)}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-gray-900">{leave.days_count}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                        {leave.reason ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_COLORS[leave.status]}`}>
                          {leave.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {leave.status === 'pending' && (
                          <button
                            onClick={() => handleCancel(leave.id)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
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
          )}
        </div>
      </div>

      {/* Request Leave Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">Request Leave</h3>
              <button
                onClick={() => { setShowModal(false); resetForm() }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type *</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as LeaveRequest['leave_type'])}
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                >
                  <option value="sick">Sick Leave</option>
                  <option value="vacation">Vacation Leave</option>
                  <option value="birthday">Birthday Leave</option>
                  <option value="emergency">Emergency Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                  <option value="paternity">Paternity Leave</option>
                  <option value="maternity">Maternity Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                  />
                </div>
              </div>

              {daysPreview > 0 && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-sm text-blue-700">
                  Duration: <strong>{daysPreview} day{daysPreview > 1 ? 's' : ''}</strong>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Briefly describe the reason for your leave..."
                  className="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => { setShowModal(false); resetForm() }}
                className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
