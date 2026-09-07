// Pure, testable computation helpers for Final Pay and Project P&L.
// These are extracted so they can be unit-tested and reused across pages.

export type SepKey =
  | 'retrenchment' | 'redundancy' | 'labor_saving_devices'
  | 'closure_no_losses' | 'closure_serious_losses' | 'disease'
  | 'resignation' | 'just_cause' | 'end_of_contract' | 'other'

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export interface SepResult {
  applies: boolean
  amount: number
  formula: string
  basis: string
  warning?: string
}

const peso = (n: number) =>
  `₱${round2(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

// Credited years of service: a remaining fraction of >= 6 months rounds up to a whole year.
export function creditedYearsBetween(hired: string | null, lastDay: string | null): number {
  if (!hired || !lastDay) return 0
  const a = new Date(hired), b = new Date(lastDay)
  if (isNaN(a.getTime()) || isNaN(b.getTime()) || b < a) return 0
  const years = (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  const whole = Math.floor(years)
  return years - whole >= 0.5 ? whole + 1 : whole
}

// Article 298/299 separation pay. Returns amount + shown formula + legal basis.
export function computeSeparationPay(reason: SepKey, monthlyBasic: number, creditedYears: number): SepResult {
  const oneMonth = monthlyBasic
  const halfPerYear = round2(monthlyBasic * 0.5 * creditedYears)
  switch (reason) {
    case 'redundancy':
    case 'labor_saving_devices': {
      const perYear = round2(monthlyBasic * creditedYears)
      const amount = Math.max(perYear, oneMonth)
      return { applies: true, amount, formula: `Monthly Basic (${peso(monthlyBasic)}) × Credited Years (${creditedYears}) = ${peso(perYear)}; min 1 month (${peso(oneMonth)}) → ${peso(amount)}`, basis: 'Labor Code Art. 298 — 1 month pay per year of service (min. 1 month).' }
    }
    case 'retrenchment':
    case 'closure_no_losses': {
      const amount = Math.max(halfPerYear, oneMonth)
      return { applies: true, amount, formula: `Monthly Basic (${peso(monthlyBasic)}) × 0.5 × Credited Years (${creditedYears}) = ${peso(halfPerYear)}; min 1 month (${peso(oneMonth)}) → ${peso(amount)}`, basis: 'Labor Code Art. 298 — ½ month pay per year of service (min. 1 month).' }
    }
    case 'disease': {
      const amount = Math.max(oneMonth, halfPerYear)
      return { applies: true, amount, formula: `Higher of 1 month (${peso(oneMonth)}) or ½ month × years (${peso(halfPerYear)}) → ${peso(amount)}`, basis: 'Labor Code Art. 299 — termination due to disease.' }
    }
    case 'closure_serious_losses':
      return { applies: false, amount: 0, formula: 'Not auto-calculated.', basis: 'Art. 298 — no statutory pay for closure due to serious business losses.', warning: 'Requires supporting documents and HR/legal review.' }
    case 'resignation':
      return { applies: false, amount: 0, formula: 'Not applicable.', basis: 'No statutory separation pay for resignation.', warning: 'Only if provided by company policy/contract.' }
    case 'just_cause':
      return { applies: false, amount: 0, formula: 'Not applicable.', basis: 'No statutory separation pay for termination for just cause (Art. 297).' }
    case 'end_of_contract':
      return { applies: false, amount: 0, formula: 'Not applicable.', basis: 'Fixed-term expiration — no statutory pay by default.' }
    default:
      return { applies: false, amount: 0, formula: 'Manual entry required.', basis: 'Reason not covered by a specific statutory formula.' }
  }
}

// Prorated 13th-month: total basic earned in the year ÷ 12, minus already paid, never negative.
export function proratedThirteenthMonth(basicEarnedYTD: number, alreadyPaid: number): number {
  return round2(Math.max(0, basicEarnedYTD / 12 - (alreadyPaid || 0)))
}

// A salary change effective on a date (used to build a per-period earnings timeline).
export interface SalaryChange { effective_date: string; new_salary: number }

export interface EarnedSegment { from: string; to: string; monthly: number; months: number; earned: number }

// Number of whole+fractional months between two ISO dates (inclusive of both ends by day count / 30.4375).
function monthsSpan(from: Date, to: Date): number {
  const days = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24) + 1 // inclusive
  return days / 30.4375
}

// Build the basic-salary-earned timeline for the calendar year, honoring salary
// increases by their effective dates. Returns per-segment breakdown + total earned.
//   currentMonthly = the salary in effect BEFORE the earliest in-range change
//     (i.e., the salary at `from`). changes = salary_history entries (effective_date, new_salary).
export function basicEarnedTimeline(
  from: string,           // Jan 1 or hire date, whichever later (ISO)
  to: string,             // last working day (ISO)
  salaryAtStart: number,  // monthly basic in effect at `from`
  changes: SalaryChange[],
): { segments: EarnedSegment[]; totalEarned: number } {
  const start = new Date(from), end = new Date(to)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start || salaryAtStart < 0) {
    return { segments: [], totalEarned: 0 }
  }
  // boundaries: start, each in-range change date, end
  const inRange = (changes || [])
    .filter(c => c.effective_date && new Date(c.effective_date) > start && new Date(c.effective_date) <= end)
    .map(c => ({ date: new Date(c.effective_date), salary: Number(c.new_salary) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  const segments: EarnedSegment[] = []
  let segStart = start
  let curSalary = salaryAtStart
  for (const chg of inRange) {
    const segEnd = new Date(chg.date.getTime() - 24 * 60 * 60 * 1000) // day before change
    if (segEnd >= segStart) {
      const m = monthsSpan(segStart, segEnd)
      segments.push({ from: segStart.toISOString().slice(0, 10), to: segEnd.toISOString().slice(0, 10), monthly: curSalary, months: m, earned: curSalary * m })
    }
    segStart = chg.date
    curSalary = chg.salary
  }
  // final segment
  const m = monthsSpan(segStart, end)
  segments.push({ from: segStart.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), monthly: curSalary, months: m, earned: curSalary * m })

  const totalEarned = segments.reduce((s, x) => s + x.earned, 0)
  return { segments, totalEarned }
}

// Leave conversion = convertible credits × daily rate; daily rate = monthly basic / divisor.
export function dailyRate(monthlyBasic: number, divisor: number): number {
  return divisor > 0 ? round2(monthlyBasic / divisor) : 0
}
export function leaveConversion(convertibleCredits: number, monthlyBasic: number, divisor: number): number {
  return round2((convertibleCredits || 0) * dailyRate(monthlyBasic, divisor))
}

// Profit margin: null when revenue is 0 (avoid divide-by-zero), else percentage.
export function profitMargin(revenue: number, profit: number): number | null {
  return revenue > 0 ? (profit / revenue) * 100 : null
}

// PHP conversion for a foreign amount (rate = PHP per 1 unit of currency).
export function toPhp(amount: number, exchangeRate: number): number {
  return round2((amount || 0) * (exchangeRate || 1))
}

// Split an amount by an allocation percentage (0..100), rounded to 2dp.
export function allocateAmount(amount: number, pct: number): number {
  return round2((amount || 0) * (pct || 0) / 100)
}
