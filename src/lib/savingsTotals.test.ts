import { describe, it, expect } from 'vitest'
import { categoryTotal, computeSavingsRollup } from './savingsTotals'

describe('categoryTotal — remaining = reserved - paid', () => {
  it('UNPAID: remaining equals reserved', () => {
    const c = categoryTotal(10000, 0)
    expect(c.reserved).toBe(10000)
    expect(c.paid).toBe(0)
    expect(c.remaining).toBe(10000)
  })

  it('FULLY PAID: remaining is 0', () => {
    const c = categoryTotal(10000, 10000)
    expect(c.remaining).toBe(0)
    expect(c.remainingRaw).toBe(0)
  })

  it('PARTIALLY PAID: only the paid amount is subtracted; unpaid stays reserved', () => {
    const c = categoryTotal(10000, 3500)
    expect(c.remaining).toBe(6500)
  })

  it('REPEATED REMITTANCE: paid accumulates; no double subtraction beyond actual paid', () => {
    // Two remittances of 2000 + 1500 against 10000 reserved.
    const paid = 2000 + 1500
    const c = categoryTotal(10000, paid)
    expect(c.paid).toBe(3500)
    expect(c.remaining).toBe(6500)
    // Paying the exact same total again would be a data duplication in the
    // remittance table, not a formula error — the math just reflects paid.
    const over = categoryTotal(10000, paid + paid)
    expect(over.remainingRaw).toBe(3000)
  })

  it('REVERSED PAYMENT: removing a remittance restores the reserve', () => {
    const afterPay = categoryTotal(10000, 4000)
    expect(afterPay.remaining).toBe(6000)
    // Reversal = remittance record removed => paid drops back to 0.
    const afterReversal = categoryTotal(10000, 0)
    expect(afterReversal.remaining).toBe(10000)
  })

  it('OVER-REMITTED: display remaining clamps at 0 but raw is negative', () => {
    const c = categoryTotal(5000, 6000)
    expect(c.remainingRaw).toBe(-1000)
    expect(c.remaining).toBe(0)
  })

  it('rounds to 2 decimals', () => {
    const c = categoryTotal(100.005, 0.001)
    expect(c.reserved).toBe(100.01)
    expect(c.paid).toBe(0)
  })
})

describe('computeSavingsRollup — overall nets out paid across categories', () => {
  const base = {
    manualActiveAmounts: [1000, 500], // 1500 active manual (already net of paid)
    govtReserved: 20000,
    govtRemitted: 5000,
    hmoReserved: 8000,
    hmoPaid: 8000,     // fully remitted
    t13Reserved: 12000,
    t13Paid: 4000,     // partially paid
  }

  it('overall remaining subtracts paid/remitted (not gross reserved)', () => {
    const r = computeSavingsRollup(base)
    expect(r.manual.remaining).toBe(1500)
    expect(r.govt.remaining).toBe(15000) // 20000 - 5000
    expect(r.hmo.remaining).toBe(0)      // 8000 - 8000
    expect(r.t13.remaining).toBe(8000)   // 12000 - 4000
    expect(r.overallRemaining).toBe(1500 + 15000 + 0 + 8000) // 24500
  })

  it('overall reserved (gross) is reported separately for reference', () => {
    const r = computeSavingsRollup(base)
    expect(r.overallReserved).toBe(1500 + 20000 + 8000 + 12000) // 41500
    expect(r.overallPaid).toBe(0 + 5000 + 8000 + 4000)          // 17000
    // The old (buggy) behavior showed overallReserved (41500); the fix shows
    // overallRemaining (24500) = reserved - paid.
    expect(r.overallReserved - r.overallPaid).toBe(r.overallRemaining)
  })

  it('does not double-count: paid is only the remittance totals, reserved only active rows', () => {
    // If a category is fully remitted it contributes 0 to remaining, never negative.
    const r = computeSavingsRollup({ ...base, govtReserved: 5000, govtRemitted: 9000 })
    expect(r.govt.remaining).toBe(0)
    expect(r.overallRemaining).toBe(1500 + 0 + 0 + 8000) // 9500
  })

  it('all-unpaid rollup equals gross reserved', () => {
    const r = computeSavingsRollup({
      manualActiveAmounts: [1000],
      govtReserved: 2000, govtRemitted: 0,
      hmoReserved: 3000, hmoPaid: 0,
      t13Reserved: 4000, t13Paid: 0,
    })
    expect(r.overallRemaining).toBe(10000)
    expect(r.overallRemaining).toBe(r.overallReserved)
  })
})
