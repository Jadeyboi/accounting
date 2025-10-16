import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Employee, Payslip } from '@/types'
import PayslipView from '@/components/PayslipView'

type Mode = 'list' | 'edit'

const today = () => new Date().toISOString().slice(0, 10)

const moneyFmt = (v: number | null | undefined) => `₱ ${(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function Payroll() {
  const [mode, setMode] = useState<Mode>('list')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Employee form
  const [empName, setEmpName] = useState('')
  const [empPosition, setEmpPosition] = useState('')
  const [empBaseSalary, setEmpBaseSalary] = useState<string>('')
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null)

  // Payslip form
  const [editingPayslip, setEditingPayslip] = useState<Payslip | null>(null)

  const payslipContainerRef = useRef<HTMLDivElement>(null)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    const [empRes, payRes] = await Promise.all([
      supabase.from('employees').select('*').order('created_at', { ascending: false }),
      supabase.from('payslips').select('*').order('created_at', { ascending: false }),
    ])
    if (empRes.error) setError(empRes.error.message)
    if (payRes.error) setError((prev) => prev ?? payRes.error!.message)
    setEmployees((empRes.data ?? []) as Employee[])
    setPayslips((payRes.data ?? []) as Payslip[])
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  const currentEmployee = useMemo(() => {
    if (!editingPayslip) return null
    return employees.find((e) => e.id === editingPayslip.employee_id) || null
  }, [editingPayslip, employees])

  // Derived totals for editingPayslip
  const totals = useMemo(() => {
    if (!editingPayslip) return { additions: 0, deductions: 0, net: 0 }
    const p = editingPayslip
    const additions = (p.bonuses ?? 0) + (p.allowances ?? 0)
    const deductions = (p.sss ?? 0) + (p.pagibig ?? 0) + (p.philhealth ?? 0) + (p.tax ?? 0) + (p.cash_advance ?? 0) + (p.other_deductions ?? 0)
    const net = p.gross_salary + additions - deductions
    return { additions, deductions, net }
  }, [editingPayslip])

  const newPayslip = (): Payslip => ({
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    employee_id: employees[0]?.id ?? '',
    period_start: today(),
    period_end: today(),
    date_issued: today(),
    gross_salary: Number(employees[0]?.base_salary ?? 0),
    sss: 0,
    pagibig: 0,
    philhealth: 0,
    tax: 0,
    cash_advance: 0,
    bonuses: 0,
    allowances: 0,
    other_deductions: 0,
    notes: '',
    net_salary: 0,
    transaction_id: null,
  })

  const onEditPayslip = (p?: Payslip) => {
    if (p) setEditingPayslip(p)
    else setEditingPayslip(newPayslip())
    setMode('edit')
  }

  const onDeletePayslip = async (id: string) => {
    const pay = payslips.find((x) => x.id === id)
    if (!confirm('Delete this payslip?')) return
    // If linked transaction exists, you may also delete or keep it. We'll keep for audit.
    const { error } = await supabase.from('payslips').delete().eq('id', id)
    if (error) return alert(error.message)
    await refresh()
  }

  const onSavePayslip = async () => {
    if (!editingPayslip) return
    const p = { ...editingPayslip }
    // Recompute net on save
    const additions = (p.bonuses ?? 0) + (p.allowances ?? 0)
    const deductions = (p.sss ?? 0) + (p.pagibig ?? 0) + (p.philhealth ?? 0) + (p.tax ?? 0) + (p.cash_advance ?? 0) + (p.other_deductions ?? 0)
    p.net_salary = p.gross_salary + additions - deductions

    // Upsert payslip
    const { error: upsertError } = await supabase.from('payslips').upsert(p, { onConflict: 'id' })
    if (upsertError) return alert(upsertError.message)

    // Create or update linked expense transaction
    const note = `Payroll: ${currentEmployee?.name ?? p.employee_id} (${p.period_start} to ${p.period_end})`
    if (p.transaction_id) {
      const { error: txErr } = await supabase
        .from('transactions')
        .update({ amount: p.net_salary, type: 'expense', category: 'Payroll', note })
        .eq('id', p.transaction_id)
      if (txErr) return alert(txErr.message)
    } else {
      const { data: txData, error: insErr } = await supabase
        .from('transactions')
        .insert({ date: p.date_issued, type: 'expense', amount: p.net_salary, category: 'Payroll', note })
        .select('id')
        .single()
      if (insErr) return alert(insErr.message)
      p.transaction_id = txData?.id ?? null
      const { error: linkErr } = await supabase.from('payslips').update({ transaction_id: p.transaction_id }).eq('id', p.id)
      if (linkErr) return alert(linkErr.message)
    }

    setEditingPayslip(null)
    setMode('list')
    await refresh()
  }

  const onDownloadPdf = async () => {
    if (!editingPayslip || !payslipContainerRef.current) return
    const el = payslipContainerRef.current
    const [jsPDFMod, html2canvasMod] = await Promise.all([
      import('jspdf'),
      import('html2canvas'),
    ])
    const jsPDF = (jsPDFMod as any).default
    const html2canvas = (html2canvasMod as any).default
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff' })
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'p', unit: 'pt', format: 'a4' })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const imgWidth = pageWidth - 40
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    pdf.addImage(imgData, 'PNG', 20, 20, imgWidth, Math.min(imgHeight, pageHeight - 40))
    pdf.save(`payslip_${currentEmployee?.name ?? 'employee'}_${editingPayslip.date_issued}.pdf`)
  }

  const onSaveEmployee = async () => {
    const payload: Partial<Employee> = {
      name: empName.trim(),
      position: empPosition.trim() || null,
      base_salary: empBaseSalary ? Number(empBaseSalary) : null,
    }
    if (!payload.name) return alert('Employee name is required')

    if (editingEmployeeId) {
      const { error } = await supabase.from('employees').update(payload).eq('id', editingEmployeeId)
      if (error) return alert(error.message)
    } else {
      const { error } = await supabase.from('employees').insert(payload)
      if (error) return alert(error.message)
    }

    setEmpName(''); setEmpPosition(''); setEmpBaseSalary(''); setEditingEmployeeId(null)
    await refresh()
  }

  const onEditEmployee = (e: Employee) => {
    setEditingEmployeeId(e.id)
    setEmpName(e.name)
    setEmpPosition(e.position ?? '')
    setEmpBaseSalary(e.base_salary != null ? String(e.base_salary) : '')
  }

  const onDeleteEmployee = async (id: string) => {
    if (!confirm('Delete this employee?')) return
    const { error } = await supabase.from('employees').delete().eq('id', id)
    if (error) return alert(error.message)
    await refresh()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Payroll</h2>
          <p className="text-sm text-slate-600">Create and edit payslips. Processing will log an expense automatically.</p>
        </div>
        <div className="flex gap-2">
          {mode === 'list' ? (
            <button className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700" onClick={() => onEditPayslip()}>New Payslip</button>
          ) : (
            <>
              <button className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700 hover:bg-slate-200" onClick={() => { setMode('list'); setEditingPayslip(null) }}>Back</button>
              <button className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-emerald-700" onClick={onSavePayslip}>Process & Save</button>
              <button className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white shadow hover:bg-black" onClick={onDownloadPdf}>Download PDF</button>
            </>
          )}
        </div>
      </div>

      {/* Employee management */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Employees</h3>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <input className="rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Name" value={empName} onChange={(e) => setEmpName(e.target.value)} />
          <input className="rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Position" value={empPosition} onChange={(e) => setEmpPosition(e.target.value)} />
          <input type="number" step="0.01" className="rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500" placeholder="Base Salary" value={empBaseSalary} onChange={(e) => setEmpBaseSalary(e.target.value)} />
          <div>
            <button onClick={onSaveEmployee} className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">{editingEmployeeId ? 'Update' : 'Add'} Employee</button>
          </div>
        </div>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Name</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Position</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">Base Salary</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {employees.map((e) => (
                <tr key={e.id}>
                  <td className="px-3 py-2 text-sm text-slate-800">{e.name}</td>
                  <td className="px-3 py-2 text-sm text-slate-700">{e.position ?? ''}</td>
                  <td className="px-3 py-2 text-right text-sm text-slate-900">{e.base_salary != null ? moneyFmt(e.base_salary) : ''}</td>
                  <td className="px-3 py-2 text-right">
                    <button className="rounded-md bg-slate-100 px-3 py-1 text-sm text-slate-700 hover:bg-slate-200" onClick={() => onEditEmployee(e)}>Edit</button>
                    <button className="ml-2 rounded-md bg-rose-50 px-3 py-1 text-sm text-rose-700 hover:bg-rose-100" onClick={() => onDeleteEmployee(e.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-500">No employees yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payslips */}
      {mode === 'list' && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Payslips</h3>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Employee</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Period</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Issued</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">Net</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Linked Expense</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {payslips.map((p) => {
                  const emp = employees.find((e) => e.id === p.employee_id)
                  return (
                    <tr key={p.id}>
                      <td className="px-3 py-2 text-sm text-slate-800">{emp?.name ?? p.employee_id}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{p.period_start} to {p.period_end}</td>
                      <td className="px-3 py-2 text-sm text-slate-700">{p.date_issued}</td>
                      <td className="px-3 py-2 text-right text-sm text-slate-900">{moneyFmt(p.net_salary)}</td>
                      <td className="px-3 py-2 text-sm">{p.transaction_id ? <span className="rounded bg-emerald-50 px-2 py-1 text-emerald-700">Linked</span> : <span className="rounded bg-slate-50 px-2 py-1 text-slate-600">Not Linked</span>}</td>
                      <td className="px-3 py-2 text-right">
                        <button className="rounded-md bg-slate-100 px-3 py-1 text-sm text-slate-700 hover:bg-slate-200" onClick={() => onEditPayslip(p)}>Edit</button>
                        <button className="ml-2 rounded-md bg-rose-50 px-3 py-1 text-sm text-rose-700 hover:bg-rose-100" onClick={() => onDeletePayslip(p.id)}>Delete</button>
                      </td>
                    </tr>
                  )
                })}
                {payslips.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">No payslips yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {mode === 'edit' && editingPayslip && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 text-base font-semibold text-slate-900">Payslip Details</div>
            <div className="grid grid-cols-1 gap-3">
              <label className="text-sm text-slate-600">Employee
                <select className="mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500" value={editingPayslip.employee_id} onChange={(e) => setEditingPayslip({ ...editingPayslip, employee_id: e.target.value })}>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-slate-600">Period Start
                  <input type="date" className="mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500" value={editingPayslip.period_start} onChange={(e) => setEditingPayslip({ ...editingPayslip, period_start: e.target.value })} />
                </label>
                <label className="text-sm text-slate-600">Period End
                  <input type="date" className="mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500" value={editingPayslip.period_end} onChange={(e) => setEditingPayslip({ ...editingPayslip, period_end: e.target.value })} />
                </label>
              </div>
              <label className="text-sm text-slate-600">Date Issued
                <input type="date" className="mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500" value={editingPayslip.date_issued} onChange={(e) => setEditingPayslip({ ...editingPayslip, date_issued: e.target.value })} />
              </label>

              <label className="text-sm text-slate-600">Gross Salary
                <input type="number" step="0.01" className="mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500" value={editingPayslip.gross_salary} onChange={(e) => setEditingPayslip({ ...editingPayslip, gross_salary: Number(e.target.value) })} />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-slate-600">Bonuses
                  <input type="number" step="0.01" className="mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm" value={editingPayslip.bonuses ?? 0} onChange={(e) => setEditingPayslip({ ...editingPayslip, bonuses: Number(e.target.value) })} />
                </label>
                <label className="text-sm text-slate-600">Allowances
                  <input type="number" step="0.01" className="mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm" value={editingPayslip.allowances ?? 0} onChange={(e) => setEditingPayslip({ ...editingPayslip, allowances: Number(e.target.value) })} />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <label className="text-sm text-slate-600">SSS
                  <input type="number" step="0.01" className="mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm" value={editingPayslip.sss ?? 0} onChange={(e) => setEditingPayslip({ ...editingPayslip, sss: Number(e.target.value) })} />
                </label>
                <label className="text-sm text-slate-600">Pag-IBIG
                  <input type="number" step="0.01" className="mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm" value={editingPayslip.pagibig ?? 0} onChange={(e) => setEditingPayslip({ ...editingPayslip, pagibig: Number(e.target.value) })} />
                </label>
                <label className="text-sm text-slate-600">PhilHealth
                  <input type="number" step="0.01" className="mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm" value={editingPayslip.philhealth ?? 0} onChange={(e) => setEditingPayslip({ ...editingPayslip, philhealth: Number(e.target.value) })} />
                </label>
                <label className="text-sm text-slate-600">Tax
                  <input type="number" step="0.01" className="mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm" value={editingPayslip.tax ?? 0} onChange={(e) => setEditingPayslip({ ...editingPayslip, tax: Number(e.target.value) })} />
                </label>
                <label className="text-sm text-slate-600">Cash Advance
                  <input type="number" step="0.01" className="mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm" value={editingPayslip.cash_advance ?? 0} onChange={(e) => setEditingPayslip({ ...editingPayslip, cash_advance: Number(e.target.value) })} />
                </label>
                <label className="text-sm text-slate-600">Other Deductions
                  <input type="number" step="0.01" className="mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm" value={editingPayslip.other_deductions ?? 0} onChange={(e) => setEditingPayslip({ ...editingPayslip, other_deductions: Number(e.target.value) })} />
                </label>
              </div>

              <label className="text-sm text-slate-600">Notes
                <input type="text" className="mt-1 w-full rounded-md border-slate-300 text-sm shadow-sm" value={editingPayslip.notes ?? ''} onChange={(e) => setEditingPayslip({ ...editingPayslip, notes: e.target.value })} />
              </label>

              <div className="mt-2 grid grid-cols-3 gap-3 rounded-lg border border-slate-200 p-3 text-sm">
                <div>
                  <div className="text-slate-500">Additions</div>
                  <div className="text-slate-900 font-medium">{moneyFmt(totals.additions)}</div>
                </div>
                <div>
                  <div className="text-slate-500">Deductions</div>
                  <div className="text-slate-900 font-medium">{moneyFmt(totals.deductions)}</div>
                </div>
                <div>
                  <div className="text-slate-500">Net Salary</div>
                  <div className="text-slate-900 font-semibold">{moneyFmt(totals.net)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 text-sm font-medium text-slate-700">Preview</div>
              <div ref={payslipContainerRef}>
                {currentEmployee && <PayslipView employee={currentEmployee} payslip={{ ...editingPayslip, net_salary: totals.net }} />}
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && <div className="text-sm text-slate-600">Loading...</div>}
      {error && <div className="text-sm text-rose-600">{error}</div>}
    </div>
  )
}
