export type PayrollFrequency = 'monthly' | 'semiMonthly'

export interface StatutoryDeductions {
  grossPay: number
  monthlySalary: number
  sss: number
  pagibig: number
  philhealth: number
  tax: number
  employerSss: number
  employerPagibig: number
  employerPhilhealth: number
  total: number
  totalEmployer: number
  netPay: number
}

// ─────────────────────────────────────────────────────────────────────────
// Configurable statutory rates (PH). These default to the 2025 schedule.
// They can be overridden at runtime via setStatutoryRates(...) — see
// loadStatutoryRates() which reads the effective-dated DB config. All
// calculation functions read from the live `RATES` object so a single
// override updates every computation consistently.
// ─────────────────────────────────────────────────────────────────────────
export interface StatutoryRates {
  effectiveDate: string            // ISO date this schedule takes effect
  sss: {
    employeeRate: number           // e.g. 0.05
    employerRate: number           // e.g. 0.10
    mscFloor: number               // minimum monthly salary credit
    mscCeiling: number             // maximum monthly salary credit
    mscStep: number                // credit granularity
    mscBase: number                // credit at the first step above the floor band
    mscBaseSalary: number          // salary at/above which stepping starts
    ecLowAmount: number            // Employees' Compensation premium (low MSC)
    ecHighAmount: number           // EC premium (high MSC)
    ecThreshold: number            // MSC at/below which the low EC applies
  }
  pagibig: {
    lowRate: number                // rate when salary <= lowThreshold
    highRate: number               // rate when salary > lowThreshold
    lowThreshold: number
    fundSalaryCap: number          // max salary the rate applies to
    employerRate: number
  }
  philhealth: {
    rate: number                   // employee share (= employer share)
    salaryFloor: number
    salaryCeiling: number
  }
}

export const DEFAULT_STATUTORY_RATES: StatutoryRates = {
  effectiveDate: '2025-01-01',
  sss: {
    employeeRate: 0.05, employerRate: 0.10,
    mscFloor: 5000, mscCeiling: 35000, mscStep: 500, mscBase: 5500, mscBaseSalary: 5250,
    ecLowAmount: 10, ecHighAmount: 30, ecThreshold: 14500,
  },
  pagibig: { lowRate: 0.01, highRate: 0.02, lowThreshold: 1500, fundSalaryCap: 10000, employerRate: 0.02 },
  philhealth: { rate: 0.025, salaryFloor: 10000, salaryCeiling: 100000 },
}

// Live rates — mutable via setStatutoryRates. Starts at the 2025 default.
let RATES: StatutoryRates = DEFAULT_STATUTORY_RATES

/** Override the active statutory rates (e.g. after loading from DB config). */
export function setStatutoryRates(rates: StatutoryRates) {
  RATES = rates
}

/** Return the currently active statutory rates. */
export function getStatutoryRates(): StatutoryRates {
  return RATES
}

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

const getSssMonthlySalaryCredit = (monthlySalary: number) => {
  const s = RATES.sss
  if (monthlySalary <= 0) return 0
  if (monthlySalary < s.mscBaseSalary) return s.mscFloor
  return Math.min(s.mscCeiling, s.mscBase + Math.floor((monthlySalary - s.mscBaseSalary) / s.mscStep) * s.mscStep)
}

const calculateSssMonthly = (monthlySalary: number) => roundCurrency(getSssMonthlySalaryCredit(monthlySalary) * RATES.sss.employeeRate)

const calculateEmployerSssMonthly = (monthlySalary: number) => {
  const s = RATES.sss
  const monthlySalaryCredit = getSssMonthlySalaryCredit(monthlySalary)
  if (monthlySalaryCredit === 0) return 0
  const employeesCompensation = monthlySalaryCredit <= s.ecThreshold ? s.ecLowAmount : s.ecHighAmount
  return roundCurrency(monthlySalaryCredit * s.employerRate + employeesCompensation)
}

const calculatePagibigMonthly = (monthlySalary: number) => {
  const p = RATES.pagibig
  if (monthlySalary <= 0) return 0
  const fundSalary = Math.min(monthlySalary, p.fundSalaryCap)
  return roundCurrency(fundSalary * (monthlySalary <= p.lowThreshold ? p.lowRate : p.highRate))
}

const calculatePhilhealthMonthly = (monthlySalary: number) => {
  const h = RATES.philhealth
  if (monthlySalary <= 0) return 0
  const premiumBase = Math.min(Math.max(monthlySalary, h.salaryFloor), h.salaryCeiling)
  return roundCurrency(premiumBase * h.rate)
}

const calculateWithholdingTax = (taxablePay: number, frequency: PayrollFrequency) => {
  if (taxablePay <= 0) return 0

  const brackets = frequency === 'monthly'
    ? [
        [20833, 0, 0],
        [33333, 20833, 0.15],
        [66667, 33333, 0.2],
        [166667, 66667, 0.25],
        [666667, 166667, 0.3],
        [Infinity, 666667, 0.35],
      ]
    : [
        [10417, 0, 0],
        [16667, 10417, 0.15],
        [33333, 16667, 0.2],
        [83333, 33333, 0.25],
        [333333, 83333, 0.3],
        [Infinity, 333333, 0.35],
      ]

  const baseTax = frequency === 'monthly'
    ? [0, 0, 1875, 8541.8, 33541.8, 183541.8]
    : [0, 0, 937.5, 4270.7, 16770.7, 91770.7]

  const bracketIndex = brackets.findIndex(([ceiling]) => taxablePay <= ceiling)
  const [, floor, rate] = brackets[bracketIndex]
  return roundCurrency(baseTax[bracketIndex] + (taxablePay - floor) * rate)
}

export function calculateStatutoryDeductions(
  monthlySalary: number,
  frequency: PayrollFrequency = 'monthly'
): StatutoryDeductions {
  const safeMonthlySalary = Math.max(0, Number.isFinite(monthlySalary) ? monthlySalary : 0)
  const divisor = frequency === 'semiMonthly' ? 2 : 1
  const grossPay = safeMonthlySalary / divisor
  const sss = calculateSssMonthly(safeMonthlySalary) / divisor
  const pagibig = calculatePagibigMonthly(safeMonthlySalary) / divisor
  const philhealth = calculatePhilhealthMonthly(safeMonthlySalary) / divisor
  const employerSss = calculateEmployerSssMonthly(safeMonthlySalary) / divisor
  const employerPagibig = Math.min(safeMonthlySalary, RATES.pagibig.fundSalaryCap) * RATES.pagibig.employerRate / divisor
  const employerPhilhealth = calculatePhilhealthMonthly(safeMonthlySalary) / divisor
  const tax = calculateWithholdingTax(grossPay - sss - pagibig - philhealth, frequency)
  const total = roundCurrency(sss + pagibig + philhealth + tax)
  const totalEmployer = roundCurrency(employerSss + employerPagibig + employerPhilhealth)

  return {
    grossPay: roundCurrency(grossPay),
    monthlySalary: safeMonthlySalary,
    sss: roundCurrency(sss),
    pagibig: roundCurrency(pagibig),
    philhealth: roundCurrency(philhealth),
    tax,
    employerSss: roundCurrency(employerSss),
    employerPagibig: roundCurrency(employerPagibig),
    employerPhilhealth: roundCurrency(employerPhilhealth),
    total,
    totalEmployer,
    netPay: roundCurrency(grossPay - total),
  }
}
