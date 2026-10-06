/**
 * payrollGovt.ts
 *
 * After every payslip save/delete, set aside government contribution amounts
 * in the savings table under two dedicated accounts:
 *   • GOVERNMENT CONTRIBUTIONS (EC)  — employee deductions (SSS, Pag-IBIG, PhilHealth, Tax)
 *   • GOVERNMENT CONTRIBUTIONS (ER)  — employer contributions (SSS+EC, Pag-IBIG, PhilHealth)
 *
 * Both rows are keyed by (payslip_id, source) so saving the same payslip
 * twice never creates duplicates — it updates in place.
 */

import { supabase } from '@/lib/supabase'
import { calculateStatutoryDeductions, type PayrollFrequency } from '@/lib/statutoryDeductions'

const EC_ACCOUNT = 'GOVERNMENT CONTRIBUTIONS (EC)'
const ER_ACCOUNT = 'GOVERNMENT CONTRIBUTIONS (ER)'

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Determine the coverage month (YYYY-MM) for a payroll period end date */
function coverageMonth(periodEnd: string): string {
  const d = new Date(periodEnd + 'T00:00:00')
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Determine semi-monthly vs monthly from the period length */
function detectFrequency(periodStart: string, periodEnd: string): PayrollFrequency {
  const start = new Date(periodStart + 'T00:00:00')
  const end   = new Date(periodEnd   + 'T00:00:00')
  const days  = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) + 1
  return days <= 18 ? 'semiMonthly' : 'monthly'
}

export interface GovtContribPayload {
  payslipId   : string
  employeeName: string
  periodStart : string
  periodEnd   : string
  dateIssued  : string
  monthlySalary: number
}

/**
 * Upsert (insert or update) the EC and ER savings rows for a payslip.
 * Safe to call multiple times — idempotent via the unique index.
 */
export async function upsertGovtContributions(p: GovtContribPayload): Promise<void> {
  const freq   = detectFrequency(p.periodStart, p.periodEnd)
  const deduct = calculateStatutoryDeductions(p.monthlySalary, freq)
  const month  = coverageMonth(p.periodEnd)

  const ecTotal = r2(deduct.sss + deduct.pagibig + deduct.philhealth + deduct.tax)
  const erTotal = r2(deduct.employerSss + deduct.employerPagibig + deduct.employerPhilhealth)

  if (ecTotal <= 0 && erTotal <= 0) return   // nothing to set aside (zero salary)

  const baseDesc = `${p.employeeName} · ${p.periodStart} – ${p.periodEnd} · ${month}`

  const rows = [
    ...(ecTotal > 0 ? [{
      source      : 'payroll_ec',
      account     : EC_ACCOUNT,
      amount      : ecTotal,
      date        : p.dateIssued,
      description : `EC · ${baseDesc}`,
      payslip_id  : p.payslipId,
      notes       : {
        category  : 'EC',
        employee  : p.employeeName,
        period    : `${p.periodStart} – ${p.periodEnd}`,
        coverage  : month,
        frequency : freq,
        breakdown : {
          sss      : deduct.sss,
          pagibig  : deduct.pagibig,
          philhealth: deduct.philhealth,
          tax      : deduct.tax,
        },
      },
    }] : []),
    ...(erTotal > 0 ? [{
      source      : 'payroll_er',
      account     : ER_ACCOUNT,
      amount      : erTotal,
      date        : p.dateIssued,
      description : `ER · ${baseDesc}`,
      payslip_id  : p.payslipId,
      notes       : {
        category  : 'ER',
        employee  : p.employeeName,
        period    : `${p.periodStart} – ${p.periodEnd}`,
        coverage  : month,
        frequency : freq,
        breakdown : {
          sss      : deduct.employerSss,
          pagibig  : deduct.employerPagibig,
          philhealth: deduct.employerPhilhealth,
        },
      },
    }] : []),
  ]

  for (const row of rows) {
    // Try update first (idempotent)
    const { data: existing } = await supabase
      .from('savings')
      .select('id')
      .eq('payslip_id', row.payslip_id)
      .eq('source', row.source)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('savings')
        .update({ amount: row.amount, date: row.date, description: row.description, notes: row.notes })
        .eq('id', existing.id)
    } else {
      await supabase.from('savings').insert({ ...row, status: 'active' })
    }
  }
}

/**
 * Remove the EC and ER savings rows for a payslip (used when a payslip is deleted).
 * Does NOT delete manually-created savings rows.
 */
export async function removeGovtContributions(payslipId: string): Promise<void> {
  await supabase
    .from('savings')
    .delete()
    .eq('payslip_id', payslipId)
    .in('source', ['payroll_ec', 'payroll_er'])
}
