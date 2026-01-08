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
  gender?: 'male' | 'female' | 'other' | null;
  marital_status?: 'single' | 'married' | 'divorced' | 'widowed' | null;
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
  loan_deductions?: number | null;
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
  asset_tag?: string | null;
  item_description: string;
  category: string;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  purchase_date?: string | null;
  purchase_price?: number | null;
  supplier?: string | null;
  warranty_expiry?: string | null;
  assigned_to?: string | null;
  location?: string | null;
  status: string;
  condition?: string | null;
  notes?: string | null;
  updated_at: string;
}

export interface InventoryHistory {
  id: string;
  created_at: string;
  inventory_id: string;
  action_type: 'maintenance' | 'repair' | 'transfer' | 'status_change';
  description: string;
  performed_by?: string | null;
  action_date: string;
  cost?: number | null;
  notes?: string | null;
}

export interface Loan {
  id: string;
  created_at: string;
  employee_id: string;
  loan_type: 'cash_advance' | 'emergency_loan' | 'salary_loan' | 'equipment_loan' | 'other';
  principal_amount: number;
  interest_rate: number;
  total_amount: number;
  bimonthly_deduction: number;
  remaining_balance: number;
  loan_date: string;
  start_deduction_date: string;
  end_date?: string | null;
  status: 'active' | 'completed' | 'cancelled';
  purpose?: string | null;
  notes?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  updated_at: string;
}

export interface LoanPayment {
  id: string;
  created_at: string;
  loan_id: string;
  payslip_id?: string | null;
  payment_date: string;
  amount: number;
  balance_before: number;
  balance_after: number;
  payment_type: 'payroll_deduction' | 'manual_payment' | 'adjustment';
  notes?: string | null;
}

export interface MoneyReceived {
  id: string;
  created_at: string;
  date_received: string;
  amount: number;
  sender_name: string;
  sender_contact?: string | null;
  payment_method: 'bank_transfer' | 'cash' | 'check' | 'gcash' | 'paymaya' | 'paypal' | 'other';
  reference_number?: string | null;
  purpose: string;
  category?: string | null;
  notes?: string | null;
  receipt_url?: string | null;
  status: 'pending' | 'confirmed' | 'cleared';
}
