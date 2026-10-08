/**
 * thirteenthMonth.ts
 *
 * Automatic 13th Month Pay savings — company-funded reserve.
 *
 * Per semi-monthly cutoff:
 *   13th month accrual = eligible basic salary earned that period / 12
 *
 * "Eligible basic salary earned" = payslip.gross_salary. In this app the
 * payslip's gross_salary is the BASIC pay for the cutoff (half-month of the
 * monthly basic, pro-rated for the period). Bonuses, allowances, holiday pay
 * and other premiums are stored separately and are NOT part of gross_salary,
 * so they are correctly excluded. Government deductions, tax, and HMO
 * deductions reduce NET pay only — they never touch gross_salary — so the
 * accrual is computed on the full basic earned, as required.
 *
 * This is a company-funded reserve: it is added to Savings but is NOT deducted
 * from the employee and does NOT reduce net pay. No transaction/expense is
 * posted here (payroll already records gross as the expense), so Savings does
 * not duplicate an expense.
 */

import { supabase } from '@/lib/supabase'

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

const ACCOUNT = '13TH MONTH PAY'
const SOURCE = 'payroll_13th'

/** 13th month accrual for one cutoff from the basic earned that period. */
export function accrualForBasic(basicEarned: number): number {
  return r2((Number(basicEarned) || 0) / 12)
}

/** Calendar year from a payroll period end (used to bucket accruals/payments). */
export function yearOf(periodEnd: string): number {
  const d = new Date(periodEnd + 'T00:00:00')
  return d.getFullYear()
}

function coverageMonth(periodEnd: string): string {
  const d = new Date(periodEnd + 'T00:00:00')
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export interface ThirteenthPayload {
  payslipId: string
  employeeId: string
  employeeName: string
  periodStart: string
  periodEnd: string
  dateIssued: string
  /** Basic salary earned for this cutoff = payslip.gross_salary. */
  basicEarned: number
}

/**
 * Upsert the 13th-month savings row for a payslip (idempotent via payslip_id+source).
 * Does nothing when basic earned is zero.
 */
export async function upsertThirteenthMonth(p: ThirteenthPayload): Promise<void> {
  const accrual = accrualForBasic(p.basicEarned)
  if (accrual <= 0) {
    // If a prior row exists (e.g. corrected to zero), remove it.
    await removeThirteenthMonth(p.payslipId)
    return
  }

  const year = yearOf(p.periodEnd)
  const month = coverageMonth(p.periodEnd)
  const description = `13th Month · ${p.employeeName} · ${p.periodStart} – ${p.periodEnd} · ${month}`
  const notes = {
    category: 'THIRTEENTH_MONTH' as const,
    employee: p.employeeName,
    employee_id: p.employeeId,
    period: `${p.periodStart} – ${p.periodEnd}`,
    year,
    basicEarned: r2(p.basicEarned),
    accrual,
  }

  const { data: existing } = await supabase
    .from('savings')
    .select('id')
    .eq('payslip_id', p.payslipId)
    .eq('source', SOURCE)
    .maybeSingle()

  if (existing) {
    await supabase.from('savings')
      .update({ amount: accrual, date: p.dateIssued, description, notes })
      .eq('id', existing.id)
  } else {
    await supabase.from('savings').insert({
      source: SOURCE, account: ACCOUNT, amount: accrual, date: p.dateIssued,
      description, payslip_id: p.payslipId, status: 'active', notes,
    })
  }
}

/** Remove the 13th-month savings row for a payslip (on delete/correction). */
export async function removeThirteenthMonth(payslipId: string): Promise<void> {
  await supabase.from('savings').delete().eq('payslip_id', payslipId).eq('source', SOURCE)
}

/**
 * Backfill 13th-month savings for ALL existing payslips (midyear implementation).
 * Idempotent — updates existing rows, inserts missing ones, removes rows whose
 * payslip now has zero basic. Does not duplicate.
 */
export async function backfillThirteenthMonth(): Promise<{ processed: number; created: number; updated: number }> {
  const { data: payslips } = await supabase
    .from('payslips')
    .select('id, employee_id, period_start, period_end, date_issued, gross_salary')

  if (!payslips || payslips.length === 0) return { processed: 0, created: 0, updated: 0 }

  const { data: emps } = await supabase.from('employees').select('id, name')
  const empMap = new Map((emps ?? []).map((e: any) => [e.id, e.name]))

  const { data: existing } = await supabase
    .from('savings')
    .select('id, payslip_id')
    .eq('source', SOURCE)
  const existingMap = new Map((existing ?? []).map((s: any) => [s.payslip_id, s.id]))

  let processed = 0, created = 0, updated = 0

  for (const ps of payslips) {
    const accrual = accrualForBasic(Number(ps.gross_salary) || 0)
    const existingId = existingMap.get(ps.id)
    if (accrual <= 0) {
      if (existingId) await supabase.from('savings').delete().eq('id', existingId)
      continue
    }
    processed++
    const empName = empMap.get(ps.employee_id) ?? 'Unknown'
    const year = yearOf(ps.period_end)
    const month = coverageMonth(ps.period_end)
    const description = `13th Month · ${empName} · ${ps.period_start} – ${ps.period_end} · ${month}`
    const notes = {
      category: 'THIRTEENTH_MONTH' as const,
      employee: empName,
      employee_id: ps.employee_id,
      period: `${ps.period_start} – ${ps.period_end}`,
      year,
      basicEarned: r2(Number(ps.gross_salary) || 0),
      accrual,
    }
    if (existingId) {
      await supabase.from('savings')
        .update({ amount: accrual, date: ps.date_issued, description, notes })
        .eq('id', existingId)
      updated++
    } else {
      await supabase.from('savings').insert({
        source: SOURCE, account: ACCOUNT, amount: accrual, date: ps.date_issued,
        description, payslip_id: ps.id, status: 'active', notes,
      })
      created++
    }
  }

  return { processed, created, updated }
}
