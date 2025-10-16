import React, { forwardRef } from 'react'
import type { Employee, Payslip } from '@/types'

interface Props {
  employee: Employee
  payslip: Payslip
}

const money = (v: number | null | undefined) => `₱ ${(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const PayslipView = forwardRef<HTMLDivElement, Props>(({ employee, payslip }, ref) => {
  const totalDeductions = (payslip.sss ?? 0) + (payslip.pagibig ?? 0) + (payslip.philhealth ?? 0) + (payslip.tax ?? 0) + (payslip.cash_advance ?? 0) + (payslip.other_deductions ?? 0)
  const totalAdditions = (payslip.bonuses ?? 0) + (payslip.allowances ?? 0)

  return (
    <div ref={ref} className="mx-auto w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 text-slate-800">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Payslip</h2>
          <p className="text-xs text-slate-500">Date Issued: {payslip.date_issued}</p>
        </div>
        <div className="text-right text-xs">
          <div className="font-medium">Employee</div>
          <div>{employee.name}</div>
          {employee.position && <div className="text-slate-500">{employee.position}</div>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="text-sm font-medium text-slate-700">Pay Period</div>
          <div className="text-sm">{payslip.period_start} to {payslip.period_end}</div>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <div className="text-sm font-medium text-slate-700">Gross Salary</div>
          <div className="text-lg font-semibold">{money(payslip.gross_salary)}</div>
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
          <div className="text-sm"><span className="text-slate-500">Other:</span> <span className="float-right">{money(payslip.other_deductions)}</span></div>
          <div className="mt-2 border-t pt-2 text-sm"><span className="text-slate-600">Total Deductions</span> <span className="float-right font-medium">{money(totalDeductions)}</span></div>
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 p-4">
        <div className="text-sm"><span className="text-slate-600">Net Salary</span> <span className="float-right text-lg font-semibold">{money(payslip.net_salary)}</span></div>
      </div>

      {payslip.notes && (
        <div className="mt-4 rounded-lg border border-slate-200 p-4">
          <div className="text-sm font-medium text-slate-700">Notes</div>
          <div className="text-sm text-slate-700">{payslip.notes}</div>
        </div>
      )}
    </div>
  )
})

export default PayslipView
