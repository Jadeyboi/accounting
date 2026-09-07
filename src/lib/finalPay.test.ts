import { describe, it, expect } from 'vitest'
import {
  creditedYearsBetween, computeSeparationPay, proratedThirteenthMonth,
  dailyRate, leaveConversion, profitMargin, toPhp, allocateAmount, round2,
} from './finalPay'

describe('creditedYearsBetween', () => {
  it('returns 0 when dates missing or reversed', () => {
    expect(creditedYearsBetween(null, '2024-01-01')).toBe(0)
    expect(creditedYearsBetween('2024-01-01', null)).toBe(0)
    expect(creditedYearsBetween('2024-06-01', '2024-01-01')).toBe(0)
  })
  it('rounds up when remainder >= 6 months', () => {
    // 3 years 7 months -> 4
    expect(creditedYearsBetween('2020-01-01', '2023-08-01')).toBe(4)
  })
  it('rounds down when remainder < 6 months', () => {
    // 3 years 2 months -> 3
    expect(creditedYearsBetween('2020-01-01', '2023-03-01')).toBe(3)
  })
  it('exactly 6 months rounds up to a whole year', () => {
    expect(creditedYearsBetween('2024-01-01', '2024-07-02')).toBe(1)
  })
})

describe('computeSeparationPay', () => {
  const basic = 20000
  it('redundancy = 1 month per year, min 1 month', () => {
    const r = computeSeparationPay('redundancy', basic, 3)
    expect(r.applies).toBe(true)
    expect(r.amount).toBe(60000)
  })
  it('redundancy with 0 years still pays min 1 month', () => {
    const r = computeSeparationPay('redundancy', basic, 0)
    expect(r.amount).toBe(20000)
  })
  it('retrenchment = half month per year, min 1 month', () => {
    const r = computeSeparationPay('retrenchment', basic, 4) // 0.5*4 = 2 months = 40000
    expect(r.amount).toBe(40000)
  })
  it('retrenchment min 1 month when service is short', () => {
    const r = computeSeparationPay('retrenchment', basic, 1) // 0.5 month = 10000 -> min 20000
    expect(r.amount).toBe(20000)
  })
  it('disease = higher of 1 month or half-month-per-year', () => {
    expect(computeSeparationPay('disease', basic, 1).amount).toBe(20000) // half=10000 -> 1 month
    expect(computeSeparationPay('disease', basic, 5).amount).toBe(50000) // half=50000 > 20000
  })
  it('closure with serious losses does not auto-apply', () => {
    const r = computeSeparationPay('closure_serious_losses', basic, 5)
    expect(r.applies).toBe(false)
    expect(r.amount).toBe(0)
    expect(r.warning).toBeTruthy()
  })
  it('resignation and just cause do not grant statutory pay', () => {
    expect(computeSeparationPay('resignation', basic, 10).applies).toBe(false)
    expect(computeSeparationPay('just_cause', basic, 10).amount).toBe(0)
  })
})

describe('proratedThirteenthMonth', () => {
  it('divides annual basic earned by 12', () => {
    expect(proratedThirteenthMonth(120000, 0)).toBe(10000)
  })
  it('subtracts amount already paid', () => {
    expect(proratedThirteenthMonth(120000, 4000)).toBe(6000)
  })
  it('never returns negative', () => {
    expect(proratedThirteenthMonth(12000, 5000)).toBe(0)
  })
})

describe('daily rate & leave conversion', () => {
  it('daily rate = monthly / divisor', () => {
    expect(dailyRate(26000, 26)).toBe(1000)
    expect(dailyRate(20000, 0)).toBe(0)
  })
  it('leave conversion = credits × daily rate', () => {
    expect(leaveConversion(5, 26000, 26)).toBe(5000)
    expect(leaveConversion(0, 26000, 26)).toBe(0)
  })
})

describe('profitMargin', () => {
  it('returns null when revenue is 0 (no divide by zero)', () => {
    expect(profitMargin(0, -5000)).toBeNull()
  })
  it('computes percentage', () => {
    expect(profitMargin(100000, 25000)).toBe(25)
    expect(profitMargin(100000, -10000)).toBe(-10)
  })
})

describe('currency helpers', () => {
  it('toPhp multiplies by exchange rate', () => {
    expect(toPhp(100, 56)).toBe(5600)
    expect(toPhp(100, 0)).toBe(100) // rate 0 falls back to 1
  })
  it('allocateAmount splits by percentage', () => {
    expect(allocateAmount(10000, 30)).toBe(3000)
    expect(allocateAmount(10000, 0)).toBe(0)
  })
  it('allocations across 100% sum back to the total (2dp)', () => {
    const total = 10000
    const parts = [33.33, 33.33, 33.34].map(p => allocateAmount(total, p))
    expect(round2(parts.reduce((s, x) => s + x, 0))).toBe(10000)
  })
})
