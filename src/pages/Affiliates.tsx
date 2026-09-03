import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLogger'

interface Affiliate {
  id: string
  name: string
  contact: string | null
  status: 'active' | 'inactive'
  notes: string | null
}

interface Commission {
  id: string
  affiliate_id: string
  project: string
  monthly_amount: number
}

interface Payment {
  id: string
  affiliate_id: string
  commission_id: string | null
  project: string
  month: string
  amount: number
  status: string
  paid_date: string | null
}

const php = (n: number) =>
  `₱${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const currentMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const today = () => new Date().toISOString().slice(0, 10)

const monthLabel = (m: string) => {
  const [y, mo] = m.split('-').map(Number)
  return new Date(y, mo - 1, 1).toLocaleString(undefined, { month: 'short', year: 'numeric' })
}

// last N months, newest first
const recentMonths = (n: number): string[] => {
  const out: string[] = []
  const d = new Date()
  for (let i = 0; i < n; i++) {
    const dt = new Date(d.getFullYear(), d.getMonth() - i, 1)
    out.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}

export default function Affiliates() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([])
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  // Affiliate edit modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editing, setEditing] = useState<Affiliate | null>(null)
  const [aName, setAName] = useState('')
  const [aContact, setAContact] = useState('')
  const [aStatus, setAStatus] = useState<'active' | 'inactive'>('active')
  const [aNotes, setANotes] = useState('')
  // commission rows in the edit form (project + amount)
  const [aComms, setAComms] = useState<Array<{ id?: string; project: string; monthly_amount: string }>>([])
  const [saving, setSaving] = useState(false)

  // Detail (payment history) modal
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detailMonth, setDetailMonth] = useState(currentMonth())

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    setLoading(true)
    const [aff, comm, pay] = await Promise.all([
      supabase.from('affiliates').select('*').order('name'),
      supabase.from('affiliate_commissions').select('*').order('project'),
      supabase.from('affiliate_payments').select('*').order('month', { ascending: false }),
    ])
    setAffiliates((aff.data ?? []) as Affiliate[])
    setCommissions((comm.data ?? []) as Commission[])
    setPayments((pay.data ?? []) as Payment[])
    setLoading(false)
  }

  const commsFor = (affiliateId: string) => commissions.filter(c => c.affiliate_id === affiliateId)
  const monthlyTotal = (affiliateId: string) => commsFor(affiliateId).reduce((s, c) => s + Number(c.monthly_amount), 0)

  // ── Affiliate CRUD ────────────────────────────────────────────────────────
  const openEdit = (a?: Affiliate) => {
    setEditing(a ?? null)
    setAName(a?.name ?? '')
    setAContact(a?.contact ?? '')
    setAStatus(a?.status ?? 'active')
    setANotes(a?.notes ?? '')
    setAComms(a ? commsFor(a.id).map(c => ({ id: c.id, project: c.project, monthly_amount: c.monthly_amount.toString() })) : [{ project: '', monthly_amount: '' }])
    setShowEditModal(true)
  }

  const addCommRow = () => setAComms(c => [...c, { project: '', monthly_amount: '' }])
  const removeCommRow = (i: number) => setAComms(c => c.filter((_, idx) => idx !== i))
  const updateCommRow = (i: number, field: 'project' | 'monthly_amount', val: string) =>
    setAComms(c => c.map((row, idx) => idx === i ? { ...row, [field]: val } : row))

  const saveAffiliate = async () => {
    if (!aName.trim()) { alert('Affiliate name is required'); return }
    const validComms = aComms.filter(c => c.project.trim() && c.monthly_amount !== '' && !isNaN(Number(c.monthly_amount)))
    setSaving(true)
    try {
      let affiliateId = editing?.id
      const affPayload = {
        name: aName.trim(),
        contact: aContact.trim() || null,
        status: aStatus,
        notes: aNotes.trim() || null,
        updated_at: new Date().toISOString(),
      }
      if (editing) {
        const { error } = await supabase.from('affiliates').update(affPayload).eq('id', editing.id)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('affiliates').insert(affPayload).select().single()
        if (error) throw error
        affiliateId = data.id
      }

      // Sync commissions: delete existing then re-insert (simple + reliable)
      if (editing) {
        await supabase.from('affiliate_commissions').delete().eq('affiliate_id', affiliateId)
      }
      if (validComms.length > 0) {
        const rows = validComms.map(c => ({ affiliate_id: affiliateId, project: c.project.trim(), monthly_amount: Number(c.monthly_amount) }))
        const { error } = await supabase.from('affiliate_commissions').insert(rows)
        if (error) throw error
      }

      await logActivity(editing ? 'UPDATE' : 'CREATE', 'Affiliates', `${editing ? 'Updated' : 'Added'} affiliate: ${aName} (${validComms.length} project commissions)`, affPayload)
      setShowEditModal(false)
      await loadData()
    } catch (e: any) {
      alert(e.message || 'Failed to save affiliate')
    } finally {
      setSaving(false)
    }
  }

  const deleteAffiliate = async (a: Affiliate) => {
    if (!confirm(`Delete affiliate "${a.name}" and all their commissions and payment history?`)) return
    await supabase.from('affiliates').delete().eq('id', a.id)
    await logActivity('DELETE', 'Affiliates', `Deleted affiliate: ${a.name}`, { id: a.id })
    await loadData()
  }

  // ── Payment actions (per project per month) ──────────────────────────────
  const paymentFor = (commissionId: string, month: string) =>
    payments.find(p => p.commission_id === commissionId && p.month === month)

  const markPaid = async (a: Affiliate, c: Commission, month: string) => {
    if (paymentFor(c.id, month)) return
    if (!confirm(`Mark ${a.name} — ${c.project} for ${monthLabel(month)} as PAID (${php(Number(c.monthly_amount))})? This also records an expense in the tracker.`)) return
    const payload = {
      affiliate_id: a.id,
      commission_id: c.id,
      project: c.project,
      month,
      amount: Number(c.monthly_amount),
      status: 'paid',
      paid_date: today(),
    }
    const { error } = await supabase.from('affiliate_payments').insert(payload)
    if (error) { alert(error.message); return }
    await supabase.from('transactions').insert({
      date: today(),
      type: 'expense',
      amount: Number(c.monthly_amount),
      category: 'Affiliate Commission',
      note: `Commission paid: ${a.name} — ${c.project} (${month})`,
    })
    await logActivity('UPDATE', 'Affiliates', `Marked PAID: ${a.name} — ${c.project} ${month} — ${php(Number(c.monthly_amount))}`, payload)
    await loadData()
  }

  const unmarkPaid = async (p: Payment) => {
    if (!confirm(`Revert this payment to unpaid? (The expense transaction stays in records.)`)) return
    const { error } = await supabase.from('affiliate_payments').delete().eq('id', p.id)
    if (error) { alert(error.message); return }
    await logActivity('DELETE', 'Affiliates', `Reverted payment: ${p.project} ${p.month}`, { id: p.id })
    await loadData()
  }

  // ── Overall summary (current month) ──────────────────────────────────────
  const thisMonth = currentMonth()
  const summary = useMemo(() => {
    let due = 0, paid = 0
    for (const a of affiliates.filter(x => x.status === 'active')) {
      for (const c of commsFor(a.id)) {
        due += Number(c.monthly_amount)
        const pmt = paymentFor(c.id, thisMonth)
        if (pmt) paid += Number(pmt.amount)
      }
    }
    return { due, paid, pending: due - paid }
  }, [affiliates, commissions, payments])

  const detailAffiliate = affiliates.find(a => a.id === detailId) || null
  const detailComms = detailAffiliate ? commsFor(detailAffiliate.id) : []
  const detailMonths = recentMonths(12)

  // Per-affiliate total paid all-time + months paid count
  const affiliateStats = (affiliateId: string) => {
    const ps = payments.filter(p => p.affiliate_id === affiliateId)
    const totalPaid = ps.reduce((s, p) => s + Number(p.amount), 0)
    const monthsPaid = new Set(ps.map(p => p.month)).size
    return { totalPaid, monthsPaid }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Affiliates</h2>
          <p className="text-sm text-gray-600">Monitor monthly project commissions per affiliate</p>
        </div>
        <button onClick={() => openEdit()} className="btn-primary">+ Add Affiliate</button>
      </div>

      {/* Summary cards (current month) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl p-5 bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
          <p className="text-xs font-medium opacity-80">Monthly Commission Due</p>
          <p className="text-2xl font-bold mt-1">{php(summary.due)}</p>
          <p className="text-xs opacity-70 mt-0.5">{monthLabel(thisMonth)}</p>
        </div>
        <div className="rounded-xl p-5 bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg">
          <p className="text-xs font-medium opacity-80">Paid This Month</p>
          <p className="text-2xl font-bold mt-1">{php(summary.paid)}</p>
        </div>
        <div className="rounded-xl p-5 bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg">
          <p className="text-xs font-medium opacity-80">Pending This Month</p>
          <p className="text-2xl font-bold mt-1">{php(summary.pending)}</p>
        </div>
      </div>

      {/* Affiliate cards */}
      {loading ? (
        <div className="py-16 text-center text-sm text-gray-500">Loading...</div>
      ) : affiliates.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center shadow-sm">
          <p className="text-gray-500">No affiliates yet.</p>
          <button onClick={() => openEdit()} className="mt-4 btn-primary">+ Add your first affiliate</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {affiliates.map(a => {
            const comms = commsFor(a.id)
            const stats = affiliateStats(a.id)
            return (
              <div key={a.id} className="rounded-xl border border-gray-200 bg-white shadow-sm p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-gray-900">{a.name}</h3>
                      {a.status === 'inactive' && <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">inactive</span>}
                    </div>
                    {a.contact && <p className="text-xs text-gray-500">{a.contact}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Monthly Total</p>
                    <p className="text-lg font-bold text-gray-900">{php(monthlyTotal(a.id))}</p>
                  </div>
                </div>

                {/* Project commissions */}
                <div className="mt-4 space-y-1.5">
                  {comms.length === 0 ? (
                    <p className="text-xs text-gray-400">No project commissions set.</p>
                  ) : comms.map(c => (
                    <div key={c.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{c.project}</span>
                      <span className="font-medium text-gray-900">{php(Number(c.monthly_amount))}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
                  <span>{stats.monthsPaid} month{stats.monthsPaid === 1 ? '' : 's'} paid • total {php(stats.totalPaid)}</span>
                  <div className="flex gap-3">
                    <button onClick={() => { setDetailId(a.id); setDetailMonth(currentMonth()) }} className="text-blue-600 hover:underline">Payments</button>
                    <button onClick={() => openEdit(a)} className="text-gray-600 hover:underline">Edit</button>
                    <button onClick={() => deleteAffiliate(a)} className="text-red-600 hover:underline">Delete</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Affiliate Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b p-6">
              <h3 className="text-xl font-bold">{editing ? 'Edit Affiliate' : 'Add Affiliate'}</h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium">Name *</label>
                <input value={aName} onChange={e => setAName(e.target.value)} className="input-field w-full" placeholder="Affiliate name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">Contact</label>
                  <input value={aContact} onChange={e => setAContact(e.target.value)} className="input-field w-full" placeholder="Email or phone" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">Status</label>
                  <select value={aStatus} onChange={e => setAStatus(e.target.value as 'active' | 'inactive')} className="input-field w-full">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>

              {/* Project commissions */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-sm font-medium">Project Commissions</label>
                  <button type="button" onClick={addCommRow} className="text-xs font-medium text-blue-600 hover:underline">+ Add project</button>
                </div>
                <div className="space-y-2">
                  {aComms.length === 0 && <p className="text-xs text-gray-400">No projects. Click "+ Add project".</p>}
                  {aComms.map((row, i) => (
                    <div key={i} className="grid grid-cols-[1fr_7rem_1.5rem] items-center gap-2">
                      <input value={row.project} onChange={e => updateCommRow(i, 'project', e.target.value)} className="input-field w-full" placeholder="Project name" />
                      <input type="number" min="0" step="0.01" value={row.monthly_amount} onChange={e => updateCommRow(i, 'monthly_amount', e.target.value)} className="input-field w-full" placeholder="₱ / month" />
                      <button type="button" onClick={() => removeCommRow(i)} className="text-red-500 hover:text-red-700">✕</button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Notes</label>
                <textarea value={aNotes} onChange={e => setANotes(e.target.value)} rows={2} className="input-field w-full" placeholder="Optional notes" />
              </div>
            </div>
            <div className="flex justify-end gap-3 border-t p-6">
              <button onClick={() => setShowEditModal(false)} className="btn-secondary">Cancel</button>
              <button onClick={saveAffiliate} disabled={saving} className="btn-primary">{saving ? 'Saving...' : editing ? 'Update' : 'Add Affiliate'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Payment History Modal */}
      {detailAffiliate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b bg-white p-6">
              <div>
                <h3 className="text-xl font-bold">{detailAffiliate.name} — Payments</h3>
                <p className="text-sm text-gray-500">Monthly commission payments by project</p>
              </div>
              <button onClick={() => setDetailId(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="p-6 space-y-4">
              {detailComms.length === 0 ? (
                <p className="text-sm text-gray-500">This affiliate has no project commissions. Add some via Edit.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-600">Month</th>
                        {detailComms.map(c => (
                          <th key={c.id} className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-600 whitespace-nowrap">{c.project}</th>
                        ))}
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-600">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {detailMonths.map(m => {
                        const rowTotal = detailComms.reduce((s, c) => {
                          const p = paymentFor(c.id, m)
                          return s + (p ? Number(p.amount) : 0)
                        }, 0)
                        return (
                          <tr key={m} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{monthLabel(m)}</td>
                            {detailComms.map(c => {
                              const p = paymentFor(c.id, m)
                              return (
                                <td key={c.id} className="px-3 py-2 text-right">
                                  {p ? (
                                    <button onClick={() => unmarkPaid(p)} title="Click to revert to unpaid" className="inline-flex flex-col items-end">
                                      <span className="font-semibold text-green-600">{php(Number(p.amount))}</span>
                                      <span className="text-[10px] text-gray-400">{p.paid_date}</span>
                                    </button>
                                  ) : (
                                    <button onClick={() => markPaid(detailAffiliate, c, m)} className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 hover:bg-amber-100">
                                      Pay {php(Number(c.monthly_amount))}
                                    </button>
                                  )}
                                </td>
                              )
                            })}
                            <td className="px-3 py-2 text-right font-bold text-gray-900">{rowTotal > 0 ? php(rowTotal) : '-'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="text-xs text-gray-400">Green = paid (click to revert). Amber = mark as paid. Showing last 12 months.</p>
            </div>

            <div className="flex justify-end gap-3 border-t p-6">
              <button onClick={() => setDetailId(null)} className="btn-secondary">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
