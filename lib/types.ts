export type UserRole = 'employee' | 'admin' | 'system_admin';
export type AccountStatus = 'active' | 'inactive' | 'locked' | 'pending_approval';
export type PayFrequency = 'weekly' | 'semi_monthly' | 'monthly';
export type WeekType = 'monday' | 'month_based';

export const DEPARTMENTS = [
  'IT',
  'Legal',
  'People Operation',
  'Admin & Payroll',
  'Marketing',
] as const;

export type Department = (typeof DEPARTMENTS)[number];

export const DEFAULT_HOURLY_WAGE = 300;
export const DEFAULT_DEPARTMENT: Department = 'IT';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: AccountStatus;
  is_hidden: boolean; // Hidden system admin flag
  clocks_in: boolean; // Whether user can clock in
  must_change_password?: boolean;
  failed_login_count: number;
  locked_until?: string | null;
  two_factor_enabled?: boolean;
  employee_no: string;
  first_name: string;
  last_name: string;
  position: string;
  department: string;
  contact_no: string;
  address?: string;
  emergency_contact?: string;
  bank_name?: string; // Bank or eWallet Name (e.g. BDO, BPI, GCash, Maya)
  account_no?: string; // Bank or eWallet Account Number / Mobile Number
  hire_date: string;
  photo_url?: string;
  hourly_rate: number; // Stored securely; filtered out for employee view
  pay_frequency: PayFrequency;
  max_hours_day?: number;
  max_hours_week?: number;
  max_hours_month?: number;
  auth_provider?: 'google' | 'email';
  created_at?: string;
}

export interface WageHistory {
  id: string;
  user_id: string;
  hourly_rate: number;
  effective_from: string;
  effective_to: string | null;
  note: string;
  set_by_name: string;
  created_at: string;
}

export type DtrStatus =
  | 'open'
  | 'submitted'
  | 'adjusted'
  | 'extra_hours_pending'
  | 'approved'
  | 'rejected'
  | 'locked';

export type ExtraHoursStatus = 'none' | 'pending' | 'approved' | 'declined';

export interface DtrRevision {
  id: string;
  dtr_entry_id: string;
  changed_by_name: string;
  display_actor: string;
  field: string;
  old_value: string;
  new_value: string;
  reason: string;
  changed_at: string;
}

export interface DtrEntry {
  id: string;
  user_id: string;
  work_date: string; // YYYY-MM-DD
  time_in: string; // HH:mm or ISO
  time_out: string | null; // null if session is currently open
  remarks: string;
  minutes_worked: number;
  hours: number; // Decimal e.g. 1.50
  regular_hours: number;
  extra_hours: number;
  extra_hours_status: ExtraHoursStatus;
  extra_hours_limit?: 'day' | 'week' | 'month' | null;
  extra_hours_note?: string;
  payable_hours: number;
  hourly_rate_snapshot: number; // Wage at time in
  status: DtrStatus;
  source: 'self' | 'admin_manual' | 'correction';
  ip_in?: string;
  ip_out?: string;
  device_info?: string;
  pay_period_id: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  revisions: DtrRevision[];
  self_approved?: boolean;
  self_approved_at?: string;
  self_approved_ref?: string;
  reference_no?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MonthlySelfApproval {
  id: string;
  user_id: string;
  month: string; // YYYY-MM
  reference_no?: string;
  total_hours: number;
  regular_hours: number;
  extra_hours: number;
  approved_hours: number;
  entries_count: number;
  submitted_at: string;
  employee_note?: string;
  attested: boolean;
  status: 'submitted' | 'reviewed' | 'approved';
  reviewed_by_name?: string;
  reviewed_at?: string;
}

export interface DtrFinalizeReminderResult {
  user_id: string;
  name: string;
  email: string;
  success: boolean;
  simulated?: boolean;
  error?: string;
}

export interface DtrFinalizeReminderResponse {
  success: boolean;
  month?: string;
  deadline_date?: string;
  total?: number;
  sent: number;
  failed: number;
  simulated?: boolean;
  results: DtrFinalizeReminderResult[];
  skipped?: Array<{ user_id: string; reason: string }>;
  message?: string;
  error?: string;
}

export interface AppNotification {
  id: string;
  recipient_role?: 'admin' | 'all' | 'employee';
  recipient_id?: string;
  type: 'monthly_self_approval' | 'correction_request' | 'extra_hours' | 'general' | 'payment_disbursed' | 'reimbursement_request' | 'reimbursement_adjudicated';
  title: string;
  message: string;
  user_id?: string;
  user_name?: string;
  month?: string; // YYYY-MM
  link_tab?: string;
  is_read: boolean;
  created_at: string;
}

export type ReimbursementStatus = 'pending' | 'approved' | 'rejected';

export interface ReimbursementRequest {
  id: string;
  user_id: string;
  title: string; // name of reimbursement (e.g. "Travel Grab fare to client", "Office stationary")
  amount: number; // reimbursement amount
  category: string; // e.g. "Travel & Transportation", "Meals & Representation", "Office & Equipment", "Internet & Utilities", "Client Expense", "Other"
  expense_date: string; // YYYY-MM-DD
  description?: string; // notes / description / receipt details
  receipt_url?: string; // optional receipt URL or reference
  status: ReimbursementStatus;
  pay_period_id?: string; // target pay period credited
  reviewed_by_name?: string;
  review_note?: string;
  reviewed_at?: string;
  payment_id?: string; // ID of the payment record where the additional payment was added
  payment_line_id?: string; // ID of the payment line
  created_at: string;
  updated_at?: string;
}

export interface CorrectionRequest {
  id: string;
  user_id: string;
  dtr_entry_id: string | null;
  work_date: string;
  requested_time_in: string;
  requested_time_out: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by_name?: string;
  review_note?: string;
  reviewed_at?: string;
  created_at: string;
}

export type PeriodStatus = 'open' | 'closed' | 'locked' | 'purged';

export interface PayPeriod {
  id: string;
  frequency: PayFrequency;
  start_date: string;
  end_date: string;
  pay_date: string;
  status: PeriodStatus;
  week_type?: WeekType;
  closed_by_name?: string;
  locked_by_name?: string;
  purged_at?: string;
}

export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'on_hold' | 'cancelled';
export type PaymentMethod = 'direct_deposit' | 'check' | 'cash' | 'bank_transfer' | 'ewallet';

export type PaymentLineType = 'hours' | 'adjustment' | 'bonus' | 'allowance' | 'reimbursement' | 'custom';

export interface PaymentLine {
  id: string;
  line_type: PaymentLineType | string;
  hourly_rate: number;
  hours: number;
  amount: number;
  description: string;
  category?: string; // e.g. 'Performance Bonus', 'Transpo Allowance', 'Meal Allowance'
  added_by_name?: string;
  created_at?: string;
  source_entry_id?: string;
}

export interface PaymentRecord {
  id: string;
  pay_period_id: string;
  user_id: string;
  month?: string; // YYYY-MM
  total_hours: number;
  sessions_count: number;
  gross_amount: number;
  status: PaymentStatus;
  method?: string;
  reference_no?: string;
  paid_at?: string;
  status_reason?: string; // Visible to employee if on_hold
  generated_at: string;
  updated_by_name?: string;
  lines: PaymentLine[];
}

export interface AuditLog {
  id: string;
  actor_id: string;
  actor_name: string;
  actor_role: UserRole;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  is_system_scope: boolean;
  created_at: string;
}

export interface SystemSettings {
  week_type: WeekType;
  pay_date_rule_semi_monthly: '16th_and_1st' | '15th_and_end';
  pay_date_rule_monthly: '1st' | 'end_of_month';
  pay_date_rule_weekly: 'following_monday' | 'next_day';
  weekend_pay_date_handling: 'previous_business_day' | 'next_business_day';
  remarks_min_length: number;
  retention_period_years: number;
  company_max_hours: {
    day?: number;
    week?: number;
    month?: number;
  };
  timezone: string;
  currency_symbol: string;
}
