import { useEffect, useState, useMemo, useRef, forwardRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import type { Employee, SalaryHistory } from '@/types'
import {
  computeSeparationPay, creditedYearsBetween, round2, basicEarnedTimeline,
  proratedThirteenthMonth, dailyRate as calcDailyRate, leaveConversion as calcLeaveConversion,
  type SepKey, type EarnedSegment,
} from '@/lib/finalPay'

// ── Helpers ──────────────────────────────────────────────────────────────────
const money = (v: number | null | undefined) =>
  `₱${(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const fmtDate = (d: string | null | undefined) => {
  if (!d) return '-'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return '-'
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })
}

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

export default function FinalPay() {
  const [params] = useSearchParams()
  const { isAdminOrHR } = useCurrentUser()
  const employeeIdParam = params.get('employee')

  const [separated, setSeparated] = useState<Employee[]>([])
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [salaryHistory, setSalaryHistory] = useState<SalaryHistory[]>([])
  const [loading, setLoading] = useState(true)
  const pdfRef = useRef<HTMLDivElement>(null)

  // ── Auto-retrieved inputs (editable to correct data; recompute is automatic) ─
  const [reason, setReason] = useState<SepKey>('resignation')
  const [monthlyBasic, setMonthlyBasic] = useState(0)
  const [divisor, setDivisor] = useState(26)
  const [dateHired, setDateHired] = useState('')
  const [lastWorkingDay, setLastWorkingDay] = useState('')
  const [unpaidSalary, setUnpaidSalary] = useState(0)
  const [thirteenthPaid, setThirteenthPaid] = useState(0)
  const [companyBenefit, setCompanyBenefit] = useState(0) // company-provided separation benefit (contract/policy)
  const [leaveLines, setLeaveLines] = useState<Array<{ type: string; credits: number; convertible: boolean }>>([])
  const [earnings, setEarnings] = useState<LineItem[]>([])
  const [deductions, setDeductions] = useState<LineItem[]>([])

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      const { data: sep } = await supabase.from('employees').select('*').eq('status', 'terminated').order('termination_date', { ascending: false })
      setSeparated((sep ?? []) as Employee[])
      if (employeeIdParam) await loadEmployee(employeeIdParam)
      setLoading(false)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeIdParam])

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

  const loadEmployee = async (id: string) => {
    const { data: emp } = await supabase.from('employees').select('*').eq('id', id).single()
    if (!emp) return
    const e = emp as Employee
    setEmployee(e)
    const { data: hist } = await supabase.from('salary_history').select('*').eq('employee_id', id).order('effective_date', { ascending: true })
    setSalaryHistory((hist ?? []) as SalaryHistory[])

    // Auto-retrieve from HRIS
    setReason(mapReason(e.termination_reason))
    setMonthlyBasic(Number(e.base_salary) || 0)
    setDivisor(26)
    setDateHired(e.date_hired || '')
    setLastWorkingDay(e.last_working_day || e.termination_date || '')
    setUnpaidSalary(0)
    setThirteenthPaid(0)
    setCompanyBenefit(0)
    setLeaveLines([
      { type: 'Vacation Leave', credits: Number((e as any).vacation_leave_balance) || 0, convertible: true },
      { type: 'Sick Leave', credits: Number((e as any).sick_leave_balance) || 0, convertible: false },
      { type: 'Birthday Leave', credits: Number((e as any).birthday_leave_balance) || 0, convertible: false },
    ])
    setEarnings([])
    setDeductions([])

    // Auto-pull open loan balances as a deduction candidate
    try {
      const { data: loans } = await supabase.from('loans').select('*').eq('employee_id', id)
      const open = (loans ?? []).filter((l: any) => (l.status ? l.status !== 'paid' : true))
      const total = open.reduce((s: number, l: any) => s + (Number(l.remaining_balance ?? l.balance ?? 0)), 0)
      if (total > 0) setDeductions([{ desc: 'Outstanding loan / cash advance balance', amount: round2(total) }])
    } catch { /* ignore */ }
  }

  // ── AUTOMATIC computation (recomputes whenever any input changes) ────────────
  const creditedYears = useMemo(() => creditedYearsBetween(dateHired || null, lastWorkingDay || null), [dateHired, lastWorkingDay])
  const sep = useMemo(() => computeSeparationPay(reason, monthlyBasic, creditedYears), [reason, monthlyBasic, creditedYears])
  // statutory + optional company-provided benefit
  const separationPay = round2(sep.amount + (Number(companyBenefit) || 0))

  const dailyRate = useMemo(() => calcDailyRate(monthlyBasic, divisor), [monthlyBasic, divisor])

  // 13th-month: build the year timeline from salary history (respects effective dates)
  const ytdFrom = useMemo(() => {
    if (!lastWorkingDay) return ''
    const year = new Date(lastWorkingDay).getFullYear()
    const jan1 = `${year}-01-01`
    // use hire date if it's later than Jan 1 of the separation year
    return dateHired && new Date(dateHired) > new Date(jan1) ? dateHired : jan1
  }, [lastWorkingDay, dateHired])

  const salaryAtStart = useMemo(() => {
    // the salary in effect at ytdFrom = latest salary_history change on/before ytdFrom, else earliest known, else current
    if (!ytdFrom) return monthlyBasic
    const priorChanges = salaryHistory.filter(h => new Date(h.effective_date) <= new Date(ytdFrom))
    if (priorChanges.length > 0) return Number(priorChanges[priorChanges.length - 1].new_salary)
    // no change before start: if there are later changes, the pre-first-change salary is previous_salary of the first
    if (salaryHistory.length > 0) return Number(salaryHistory[0].previous_salary ?? salaryHistory[0].new_salary)
    return monthlyBasic
  }, [ytdFrom, salaryHistory, monthlyBasic])

  const timeline = useMemo(
    () => basicEarnedTimeline(ytdFrom, lastWorkingDay, salaryAtStart, salaryHistory.map(h => ({ effective_date: h.effective_date, new_salary: Number(h.new_salary) }))),
    [ytdFrom, lastWorkingDay, salaryAtStart, salaryHistory])
  const thirteenth = useMemo(() => proratedThirteenthMonth(timeline.totalEarned, thirteenthPaid), [timeline.totalEarned, thirteenthPaid])

  const leaveConversion = useMemo(
    () => leaveLines.filter(l => l.convertible).reduce((s, l) => s + calcLeaveConversion(Number(l.credits) || 0, monthlyBasic, divisor), 0),
    [leaveLines, monthlyBasic, divisor])

  const otherEarnings = round2(earnings.reduce((s, e) => s + (Number(e.amount) || 0), 0))
  const totalDeductions = round2(deductions.reduce((s, d) => s + (Number(d.amount) || 0), 0))
  const grossFinalPay = round2(round2(unpaidSalary) + separationPay + thirteenth + round2(leaveConversion) + otherEarnings)
  const netFinalPay = round2(grossFinalPay - totalDeductions)

  // ── Validation ────────────────────────────────────────────────────────────
  const errors = useMemo(() => {
    const e: string[] = []
    if (!dateHired) e.push('Employment start date is missing (check the employee record).')
    if (!lastWorkingDay) e.push('Last working day is missing.')
    if (dateHired && lastWorkingDay && new Date(lastWorkingDay) < new Date(dateHired)) e.push('Last working day is earlier than the start date.')
    if (!monthlyBasic || monthlyBasic <= 0) e.push('Monthly basic salary must be greater than zero.')
    if (!divisor || divisor <= 0) e.push('Payroll divisor must be greater than zero.')
    if (!reason) e.push('Separation reason is required.')
    if (leaveLines.some(l => Number(l.credits) < 0)) e.push('Leave credits cannot be negative.')
    if (earnings.some(x => !x.desc.trim())) e.push('Every other earning needs a description.')
    if (deductions.some(x => !x.desc.trim())) e.push('Every deduction needs a description.')
    return e
  }, [dateHired, lastWorkingDay, monthlyBasic, divisor, reason, leaveLines, earnings, deductions])

  const reasonLabel = SEPARATION_REASONS.find(r => r.key === reason)?.label || reason

  // ── PDF (statement only — no approval fields) ────────────────────────────────
  const downloadPdf = async () => {
    const el = pdfRef.current
    if (!el || !employee) return
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
    while (left > 0) { pos = left - imgH; page++; pdf.addPage(); pdf.addImage(img, 'PNG', 0, pos, pageW, imgH); pdf.setFontSize(8); pdf.setTextColor(150); pdf.text(`Page ${page} of ${totalPages}`, pageW - 25, pageH - 6); left -= pageH }
    const safe = (employee.name || 'Employee').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-')
    pdf.save(`Final-Pay_${safe}_${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  if (!isAdminOrHR) return <div className="p-8 text-center text-gray-600">You do not have permission to access Final Pay computations.</div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Final Pay Computation</h2>
        <p className="text-sm text-gray-600">Automatically calculated from HRIS, payroll, and leave records. Adjust inputs and figures update instantly.</p>
      </div>

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
                  <span className="text-blue-600 text-sm">Compute Final Pay →</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {employee && (
        <>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <button onClick={() => setEmployee(null)} className="text-sm text-blue-600 hover:underline">← Back to list</button>
            <button onClick={downloadPdf} disabled={errors.length > 0} className="btn-primary" title={errors.length ? 'Resolve validation issues first' : ''}>Download Final Pay Statement (PDF)</button>
          </div>

          {/* Employee summary */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <Info label="Employee" value={employee.name} />
            <Info label="Employee ID" value={(employee as any).employee_number || employee.id.slice(0, 8)} />
            <Info label="Position" value={employee.position || '-'} />
            <Info label="Department/Project" value={(employee as any).department || '-'} />
            <Info label="Date Hired" value={fmtDate(dateHired)} />
            <Info label="Last Working Day" value={fmtDate(lastWorkingDay)} />
            <Info label="Separation Reason" value={reasonLabel} />
            <Info label="Credited Years" value={String(creditedYears)} />
          </div>

          {errors.length > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
              <p className="font-semibold">Please resolve before downloading:</p>
              <ul className="mt-1 list-disc pl-5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          )}
          {reason === 'closure_serious_losses' && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
              <strong>Closure due to serious business losses:</strong> statutory separation pay is not automatically awarded. The exemption depends on the employer proving serious business losses; confirm the correct separation classification. Any company-provided benefit can be entered below.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Inputs (auto-filled, editable) */}
            <div className="space-y-6">
              <Section title="Inputs (auto-retrieved)">
                <Field label="Separation Reason">
                  <select value={reason} onChange={e => setReason(e.target.value as SepKey)} className="input-field w-full">
                    {SEPARATION_REASONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Monthly Basic Salary (₱)"><input type="number" value={monthlyBasic} onChange={e => setMonthlyBasic(Number(e.target.value) || 0)} className="input-field w-full" /></Field>
                  <Field label="Payroll Divisor (days/mo)"><input type="number" value={divisor} onChange={e => setDivisor(Number(e.target.value) || 26)} className="input-field w-full" /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Date Hired"><input type="date" value={dateHired} onChange={e => setDateHired(e.target.value)} className="input-field w-full" /></Field>
                  <Field label="Last Working Day"><input type="date" value={lastWorkingDay} onChange={e => setLastWorkingDay(e.target.value)} className="input-field w-full" /></Field>
                </div>
                <Field label="Unpaid Basic Salary through LWD (₱)"><input type="number" value={unpaidSalary} onChange={e => setUnpaidSalary(Number(e.target.value) || 0)} className="input-field w-full" /></Field>
                <p className="text-xs text-gray-500">Daily rate = {money(monthlyBasic)} ÷ {divisor} = <strong>{money(dailyRate)}</strong></p>
              </Section>

              <Section title="Separation Pay">
                <p className="text-xs text-gray-600">{sep.formula}</p>
                <p className="mt-1 text-[11px] text-gray-400">{sep.basis} • Category: {reasonLabel}</p>
                {!sep.applies && (
                  <Field label="Company-provided separation benefit (₱, optional)">
                    <input type="number" value={companyBenefit} onChange={e => setCompanyBenefit(Number(e.target.value) || 0)} className="input-field w-full" />
                  </Field>
                )}
                <p className="mt-2 text-sm">Statutory: <strong>{money(sep.amount)}</strong>{!sep.applies && companyBenefit > 0 ? ` + company benefit ${money(companyBenefit)}` : ''} → Total <strong>{money(separationPay)}</strong></p>
              </Section>

              <Section title="Prorated 13th-Month Pay">
                <p className="text-xs text-gray-500">Covered {fmtDate(ytdFrom)} → {fmtDate(lastWorkingDay)} (basic salary only)</p>
                <div className="mt-2 space-y-1 text-xs">
                  {timeline.segments.map((s: EarnedSegment, i) => (
                    <div key={i} className="flex justify-between text-gray-600">
                      <span>{fmtDate(s.from)}–{fmtDate(s.to)} @ {money(s.monthly)}/mo × {s.months.toFixed(2)} mo</span>
                      <span>{money(s.earned)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-gray-100 pt-1 font-medium text-gray-800"><span>Total basic earned</span><span>{money(timeline.totalEarned)}</span></div>
                </div>
                <Field label="13th-Month Already Paid This Year (₱)"><input type="number" value={thirteenthPaid} onChange={e => setThirteenthPaid(Number(e.target.value) || 0)} className="input-field w-full" /></Field>
                <p className="text-xs text-gray-500">{money(timeline.totalEarned)} ÷ 12 − paid {money(thirteenthPaid)} = <strong>{money(thirteenth)}</strong></p>
              </Section>

              <Section title="Leave Conversion">
                <div className="space-y-2">
                  {leaveLines.map((l, i) => (
                    <div key={i} className="grid grid-cols-[1fr_5rem_6rem_auto] items-center gap-2 text-sm">
                      <span className="text-gray-700">{l.type}</span>
                      <input type="number" step="0.1" value={l.credits} onChange={e => setLeaveLines(ls => ls.map((x, j) => j === i ? { ...x, credits: Number(e.target.value) || 0 } : x))} className="input-field" />
                      <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={l.convertible} onChange={e => setLeaveLines(ls => ls.map((x, j) => j === i ? { ...x, convertible: e.target.checked } : x))} /> convertible</label>
                      <span className="text-right text-gray-600">{l.convertible ? money(calcLeaveConversion(Number(l.credits) || 0, monthlyBasic, divisor)) : '—'}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500">Convertible credits × daily rate ({money(dailyRate)}) = <strong>{money(leaveConversion)}</strong></p>
              </Section>

              <Section title="Other Earnings"><LineEditor items={earnings} setItems={setEarnings} /></Section>
              <Section title="Deductions"><LineEditor items={deductions} setItems={setDeductions} /></Section>
            </div>

            {/* Summary (live) */}
            <div className="lg:sticky lg:top-4 self-start">
              <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
                <h3 className="mb-4 text-lg font-bold text-gray-900">Final Pay Summary</h3>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">Earnings</p>
                <SumRow label="Unpaid basic salary" value={unpaidSalary} />
                <SumRow label={`Separation pay (${reasonLabel})`} value={separationPay} />
                <SumRow label="Prorated 13th-month" value={thirteenth} />
                <SumRow label="Leave conversion" value={leaveConversion} />
                {earnings.map((e, i) => <SumRow key={i} label={e.desc || 'Other earning'} value={Number(e.amount) || 0} />)}
                <div className="my-2 border-t border-gray-200" />
                <SumRow label="Gross Final Pay" value={grossFinalPay} bold />
                <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-gray-400">Deductions</p>
                {deductions.length === 0 && <p className="text-sm text-gray-400">None</p>}
                {deductions.map((d, i) => <SumRow key={i} label={d.desc || 'Deduction'} value={-(Number(d.amount) || 0)} />)}
                <SumRow label="Total Deductions" value={-totalDeductions} />
                <div className="my-2 border-t-2 border-gray-800" />
                <div className="flex items-center justify-between"><span className="text-lg font-bold text-gray-900">Net Final Pay</span><span className="text-2xl font-extrabold text-gray-900">{money(netFinalPay)}</span></div>
                <button onClick={downloadPdf} disabled={errors.length > 0} className="btn-primary mt-4 w-full">Download PDF</button>
              </div>
            </div>
          </div>

          <FinalPayPdf ref={pdfRef} employee={employee} reasonLabel={reasonLabel} sep={sep}
            data={{ dateHired, lastWorkingDay, monthlyBasic, divisor, dailyRate, creditedYears, unpaidSalary, separationPay, statutory: sep.amount, companyBenefit, thirteenth, thirteenthPaid, ytdFrom, timeline, leaveConversion, leaveLines, earnings, deductions, grossFinalPay, totalDeductions, netFinalPay }} />
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
function LineEditor({ items, setItems }: { items: LineItem[]; setItems: (f: (p: LineItem[]) => LineItem[]) => void }) {
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-[1fr_8rem_1.5rem] items-center gap-2">
          <input value={it.desc} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, desc: e.target.value } : x))} className="input-field w-full" placeholder="Description (required)" />
          <input type="number" value={it.amount} onChange={e => setItems(p => p.map((x, j) => j === i ? { ...x, amount: Number(e.target.value) || 0 } : x))} className="input-field w-full" placeholder="₱" />
          <button onClick={() => setItems(p => p.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-700">✕</button>
        </div>
      ))}
      <button onClick={() => setItems(p => [...p, { desc: '', amount: 0 }])} className="text-xs font-medium text-blue-600 hover:underline">+ Add line</button>
    </div>
  )
}

// ── PDF layout (statement only — no approval/reviewer fields) ─────────────────
const FinalPayPdf = forwardRef<HTMLDivElement, any>(({ employee, reasonLabel, sep, data }, ref) => (
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
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '16px 0', fontSize: 12 }}>
        {[
          ['Employee', employee?.name],
          ['Employee ID', (employee as any)?.employee_number || employee?.id?.slice(0, 8)],
          ['Position', employee?.position || '-'],
          ['Date Hired', fmtDate(data.dateHired)],
          ['Last Working Day', fmtDate(data.lastWorkingDay)],
          ['Separation Reason', reasonLabel],
          ['Credited Years', String(data.creditedYears)],
          ['Daily Rate', money(data.dailyRate)],
        ].map(([k, v], i) => (
          <div key={i} style={{ width: '25%', boxSizing: 'border-box', paddingRight: 8 }}>
            <p style={{ margin: 0, fontSize: 9, textTransform: 'uppercase', color: '#9ca3af' }}>{k}</p>
            <p style={{ margin: '2px 0 0', fontWeight: 600 }}>{v as string}</p>
          </div>
        ))}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 8 }}>
        <thead><tr style={{ background: '#f3f4f6' }}><th style={{ textAlign: 'left', padding: 8 }}>Earnings</th><th style={{ textAlign: 'right', padding: 8 }}>Amount</th></tr></thead>
        <tbody>
          <Row k="Unpaid basic salary" v={data.unpaidSalary} />
          <Row k={`Separation pay (${reasonLabel})`} v={data.separationPay} />
          <Row k="Prorated 13th-month pay" v={data.thirteenth} />
          <Row k="Leave conversion" v={data.leaveConversion} />
          {data.earnings.map((e: LineItem, i: number) => <Row key={i} k={e.desc || 'Other earning'} v={Number(e.amount) || 0} />)}
          <tr style={{ borderTop: '2px solid #374151', fontWeight: 700 }}><td style={{ padding: 8 }}>Gross Final Pay</td><td style={{ padding: 8, textAlign: 'right' }}>{money(data.grossFinalPay)}</td></tr>
        </tbody>
      </table>

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

      <div style={{ marginTop: 16, fontSize: 10.5, color: '#374151' }}>
        <p style={{ fontWeight: 700, marginBottom: 4 }}>Computation Breakdown</p>
        <p style={{ margin: '2px 0' }}><strong>Separation pay:</strong> {sep?.formula} — {sep?.basis}{data.companyBenefit > 0 ? ` (+ company benefit ${money(data.companyBenefit)})` : ''}</p>
        <p style={{ margin: '2px 0' }}><strong>13th-month:</strong> total basic earned {money(data.timeline.totalEarned)} ÷ 12 − paid {money(data.thirteenthPaid)} (covering {fmtDate(data.ytdFrom)}–{fmtDate(data.lastWorkingDay)})</p>
        {data.timeline.segments.map((s: EarnedSegment, i: number) => (
          <p key={i} style={{ margin: '1px 0 1px 12px', color: '#6b7280' }}>• {fmtDate(s.from)}–{fmtDate(s.to)}: {money(s.monthly)}/mo × {s.months.toFixed(2)} = {money(s.earned)}</p>
        ))}
        <p style={{ margin: '2px 0' }}><strong>Daily rate:</strong> {money(data.monthlyBasic)} ÷ {data.divisor} = {money(data.dailyRate)}</p>
        <p style={{ margin: '2px 0' }}><strong>Leave conversion:</strong> {data.leaveLines.filter((l: any) => l.convertible).map((l: any) => `${l.type} ${l.credits}d`).join(', ') || 'none'} × {money(data.dailyRate)} = {money(data.leaveConversion)}</p>
      </div>

      <div style={{ marginTop: 28, display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
        <div style={{ width: '45%', textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #9ca3af', marginTop: 36, paddingTop: 4 }} />
          <p style={{ margin: '2px 0 0', color: '#6b7280' }}>Prepared by</p>
        </div>
        <div style={{ width: '45%', textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #9ca3af', marginTop: 36, paddingTop: 4 }} />
          <p style={{ margin: '2px 0 0', color: '#6b7280' }}>Received by (Employee)</p>
        </div>
      </div>
      <p style={{ marginTop: 16, fontSize: 9, color: '#9ca3af', textAlign: 'center' }}>This is a final pay computation statement.</p>
    </div>
  </div>
))
function Row({ k, v }: { k: string; v: number }) {
  return <tr><td style={{ padding: 8 }}>{k}</td><td style={{ padding: 8, textAlign: 'right' }}>{money(v)}</td></tr>
}
