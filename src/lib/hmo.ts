/**
 * hmo.ts
 *
 * HMO calculation helpers and payroll-savings integration.
 *
 * Premium normalization: premiums are stored as-billed (monthly / quarterly / annual)
 * and converted here to monthly or quarterly equivalents for payroll deduction
 * and summary purposes.
 *
 * Payroll flow:
 * 1. getEmployeeHmoDeduction(empId) → returns per-cutoff employee deduction and per-cutoff company set-aside.
 * 2. upsertHmoSavings(payslipData) → writes two savings rows (HMO company + HMO employee), idempotent.
 * 3. removeHmoSavings(payslipId)   → reverses on delete.
 */

import { supabase } from '@/lib/supabase'
import type { HmoBillingCycle } from '@/types'

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

const HMO_ACCOUNT = 'HMO'

/** Fixed provider — the company's HMO is Maxicare. */
export const HMO_PROVIDER = 'Maxicare'

/** Maxicare plan options and their default quarterly premiums. */
export type HmoPlan = 'Platinum' | 'Gold'

export const HMO_PLAN_QUARTERLY: Record<HmoPlan, number> = {
  Platinum: 5032.88,
  Gold: 5063.0,
}

/** Default plan for principal members and dependents. */
export const PRINCIPAL_DEFAULT_PLAN: HmoPlan = 'Platinum'
export const DEPENDENT_DEFAULT_PLAN: HmoPlan = 'Gold'

/**
 * Convert a premium to its monthly equivalent.
 */
export function toMonthly(premium: number, cycle: HmoBillingCycle): number {
  switch (cycle) {
    case 'monthly':   return r2(premium)
    case 'quarterly': return r2(premium / 3)
    case 'annual':    return r2(premium / 12)
    default:          return r2(premium / 12) // fallback: treat as annual
  }
}

/**
 * Convert a premium to its quarterly equivalent.
 */
export function toQuarterly(premium: number, cycle: HmoBillingCycle): number {
  switch (cycle) {
    case 'monthly':   return r2(premium * 3)
    case 'quarterly': return r2(premium)
    case 'annual':    return r2(premium / 4)
    default:          return r2(premium / 4)
  }
}

/**
 * Compute per-cutoff (semi-monthly) amount: monthly / 2.
 */
export function perCutoff(monthlyAmount: number): number {
  return r2(monthlyAmount / 2)
}

/** Coverage month from period end (YYYY-MM). */
function coverageMonth(periodEnd: string): string {
  const d = new Date(periodEnd + 'T00:00:00')
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export interface HmoBreakdown {
  /** monthly principal premium (company pays) */
  principalMonthly: number
  /** monthly company-covered dependent premium */
  companyDependentMonthly: number
  /** monthly sum of employee-paid additional dependents */
  employeeDependentsMonthly: number
  /** total monthly company expense */
  companyMonthly: number
  /** total monthly employee expense */
  employeeMonthly: number
  /** overall monthly */
  totalMonthly: number
  /** per cutoff for employee deduction (employee-paid additional dependents / 2) */
  employeePerCutoff: number
  /** per cutoff for company set-aside (company portion / 2) */
  companyPerCutoff: number
}

/**
 * Calculate the HMO breakdown for one employee from their active enrollment + dependents.
 * Returns zeros if no active enrollment.
 */
export async function getEmployeeHmoBreakdown(employeeId: string): Promise<HmoBreakdown> {
  const zero: HmoBreakdown = {
    principalMonthly: 0, companyDependentMonthly: 0, employeeDependentsMonthly: 0,
    companyMonthly: 0, employeeMonthly: 0, totalMonthly: 0,
    employeePerCutoff: 0, companyPerCutoff: 0,
  }

  const { data: enrollment } = await supabase
    .from('hmo_enrollments')
    .select('*')
    .eq('employee_id', employeeId)
    .eq('status', 'active')
    .order('effective_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!enrollment) return zero

  const principalMonthly = toMonthly(enrollment.principal_premium, enrollment.billing_cycle)

  const { data: deps } = await supabase
    .from('hmo_dependents')
    .select('*')
    .eq('enrollment_id', enrollment.id)
    .eq('status', 'active')

  let companyDependentMonthly = 0
  let employeeDependentsMonthly = 0

  for (const dep of deps ?? []) {
    const depMonthly = toMonthly(dep.premium, dep.billing_cycle)
    if (dep.coverage_type === 'company') {
      companyDependentMonthly += depMonthly
    } else {
      employeeDependentsMonthly += depMonthly
    }
  }

  companyDependentMonthly = r2(companyDependentMonthly)
  employeeDependentsMonthly = r2(employeeDependentsMonthly)
  const companyMonthly = r2(principalMonthly + companyDependentMonthly)
  const employeeMonthly = employeeDependentsMonthly
  const totalMonthly = r2(companyMonthly + employeeMonthly)

  return {
    principalMonthly,
    companyDependentMonthly,
    employeeDependentsMonthly,
    companyMonthly,
    employeeMonthly,
    totalMonthly,
    employeePerCutoff: perCutoff(employeeMonthly),
    companyPerCutoff: perCutoff(companyMonthly),
  }
}

/**
 * Return the employee-side HMO deduction for a single payroll cutoff.
 * This is the amount to subtract from net pay.
 */
export async function getHmoDeductionForPayslip(employeeId: string): Promise<number> {
  const b = await getEmployeeHmoBreakdown(employeeId)
  return b.employeePerCutoff
}

// ─── Savings integration ──────────────────────────────────────────────
export interface HmoSavingsPayload {
  payslipId: string
  employeeId: string
  employeeName: string
  periodStart: string
  periodEnd: string
  dateIssued: string
  /** The actual HMO deduction collected from the employee on this payslip (from payslips.hmo_deduction). */
  hmoDeduction: number
}

/**
 * Upsert company and employee HMO savings rows for a payslip (idempotent).
 *
 * Company savings: derived from the active enrollment (principal + company dependent per cutoff).
 * Employee savings: uses the ACTUAL hmo_deduction stored on the payslip, not the enrollment
 *   — this ensures the savings reflects what was truly collected through finalized payroll.
 *
 * Uses the same dedup pattern as govt contributions.
 */
export async function upsertHmoSavings(p: HmoSavingsPayload): Promise<void> {
  const b = await getEmployeeHmoBreakdown(p.employeeId)
  const actualEmployeeDeduction = r2(Number(p.hmoDeduction) || 0)
  const companyAmount = b.companyPerCutoff

  if (companyAmount <= 0 && actualEmployeeDeduction <= 0) return // nothing to set aside

  const month = coverageMonth(p.periodEnd)
  const baseDesc = `${p.employeeName} · ${p.periodStart} – ${p.periodEnd} · ${month}`

  const rows = [
    ...(companyAmount > 0 ? [{
      source: 'payroll_hmo_company',
      account: HMO_ACCOUNT,
      amount: companyAmount,
      date: p.dateIssued,
      description: `HMO Company · ${baseDesc}`,
      payslip_id: p.payslipId,
      notes: {
        category: 'HMO_COMPANY',
        employee: p.employeeName,
        period: `${p.periodStart} – ${p.periodEnd}`,
        coverage: month,
        breakdown: {
          principal: r2(b.principalMonthly / 2),
          companyDependent: r2(b.companyDependentMonthly / 2),
        },
      },
    }] : []),
    ...(actualEmployeeDeduction > 0 ? [{
      source: 'payroll_hmo_employee',
      account: HMO_ACCOUNT,
      amount: actualEmployeeDeduction,
      date: p.dateIssued,
      description: `HMO Employee · ${baseDesc}`,
      payslip_id: p.payslipId,
      notes: {
        category: 'HMO_EMPLOYEE',
        employee: p.employeeName,
        period: `${p.periodStart} – ${p.periodEnd}`,
        coverage: month,
        breakdown: {
          employeeDependents: actualEmployeeDeduction,
        },
      },
    }] : []),
  ]

  for (const row of rows) {
    const { data: existing } = await supabase
      .from('savings')
      .select('id')
      .eq('payslip_id', row.payslip_id)
      .eq('source', row.source)
      .maybeSingle()

    if (existing) {
      await supabase.from('savings')
        .update({ amount: row.amount, date: row.date, description: row.description, notes: row.notes })
        .eq('id', existing.id)
    } else {
      await supabase.from('savings').insert({ ...row, status: 'active' })
    }
  }
}

/**
 * Backfill HMO savings for all finalized payslips that have an hmo_deduction > 0
 * but are missing the corresponding savings rows.
 * Also backfills company savings for employees with active HMO enrollments.
 * Idempotent — will not duplicate existing entries (dedup via payslip_id + source).
 */
export async function backfillHmoSavings(): Promise<{ processed: number; created: number }> {
  // Load all payslips (regardless of period) that might need HMO savings
  const { data: payslips } = await supabase
    .from('payslips')
    .select('id, employee_id, period_start, period_end, date_issued, hmo_deduction')

  if (!payslips || payslips.length === 0) return { processed: 0, created: 0 }

  // Load all employees for name lookup
  const { data: emps } = await supabase.from('employees').select('id, name')
  const empMap = new Map((emps ?? []).map((e: any) => [e.id, e.name]))

  // Load existing HMO savings to check what's already there
  const { data: existingSavings } = await supabase
    .from('savings')
    .select('payslip_id, source')
    .in('source', ['payroll_hmo_company', 'payroll_hmo_employee'])

  const existingKeys = new Set(
    (existingSavings ?? []).map((s: any) => `${s.payslip_id}::${s.source}`)
  )

  let processed = 0
  let created = 0

  for (const ps of payslips) {
    const hmoDeduction = Number(ps.hmo_deduction) || 0
    const empName = empMap.get(ps.employee_id) ?? 'Unknown'
    const b = await getEmployeeHmoBreakdown(ps.employee_id)
    const companyAmount = b.companyPerCutoff

    // Skip payslips with no HMO involvement
    if (companyAmount <= 0 && hmoDeduction <= 0) continue

    processed++
    const month = coverageMonth(ps.period_end)
    const baseDesc = `${empName} · ${ps.period_start} – ${ps.period_end} · ${month}`

    // Company savings
    if (companyAmount > 0 && !existingKeys.has(`${ps.id}::payroll_hmo_company`)) {
      await supabase.from('savings').insert({
        source: 'payroll_hmo_company',
        account: HMO_ACCOUNT,
        amount: companyAmount,
        date: ps.date_issued,
        description: `HMO Company · ${baseDesc}`,
        payslip_id: ps.id,
        status: 'active',
        notes: {
          category: 'HMO_COMPANY',
          employee: empName,
          period: `${ps.period_start} – ${ps.period_end}`,
          coverage: month,
          breakdown: {
            principal: r2(b.principalMonthly / 2),
            companyDependent: r2(b.companyDependentMonthly / 2),
          },
        },
      })
      created++
    }

    // Employee savings — only if the payslip actually deducted HMO
    if (hmoDeduction > 0 && !existingKeys.has(`${ps.id}::payroll_hmo_employee`)) {
      await supabase.from('savings').insert({
        source: 'payroll_hmo_employee',
        account: HMO_ACCOUNT,
        amount: hmoDeduction,
        date: ps.date_issued,
        description: `HMO Employee · ${baseDesc}`,
        payslip_id: ps.id,
        status: 'active',
        notes: {
          category: 'HMO_EMPLOYEE',
          employee: empName,
          period: `${ps.period_start} – ${ps.period_end}`,
          coverage: month,
          breakdown: {
            employeeDependents: hmoDeduction,
          },
        },
      })
      created++
    }
  }

  return { processed, created }
}

/**
 * Remove HMO savings rows for a payslip (used when payslip is deleted).
 */
export async function removeHmoSavings(payslipId: string): Promise<void> {
  await supabase
    .from('savings')
    .delete()
    .eq('payslip_id', payslipId)
    .in('source', ['payroll_hmo_company', 'payroll_hmo_employee'])
}
