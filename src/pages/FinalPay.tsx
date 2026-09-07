import { useEffect, useState, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activityLogger'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { Employee, SalaryHistory } from '@/types'
import { computeSeparationPay, creditedYearsBetween, round2, type SepKey } from '@/lib/finalPay'

// ── Money / date helpers ────────────────────────────────────────────────────
const money = (v: number | null | undefined) =>
  `₱${(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (d: string | null | undefined) => {
  if (!d) return '-'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '-'
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })
}

// ── Separation reasons (labels for the dropdown) ─────────────────────────────
const SEPARATION_REASONS: { key: SepKey; label: string }[] = [
  { key: 'retrenchment', label: 'Retrenchment' },
  { key: 'redundancy', label: 'Redundancy' },
  { key: 'labor_saving_devices', label: 'Installation of labor-saving devices' },
  { key: 'closure_no_losses', label: 'Closure not caused by serious business losses' },
  { key: 'closure_serious_losses', label: 'Closure caused by serious business losses' },
  { key: 'disease', label: 'Termination due to disease' },
  { key: 'resignation', label: 'Resignation' },
  { key: 'just_cause', label: 'Termination for just cause' },
  { key: 'end_of_contract', label: 'End of fixed-term contract' },
  { key: 'other', label: 'Other' },
]

interface LineItem { desc: string; amount: number }

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft', for_review: 'For Review', approved: 'Approved', paid: 'Paid', cancelled: 'Cancelled',
}
const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  for_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
}

export default function FinalPay() {
  const [params] = useSearchParams()
  const { currentUser, isAdminOrHR } = useCurrentUser()
  const employeeIdParam = params.get('employee')

  const [separated, setSeparated] = useState<Employee[]>([])
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistory[]>([])
  const [existing, setExisting] = useState<any[]>([])       // existing final_pay records for this employee
  const [record, setRecord] = useState<any | null>(null)    // the one being viewed/edited
  const [loading, setLoading] = useState(true)
  const pdfRef = useRef<HTMLDivElement>(null)

  // ── Editable inputs ───────────────────────────────────────────────────────
  const [reason, setReason] = useState<SepKey>('resignation')
  const [monthlyBasic, setMonthlyBasic] = useState(0)
  const [divisor, setDivisor] = useState(26)
  const [lastWorkingDay, setLastWorkingDay] = useState('')
  const [unpaidSalary, setUnpaidSalary] = useState(0)
  const [thirteenthPaid, setThirteenthPaid] = useState(0)
  const [basicEarnedYTD, setBasicEarnedYTD] = useState(0)   // total basic salary earned Jan1..last day
  const [ytdFrom, setYtdFrom] = useState('')
  const [ytdTo, setYtdTo] = useState('')
  const [leaveLines, setLeaveLines] = useState<Array<{ type: string; credits: number; convertible: boolean }>>([])
  const [leaveConfirmed, setLeaveConfirmed] = useState(false)
  const [earnings, setEarnings] = useState<LineItem[]>([])
  const [deductions, setDeductions] = useState<LineItem[]>([])
  const [notes, setNotes] = useState('')
  const [sepPayOverride, setSepPayOverride] = useState<number | null>(null) // manual override for non-statutory
  const [saving, setSaving] = useState(false)

  const canEdit = isAdminOrHR && (!record || record.status === 'draft' || record.status === 'for_review')
  const locked = !!record && (record.status === 'approved' || record.status === 'paid' || record.status === 'cancelled')

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      setLoading(true)
      // separated employees list
      const { data: sep } = await supabase.from('employees').select('*').eq('status', 'terminated').order('termination_date', { ascending: false })
      setSeparated((sep ?? []) as Employee[])
      if (employeeIdParam) await loadEmployee(employeeIdParam)
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeIdParam])

  const loadEmployee = async (id: string) => {
    const { data: emp } = await supabase.from('employees').select('*').eq('id', id).single()
    if (!emp) return
    setEmployee(emp as Employee)
    const { data: hist } = await supabase.from('salary_history').select('*').eq('employee_id', id).order('effective_date', { ascending: false })
    setSalaryHistory((hist ?? []) as SalaryHistory[])
    const { data: recs } = await supabase.from('final_pay').select('*').eq('employee_id', id).order('version', { ascending: false })
    setExisting(recs ?? [])

    // Pre-fill inputs from employee data (editable)
    const e = emp as Employee
    setReason(mapReason(e.termination_reason))
    setMonthlyBasic(Number(e.base_salary) || 0)
    setLastWorkingDay(e.last_working_day || e.termination_date || '')
    setUnpaidSalary(0)
    setThirteenthPaid(0)
    const year = new Date(e.last_working_day || e.termination_date || new Date()).getFullYear()
    setYtdFrom(`${year}-01-01`)
    setYtdTo(e.last_working_day || e.termination_date || '')
    setBasicEarnedYTD(0)
    // leave balances -> convertible defaults: vacation convertible, sick/birthday not (HR can toggle)
    setLeaveLines([
      { type: 'Vacation Leave', credits: Number((e as any).vacation_leave_balance) || 0, convertible: true },
      { type: 'Sick Leave', credits: Number((e as any).sick_leave_balance) || 0, convertible: false },
      { type: 'Birthday Leave', credits: Number((e as any).birthday_leave_balance) || 0, convertible: false },
    ])
    setLeaveConfirmed(false)
    setEarnings([])
    setDeductions([])
    setNotes('')
    setSepPayOverride(null)
    setRecord(null)

    // Auto-suggest open loan balances as a deduction candidate (HR reviews)
    try {
      const { data: loans } = await supabase.from('loans').select('*').eq('employee_id', id)
      const openLoans = (loans ?? []).filter((l: any) => (l.status ? l.status !== 'paid' : true))
      const loanTotal = openLoans.reduce((s: number, l: any) => s + (Number(l.remaining_balance ?? l.balance ?? 0)), 0)
      if (loanTotal > 0) setDeductions([{ desc: 'Outstanding loan / cash advance balance', amount: round2(loanTotal) }])
    } catch { /* loans table shape varies; skip silently */ }
  }

  const mapReason = (r: string | null | undefined): SepKey => {
    const t = (r || '').toLowerCase()
    if (t.includes('redundan')) return 'redundancy'
    if (t.includes('retrench')) return 'retrenchment'
    if (t.includes('labor-saving') || t.includes('labor saving')) return 'labor_saving_devices'
    if (t.includes('disease')) return 'disease'
    if (t.includes('resign')) return 'resignation'
    if (t.includes('just cause')) return 'just_cause'
    if (t.includes('contract')) return 'end_of_contract'
    if (t.includes('closure') && t.includes('loss')) return 'closure_serious_losses'
    if (t.includes('closure')) return 'closure_no_losses'
    return 'other'
  }

  // ── Derived computation ─────────────────────────────────────────────────────
  const creditedYears = useMemo(() => creditedYearsBetween(employee?.date_hired ?? null, lastWorkingDay), [employee, lastWorkingDay])
  const sep = useMemo(() => computeSeparationPay(reason, monthlyBasic, creditedYears), [reason, monthlyBasic, creditedYears])
  const separationPay = sepPayOverride != null ? sepPayOverride : sep.amount
  const dailyRate = useMemo(() => (divisor > 0 ? round2(monthlyBasic / (divisor / 12 <= 1 ? divisor : divisor)) : 0), [monthlyBasic, divisor])
  // daily rate = monthly basic ÷ divisor (divisor = working days/month, e.g. 26 or 22)
  const dailyRateSimple = divisor > 0 ? round2(monthlyBasic / divisor) : 0
  const thirteenth = useMemo(() => {
    const prorated = basicEarnedYTD / 12
    return round2(Math.max(0, prorated - (thirteenthPaid || 0)))
  }, [basicEarnedYTD, thirteenthPaid])
  const leaveConversion = useMemo(() =>
    round2(leaveLines.filter(l => l.convertible).reduce((s, l) => s + (Number(l.credits) || 0) * dailyRateSimple, 0)),
    [leaveLines, dailyRateSimple])

  const otherEarningsTotal = round2(earnings.reduce((s, e) => s + (Number(e.amount) || 0), 0))
  const totalDeductions = round2(deductions.reduce((s, d) => s + (Number(d.amount) || 0), 0))
  const grossFinalPay = round2(round2(unpaidSalary) + round2(separationPay) + round2(thirteenth) + round2(leaveConversion) + otherEarningsTotal)
  const netFinalPay = round2(grossFinalPay - totalDeductions)

  // ── Validation ──────────────────────────────────────────────────────────────
  const validationErrors = useMemo(() => {
    const errs: string[] = []
    if (employee?.date_hired && lastWorkingDay && new Date(lastWorkingDay) < new Date(employee.date_hired))
      errs.push('Last working day is earlier than the employment start date.')
    if (leaveLines.some(l => Number(l.credits) < 0)) errs.push('Leave credits cannot be negative.')
    if (earnings.some(e => !e.desc.trim())) errs.push('Every manual earning needs a description.')
    if (deductions.some(d => !d.desc.trim())) errs.push('Every deduction needs a description.')
    if (leaveConversion > 0 && !leaveConfirmed) errs.push('HR must confirm the leave conversion before finalizing.')
    if (!employee?.date_hired) errs.push('Employment start date is missing — review employee record.')
    if (salaryHistory.length === 0) errs.push('No salary history on record — verify the monthly basic salary is correct.')
    if (basicEarnedYTD <= 0) errs.push('Enter the total basic salary actually earned this calendar year (for 13th-month).')
    return errs
  }, [employee, lastWorkingDay, leaveLines, earnings, deductions, leaveConversion, leaveConfirmed, salaryHistory, basicEarnedYTD])

  const buildDetails = () => ({
    earnings, deductions,
    breakdown: {
      creditedYears,
      dailyRate: dailyRateSimple,
      separation: { formula: sep.formula, basis: sep.basis, applies: sep.applies, override: sepPayOverride },
      thirteenth: { basicEarnedYTD, from: ytdFrom, to: ytdTo, alreadyPaid: thirteenthPaid, formula: `${money(basicEarnedYTD)} ÷ 12 − paid ${money(thirteenthPaid)}` },
      leave: leaveLines,
    },
  })

  const snapshotForSave = (status: string) => ({
    employee_id: employee!.id,
    employee_name: employee!.name,
    employee_number: (employee as any).employee_number || null,
    position: employee!.position || null,
    department: (employee as any).department || null,
    date_hired: employee!.date_hired || null,
    last_working_day: lastWorkingDay || null,
    separation_reason: reason,
    monthly_basic_salary: round2(monthlyBasic),
    payroll_divisor: divisor,
    credited_years: creditedYears,
    unpaid_salary: round2(unpaidSalary),
    separation_pay: round2(separationPay),
    separation_pay_applies: sep.applies || sepPayOverride != null,
    thirteenth_month: thirteenth,
    thirteenth_month_already_paid: round2(thirteenthPaid),
    leave_conversion: leaveConversion,
    details: buildDetails(),
    gross_final_pay: grossFinalPay,
    total_deductions: totalDeductions,
    net_final_pay: netFinalPay,
    status,
    prepared_by: currentUser?.email || null,
    notes: notes || null,
  })

  const audit = async (finalPayId: string, action: string, from?: string, to?: string) => {
    await supabase.from('final_pay_audit').insert({
      final_pay_id: finalPayId, action, actor: currentUser?.email || null, from_status: from || null, to_status: to || null,
    })
  }

  // ── Save / workflow actions ──────────────────────────────────────────────────
  const save = async (status: string) => {
    if (!employee) return
    if (validationErrors.length > 0) { alert('Please resolve:\n\n• ' + validationErrors.join('\n• ')); return }
    setSaving(true)
    try {
      if (record && (record.status === 'draft' || record.status === 'for_review')) {
        const from = record.status
        const { error } = await supabase.from('final_pay').update(snapshotForSave(status)).eq('id', record.id)
        if (error) throw error
        await audit(record.id, status === from ? 'updated' : 'status_change', from, status)
        await logActivity('updated', 'Final Pay', `${STATUS_LABELS[status]} final pay for ${employee.name} (${money(netFinalPay)})`)
      } else {
        const { data, error } = await supabase.from('final_pay').insert(snapshotForSave(status)).select().single()
        if (error) throw error
        await audit(data.id, 'created', undefined, status)
        await logActivity('created', 'Final Pay', `Created final pay for ${employee.name} (${money(netFinalPay)})`)
      }
      await loadEmployee(employee.id)
      alert(`Saved as ${STATUS_LABELS[status]}.`)
    } catch (e: any) {
      alert(e.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const approve = async () => {
    if (!record) return
    if (!confirm('Approve and LOCK this final pay computation? Corrections after this require a new version.')) return
    const { error } = await supabase.from('final_pay').update({
      status: 'approved', approved_by: currentUser?.email || null, approved_at: new Date().toISOString(), reviewed_by: currentUser?.email || null,
    }).eq('id', record.id)
    if (error) { alert(error.message); return }
    await audit(record.id, 'approved', record.status, 'approved')
    await logActivity('updated', 'Final Pay', `Approved final pay for ${record.employee_name}`)
    await loadEmployee(record.employee_id)
  }

  const markPaid = async () => {
    if (!record) return
    if (!confirm('Mark this approved final pay as PAID? Only do this after the actual payout.')) return
    const { error } = await supabase.from('final_pay').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', record.id)
    if (error) { alert(error.message); return }
    await audit(record.id, 'paid', 'approved', 'paid')
    await logActivity('updated', 'Final Pay', `Marked final pay PAID for ${record.employee_name}`)
    await loadEmployee(record.employee_id)
  }

  const cancel = async () => {
    if (!record) return
    if (!confirm('Cancel this final pay record?')) return
    const { error } = await supabase.from('final_pay').update({ status: 'cancelled' }).eq('id', record.id)
    if (error) { alert(error.message); return }
    await audit(record.id, 'cancelled', record.status, 'cancelled')
    await loadEmployee(record.employee_id)
  }

  const reviseFrom = async (rec: any) => {
    if (!confirm('Create a new editable revision from this record? The original stays locked.')) return
    const { data, error } = await supabase.from('final_pay').insert({
      ...Object.fromEntries(Object.entries(rec).filter(([k]) => !['id', 'created_at', 'updated_at', 'status', 'approved_by', 'approved_at', 'paid_at', 'version', 'supersedes_id'].includes(k))),
      version: (rec.version || 1) + 1,
      supersedes_id: rec.id,
      status: 'draft',
      prepared_by: currentUser?.email || null,
    }).select().single()
    if (error) { alert(error.message); return }
    await audit(data.id, 'revised', undefined, 'draft')
    await loadEmployee(rec.employee_id)
    loadRecordIntoForm(data)
  }

  const loadRecordIntoForm = (rec: any) => {
    setRecord(rec)
    setReason(rec.separation_reason)
    setMonthlyBasic(Number(rec.monthly_basic_salary) || 0)
    setDivisor(Number(rec.payroll_divisor) || 26)
    setLastWorkingDay(rec.last_working_day || '')
    setUnpaidSalary(Number(rec.unpaid_salary) || 0)
    setThirteenthPaid(Number(rec.thirteenth_month_already_paid) || 0)
    const bd = rec.details?.breakdown || {}
    setBasicEarnedYTD(Number(bd.thirteenth?.basicEarnedYTD) || 0)
    setYtdFrom(bd.thirteenth?.from || '')
    setYtdTo(bd.thirteenth?.to || '')
    setLeaveLines(bd.leave || [])
    setLeaveConfirmed(true)
    setEarnings(rec.details?.earnings || [])
    setDeductions(rec.details?.deductions || [])
    setNotes(rec.notes || '')
    setSepPayOverride(bd.separation?.override ?? null)
  }

  // ── PDF ──────────────────────────────────────────────────────────────────────
  const downloadPdf = async () => {
    const el = pdfRef.current
    if (!el || !record) return
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas')])
    el.style.display = 'block'
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', windowWidth: 794 })
    el.style.display = 'none'
    const img = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
    const pageW = 210, pageH = 297
    const imgH = (canvas.height * pageW) / canvas.width
    let left = imgH, pos = 0, page = 1
    const totalPages = Math.ceil(imgH / pageH)
    pdf.addImage(img, 'PNG', 0, pos, pageW, imgH)
    pdf.setFontSize(8); pdf.setTextColor(150)
    if (totalPages > 1) pdf.text(`Page ${page} of ${totalPages}`, pageW - 25, pageH - 6)
    left -= pageH
    while (left > 0) {
      pos = left - imgH; page++
      pdf.addPage(); pdf.addImage(img, 'PNG', 0, pos, pageW, imgH)
      pdf.setFontSize(8); pdf.setTextColor(150)
      pdf.text(`Page ${page} of ${totalPages}`, pageW - 25, pageH - 6)
      left -= pageH
    }
    const safe = (record.employee_name || 'Employee').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-')
    pdf.save(`Final-Pay_${safe}_${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  if (!isAdminOrHR) {
    return <div className="p-8 text-center text-gray-600">You do not have permission to access Final Pay computations.</div>
  }

  const reasonLabel = SEPARATION_REASONS.find(r => r.key === reason)?.label || reason

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Final Pay Computation</h2>
        <p className="text-sm text-gray-600">For separated employees. Figures are an <strong>estimate</strong> until approved.</p>
      </div>

      {/* Employee picker */}
      {!employee && (
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100"><h3 className="font-semibold text-gray-900">Select a separated employee</h3></div>
          {loading ? <p className="p-6 text-sm text-gray-500">Loading...</p> : separated.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">No separated employees on record.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {separated.map(e => (
                <button key={e.id} onClick={() => loadEmployee(e.id)} className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-gray-900">{e.name}</p>
                    <p className="text-xs text-gray-500">{e.position || '-'} • {e.termination_reason || '-'} • LWD {fmtDate(e.last_working_day)}</p>
                  </div>
                  <span className="text-blue-600 text-sm">Calculate Final Pay →</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {employee && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <button onClick={() => { setEmployee(null); setRecord(null) }} className="text-sm text-blue-600 hover:underline">← Back to list</button>
            {record && <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[record.status]}`}>{STATUS_LABELS[record.status]}{record.version > 1 ? ` • v${record.version}` : ''}</span>}
          </div>

          {/* Existing records */}
          {existing.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="mb-2 text-sm font-semibold text-gray-700">Existing computations</p>
              <div className="space-y-1">
                {existing.map(r => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <span>v{r.version} • <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_STYLE[r.status]}`}>{STATUS_LABELS[r.status]}</span> • Net {money(r.net_final_pay)} • {fmtDate(r.created_at)}</span>
                    <span className="flex gap-3">
                      <button onClick={() => loadRecordIntoForm(r)} className="text-blue-600 hover:underline">Open</button>
                      {(r.status === 'approved' || r.status === 'paid') && <button onClick={() => reviseFrom(r)} className="text-amber-600 hover:underline">Revise</button>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Employee summary */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <Info label="Employee" value={employee.name} />
            <Info label="Employee ID" value={(employee as any).employee_number || employee.id.slice(0, 8)} />
            <Info label="Position" value={employee.position || '-'} />
            <Info label="Department" value={(employee as any).department || '-'} />
            <Info label="Date Hired" value={fmtDate(employee.date_hired)} />
            <Info label="Last Working Day" value={fmtDate(lastWorkingDay)} />
            <Info label="Separation Reason" value={reasonLabel} />
            <Info label="Credited Years" value={String(creditedYears)} />
          </div>

          {validationErrors.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-semibold">Review required before finalizing:</p>
              <ul className="mt-1 list-disc pl-5">{validationErrors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Inputs */}
            <div className="space-y-6">
              {/* Basics */}
              <Section title="Inputs">
                <Field label="Separation Reason">
                  <select disabled={!canEdit} value={reason} onChange={e => { setReason(e.target.value as SepKey); setSepPayOverride(null) }} className="input-field w-full">
                    {SEPARATION_REASONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Monthly Basic Salary (₱)"><input disabled={!canEdit} type="number" value={monthlyBasic} onChange={e => setMonthlyBasic(Number(e.target.value) || 0)} className="input-field w-full" /></Field>
                  <Field label="Payroll Divisor (working days/mo)"><input disabled={!canEdit} type="number" value={divisor} onChange={e => setDivisor(Number(e.target.value) || 26)} className="input-field w-full" /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Last Working Day"><input disabled={!canEdit} type="date" value={lastWorkingDay} onChange={e => setLastWorkingDay(e.target.value)} className="input-field w-full" /></Field>
                  <Field label="Unpaid Salary through LWD (₱)"><input disabled={!canEdit} type="number" value={unpaidSalary} onChange={e => setUnpaidSalary(Number(e.target.value) || 0)} className="input-field w-full" /></Field>
                </div>
                <p className="text-xs text-gray-500">Daily rate = {money(monthlyBasic)} ÷ {divisor} = <strong>{money(dailyRateSimple)}</strong></p>
              </Section>

              {/* Separation pay */}
              <Section title="Separation Pay">
                {sep.warning && <div className="mb-2 rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">{sep.warning}</div>}
                <p className="text-xs text-gray-600">{sep.formula}</p>
                <p className="mt-1 text-[11px] text-gray-400">{sep.basis}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm text-gray-600">Amount:</span>
                  {sep.applies && sepPayOverride == null ? (
                    <span className="font-semibold text-gray-900">{money(sep.amount)}</span>
                  ) : (
                    <input disabled={!canEdit} type="number" value={sepPayOverride ?? 0} onChange={e => setSepPayOverride(Number(e.target.value) || 0)} className="input-field w-40" placeholder="Manual amount" />
                  )}
                  {sep.applies && sepPayOverride == null && canEdit && (
                    <button onClick={() => setSepPayOverride(sep.amount)} className="text-xs text-blue-600 hover:underline">Override</button>
                  )}
                  {sepPayOverride != null && sep.applies && canEdit && (
                    <button onClick={() => setSepPayOverride(null)} className="text-xs text-gray-500 hover:underline">Use formula</button>
                  )}
                </div>
              </Section>

              {/* 13th month */}
              <Section title="Prorated 13th-Month Pay">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Covered From"><input disabled={!canEdit} type="date" value={ytdFrom} onChange={e => setYtdFrom(e.target.value)} className="input-field w-full" /></Field>
                  <Field label="Covered To"><input disabled={!canEdit} type="date" value={ytdTo} onChange={e => setYtdTo(e.target.value)} className="input-field w-full" /></Field>
                </div>
                <Field label="Total Basic Salary Earned this Year (Jan 1 → LWD) (₱)">
                  <input disabled={!canEdit} type="number" value={basicEarnedYTD} onChange={e => setBasicEarnedYTD(Number(e.target.value) || 0)} className="input-field w-full" />
                </Field>
                <Field label="13th-Month Already Paid this Year (₱)">
                  <input disabled={!canEdit} type="number" value={thirteenthPaid} onChange={e => setThirteenthPaid(Number(e.target.value) || 0)} className="input-field w-full" />
                </Field>
                <p className="text-xs text-gray-500">{money(basicEarnedYTD)} ÷ 12 − paid {money(thirteenthPaid)} = <strong>{money(thirteenth)}</strong> (basic salary only; excludes allowances, OT, bonuses)</p>
              </Section>

              {/* Leave conversion */}
              <Section title="Leave Conversion">
                <div className="space-y-2">
                  {leaveLines.map((l, i) => (
                    <div key={i} className="grid grid-cols-[1fr_5rem_6rem_auto] items-center gap-2 text-sm">
                      <span className="text-gray-700">{l.type}</span>
                      <input disabled={!canEdit} type="number" step="0.1" value={l.credits} onChange={e => setLeaveLines(ls => ls.map((x, j) => j === i ? { ...x, credits: Number(e.target.value) || 0 } : x))} className="input-field" />
                      <label className="flex items-center gap-1 text-xs"><input disabled={!canEdit} type="checkbox" checked={l.convertible} onChange={e => setLeaveLines(ls => ls.map((x, j) => j === i ? { ...x, convertible: e.target.checked } : x))} /> convertible</label>
                      <span className="text-right text-gray-600">{l.convertible ? money((Number(l.credits) || 0) * dailyRateSimple) : '—'}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">Convertible credits × daily rate ({money(dailyRateSimple)}) = <strong>{money(leaveConversion)}</strong></p>
                <label className="mt-2 flex items-center gap-2 text-sm"><input disabled={!canEdit} type="checkbox" checked={leaveConfirmed} onChange={e => setLeaveConfirmed(e.target.checked)} /> HR confirms the leave conversion</label>
              </Section>

              {/* Other earnings & deductions */}
              <Section title="Other Earnings">
                <LineEditor items={earnings} setItems={setEarnings} canEdit={canEdit} />
              </Section>
              <Section title="Deductions">
                <LineEditor items={deductions} setItems={setDeductions} canEdit={canEdit} />
              </Section>

              <Section title="Notes">
                <textarea disabled={!canEdit} value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="input-field w-full" />
              </Section>
            </div>

            {/* Summary */}
            <div className="lg:sticky lg:top-4 self-start space-y-4">
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
                <h3 className="mb-4 text-lg font-bold text-gray-900">Final Pay Summary <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 align-middle">{record && locked ? STATUS_LABELS[record.status] : 'Estimate'}</span></h3>
                <SumRow label="Unpaid salary" value={unpaidSalary} />
                <SumRow label="Separation pay" value={separationPay} />
                <SumRow label="Prorated 13th-month" value={thirteenth} />
                <SumRow label="Leave conversion" value={leaveConversion} />
                {earnings.map((e, i) => <SumRow key={i} label={e.desc || 'Other earning'} value={Number(e.amount) || 0} />)}
                <div className="my-2 border-t border-gray-200" />
                <SumRow label="Gross Final Pay" value={grossFinalPay} bold />
                <div className="my-2 border-t border-gray-200" />
                {deductions.map((d, i) => <SumRow key={i} label={d.desc || 'Deduction'} value={-(Number(d.amount) || 0)} />)}
                <SumRow label="Total Deductions" value={-totalDeductions} />
                <div className="my-2 border-t-2 border-gray-800" />
                <div className="flex items-center justify-between"><span className="text-lg font-bold text-gray-900">Net Final Pay</span><span className="text-2xl font-extrabold text-gray-900">{money(netFinalPay)}</span></div>
              </div>

              {/* Actions */}
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-2">
                {canEdit && (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => save('draft')} disabled={saving} className="btn-secondary">Save Draft</button>
                    <button onClick={() => save('for_review')} disabled={saving} className="btn-primary">Save for Review</button>
                  </div>
                )}
                {record?.status === 'for_review' && <button onClick={approve} className="btn-primary w-full">Approve &amp; Lock</button>}
                {record?.status === 'approved' && (
                  <div className="flex flex-wrap gap-2">
                    <button onClick={downloadPdf} className="btn-secondary">Download PDF</button>
                    <button onClick={markPaid} className="btn-primary">Mark as Paid</button>
                  </div>
                )}
                {record?.status === 'paid' && <button onClick={downloadPdf} className="btn-secondary w-full">Download Final Pay Statement (PDF)</button>}
                {record && (record.status === 'draft' || record.status === 'for_review' || record.status === 'approved') && (
                  <button onClick={cancel} className="text-xs text-red-600 hover:underline">Cancel this computation</button>
                )}
                {locked && <p className="text-xs text-gray-500">This record is locked. Use “Revise” to create a new version.</p>}
              </div>
            </div>
          </div>

          {/* Hidden PDF layout */}
          <FinalPayPdf ref={pdfRef} record={record} reasonLabel={reasonLabel} sep={sep} employee={employee}
            data={{ unpaidSalary, separationPay, thirteenth, leaveConversion, earnings, deductions, grossFinalPay, totalDeductions, netFinalPay, creditedYears, dailyRate: dailyRateSimple, monthlyBasic, divisor, lastWorkingDay, basicEarnedYTD, thirteenthPaid, leaveLines, ytdFrom, ytdTo }} />
        </>
      )}
    </div>
  )
}

// ── Small presentational helpers ─────────────────────────────────────────────
function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p><p className="text-sm font-medium text-gray-900">{value}</p></div>
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"><h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">{title}</h3><div className="space-y-3">{children}</div></div>
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>{children}</div>
}
function SumRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return <div className="flex items-center justify-between py-0.5 text-sm"><span className={bold ? 'font-semibold text-gray-800' : 'text-gray-600'}>{label}</span><span className={bold ? 'font-bold text-gray-900' : 'text-gray-800'}>{money(value)}</span></div>
}
function LineEditor({ items, setItems, canEdit }: { items: LineItem[]; setItems: (f: (p: LineItem[]) => LineItem[]) => void; canEdit: boolean }) {
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-[1fr_8rem_1.5rem] items-center gap-2">
          <input disabled={!canEdit} value={it.desc} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, desc: e.target.value } : x))} className="input-field w-full" placeholder="Description (required)" />
          <input disabled={!canEdit} type="number" value={it.amount} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) || 0 } : x))} className="input-field w-full" placeholder="₱" />
          {canEdit && <button onClick={() => setItems(p => p.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700">✕</button>}
        </div>
      ))}
      {canEdit && <button onClick={() => setItems(p => [...p, { desc: '', amount: 0 }])} className="text-xs font-medium text-blue-600 hover:underline">+ Add line</button>}
    </div>
  )
}

// ── PDF layout (hidden, rasterized on download) ───────────────────────────────
import { forwardRef } from 'react'
const FinalPayPdf = forwardRef<HTMLDivElement, any>(({ record, reasonLabel, sep, employee, data }, ref) => {
  const st = record?.status
  return (
    <div ref={ref} style={{ display: 'none', width: 794, background: '#fff', color: '#111827', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ padding: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '3px solid #1e293b', paddingBottom: 16 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <img src="/logo.jpg" alt="logo" style={{ height: 44 }} />
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 16 }}>Avensetech Software Development Services</p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#6b7280' }}>OIT2-806, Oakridge Business Park, Banilad, Mandaue City, Cebu • (032) 234-1362</p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1e293b' }}>FINAL PAY STATEMENT</p>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6b7280' }}>Generated {new Date().toLocaleDateString()}</p>
            <p style={{ margin: '2px 0 0', fontSize: 11, fontWeight: 700 }}>Status: {st ? STATUS_LABELS[st] : 'Draft'}</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '16px 0', fontSize: 12 }}>
          {[
            ['Employee', record?.employee_name || employee?.name],
            ['Employee ID', record?.employee_number || employee?.id?.slice(0, 8)],
            ['Position', record?.position || employee?.position || '-'],
            ['Department', record?.department || (employee as any)?.department || '-'],
            ['Date Hired', fmtDate(record?.date_hired || employee?.date_hired)],
            ['Last Working Day', fmtDate(data.lastWorkingDay)],
            ['Separation Reason', reasonLabel],
            ['Credited Years', String(data.creditedYears)],
          ].map(([k, v], i) => (
            <div key={i} style={{ width: '25%', boxSizing: 'border-box', paddingRight: 8 }}>
              <p style={{ margin: 0, fontSize: 9, textTransform: 'uppercase', color: '#9ca3af' }}>{k}</p>
              <p style={{ margin: '2px 0 0', fontWeight: 600 }}>{v as string}</p>
            </div>
          ))}
        </div>

        {/* Earnings */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 8 }}>
          <thead><tr style={{ background: '#f3f4f6' }}><th style={{ textAlign: 'left', padding: 8 }}>Earnings</th><th style={{ textAlign: 'right', padding: 8 }}>Amount</th></tr></thead>
          <tbody>
            <Row k="Unpaid salary" v={data.unpaidSalary} />
            <Row k="Separation pay" v={data.separationPay} />
            <Row k="Prorated 13th-month pay" v={data.thirteenth} />
            <Row k="Leave conversion" v={data.leaveConversion} />
            {data.earnings.map((e: LineItem, i: number) => <Row key={i} k={e.desc || 'Other earning'} v={Number(e.amount) || 0} />)}
            <tr style={{ borderTop: '2px solid #374151', fontWeight: 700 }}><td style={{ padding: 8 }}>Gross Final Pay</td><td style={{ padding: 8, textAlign: 'right' }}>{money(data.grossFinalPay)}</td></tr>
          </tbody>
        </table>

        {/* Deductions */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 12 }}>
          <thead><tr style={{ background: '#f3f4f6' }}><th style={{ textAlign: 'left', padding: 8 }}>Deductions</th><th style={{ textAlign: 'right', padding: 8 }}>Amount</th></tr></thead>
          <tbody>
            {data.deductions.length === 0 && <tr><td style={{ padding: 8, color: '#9ca3af' }}>None</td><td style={{ padding: 8, textAlign: 'right' }}>{money(0)}</td></tr>}
            {data.deductions.map((d: LineItem, i: number) => <Row key={i} k={d.desc || 'Deduction'} v={Number(d.amount) || 0} />)}
            <tr style={{ borderTop: '2px solid #374151', fontWeight: 700 }}><td style={{ padding: 8 }}>Total Deductions</td><td style={{ padding: 8, textAlign: 'right' }}>{money(data.totalDeductions)}</td></tr>
          </tbody>
        </table>

        <div style={{ marginTop: 12, background: '#1e293b', color: '#fff', padding: 12, display: 'flex', justifyContent: 'space-between', borderRadius: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>NET FINAL PAY</span>
          <span style={{ fontWeight: 800, fontSize: 18 }}>{money(data.netFinalPay)}</span>
        </div>

        {/* Computation breakdown */}
        <div style={{ marginTop: 16, fontSize: 10.5, color: '#374151' }}>
          <p style={{ fontWeight: 700, marginBottom: 4 }}>Computation Breakdown</p>
          <p style={{ margin: '2px 0' }}><strong>Separation pay:</strong> {sep?.formula} — {sep?.basis}</p>
          <p style={{ margin: '2px 0' }}><strong>13th-month:</strong> {money(data.basicEarnedYTD)} ÷ 12 − paid {money(data.thirteenthPaid)} (covering {fmtDate(data.ytdFrom)}–{fmtDate(data.ytdTo)})</p>
          <p style={{ margin: '2px 0' }}><strong>Daily rate:</strong> {money(data.monthlyBasic)} ÷ {data.divisor} = {money(data.dailyRate)}</p>
          <p style={{ margin: '2px 0' }}><strong>Leave conversion:</strong> {data.leaveLines.filter((l: any) => l.convertible).map((l: any) => `${l.type} ${l.credits}d`).join(', ') || 'none'} × {money(data.dailyRate)} = {money(data.leaveConversion)}</p>
        </div>

        {/* Signatures */}
        <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
          {['Prepared by', 'Approved by', 'Received by (Employee)'].map((label, i) => (
            <div key={i} style={{ width: '30%', textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #9ca3af', marginTop: 40, paddingTop: 4 }}>
                {i === 0 ? (record?.prepared_by || '') : i === 1 ? (record?.approved_by || '') : ''}
              </div>
              <p style={{ margin: '2px 0 0', color: '#6b7280' }}>{label}</p>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 20, fontSize: 9, color: '#9ca3af', textAlign: 'center' }}>
          {st === 'approved' || st === 'paid' ? 'This is an approved final pay computation.' : 'This is an estimate and not yet approved.'}
        </p>
      </div>
    </div>
  )
})
function Row({ k, v }: { k: string; v: number }) {
  return <tr><td style={{ padding: 8 }}>{k}</td><td style={{ padding: 8, textAlign: 'right' }}>{money(v)}</td></tr>
}
