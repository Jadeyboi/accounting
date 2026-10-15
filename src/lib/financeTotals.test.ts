import { describe, it, expect } from 'vitest'
import { computeLedgerTotals } from './financeTotals'
import type { Transaction } from '@/types'

const tx = (type: Transaction['type'], amount: number, id = Math.random().toString()): Transaction => ({
  id,
  created_at: '2026-01-01T00:00:00Z',
  date: '2026-01-01',
  type,
  amount,
  category: null,
  note: null,
})

describe('computeLedgerTotals — formula and buckets', () => {
  it('cashIn/out/expense/balance and debit are computed correctly', () => {
    const t = [tx('in', 1000), tx('in', 500), tx('out', 300), tx('expense', 200)]
    const r = computeLedgerTotals(t)
    expect(r.cashIn).toBe(1500)
    expect(r.cashOut).toBe(300)
    expect(r.expense).toBe(200)
    expect(r.debit).toBe(500)        // out + expense
    expect(r.balance).toBe(1000)     // 1500 - 300 - 200
    expect(r.counts).toEqual({ total: 4, in: 2, out: 1, expense: 1 })
  })

  it('empty ledger yields zeros', () => {
    const r = computeLedgerTotals([])
    expect(r).toMatchObject({ cashIn: 0, cashOut: 0, expense: 0, debit: 0, balance: 0 })
  })
})

describe('exact decimal arithmetic (no float drift)', () => {
  it('sums centavos exactly where naive float addition would drift', () => {
    // 0.1 + 0.2 !== 0.3 in float; integer-centavo math must give exactly 0.30.
    const r = computeLedgerTotals([tx('in', 0.1), tx('in', 0.2)])
    expect(r.cashIn).toBe(0.3)
  })

  it('handles many 2-decimal values precisely', () => {
    const items = Array.from({ length: 100 }, () => tx('expense', 10.01))
    const r = computeLedgerTotals(items)
    expect(r.expense).toBe(1001) // 100 * 10.01 exactly
    expect(r.balance).toBe(-1001)
  })

  it('rounds odd fractional inputs to centavos deterministically', () => {
    const r = computeLedgerTotals([tx('in', 100.005), tx('in', 0.001)])
    // 100.005 -> 10001 (banker-agnostic Math.round), 0.001 -> 0
    expect(r.cashIn).toBe(100.01)
  })
})

describe('reconciliation guard — known staging all-time totals', () => {
  it('matches the confirmed Supabase figures given equivalent inputs', () => {
    // One aggregate row per type standing in for the summed amounts, to prove
    // the formula reproduces the DB-confirmed balance exactly.
    const t = [
      tx('in', 28570056.52),
      tx('out', 3664864.38),
      tx('expense', 24545266.25),
    ]
    const r = computeLedgerTotals(t)
    expect(r.cashIn).toBe(28570056.52)
    expect(r.cashOut).toBe(3664864.38)
    expect(r.expense).toBe(24545266.25)
    expect(r.balance).toBe(359925.89) // exact, no float drift
  })
})
