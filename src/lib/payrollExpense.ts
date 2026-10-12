// Pure helpers for deciding the payroll-linked expense amount and whether a
// payslip save is allowed. Kept framework-free so the rules are unit-testable
// and shared with Payroll.tsx (single save, single/bulk generation).

export interface PayslipAmounts {
  gross_salary: number
  // additions
  bonuses?: number | null
  allowances?: number | null
  holiday_pay?: number | null
  // deductions
  sss?: number | null
  pagibig?: number | null
  philhealth?: number | null
  tax?: number | null
  cash_advance?: number | null
  loan_deductions?: number | null
  other_deductions?: number | null
  hmo_deduction?: number | null
  // When true, the linked expense uses NET pay; otherwise GROSS (existing rows).
  uses_net_expense?: boolean | null
}

/** Net pay = gross + additions - deductions. Mirrors onSavePayslip's recompute. */
export function computeNetSalary(p: PayslipAmounts): number {
  const additions = (p.bonuses ?? 0) + (p.allowances ?? 0) + (p.holiday_pay ?? 0)
  const deductions =
    (p.sss ?? 0) + (p.pagibig ?? 0) + (p.philhealth ?? 0) + (p.tax ?? 0) +
    (p.cash_advance ?? 0) + (p.loan_deductions ?? 0) + (p.other_deductions ?? 0) +
    (p.hmo_deduction ?? 0)
  return p.gross_salary + additions - deductions
}

/**
 * The amount that will be posted to the linked expense transaction.
 * NET for flagged (new) payslips, GROSS for existing ones (flag false/null).
 */
export function payrollExpenseAmount(p: PayslipAmounts): number {
  return p.uses_net_expense === true ? computeNetSalary(p) : Number(p.gross_salary)
}

export interface SaveValidation {
  ok: boolean
  /** basis used for the decision; useful for messaging/tests */
  basis: 'net' | 'gross'
  message?: string
}

/**
 * Whether a payslip save may proceed. The posted expense amount must be > 0
 * (the transactions table enforces amount > 0). Rejection must happen BEFORE
 * any DB write so the stored payslip and linked expense stay unchanged.
 */
export function validatePayslipSave(p: PayslipAmounts): SaveValidation {
  const useNet = p.uses_net_expense === true
  const amount = payrollExpenseAmount(p)
  if (!(amount > 0)) {
    return {
      ok: false,
      basis: useNet ? 'net' : 'gross',
      message: useNet
        ? 'Cannot save payslip: net pay must be greater than 0. Reduce deductions or increase earnings.'
        : 'Cannot save payslip: gross pay must be greater than 0.',
    }
  }
  return { ok: true, basis: useNet ? 'net' : 'gross' }
}
