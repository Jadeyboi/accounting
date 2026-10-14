# 13th Month Pay Savings — Feature Toggle

The automatic 13th Month Pay savings reserve is **currently ENABLED**
(`THIRTEENTH_MONTH_ENABLED = true`). Each successfully saved eligible payslip
(single or bulk) creates exactly one 13th-month accrual. This note explains the
toggle and how the earlier data removal relates to it.

## What "13th Month Pay Savings" is

A **company-funded reserve** (not an employee deduction). Per semi-monthly
cutoff the accrual is `payslip.gross_salary / 12`, set aside into the `savings`
table with `source = 'payroll_13th'`. It does **not** change gross pay, net pay,
or payroll expense, and it is **not** posted to the transactions ledger — so it
never affects the cash balance.

## Current state (ENABLED)

Controlled by a single flag in `src/lib/thirteenthMonth.ts`:

```ts
export const THIRTEENTH_MONTH_ENABLED = true
```

Set to `false` to temporarily turn the automatic set-aside off.

While `false`:
- `upsertThirteenthMonth(...)` returns immediately — saving/generating payslips
  (single or bulk) creates **no** new 13th-month savings and updates none.
- `backfillThirteenthMonth(...)` is a no-op (returns `{processed:0, created:0, updated:0}`).
- `removeThirteenthMonth(...)` is a no-op — so disabling (or normal payslip
  deletes) will **not** delete existing 13th-month savings rows.

The Payroll call sites remain wired, so no further code change is needed to
resume — only the flag.

## How to RE-ENABLE later

1. In `src/lib/thirteenthMonth.ts`, set:
   ```ts
   export const THIRTEENTH_MONTH_ENABLED = true
   ```
2. Build and test:
   ```
   npm run build
   npm test
   ```
3. From then on, saving/generating payslips creates the 13th-month reserve
   again (idempotent per `payslip_id + source`, via the existing
   `savings_payslip_source_uidx` index).
4. (Optional) If you want to recreate reserves for payslips saved while the
   feature was off, call `backfillThirteenthMonth()` once (it is idempotent —
   updates existing rows, inserts missing ones, removes rows whose payslip now
   has zero basic). There is no UI button required; it can be run from a
   one-off script/console if needed.

## Relationship to the data removal

Disabling the feature does **not** delete existing data. The existing
`payroll_13th` savings rows were removed separately and deliberately via
`supabase/remove-13th-month-savings.sql` (backup-first, run manually in the
production SQL editor). If you re-enable the feature later and want the historical
reserves back, either restore from the `savings_backup_13th_removed` backup table
created by that script, or re-run `backfillThirteenthMonth()` to regenerate them
from payslips.

## Files involved

- `src/lib/thirteenthMonth.ts` — the feature flag + guarded functions.
- `src/pages/Payroll.tsx` — call sites (unchanged; gated by the flag).
- `supabase/thirteenth-month-setup.sql` — schema (savings linkage columns,
  payments/opening tables). Unaffected by the toggle.
- `supabase/remove-13th-month-savings.sql` — one-time production data removal
  (backup-first). Separate from the toggle.
