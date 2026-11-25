-- ==============================================================================
-- WMedlaw DTR & TIMEKEEPING - SUPABASE DATABASE SCHEMA
-- Execute this script in your Supabase SQL Editor: 
-- https://supabase.com/dashboard/project/lnihrsvxodrrxcuxeenz/sql
-- ==============================================================================

-- 1. Profiles Table (Linked to Supabase Auth Users)
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null unique,
  first_name text default '',
  last_name text default '',
  username text,
  role text not null check (role in ('employee', 'admin', 'system_admin')) default 'employee',
  status text not null check (status in ('pending_approval', 'active', 'inactive', 'locked')) default 'pending_approval',
  clocks_in boolean not null default false,
  employee_no text unique,
  position text default 'Pending Assignment',
  department text default 'IT',
  contact_no text default '',
  address text default '',
  emergency_contact text default '',
  bank_name text default '',
  account_no text default '',
  hire_date text default (to_char(now(), 'YYYY-MM-DD')),
  hourly_rate numeric(10, 2) default 300.00,
  pay_frequency text not null check (pay_frequency in ('weekly', 'semi_monthly', 'monthly')) default 'monthly',
  max_hours_day numeric(4, 2) default 8.0,
  max_hours_week numeric(5, 2) default 40.0,
  auth_provider text default 'email',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for fast lookup
create index if not exists idx_profiles_email on public.profiles(email);
create index if not exists idx_profiles_status on public.profiles(status);
create index if not exists idx_profiles_role on public.profiles(role);

-- Ensure contact & payout columns exist on existing profiles table
alter table public.profiles add column if not exists contact_no text default '';
alter table public.profiles add column if not exists address text default '';
alter table public.profiles add column if not exists emergency_contact text default '';
alter table public.profiles add column if not exists bank_name text default '';
alter table public.profiles add column if not exists account_no text default '';

-- Enable RLS
alter table public.profiles enable row level security;

-- Helper function to check if the caller is an active admin or sysadmin.
-- Marked SECURITY DEFINER and executes with postgres permissions to avoid
-- infinite recursion when querying public.profiles inside its own RLS policies.
create or replace function public.is_admin_or_sysadmin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and role in ('admin', 'system_admin')
      and status = 'active'
  );
$$;

-- Drop existing policies if any
drop policy if exists "Users can view own profile or admins view all" on public.profiles;
drop policy if exists "Admins and Sysadmins can manage all profiles" on public.profiles;
drop policy if exists "Users can update own contact profile" on public.profiles;
drop policy if exists "Allow insert from trigger or auth user" on public.profiles;

-- RLS Policy: View profiles (Own profile or any profile if admin/system_admin)
create policy "Users can view own profile or admins view all"
  on public.profiles for select
  using (
    auth.uid() = id
    or public.is_admin_or_sysadmin()
  );

-- RLS Policy: Update profiles (Admins/Sysadmins can update all, users can update own)
create policy "Admins and Sysadmins can manage all profiles"
  on public.profiles for update
  using (
    auth.uid() = id
    or public.is_admin_or_sysadmin()
  );

-- RLS Policy: Insert profiles
create policy "Allow insert from trigger or auth user"
  on public.profiles for insert
  with check (true);

-- 2. Trigger Function: Automatically Provision Profile on auth.users Signup
create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_first_name text;
  v_last_name text;
  v_full_name text;
  v_is_sysadmin boolean;
  v_role text;
  v_status text;
  v_clocks_in boolean;
  v_position text;
  v_emp_no text;
begin
  -- Check if this user is the designated default system admin
  v_is_sysadmin := lower(trim(new.email)) = 'marquez.ronrons@gmail.com';

  -- Extract name metadata (from Google OAuth or Email signup metadata)
  v_full_name := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', '');
  v_first_name := coalesce(new.raw_user_meta_data->>'first_name', split_part(v_full_name, ' ', 1), 'User');
  v_last_name := coalesce(new.raw_user_meta_data->>'last_name', substring(v_full_name from position(' ' in v_full_name) + 1), '');

  if v_is_sysadmin then
    v_role := 'system_admin';
    v_status := 'active';
    v_clocks_in := false;
    v_position := 'System Administrator';
    v_emp_no := 'SYS-001';
    if v_first_name = 'User' or v_first_name = '' then
      v_first_name := 'Ron';
      v_last_name := 'Marquez';
    end if;
  else
    -- Standard user: must be approved by admin before activating
    v_role := 'employee';
    v_status := 'pending_approval';
    v_clocks_in := false;
    v_position := 'Pending Approval';
    v_emp_no := 'EMP-' || floor(random() * (99999 - 10000 + 1) + 10000)::text;
  end if;

  insert into public.profiles (
    id,
    email,
    first_name,
    last_name,
    username,
    role,
    status,
    clocks_in,
    employee_no,
    position,
    department,
    auth_provider,
    hourly_rate,
    pay_frequency
  )
  values (
    new.id,
    new.email,
    v_first_name,
    v_last_name,
    split_part(new.email, '@', 1),
    v_role,
    v_status,
    v_clocks_in,
    v_emp_no,
    v_position,
    'IT',
    coalesce(new.raw_app_meta_data->>'provider', 'email'),
    300.00,
    'monthly'
  )
  on conflict (id) do update
  set 
    email = excluded.email,
    updated_at = now();

  return new;
end;
$$ language plpgsql security definer;

-- Attach trigger to auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- If user marquez.ronrons@gmail.com already exists in auth.users, backfill or promote to system_admin
do $$
declare
  admin_rec record;
begin
  select id, email, raw_user_meta_data into admin_rec from auth.users where lower(trim(email)) = 'marquez.ronrons@gmail.com' limit 1;
  if found then
    insert into public.profiles (
      id,
      email,
      first_name,
      last_name,
      username,
      role,
      status,
      clocks_in,
      employee_no,
      position,
      department
    )
    values (
      admin_rec.id,
      admin_rec.email,
      'Ron',
      'Marquez',
      'marquez.ronrons',
      'system_admin',
      'active',
      false,
      'SYS-001',
      'System Administrator',
      'System Architecture'
    )
    on conflict (id) do update
    set
      role = 'system_admin',
      status = 'active',
      updated_at = now();
  end if;
end;
$$;

-- 3. Additional System Tables for Full Cloud Storage (Optional sync tables)
create table if not exists public.dtr_entries (
  id text primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  work_date text not null,
  time_in text not null,
  time_out text,
  remarks text default '',
  minutes_worked integer default 0,
  hours numeric(6, 2) default 0.00,
  regular_hours numeric(6, 2) default 0.00,
  extra_hours numeric(6, 2) default 0.00,
  extra_hours_status text default 'none',
  extra_hours_limit text,
  extra_hours_note text,
  payable_hours numeric(6, 2) default 0.00,
  hourly_rate_snapshot numeric(10, 2) default 0.00,
  status text not null default 'open',
  source text not null default 'self',
  ip_in text,
  ip_out text,
  device_info text,
  pay_period_id text,
  reviewed_by_name text,
  reviewed_at timestamptz,
  revisions jsonb default '[]'::jsonb,
  self_approved boolean default false,
  self_approved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.dtr_entries enable row level security;
drop policy if exists "DTR policy" on public.dtr_entries;
create policy "DTR policy" on public.dtr_entries
  for all
  using (
    auth.uid() = user_id
    or public.is_admin_or_sysadmin()
  )
  with check (
    auth.uid() = user_id
    or public.is_admin_or_sysadmin()
  );

create table if not exists public.correction_requests (
  id text primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  dtr_entry_id text,
  work_date text not null,
  requested_time_in text not null,
  requested_time_out text not null,
  reason text not null,
  status text not null default 'pending',
  reviewed_by_name text,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

alter table public.correction_requests enable row level security;
drop policy if exists "Correction policy" on public.correction_requests;
create policy "Correction policy" on public.correction_requests
  for all
  using (
    auth.uid() = user_id
    or public.is_admin_or_sysadmin()
  )
  with check (
    auth.uid() = user_id
    or public.is_admin_or_sysadmin()
  );

-- 3b. Reimbursement Requests Table (Employee expense filings & payroll credit)
create table if not exists public.reimbursement_requests (
  id text primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  title text not null,
  amount numeric(10, 2) not null check (amount > 0),
  category text default 'General',
  expense_date text not null,
  description text default '',
  receipt_url text,
  status text not null check (status in ('pending', 'approved', 'rejected')) default 'pending',
  pay_period_id text,
  reviewed_by_name text,
  review_note text,
  reviewed_at timestamptz,
  payment_id text,
  payment_line_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_reimbursements_user_id on public.reimbursement_requests(user_id);
create index if not exists idx_reimbursements_status on public.reimbursement_requests(status);
create index if not exists idx_reimbursements_expense_date on public.reimbursement_requests(expense_date);

alter table public.reimbursement_requests enable row level security;
drop policy if exists "Reimbursement policy" on public.reimbursement_requests;
create policy "Reimbursement policy" on public.reimbursement_requests
  for all
  using (
    auth.uid() = user_id
    or public.is_admin_or_sysadmin()
  )
  with check (
    auth.uid() = user_id
    or public.is_admin_or_sysadmin()
  );

create table if not exists public.audit_logs (
  id text primary key,
  actor_id text not null,
  actor_name text not null,
  actor_role text not null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  details text not null,
  before jsonb,
  after jsonb,
  is_system_scope boolean default false,
  created_at timestamptz default now()
);

alter table public.audit_logs enable row level security;
drop policy if exists "Audit log policy" on public.audit_logs;
create policy "Audit log policy" on public.audit_logs
  for all
  using (
    public.is_admin_or_sysadmin()
    or auth.uid()::text = actor_id
  )
  with check (
    auth.uid() is not null
  );

-- 4. Monthly Self-Approvals Table
create table if not exists public.monthly_self_approvals (
  id text primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  month text not null, -- YYYY-MM
  total_hours numeric(6, 2) default 0.00,
  regular_hours numeric(6, 2) default 0.00,
  extra_hours numeric(6, 2) default 0.00,
  approved_hours numeric(6, 2) default 0.00,
  entries_count integer default 0,
  submitted_at timestamptz default now(),
  employee_note text,
  attested boolean default true,
  status text not null default 'submitted',
  reviewed_by_name text,
  reviewed_at timestamptz,
  created_at timestamptz default now()
);

alter table public.monthly_self_approvals enable row level security;
drop policy if exists "Monthly approval policy" on public.monthly_self_approvals;
create policy "Monthly approval policy" on public.monthly_self_approvals
  for all
  using (
    auth.uid() = user_id
    or public.is_admin_or_sysadmin()
  )
  with check (
    auth.uid() = user_id
    or public.is_admin_or_sysadmin()
  );

-- 5. System Notifications Table
create table if not exists public.notifications (
  id text primary key,
  recipient_role text default 'admin',
  recipient_id uuid references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  user_id uuid references public.profiles(id) on delete cascade,
  month text,
  link_tab text,
  is_read boolean default false,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;
drop policy if exists "Notifications policy" on public.notifications;
create policy "Notifications policy" on public.notifications
  for all
  using (
    public.is_admin_or_sysadmin()
    or auth.uid() = recipient_id
  )
  with check (
    auth.uid() is not null
  );

-- 6. Pay Periods Table
create table if not exists public.pay_periods (
  id text primary key,
  frequency text not null check (frequency in ('weekly', 'semi_monthly', 'monthly')) default 'monthly',
  start_date text not null,
  end_date text not null,
  pay_date text not null,
  status text not null check (status in ('open', 'closed', 'locked', 'purged')) default 'open',
  week_type text,
  closed_by_name text,
  locked_by_name text,
  purged_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.pay_periods enable row level security;
drop policy if exists "Pay periods viewable by authenticated users" on public.pay_periods;
create policy "Pay periods viewable by authenticated users"
  on public.pay_periods for select
  using (auth.uid() is not null);

drop policy if exists "Pay periods modifiable by admins" on public.pay_periods;
create policy "Pay periods modifiable by admins"
  on public.pay_periods for all
  using (public.is_admin_or_sysadmin())
  with check (public.is_admin_or_sysadmin());

-- Seed initial default pay periods if not present
insert into public.pay_periods (id, frequency, start_date, end_date, pay_date, status, closed_by_name, locked_by_name)
values
  ('pp-m-aug', 'monthly', '2026-08-01', '2026-08-31', '2026-09-01', 'locked', 'Alex Rivera', 'Alex Rivera'),
  ('pp-m-sep', 'monthly', '2026-09-01', '2026-09-30', '2026-10-01', 'closed', 'Alex Rivera', null),
  ('pp-m-oct', 'monthly', '2026-10-01', '2026-10-31', '2026-11-02', 'open', null, null),
  ('pp-m-nov', 'monthly', '2026-11-01', '2026-11-30', '2026-12-01', 'open', null, null),
  ('pp-m-dec', 'monthly', '2026-12-01', '2026-12-31', '2027-01-01', 'open', null, null)
on conflict (id) do nothing;

-- 7. Payment Records Table
create table if not exists public.payments (
  id text primary key,
  pay_period_id text not null,
  user_id uuid references public.profiles(id) on delete cascade,
  month text,
  total_hours numeric(6, 2) default 0.00,
  sessions_count integer default 0,
  gross_amount numeric(10, 2) default 0.00,
  status text not null check (status in ('pending', 'processing', 'paid', 'on_hold', 'cancelled')) default 'pending',
  method text,
  reference_no text,
  paid_at timestamptz,
  status_reason text,
  generated_at timestamptz default now(),
  updated_by_name text,
  lines jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.payments enable row level security;
drop policy if exists "Payments viewable by owner or admin" on public.payments;
create policy "Payments viewable by owner or admin"
  on public.payments for select
  using (
    auth.uid() = user_id
    or public.is_admin_or_sysadmin()
  );

drop policy if exists "Payments modifiable by admins" on public.payments;
create policy "Payments modifiable by admins"
  on public.payments for all
  using (public.is_admin_or_sysadmin())
  with check (public.is_admin_or_sysadmin());

-- 8. System Settings Table
create table if not exists public.system_settings (
  id text primary key default 'global_settings',
  week_type text default 'monday',
  pay_date_rule_semi_monthly text default '16th_and_1st',
  pay_date_rule_monthly text default '1st',
  pay_date_rule_weekly text default 'following_monday',
  weekend_pay_date_handling text default 'previous_business_day',
  remarks_min_length integer default 10,
  retention_period_years integer default 1,
  company_max_hours jsonb default '{"day": 8.0, "week": 40.0, "month": 160.0}'::jsonb,
  timezone text default 'Asia/Manila (UTC+8)',
  currency_symbol text default '₱',
  updated_at timestamptz default now()
);

alter table public.system_settings enable row level security;
drop policy if exists "Settings viewable by authenticated users" on public.system_settings;
create policy "Settings viewable by authenticated users"
  on public.system_settings for select
  using (auth.uid() is not null);

drop policy if exists "Settings modifiable by sysadmin" on public.system_settings;
create policy "Settings modifiable by sysadmin"
  on public.system_settings for all
  using (public.is_admin_or_sysadmin())
  with check (public.is_admin_or_sysadmin());

insert into public.system_settings (
  id,
  week_type,
  pay_date_rule_semi_monthly,
  pay_date_rule_monthly,
  pay_date_rule_weekly,
  weekend_pay_date_handling,
  remarks_min_length,
  retention_period_years,
  company_max_hours,
  timezone,
  currency_symbol
)
values (
  'global_settings',
  'monday',
  '16th_and_1st',
  '1st',
  'following_monday',
  'previous_business_day',
  10,
  1,
  '{"day": 8.0, "week": 40.0, "month": 160.0}'::jsonb,
  'Asia/Manila (UTC+8)',
  '₱'
)
on conflict (id) do nothing;

-- 9. Wage History Table
create table if not exists public.wage_history (
  id text primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  hourly_rate numeric(10, 2) not null,
  effective_from text not null,
  effective_to text,
  note text default '',
  set_by_name text not null,
  created_at timestamptz default now()
);

alter table public.wage_history enable row level security;
drop policy if exists "Wage history policy" on public.wage_history;
create policy "Wage history policy"
  on public.wage_history for all
  using (public.is_admin_or_sysadmin())
  with check (public.is_admin_or_sysadmin());

-- ==============================================================================
-- Migration: Set all employees / profiles Pay Frequency to Monthly basis
-- ==============================================================================
update public.profiles set pay_frequency = 'monthly' where pay_frequency != 'monthly';
alter table public.profiles alter column pay_frequency set default 'monthly';
