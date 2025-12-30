export type TransactionType = "in" | "out" | "expense";

export interface Transaction {
  id: string;
  created_at: string;
  date: string;
  type: TransactionType;
  amount: number;
  category?: string | null;
  note?: string | null;
  receipt_url?: string | null;
}

export interface Employee {
  id: string;
  created_at: string;
  name: string;
  position?: string | null;
  base_salary?: number | null;
  employee_number?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  birthdate?: string | null;
  date_hired?: string | null;
  department?: string | null;
  status?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relationship?: string | null;
  sss_number?: string | null;
  philhealth_number?: string | null;
  pagibig_number?: string | null;
  tin_number?: string | null;
  sick_leave_balance?: number | null;
  vacation_leave_balance?: number | null;
  birthday_leave_balance?: number | null;
  employment_status?: 'probationary' | 'regular' | null;
  regularization_date?: string | null;
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_account_name?: string | null;
  bank_branch?: string | null;
}

export interface LeaveRequest {
  id: string;
  created_at: string;
  employee_id: string;
  leave_type: 'sick' | 'vacation' | 'birthday' | 'emergency' | 'unpaid';
  start_date: string;
  end_date: string;
  days_count: number;
  reason?: string | null;
  status: 'pending' | 'approved' | 'rejected';
  approved_by?: string | null;
  approved_at?: string | null;
  notes?: string | null;
}

export interface Payslip {
  id: string;
  created_at: string;
  employee_id: string;
  period_start: string;
  period_end: string;
  date_issued: string;
  gross_salary: number;
  sss?: number | null;
  pagibig?: number | null;
  philhealth?: number | null;
  tax?: number | null;
  cash_advance?: number | null;
  bonuses?: number | null;
  allowances?: number | null;
  other_deductions?: number | null;
  notes?: string | null;
  net_salary: number;
  transaction_id?: string | null;
}

export interface Saving {
  id: string;
  created_at: string;
  date: string;
  description?: string | null;
  amount: number;
  account?: string | null;
}

export interface InventoryItem {
  id: string;
  created_at: string;
  item_name: string;
  category: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_value?: number;
  location?: string | null;
  supplier?: string | null;
  minimum_stock: number;
  notes?: string | null;
  last_restocked?: string | null;
  updated_at: string;
}

export interface InventoryTransaction {
  id: string;
  created_at: string;
  inventory_id: string;
  transaction_type: 'in' | 'out';
  quantity: number;
  reason?: string | null;
  performed_by?: string | null;
  transaction_date: string;
  notes?: string | null;
}
