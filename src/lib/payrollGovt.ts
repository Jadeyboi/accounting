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

const EC_ACCOUNT = 'GOVERNMENT CONTRIBUTIONS (EC)'
const ER_ACCOUNT = 'GOVERNMENT CONTRIBUTIONS (ER)'

/**
 * Feature start date. Government contributions are only set aside for payrolls
 * issued on or after this date — earlier periods were already recorded elsewhere.
 */
export const GOVT_FEATURE_START = '2026-10-01'

/** True when a payslip's date_issued is on/after the feature start date. */
function isOnOrAfterStart(dateIssued: string): boolean {
  if (!dateIssued) return false
  return dateIssued >= GOVT_FEATURE_START // ISO yyyy-mm-dd compares lexicographically
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/** Determine the coverage month (YYYY-MM) for a payroll period end date */
function coverageMonth(periodEnd: string): string {
  const d = new Date(periodEnd + 'T00:00:00')
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Derive the employer (ER) share from the ACTUAL employee (EC) amounts
 * deducted on the payslip, using the standard PH statutory ratios:
 *   • SSS        — employer pays 2× the employee share plus the EC premium
 *                  (EC ≈ ₱10 for low MSC, ₱30 higher). We approximate the EC
 *                  premium proportionally; where the employee SSS is 0, ER is 0.
 *   • Pag-IBIG   — employer matches the employee share 1:1.
 *   • PhilHealth — split 50/50, so employer matches the employee share 1:1.
 * Tax is employee-only (no employer counterpart).
 */
function employerShareFromEmployee(ecSss: number, ecPagibig: number, ecPhilhealth: number) {
  // SSS: employee = 5% of MSC, employer = 10% of MSC → employer = employee × 2.
  // The EC premium (₱10/₱30) is small and salary-bracket specific; since we no
  // longer use base salary, we add the typical ₱30 EC when there is an SSS deduction.
  const employerSss = ecSss > 0 ? r2(ecSss * 2 + 30) : 0
  const employerPagibig = r2(ecPagibig)      // 1:1 match
  const employerPhilhealth = r2(ecPhilhealth) // 1:1 match (50/50 split)
  return { employerSss, employerPagibig, employerPhilhealth }
}

export interface GovtContribPayload {
  payslipId   : string
  employeeName: string
  periodStart : string
  periodEnd   : string
  dateIssued  : string
  /** ACTUAL deduction amounts taken from the payslip columns. */
  sss        : number
  pagibig    : number
  philhealth : number
  tax        : number
}

/**
 * Upsert (insert or update) the EC and ER savings rows for a payslip.
 *
 * EC (employee) amounts are taken DIRECTLY from the actual payslip deduction
 * columns (sss, pagibig, philhealth, tax) — NOT recomputed from base salary,
 * because the declared/taxable salary used for payroll may differ.
 *
 * ER (employer) amounts are derived from those actual employee amounts using
 * the standard statutory ratios.
 *
 * Safe to call multiple times — idempotent via the unique index.
 */
export async function upsertGovtContributions(p: GovtContribPayload): Promise<void> {
  // Only track contributions from the feature start date onward.
  if (!isOnOrAfterStart(p.dateIssued)) return

  const month = coverageMonth(p.periodEnd)

  const ecSss        = r2(Number(p.sss) || 0)
  const ecPagibig    = r2(Number(p.pagibig) || 0)
  const ecPhilhealth = r2(Number(p.philhealth) || 0)
  const ecTax        = r2(Number(p.tax) || 0)

  const er = employerShareFromEmployee(ecSss, ecPagibig, ecPhilhealth)

  const ecTotal = r2(ecSss + ecPagibig + ecPhilhealth + ecTax)
  const erTotal = r2(er.employerSss + er.employerPagibig + er.employerPhilhealth)

  if (ecTotal <= 0 && erTotal <= 0) return   // nothing to set aside

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
        breakdown : {
          sss      : ecSss,
          pagibig  : ecPagibig,
          philhealth: ecPhilhealth,
          tax      : ecTax,
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
        breakdown : {
          sss      : er.employerSss,
          pagibig  : er.employerPagibig,
          philhealth: er.employerPhilhealth,
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

/**
 * Recompute EC/ER government-contribution savings for ALL finalized payslips
 * from the ACTUAL payslip deduction columns.
 *
 * Use this to correct rows that were previously created from base-salary
 * formulas. Idempotent — updates existing rows in place, inserts missing ones,
 * and removes rows whose payslip now has zero contributions.
 */
export async function backfillGovtContributions(): Promise<{ processed: number; updated: number; created: number; removed: number }> {
  // ── Cleanup: remove any EC/ER savings tied to payslips BEFORE the feature
  //    start date (these were created before the cutoff rule existed), plus
  //    any orphaned rows whose payslip no longer exists.
  let removed = 0
  {
    // Payslip ids that qualify (on/after start)
    const { data: validPs } = await supabase
      .from('payslips')
      .select('id')
      .gte('date_issued', GOVT_FEATURE_START)
    const validIds = new Set((validPs ?? []).map((p: any) => p.id))

    const { data: govtRows } = await supabase
      .from('savings')
      .select('id, payslip_id')
      .in('source', ['payroll_ec', 'payroll_er'])

    const toDelete = (govtRows ?? [])
      .filter((r: any) => !r.payslip_id || !validIds.has(r.payslip_id))
      .map((r: any) => r.id)

    for (const id of toDelete) {
      await supabase.from('savings').delete().eq('id', id)
      removed++
    }
  }

  const { data: payslips } = await supabase
    .from('payslips')
    .select('id, employee_id, period_start, period_end, date_issued, sss, pagibig, philhealth, tax')
    .gte('date_issued', GOVT_FEATURE_START)

  if (!payslips || payslips.length === 0) return { processed: 0, updated: 0, created: 0, removed }

  const { data: emps } = await supabase.from('employees').select('id, name')
  const empMap = new Map((emps ?? []).map((e: any) => [e.id, e.name]))

  const { data: existingSavings } = await supabase
    .from('savings')
    .select('id, payslip_id, source')
    .in('source', ['payroll_ec', 'payroll_er'])

  const existingMap = new Map(
    (existingSavings ?? []).map((s: any) => [`${s.payslip_id}::${s.source}`, s.id])
  )

  let processed = 0, updated = 0, created = 0

  for (const ps of payslips) {
    const ecSss = r2(Number(ps.sss) || 0)
    const ecPagibig = r2(Number(ps.pagibig) || 0)
    const ecPhilhealth = r2(Number(ps.philhealth) || 0)
    const ecTax = r2(Number(ps.tax) || 0)
    const er = employerShareFromEmployee(ecSss, ecPagibig, ecPhilhealth)

    const ecTotal = r2(ecSss + ecPagibig + ecPhilhealth + ecTax)
    const erTotal = r2(er.employerSss + er.employerPagibig + er.employerPhilhealth)

    const empName = empMap.get(ps.employee_id) ?? 'Unknown'
    const month = coverageMonth(ps.period_end)
    const baseDesc = `${empName} · ${ps.period_start} – ${ps.period_end} · ${month}`
    processed++

    const specs = [
      {
        source: 'payroll_ec', account: EC_ACCOUNT, total: ecTotal, label: 'EC',
        breakdown: { sss: ecSss, pagibig: ecPagibig, philhealth: ecPhilhealth, tax: ecTax },
      },
      {
        source: 'payroll_er', account: ER_ACCOUNT, total: erTotal, label: 'ER',
        breakdown: { sss: er.employerSss, pagibig: er.employerPagibig, philhealth: er.employerPhilhealth },
      },
    ]

    for (const spec of specs) {
      const key = `${ps.id}::${spec.source}`
      const existingId = existingMap.get(key)
      if (spec.total <= 0) {
        // Zero now — remove any stale row
        if (existingId) await supabase.from('savings').delete().eq('id', existingId)
        continue
      }
      const notes = {
        category: spec.label,
        employee: empName,
        period: `${ps.period_start} – ${ps.period_end}`,
        coverage: month,
        breakdown: spec.breakdown,
      }
      if (existingId) {
        await supabase.from('savings').update({
          amount: spec.total,
          date: ps.date_issued,
          description: `${spec.label} · ${baseDesc}`,
          notes,
        }).eq('id', existingId)
        updated++
      } else {
        await supabase.from('savings').insert({
          source: spec.source,
          account: spec.account,
          amount: spec.total,
          date: ps.date_issued,
          description: `${spec.label} · ${baseDesc}`,
          payslip_id: ps.id,
          status: 'active',
          notes,
        })
        created++
      }
    }
  }

  return { processed, updated, created, removed }
}
