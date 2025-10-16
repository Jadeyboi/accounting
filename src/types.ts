export type TransactionType = 'in' | 'out' | 'expense'

export interface Transaction {
  id: string
  created_at: string
  date: string
  type: TransactionType
  amount: number
  category?: string | null
  note?: string | null
}

export interface Employee {
  id: string
  created_at: string
  name: string
  position?: string | null
  base_salary?: number | null
}

export interface Payslip {
  id: string
  created_at: string
  employee_id: string
  period_start: string
  period_end: string
  date_issued: string
  gross_salary: number
  sss?: number | null
  pagibig?: number | null
  philhealth?: number | null
  tax?: number | null
  cash_advance?: number | null
  bonuses?: number | null
  allowances?: number | null
  other_deductions?: number | null
  notes?: string | null
  net_salary: number
  transaction_id?: string | null
}
