import { describe, it, expect } from 'vitest'
import {
  computeNetSalary,
  payrollExpenseAmount,
  validatePayslipSave,
  type PayslipAmounts,
} from './payrollExpense'

const base = (over: Partial<PayslipAmounts> = {}): PayslipAmounts => ({
  gross_salary: 30000,
  sss: 1125,
  pagibig: 100,
  philhealth: 450,
  tax: 0,
  cash_advance: 0,
  loan_deductions: 0,
  other_deductions: 0,
  hmo_deduction: 0,
  bonuses: 0,
  allowances: 0,
  holiday_pay: 0,
  ...over,
})

describe('computeNetSalary', () => {
  it('is gross + additions - deductions', () => {
    expect(computeNetSalary(base())).toBe(30000 - 1675)
    expect(computeNetSalary(base({ bonuses: 2000, allowances: 500 }))).toBe(30000 + 2500 - 1675)
  })
})

describe('payrollExpenseAmount', () => {
  it('uses NET when uses_net_expense is true', () => {
    expect(payrollExpenseAmount(base({ uses_net_expense: true }))).toBe(28325)
  })
  it('uses GROSS when flag is false or null (existing payslips)', () => {
    expect(payrollExpenseAmount(base({ uses_net_expense: false }))).toBe(30000)
    expect(payrollExpenseAmount(base({ uses_net_expense: null }))).toBe(30000)
    expect(payrollExpenseAmount(base({}))).toBe(30000) // undefined => gross
  })
})

describe('validatePayslipSave — non-positive net on a flagged (new) payslip', () => {
  it('REJECTS when net <= 0 and the payslip uses net', () => {
    // deductions exceed gross+additions => net negative
    const p = base({ uses_net_expense: true, loan_deductions: 40000 })
    const r = validatePayslipSave(p)
    expect(r.ok).toBe(false)
    expect(r.basis).toBe('net')
    expect(r.message).toMatch(/net pay must be greater than 0/i)
  })

  it('REJECTS when net is exactly 0 and the payslip uses net', () => {
    // gross 30000, deductions total 30000 => net 0
    const p = base({
      uses_net_expense: true,
      sss: 0, pagibig: 0, philhealth: 0,
      loan_deductions: 30000,
    })
    expect(computeNetSalary(p)).toBe(0)
    expect(validatePayslipSave(p).ok).toBe(false)
  })

  it('ALLOWS when net > 0 and the payslip uses net', () => {
    const r = validatePayslipSave(base({ uses_net_expense: true }))
    expect(r.ok).toBe(true)
    expect(r.basis).toBe('net')
  })
})

describe('validatePayslipSave — existing payslips keep GROSS behavior', () => {
  it('ALLOWS an existing (gross) payslip even when its NET would be <= 0', () => {
    // Same loan-heavy figures, but flag false => basis is gross (30000 > 0) => allowed.
    const p = base({ uses_net_expense: false, loan_deductions: 40000 })
    const r = validatePayslipSave(p)
    expect(r.ok).toBe(true)
    expect(r.basis).toBe('gross')
  })

  it('REJECTS an existing payslip only when GROSS itself is <= 0', () => {
    const r = validatePayslipSave(base({ uses_net_expense: false, gross_salary: 0 }))
    expect(r.ok).toBe(false)
    expect(r.basis).toBe('gross')
    expect(r.message).toMatch(/gross pay must be greater than 0/i)
  })
})
