/**
 * savingsTotals.ts
 *
 * Single source of truth for Savings roll-ups so the Savings page, category
 * summaries, dashboard cards, and Reports all agree.
 *
 * REMAINING = TOTAL RESERVED − TOTAL PAID/REMITTED, per the rules:
 *   - Government: reserved = active EC/ER savings rows; paid = govt_remittances.
 *   - HMO:        reserved = active HMO savings rows;   paid = hmo_remittances.
 *   - 13th Month: reserved = active 13th savings rows;  paid = thirteenth_month_payments.
 *   - Manual:     reserved = active manual savings rows; paid = handled by the
 *                 status flag (a manual saving marked 'paid' leaves the active
 *                 set AND posts its own cash-out expense), so active manual rows
 *                 are already net of paid.
 *
 * NON-DOUBLE-COUNTING RULES:
 *   - For the three AUTO categories, "paid" lives ONLY in the dedicated
 *     remittance/payment tables. The reserved side counts ONLY active rows.
 *     We must NOT also subtract a paid-status auto row (that would double-count
 *     a payment already represented by its remittance). Callers therefore pass
 *     ACTIVE auto savings rows as "reserved" and the remittance/payment totals
 *     as "paid".
 *   - Computing remaining is pure arithmetic — it never creates an expense or
 *     cash-out. The single cash-out for a payment is its existing remittance/
 *     payment or the manual 'paid' expense; this module does not touch it.
 *   - Repeated remittances simply add to the paid total (idempotence/duplication
 *     is governed by the remittance records themselves, not by this math).
 *   - Reversing a payment is modeled by removing the remittance/payment record;
 *     remaining then rises back automatically because paid shrinks.
 *
 * Remaining is clamped at >= 0 for display totals (an over-remittance should not
 * show the category as a negative reserve), while the raw figure is available
 * for diagnostics.
 */

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
const sum = <T>(arr: T[], f: (t: T) => number) => arr.reduce((a, t) => a + (f(t) || 0), 0)

export interface CategoryTotal {
  reserved: number
  paid: number
  /** reserved - paid, not clamped (can be negative if over-paid). */
  remainingRaw: number
  /** max(0, remainingRaw) — safe for display/roll-up. */
  remaining: number
}

export function categoryTotal(reserved: number, paid: number): CategoryTotal {
  const reservedR = r2(reserved)
  const paidR = r2(paid)
  const remainingRaw = r2(reservedR - paidR)
  return { reserved: reservedR, paid: paidR, remainingRaw, remaining: Math.max(0, remainingRaw) }
}

export interface SavingsRollupInput {
  /** Active manual savings amounts (already net of 'paid' which leaves the active set). */
  manualActiveAmounts: number[]
  /** Active government (EC/ER) savings reserved amounts. */
  govtReserved: number
  /** Sum of govt_remittances amounts. */
  govtRemitted: number
  /** Active HMO savings reserved amounts. */
  hmoReserved: number
  /** Sum of hmo_remittances amounts. */
  hmoPaid: number
  /** Active 13th-month savings reserved amounts. */
  t13Reserved: number
  /** Sum of thirteenth_month_payments amounts. */
  t13Paid: number
}

export interface SavingsRollup {
  manual: CategoryTotal
  govt: CategoryTotal
  hmo: CategoryTotal
  t13: CategoryTotal
  /** Sum of each category's remaining (reserved - paid), the figure to display. */
  overallRemaining: number
  /** Sum of reserved only (pre-payment) — for reference/diagnostics. */
  overallReserved: number
  /** Sum of all paid/remitted — for reference/diagnostics. */
  overallPaid: number
}

export function computeSavingsRollup(i: SavingsRollupInput): SavingsRollup {
  const manual = categoryTotal(sum(i.manualActiveAmounts, (n) => n), 0) // manual active is already net
  const govt = categoryTotal(i.govtReserved, i.govtRemitted)
  const hmo = categoryTotal(i.hmoReserved, i.hmoPaid)
  const t13 = categoryTotal(i.t13Reserved, i.t13Paid)

  const overallRemaining = r2(manual.remaining + govt.remaining + hmo.remaining + t13.remaining)
  const overallReserved = r2(manual.reserved + govt.reserved + hmo.reserved + t13.reserved)
  const overallPaid = r2(manual.paid + govt.paid + hmo.paid + t13.paid)

  return { manual, govt, hmo, t13, overallRemaining, overallReserved, overallPaid }
}
