# Accounting App (React + Vite + Tailwind + Supabase)

A simple accounting tracker to record cash in, cash out, and expenses. Built with React, Vite, TailwindCSS, and Supabase.

## Features
- **Transactions**: Add cash in, cash out, and expense entries with date, amount, category, note
- **Summary**: Aggregate totals and balance
- **List & Delete**: View and delete transactions

## Prerequisites
- Node.js 18+
- A Supabase project (https://supabase.com/)

## Setup
1. Copy `.env.example` to `.env` and fill in your Supabase credentials
```
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

2. Install dependencies
```
npm install
```

3. Start the dev server
```
npm run dev
```

Open the URL shown in the terminal.

## Supabase SQL Schema
Run this SQL in the Supabase SQL editor.

```sql
-- Enable pgcrypto for gen_random_uuid (usually enabled by default)
create extension if not exists pgcrypto;

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone not null default now(),
  date date not null,
  type text not null check (type in ('in','out','expense')),
  amount numeric(12,2) not null check (amount > 0),
  category text,
  note text
);

-- Row Level Security
alter table public.transactions enable row level security;

-- Development-only policies (open access). For production, replace with authenticated-user policies.
create policy "Enable read for anon" on public.transactions
  for select using (true);

create policy "Enable insert for anon" on public.transactions
  for insert with check (true);

create policy "Enable delete for anon" on public.transactions
  for delete using (true);
```

## Project Structure
- `index.html` – Vite entry HTML
- `src/main.tsx` – React entry
- `src/App.tsx` – App shell
- `src/components/` – `TransactionForm`, `TransactionList`, `SummaryCards`
- `src/lib/supabase.ts` – Supabase client
- `src/types.ts` – Shared types
- `tailwind.config.js`, `postcss.config.js`, `src/index.css` – Tailwind setup

## Notes
- Tailwind scans `index.html` and `src/**/*.{ts,tsx}` per `tailwind.config.js`.
- `@` path alias points to `src` (see `vite.config.ts`).
- This repo uses open RLS policies for simplicity during development. Tighten policies before production.
