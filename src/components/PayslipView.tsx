import React, { forwardRef } from 'react'
import type { Employee, Payslip } from '@/types'

interface Props {
  employee: Employee
  payslip: Payslip
}

const money = (v: number | null | undefined) => `₱ ${(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const formatDate = (dateString: string): string => {
  if (!dateString) return ''
  const date = new Date(dateString)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = date.getFullYear()
  return `${month}-${day}-${year}`
}

const PayslipView = forwardRef<HTMLDivElement, Props>(({ employee, payslip }, ref) => {
  const totalDeductions = (payslip.sss ?? 0) + (payslip.pagibig ?? 0) + (payslip.philhealth ?? 0) + (payslip.tax ?? 0) + (payslip.cash_advance ?? 0) + (payslip.loan_deductions ?? 0) + (payslip.other_deductions ?? 0)
  const totalAdditions = (payslip.bonuses ?? 0) + (payslip.allowances ?? 0)

  return (
    <div ref={ref} className="mx-auto w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-8 text-slate-800">
      {/* Company Header */}
      <div className="mb-6 flex items-start justify-between border-b-2 border-slate-900 pb-4">
        <div className="flex items-center gap-4">
          <img src="/avensetech-logo.jpg" alt="Avensetech Logo" className="h-16 w-16 object-contain" />
          <div>
            <h1 className="text-xl font-bold text-slate-900">Avensetech Software Development Services</h1>
            <p className="mt-1 text-xs text-slate-600">OITC2 - 806, Oakridge Business Park, Banilad, Mandaue City, Cebu</p>
            <p className="text-xs text-slate-600">(032) 234-1362 • 09297246296</p>
          </div>
        </div>
      </div>

      {/* Payslip Title and Employee Info */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">PAYSLIP</h2>
          <p className="text-sm text-slate-600">Date Issued: {formatDate(payslip.date_issued)}</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-4 text-right">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Employee</div>
          <div className="mt-1 text-base font-bold text-slate-900">{employee.name}</div>
          {employee.position && <div className="text-sm text-slate-600">{employee.position}</div>}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-300 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pay Period</div>
          <div className="mt-1 text-sm font-medium text-slate-900">{formatDate(payslip.period_start)} to {formatDate(payslip.period_end)}</div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-600">Gross Salary</div>
          <div className="mt-1 text-xl font-bold text-blue-900">{money(payslip.gross_salary)}</div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-emerald-100 p-4">
          <div className="mb-2 text-sm font-medium text-emerald-700">Additions</div>
          <div className="text-sm"><span className="text-slate-500">Bonuses:</span> <span className="float-right">{money(payslip.bonuses)}</span></div>
          <div className="text-sm"><span className="text-slate-500">Allowances:</span> <span className="float-right">{money(payslip.allowances)}</span></div>
          <div className="mt-2 border-t pt-2 text-sm"><span className="text-slate-600">Total Additions</span> <span className="float-right font-medium">{money(totalAdditions)}</span></div>
        </div>
        <div className="rounded-lg border border-rose-100 p-4">
          <div className="mb-2 text-sm font-medium text-rose-700">Deductions</div>
          <div className="text-sm"><span className="text-slate-500">SSS:</span> <span className="float-right">{money(payslip.sss)}</span></div>
          <div className="text-sm"><span className="text-slate-500">Pag-IBIG:</span> <span className="float-right">{money(payslip.pagibig)}</span></div>
          <div className="text-sm"><span className="text-slate-500">PhilHealth:</span> <span className="float-right">{money(payslip.philhealth)}</span></div>
          <div className="text-sm"><span className="text-slate-500">Tax:</span> <span className="float-right">{money(payslip.tax)}</span></div>
          <div className="text-sm"><span className="text-slate-500">Cash Advance:</span> <span className="float-right">{money(payslip.cash_advance)}</span></div>
          <div className="text-sm"><span className="text-slate-500">Loan Deductions:</span> <span className="float-right">{money(payslip.loan_deductions)}</span></div>
          <div className="text-sm"><span className="text-slate-500">Other:</span> <span className="float-right">{money(payslip.other_deductions)}</span></div>
          <div className="mt-2 border-t pt-2 text-sm"><span className="text-slate-600">Total Deductions</span> <span className="float-right font-medium">{money(totalDeductions)}</span></div>
        </div>
      </div>

      <div className="mt-6 rounded-lg border-2 border-emerald-600 bg-emerald-50 p-6">
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-emerald-900">NET SALARY</span>
          <span className="text-3xl font-bold text-emerald-700">{money(payslip.net_salary)}</span>
        </div>
      </div>

      {payslip.notes && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notes</div>
          <div className="mt-2 text-sm text-slate-700">{payslip.notes}</div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 border-t border-slate-200 pt-4 text-center">
        <p className="text-xs text-slate-500">This is a computer-generated payslip and does not require a signature.</p>
      </div>
    </div>
  )
})

export default PayslipView
