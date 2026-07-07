import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { Employee, LeaveRequest, Payslip } from '@/types'

export default function EmployeeDashboard() {
  const { currentUser, loading: userLoading } = useCurrentUser()
  const navigate = useNavigate()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [recentPayslips, setRecentPayslips] = useState<Payslip[]>([])
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userLoading && currentUser?.employeeId) {
      loadDashboard()
    } else if (!userLoading && !currentUser?.employeeId) {
      setLoading(false)
    }
  }, [userLoading, currentUser])

  const loadDashboard = async () => {
    if (!currentUser?.employeeId) return
    setLoading(true)

    const [empRes, payRes, leaveRes] = await Promise.all([
      supabase.from('employees').select('*').eq('id', currentUser.employeeId).single(),
      supabase
        .from('payslips')
        .select('*')
        .eq('employee_id', currentUser.employeeId)
        .order('period_start', { ascending: false })
        .limit(3),
      supabase
        .from('leave_requests')
        .select('*')
        .eq('employee_id', currentUser.employeeId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ])

    setEmployee(empRes.data as Employee ?? null)
    setRecentPayslips((payRes.data ?? []) as Payslip[])
    setPendingLeaves((leaveRes.data ?? []) as LeaveRequest[])
    setLoading(false)
  }

  const moneyFmt = (v: number | null | undefined) =>
    `₱ ${(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  const formatDate = (d: string) => {
    const date = new Date(d)
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${date.getFullYear()}`
  }

  if (userLoading || loading) {
    return (
      <div className="py-16 text-center text-sm text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
        Loading dashboard...
      </div>
    )
  }

  if (!currentUser?.employeeId) {
    return (
      <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-8 text-center">
        <p className="text-yellow-800 font-medium">Your account is not linked to an employee record.</p>
        <p className="text-yellow-700 text-sm mt-1">Please contact HR to link your account.</p>
      </div>
    )
  }

  const lastPayslip = recentPayslips[0]
  const lastNet = lastPayslip
    ? lastPayslip.gross_salary
      + (lastPayslip.bonuses ?? 0) + (lastPayslip.allowances ?? 0) + (lastPayslip.holiday_pay ?? 0)
      - (lastPayslip.sss ?? 0) - (lastPayslip.pagibig ?? 0) - (lastPayslip.philhealth ?? 0)
      - (lastPayslip.tax ?? 0) - (lastPayslip.cash_advance ?? 0) - (lastPayslip.loan_deductions ?? 0)
      - (lastPayslip.other_deductions ?? 0)
    : null

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          Welcome, {employee?.name ?? currentUser.email}
        </h2>
        <p className="text-sm text-gray-600">
          {employee?.position ?? 'Employee'}{employee?.department ? ` • ${employee.department}` : ''}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 p-5 text-white shadow-lg">
          <p className="text-sm font-medium opacity-80">Sick Leave</p>
          <p className="text-4xl font-bold mt-2">{employee?.sick_leave_balance ?? 0}</p>
          <p className="text-xs opacity-70 mt-1">days remaining</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-5 text-white shadow-lg">
          <p className="text-sm font-medium opacity-80">Vacation Leave</p>
          <p className="text-4xl font-bold mt-2">{employee?.vacation_leave_balance ?? 0}</p>
          <p className="text-xs opacity-70 mt-1">days remaining</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 p-5 text-white shadow-lg">
          <p className="text-sm font-medium opacity-80">Pending Requests</p>
          <p className="text-4xl font-bold mt-2">{pendingLeaves.length}</p>
          <p className="text-xs opacity-70 mt-1">awaiting approval</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 p-5 text-white shadow-lg">
          <p className="text-sm font-medium opacity-80">Last Net Pay</p>
          <p className="text-2xl font-bold mt-2">{lastNet !== null ? moneyFmt(lastNet) : '—'}</p>
          <p className="text-xs opacity-70 mt-1">
            {lastPayslip ? `${formatDate(lastPayslip.period_start)} – ${formatDate(lastPayslip.period_end)}` : 'No payslips yet'}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-lg p-6">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/my-payslips')}
            className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-4 text-sm font-medium text-blue-700 text-center hover:bg-blue-100 hover:border-blue-400 transition-all"
          >
            📄 View My Payslips
          </button>
          <button
            onClick={() => navigate('/my-leave')}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-medium text-emerald-700 text-center hover:bg-emerald-100 hover:border-emerald-400 transition-all"
          >
            📅 Manage My Leave
          </button>
        </div>
      </div>

      {/* Recent Payslips */}
      {recentPayslips.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-gray-900">Recent Payslips</h3>
            <button
              onClick={() => navigate('/my-payslips')}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              View All →
            </button>
          </div>
          <div className="space-y-3">
            {recentPayslips.map((slip) => {
              const net =
                slip.gross_salary
                + (slip.bonuses ?? 0) + (slip.allowances ?? 0) + (slip.holiday_pay ?? 0)
                - (slip.sss ?? 0) - (slip.pagibig ?? 0) - (slip.philhealth ?? 0)
                - (slip.tax ?? 0) - (slip.cash_advance ?? 0) - (slip.loan_deductions ?? 0)
                - (slip.other_deductions ?? 0)
              return (
                <div key={slip.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(slip.period_start)} – {formatDate(slip.period_end)}
                    </p>
                    <p className="text-xs text-gray-500">Issued: {formatDate(slip.date_issued)}</p>
                  </div>
                  <p className="text-sm font-bold text-emerald-700">{moneyFmt(net)}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pending Leave */}
      {pendingLeaves.length > 0 && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6">
          <h3 className="text-base font-semibold text-yellow-900 mb-3">Pending Leave Requests</h3>
          <div className="space-y-2">
            {pendingLeaves.map((leave) => (
              <div key={leave.id} className="flex items-center justify-between rounded-lg bg-white border border-yellow-200 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 capitalize">
                    {leave.leave_type.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDate(leave.start_date)} – {formatDate(leave.end_date)} ({leave.days_count} day{leave.days_count > 1 ? 's' : ''})
                  </p>
                </div>
                <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                  Pending
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
