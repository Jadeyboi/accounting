-- Supabase initialization SQL for this app
-- Adds savings table and receipt_url to transactions, plus RLS and grants.

-- Extensions
create extension if not exists pgcrypto;

-- =========================
-- Core tables
-- =========================

-- Employees
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  position text,
  base_salary numeric
);

-- Payslips
create table if not exists public.payslips (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  employee_id uuid not null references public.employees(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  date_issued date not null,
  gross_salary numeric not null,
  sss numeric,
  pagibig numeric,
  philhealth numeric,
  tax numeric,
  cash_advance numeric,
  bonuses numeric,
  allowances numeric,
  other_deductions numeric,
  notes text,
  net_salary numeric not null,
  transaction_id uuid
);

-- Transactions (create or align)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  date date not null,
  type text not null check (type in ('in','out','expense')),
  amount numeric(12,2) not null check (amount > 0),
  category text,
  note text,
  receipt_url text
);

-- Savings (NEW for app)
create table if not exists public.savings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  date date not null,
  description text,
  amount numeric(12,2) not null check (amount > 0),
  account text
);

-- Ensure created_at exists on all (safe if already present)
alter table public.employees    add column if not exists created_at timestamptz not null default now();
alter table public.payslips     add column if not exists created_at timestamptz not null default now();
alter table public.transactions add column if not exists created_at timestamptz not null default now();
alter table public.savings      add column if not exists created_at timestamptz not null default now();

-- Helpful indexes for ordering/filtering
create index if not exists employees_created_at_idx    on public.employees(created_at desc);
create index if not exists payslips_created_at_idx     on public.payslips(created_at desc);
create index if not exists transactions_created_at_idx on public.transactions(created_at desc);
create index if not exists savings_created_at_idx      on public.savings(created_at desc);

-- =========================
-- Visibility & privileges
-- =========================

-- Allow API roles to see the schema (needed for PostgREST discovery)
grant usage on schema public to anon, authenticated;

-- Base privileges (RLS will still apply)
grant select, insert, update, delete on table public.employees    to anon, authenticated;
grant select, insert, update, delete on table public.payslips     to anon, authenticated;
grant select, insert, update, delete on table public.transactions to anon, authenticated;
grant select, insert, update, delete on table public.savings      to anon, authenticated;

-- =========================
-- Row Level Security (RLS)
-- Dev-friendly policies; tighten for prod if needed
-- =========================

-- Enable RLS
alter table public.employees    enable row level security;
alter table public.payslips     enable row level security;
alter table public.transactions enable row level security;
alter table public.savings      enable row level security;

-- READ policies (anyone; change to auth-only if required)
drop policy if exists "employees_select_all"    on public.employees;
drop policy if exists "payslips_select_all"     on public.payslips;
drop policy if exists "transactions_select_all" on public.transactions;
drop policy if exists "savings_select_all"      on public.savings;

create policy "employees_select_all"    on public.employees    for select using (true);
create policy "payslips_select_all"     on public.payslips     for select using (true);
create policy "transactions_select_all" on public.transactions for select using (true);
create policy "savings_select_all"      on public.savings      for select using (true);

-- WRITE policies (insert/update/delete)
drop policy if exists "employees_modify_all"    on public.employees;
drop policy if exists "payslips_modify_all"     on public.payslips;
drop policy if exists "transactions_modify_all" on public.transactions;
drop policy if exists "savings_modify_all"      on public.savings;

create policy "employees_modify_all"    on public.employees    for all using (true) with check (true);
create policy "payslips_modify_all"     on public.payslips     for all using (true) with check (true);
create policy "transactions_modify_all" on public.transactions for all using (true) with check (true);
create policy "savings_modify_all"      on public.savings      for all using (true) with check (true);

-- =========================
-- Storage bucket recommendation
-- =========================
-- Create a bucket named 'receipts' (public) in Supabase Storage for receipt uploads
-- Do this in Supabase UI: Storage -> Create new bucket -> Name: receipts -> Public: yes (or adjust access per your security model)

-- =========================
-- Optional: integrity helpers
-- =========================

-- Ensure transaction_id on payslips points to an existing transaction if used
-- (Leave as nullable since your app creates the payslip first, then links)
-- You can enforce with a FK once the app always links:
-- alter table public.payslips
--   add constraint payslips_transaction_fk
--   foreign key (transaction_id) references public.transactions(id) on delete set null;
