import { useEffect, useMemo, useState } from 'react'
import Pagination from '@/components/Pagination'
import { usePagination } from '@/hooks/usePagination'
import { supabase } from '@/lib/supabase'
import { calculateStatutoryDeductions } from '@/lib/statutoryDeductions'
import type { Employee } from '@/types'

const formatMoney = (amount: number) =>
  `₱ ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function SalaryDeclaration() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [declaredSalaries, setDeclaredSalaries] = useState<Record<string, number>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadEmployees = async () => {
      setLoading(true)
      const { data, error: loadError } = await supabase
        .from('employees')
        .select('*')
        .neq('status', 'terminated')
        .order('name')

      if (loadError) {
        setError(loadError.message)
      } else {
        setEmployees((data ?? []) as Employee[])
      }
      setLoading(false)
    }

    loadEmployees()
  }, [])

  const filteredEmployees = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()
    if (!normalizedSearch) return employees
    return employees.filter((employee) =>
      employee.name.toLowerCase().includes(normalizedSearch) ||
      employee.position?.toLowerCase().includes(normalizedSearch) ||
      employee.department?.toLowerCase().includes(normalizedSearch)
    )
  }, [employees, searchTerm])

  const pagination = usePagination(filteredEmployees)

  const getSalary = (employee: Employee) => declaredSalaries[employee.id] ?? employee.declared_salary ?? employee.base_salary ?? 0

  const totals = useMemo(() => {
    return filteredEmployees.reduce((result, employee) => {
      const deductions = calculateStatutoryDeductions(getSalary(employee))
      return {
        salary: result.salary + deductions.monthlySalary,
        employee: result.employee + deductions.total,
        employer: result.employer + deductions.totalEmployer,
        net: result.net + deductions.netPay,
      }
    }, { salary: 0, employee: 0, employer: 0, net: 0 })
  }, [filteredEmployees, declaredSalaries])

  const setSalary = (employeeId: string, value: string) => {
    setDeclaredSalaries((current) => ({
      ...current,
      [employeeId]: Math.max(0, Number(value) || 0),
    }))
  }

  const saveDeclaredSalary = async (employeeId: string, salary: number) => {
    const { error: saveError } = await supabase
      .from('employees')
      .update({ declared_salary: salary || null })
      .eq('id', employeeId)

    if (saveError) {
      alert(`Unable to save declared salary: ${saveError.message}`)
      return
    }

    setEmployees((current) => current.map((employee) =>
      employee.id === employeeId ? { ...employee, declared_salary: salary || null } : employee
    ))
  }

  const resetSalaries = async () => {
    const results = await Promise.all(employees.map((employee) =>
      supabase.from('employees').update({ declared_salary: null }).eq('id', employee.id)
    ))
    const resetError = results.find((result) => result.error)?.error
    if (resetError) {
      alert(`Unable to reset declared salaries: ${resetError.message}`)
      return
    }
    setDeclaredSalaries({})
    setEmployees((current) => current.map((employee) => ({ ...employee, declared_salary: null })))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Salary Declaration Worksheet</h2>
          <p className="text-sm text-slate-600">Enter each employee’s declared monthly salary to calculate employee and employer statutory contributions.</p>
        </div>
        <button onClick={resetSalaries} className="rounded-md bg-slate-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-700">Reset to Base Salaries</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">Declared salaries</div>
          <div className="mt-1 text-xl font-bold text-blue-950">{formatMoney(totals.salary)}</div>
        </div>
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-rose-700">Employee deductions</div>
          <div className="mt-1 text-xl font-bold text-rose-700">{formatMoney(totals.employee)}</div>
        </div>
        <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Employer contribution</div>
          <div className="mt-1 text-xl font-bold text-amber-700">{formatMoney(totals.employer)}</div>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Estimated net pay</div>
          <div className="mt-1 text-xl font-bold text-emerald-700">{formatMoney(totals.net)}</div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Employee declaration grid</h3>
            <p className="text-sm text-slate-600">Values update instantly and save to the employee declaration when you leave a salary field.</p>
          </div>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => { setSearchTerm(event.target.value); pagination.resetPage() }}
            placeholder="Search employee..."
            className="w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:w-64"
          />
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading employees...</div>
      ) : error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      ) : filteredEmployees.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No employees found.</div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-max w-full border-collapse text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-700">
                <tr>
                  <th className="sticky left-0 z-10 border-b border-r border-slate-200 bg-slate-50 px-3 py-3 text-left">Name</th>
                  <th className="border-b border-slate-200 bg-blue-50 px-3 py-3 text-right">Declared Monthly Salary</th>
                  <th className="border-b border-slate-200 bg-orange-50 px-3 py-3 text-right">SSS Employer</th>
                  <th className="border-b border-slate-200 bg-orange-100 px-3 py-3 text-right">SSS Employee</th>
                  <th className="border-b border-slate-200 bg-lime-50 px-3 py-3 text-right">Pag-IBIG Employer</th>
                  <th className="border-b border-slate-200 bg-lime-100 px-3 py-3 text-right">Pag-IBIG Employee</th>
                  <th className="border-b border-slate-200 bg-sky-50 px-3 py-3 text-right">PhilHealth Employer</th>
                  <th className="border-b border-slate-200 bg-sky-100 px-3 py-3 text-right">PhilHealth Employee</th>
                  <th className="border-b border-slate-200 bg-violet-50 px-3 py-3 text-right">Tax Employee</th>
                  <th className="border-b border-slate-200 bg-rose-50 px-3 py-3 text-right">Total Employee</th>
                  <th className="border-b border-slate-200 bg-amber-50 px-3 py-3 text-right">Total Employer</th>
                  <th className="border-b border-slate-200 bg-emerald-50 px-3 py-3 text-right">Est. Net Pay</th>
                </tr>
              </thead>
              <tbody>
                {pagination.pageItems.map((employee) => {
                  const salary = getSalary(employee)
                  const deductions = calculateStatutoryDeductions(salary)
                  return (
                    <tr key={employee.id} className="hover:bg-slate-50">
                      <td className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-3 py-2.5">
                        <div className="font-medium text-slate-900">{employee.name}</div>
                        <div className="text-xs text-slate-500">{employee.position || employee.department || '—'}</div>
                      </td>
                      <td className="border-b border-slate-100 bg-blue-50/40 px-3 py-2 text-right">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={salary || ''}
                          onChange={(event) => setSalary(employee.id, event.target.value)}
                          onBlur={(event) => saveDeclaredSalary(employee.id, Math.max(0, Number(event.target.value) || 0))}
                          placeholder="0.00"
                          className="w-32 rounded border-blue-200 bg-white px-2 py-1 text-right font-medium text-slate-900 focus:border-blue-500 focus:ring-blue-500"
                        />
                      </td>
                      <td className="border-b border-slate-100 bg-orange-50/40 px-3 py-2 text-right text-slate-700">{formatMoney(deductions.employerSss)}</td>
                      <td className="border-b border-slate-100 bg-orange-100/40 px-3 py-2 text-right text-slate-700">{formatMoney(deductions.sss)}</td>
                      <td className="border-b border-slate-100 bg-lime-50/40 px-3 py-2 text-right text-slate-700">{formatMoney(deductions.employerPagibig)}</td>
                      <td className="border-b border-slate-100 bg-lime-100/40 px-3 py-2 text-right text-slate-700">{formatMoney(deductions.pagibig)}</td>
                      <td className="border-b border-slate-100 bg-sky-50/40 px-3 py-2 text-right text-slate-700">{formatMoney(deductions.employerPhilhealth)}</td>
                      <td className="border-b border-slate-100 bg-sky-100/40 px-3 py-2 text-right text-slate-700">{formatMoney(deductions.philhealth)}</td>
                      <td className="border-b border-slate-100 bg-violet-50/40 px-3 py-2 text-right text-slate-700">{formatMoney(deductions.tax)}</td>
                      <td className="border-b border-slate-100 bg-rose-50/40 px-3 py-2 text-right font-semibold text-rose-700">{formatMoney(deductions.total)}</td>
                      <td className="border-b border-slate-100 bg-amber-50/40 px-3 py-2 text-right font-semibold text-amber-700">{formatMoney(deductions.totalEmployer)}</td>
                      <td className="border-b border-slate-100 bg-emerald-50/40 px-3 py-2 text-right font-semibold text-emerald-700">{formatMoney(deductions.netPay)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalItems={pagination.totalItems}
            totalPages={pagination.totalPages}
            from={pagination.from}
            to={pagination.to}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        </>
      )}
    </div>
  )
}
