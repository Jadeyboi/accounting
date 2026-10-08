import { describe, it, expect } from 'vitest'
import { calculateStatutoryDeductions } from './statutoryDeductions'
import { toMonthly, toQuarterly, toMonthlyRaw, toQuarterlyRaw } from './hmo'
import { accrualForBasic, yearOf } from './thirteenthMonth'

// ───────────────────────────────────────────────────────────────────────────
// Statutory deductions (PH 2024/2025 rules). Expected values hand-computed.
//   SSS: EE 5% of MSC, ER 10% of MSC + EC (₱10 if MSC<=14500 else ₱30),
//        MSC floor 5000 / ceiling 35000.
//   Pag-IBIG: EE 2% (1% if salary<=1500) of min(salary,10000); ER 2%.
//   PhilHealth: 2.5% EE + 2.5% ER of clamp(salary,10000,100000).
//   Tax: TRAIN monthly/semi-monthly brackets on (gross - SSS - Pag-IBIG - PhilHealth).
// ───────────────────────────────────────────────────────────────────────────
describe('calculateStatutoryDeductions — monthly', () => {
  it('₱20,000 monthly computes each component correctly', () => {
    const d = calculateStatutoryDeductions(20000, 'monthly')
    // MSC = 5500 + floor((20000-5250)/500)*500 = 20000
    expect(d.sss).toBe(1000)            // 20000 * 5%
    expect(d.employerSss).toBe(2030)    // 20000 * 10% + 30 EC
    expect(d.pagibig).toBe(200)         // min(20000,10000) * 2%
    expect(d.employerPagibig).toBe(200)
    expect(d.philhealth).toBe(500)      // 20000 * 2.5%
    expect(d.employerPhilhealth).toBe(500)
    // taxable = 20000 - 1000 - 200 - 500 = 18300 <= 20833 => 0 tax
    expect(d.tax).toBe(0)
    expect(d.total).toBe(1700)          // EE: 1000 + 200 + 500 + 0
    expect(d.netPay).toBe(18300)        // 20000 - 1700
  })

  it('₱50,000 monthly hits SSS ceiling behavior and a tax bracket', () => {
    const d = calculateStatutoryDeductions(50000, 'monthly')
    // MSC capped at 35000 => EE SSS = 1750, ER = 3500 + 30 = 3530
    expect(d.sss).toBe(1750)
    expect(d.employerSss).toBe(3530)
    expect(d.pagibig).toBe(200)         // capped fund salary 10000 * 2%
    expect(d.philhealth).toBe(1250)     // 50000 * 2.5%
    // taxable = 50000 - 1750 - 200 - 1250 = 46800
    // bracket [33333,66667) base 1875 + 20% over 33333 => 1875 + 0.2*(46800-33333)=1875+2693.4=4568.4
    expect(d.tax).toBeCloseTo(4568.4, 1)
  })

  it('zero salary yields all zeros (no negative, no NaN)', () => {
    const d = calculateStatutoryDeductions(0, 'monthly')
    expect(d.sss).toBe(0)
    expect(d.employerSss).toBe(0)
    expect(d.pagibig).toBe(0)
    expect(d.philhealth).toBe(0)
    expect(d.tax).toBe(0)
    expect(d.total).toBe(0)
    expect(d.netPay).toBe(0)
  })

  it('low salary uses minimum MSC and 1% Pag-IBIG threshold', () => {
    const d = calculateStatutoryDeductions(1500, 'monthly')
    // MSC floor 5000 => EE SSS = 250
    expect(d.sss).toBe(250)
    // Pag-IBIG: salary<=1500 => 1% of min(1500,10000)=1500 => 15
    expect(d.pagibig).toBe(15)
  })
})

describe('calculateStatutoryDeductions — semiMonthly halves monthly figures', () => {
  it('₱20,000 semi-monthly is half of the monthly components', () => {
    const m = calculateStatutoryDeductions(20000, 'monthly')
    const s = calculateStatutoryDeductions(20000, 'semiMonthly')
    expect(s.sss).toBeCloseTo(m.sss / 2, 2)
    expect(s.pagibig).toBeCloseTo(m.pagibig / 2, 2)
    expect(s.philhealth).toBeCloseTo(m.philhealth / 2, 2)
    expect(s.grossPay).toBeCloseTo(10000, 2)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// HMO premium normalization
// ───────────────────────────────────────────────────────────────────────────
describe('HMO premium conversions', () => {
  it('quarterly → monthly divides by 3; → quarterly is identity', () => {
    expect(toMonthly(5032.88, 'quarterly')).toBe(1677.63)   // rounded
    expect(toQuarterly(5032.88, 'quarterly')).toBe(5032.88)
  })
  it('raw helpers keep full precision (no rounding)', () => {
    expect(toMonthlyRaw(5032.88, 'quarterly')).toBeCloseTo(1677.6266666, 6)
    expect(toQuarterlyRaw(1000, 'monthly')).toBe(3000)
    expect(toMonthlyRaw(12000, 'annual')).toBe(1000)
  })
  it('company quarterly total for 22 Platinum + 24 Gold reconciles exactly', () => {
    const total = 22 * 5032.88 + 24 * 5063.0
    expect(total).toBeCloseTo(232235.36, 2)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// 13th month accrual = basic earned per cutoff / 12
// ───────────────────────────────────────────────────────────────────────────
describe('13th month accrual', () => {
  it('half-month basic / 12', () => {
    expect(accrualForBasic(13000)).toBe(1083.33) // 13000/12 = 1083.333..
  })
  it('zero basic yields zero', () => {
    expect(accrualForBasic(0)).toBe(0)
  })
  it('a full year of semi-monthly accruals ≈ one month basic', () => {
    // monthly basic 26000 -> 13000 per cutoff, 24 cutoffs
    const perCutoff = accrualForBasic(13000)
    expect(perCutoff * 24).toBeCloseTo(26000, 0) // ≈ one month (rounding ~±0.1)
  })
  it('yearOf reads the calendar year from the period end', () => {
    expect(yearOf('2026-10-15')).toBe(2026)
  })
})
