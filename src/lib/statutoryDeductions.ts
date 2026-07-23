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

const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100

const getSssMonthlySalaryCredit = (monthlySalary: number) => {
  if (monthlySalary <= 0) return 0
  if (monthlySalary < 5250) return 5000
  return Math.min(35000, 5500 + Math.floor((monthlySalary - 5250) / 500) * 500)
}

const calculateSssMonthly = (monthlySalary: number) => roundCurrency(getSssMonthlySalaryCredit(monthlySalary) * 0.05)

const calculateEmployerSssMonthly = (monthlySalary: number) => {
  const monthlySalaryCredit = getSssMonthlySalaryCredit(monthlySalary)
  if (monthlySalaryCredit === 0) return 0
  const employeesCompensation = monthlySalaryCredit <= 14500 ? 10 : 30
  return roundCurrency(monthlySalaryCredit * 0.1 + employeesCompensation)
}

const calculatePagibigMonthly = (monthlySalary: number) => {
  if (monthlySalary <= 0) return 0
  const fundSalary = Math.min(monthlySalary, 10000)
  return roundCurrency(fundSalary * (monthlySalary <= 1500 ? 0.01 : 0.02))
}

const calculatePhilhealthMonthly = (monthlySalary: number) => {
  if (monthlySalary <= 0) return 0
  const premiumBase = Math.min(Math.max(monthlySalary, 10000), 100000)
  return roundCurrency(premiumBase * 0.025)
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
  const employerPagibig = Math.min(safeMonthlySalary, 10000) * 0.02 / divisor
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
