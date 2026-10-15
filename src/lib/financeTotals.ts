/**
 * financeTotals.ts
 *
 * Single source of truth for the Cash In / Cash Out / Expenses / Balance
 * figures shown on BOTH the Dashboard (Home + SummaryCards) and Reports.
 *
 * Why this exists:
 *   - The Dashboard previously fetched `transactions` with a single
 *     `.select('*')`, which Supabase caps at 1000 rows — silently truncating
 *     the ledger once it grows past 1000 and understating every total.
 *   - Reports computed the same metrics with its own inline logic.
 *   This module gives both pages one paginated fetch + one set of formulas, so
 *   equivalent metrics over the same date range match exactly.
 *
 * Guarantees:
 *   - fetchAllTransactions() pages through ALL rows (1000 at a time) so results
 *     are complete at any table size (1k, 5k, 10k+).
 *   - It THROWS on any page error, so incomplete/failed retrieval can never be
 *     silently presented as a correct total (callers must handle the error).
 *   - computeLedgerTotals() uses integer-centavo arithmetic for exact decimal
 *     results (no float drift), returning values rounded to 2 decimals.
 *   - No writes, no schema, no data mutation — read + compute only.
 */

import { supabase } from '@/lib/supabase'
import type { Transaction } from '@/types'

const PAGE_SIZE = 1000

export interface LedgerDateRange {
  /** inclusive start date 'YYYY-MM-DD' (optional — omit for all-time) */
  start?: string
  /** inclusive end date 'YYYY-MM-DD' (optional — omit for all-time) */
  end?: string
}

/** Convert a peso amount to integer centavos (exact), tolerant of float input. */
function toCentavos(amount: number | null | undefined): number {
  return Math.round((Number(amount) || 0) * 100)
}

/** Convert integer centavos back to a 2-decimal peso number. */
function toPesos(centavos: number): number {
  return centavos / 100
}

/**
 * Fetch ALL transactions (optionally within a date range) using keyset-free
 * offset pagination. Throws if any page returns an error, so a partial result
 * is never returned as if complete.
 */
export async function fetchAllTransactions(range: LedgerDateRange = {}): Promise<Transaction[]> {
  const all: Transaction[] = []
  let from = 0

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = supabase
      .from('transactions')
      .select('*')
      .order('date', { ascending: true })
      .order('id', { ascending: true }) // stable tiebreaker so paging can't skip/dupe
      .range(from, from + PAGE_SIZE - 1)

    if (range.start) q = q.gte('date', range.start)
    if (range.end) q = q.lte('date', range.end)

    const { data, error } = await q
    if (error) {
      throw new Error(`Failed to load transactions (rows ${from}–${from + PAGE_SIZE - 1}): ${error.message}`)
    }
    const batch = (data ?? []) as Transaction[]
    all.push(...batch)
    if (batch.length < PAGE_SIZE) break // last page reached
    from += PAGE_SIZE
  }

  return all
}

export interface LedgerTotals {
  cashIn: number
  cashOut: number
  expense: number
  /** out + expense (Reports' "Debit"). */
  debit: number
  /** cashIn - cashOut - expense. */
  balance: number
  /** row counts for diagnostics / validation. */
  counts: { total: number; in: number; out: number; expense: number }
}

/**
 * Compute Cash In / Out / Expenses / Balance from a set of transactions using
 * exact integer-centavo arithmetic. Identical formula for Dashboard and Reports.
 */
export function computeLedgerTotals(transactions: Transaction[]): LedgerTotals {
  let inC = 0, outC = 0, expC = 0
  let inN = 0, outN = 0, expN = 0

  for (const t of transactions) {
    const c = toCentavos(t.amount)
    if (t.type === 'in') { inC += c; inN++ }
    else if (t.type === 'out') { outC += c; outN++ }
    else if (t.type === 'expense') { expC += c; expN++ }
  }

  const balanceC = inC - outC - expC
  const debitC = outC + expC

  return {
    cashIn: toPesos(inC),
    cashOut: toPesos(outC),
    expense: toPesos(expC),
    debit: toPesos(debitC),
    balance: toPesos(balanceC),
    counts: { total: transactions.length, in: inN, out: outN, expense: expN },
  }
}

/**
 * Convenience: fetch (paginated, complete) + compute in one call for a given
 * range. Throws on retrieval failure.
 */
export async function getLedgerTotals(range: LedgerDateRange = {}): Promise<{ totals: LedgerTotals; transactions: Transaction[] }> {
  const transactions = await fetchAllTransactions(range)
  return { totals: computeLedgerTotals(transactions), transactions }
}
