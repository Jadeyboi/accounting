import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import PayslipView from '@/components/PayslipView'
import type { Employee, Payslip } from '@/types'

const formatDate = (dateString: string): string => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = date.getFullYear()
  return `${month}-${day}-${year}`
}

const moneyFmt = (v: number | null | undefined) =>
  `₱ ${(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function MyPayslips() {
  const { currentUser, loading: userLoading } = useCurrentUser()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [viewingPayslip, setViewingPayslip] = useState<Payslip | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!userLoading && currentUser) {
      loadMyPayslips()
    }
  }, [userLoading, currentUser])

  const loadMyPayslips = async () => {
    if (!currentUser?.employeeId) {
      setError('Your account is not linked to an employee record. Please contact HR to link your account.')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const [empRes, payRes] = await Promise.all([
      supabase
        .from('employees')
        .select('*')
        .eq('id', currentUser.employeeId)
        .single(),
      supabase
        .from('payslips')
        .select('*')
        .eq('employee_id', currentUser.employeeId)
        .order('period_start', { ascending: false }),
    ])

    if (empRes.error) { setError(empRes.error.message); setLoading(false); return }
    if (payRes.error) { setError(payRes.error.message); setLoading(false); return }

    setEmployee(empRes.data as Employee)
    setPayslips((payRes.data ?? []) as Payslip[])
    setLoading(false)
  }

  const handlePrint = () => {
    if (!printRef.current) return
    const content = printRef.current.innerHTML
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(`
      <html>
        <head>
          <title>Payslip</title>
          <style>
            body { margin: 0; padding: 20px; font-family: sans-serif; }
            * { box-sizing: border-box; }
          </style>
        </head>
        <body>${content}</body>
      </html>
    `)
    win.document.close()
    win.focus()
    win.print()
    win.close()
  }

  if (userLoading || loading) {
    return (
      <div className="py-16 text-center text-sm text-gray-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
        Loading your payslips...
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">My Payslips</h2>
        {employee && (
          <p className="text-sm text-gray-600">
            {employee.name} — {employee.position ?? 'Employee'} • {employee.department ?? ''}
          </p>
        )}
      </div>

      {/* Leave Balance Summary */}
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

      {/* Payslip List */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-lg">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Payslip History</h3>

          {payslips.length === 0 ? (
            <div className="py-12 text-center text-gray-500">
              <svg className="mx-auto h-12 w-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="font-medium">No payslips yet</p>
              <p className="text-sm">Your payslips will appear here once payroll is processed.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Pay Period</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Date Issued</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Gross</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Deductions</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-emerald-700">Net Pay</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {payslips.map((slip) => {
                    const totalDeductions =
                      (slip.sss ?? 0) + (slip.pagibig ?? 0) + (slip.philhealth ?? 0) +
                      (slip.tax ?? 0) + (slip.cash_advance ?? 0) + (slip.loan_deductions ?? 0) +
                      (slip.other_deductions ?? 0)
                    const totalAdditions = (slip.bonuses ?? 0) + (slip.allowances ?? 0) + (slip.holiday_pay ?? 0)
                    const net = slip.gross_salary + totalAdditions - totalDeductions

                    return (
                      <tr key={slip.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {formatDate(slip.period_start)} – {formatDate(slip.period_end)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{formatDate(slip.date_issued)}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">{moneyFmt(slip.gross_salary)}</td>
                        <td className="px-4 py-3 text-sm text-right text-red-600">{moneyFmt(totalDeductions)}</td>
                        <td className="px-4 py-3 text-sm text-right font-bold text-emerald-700">{moneyFmt(net)}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setViewingPayslip(slip)}
                            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                          >
                            View
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

      {/* Payslip View Modal */}
      {viewingPayslip && employee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between bg-white border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-bold text-gray-900">Payslip</h3>
              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  Print / Download
                </button>
                <button
                  onClick={() => setViewingPayslip(null)}
                  className="rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="p-4">
              <div ref={printRef}>
                <PayslipView employee={employee} payslip={viewingPayslip} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
