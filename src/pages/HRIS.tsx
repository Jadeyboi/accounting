import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Employee } from '@/types'

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return '-'
  const date = new Date(dateString)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const year = date.getFullYear()
  return `${month}-${day}-${year}`
}

export default function HRIS() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null)
  const [activeTab, setActiveTab] = useState<'basic' | 'contact' | 'government'>('basic')
  const [viewingEmployee, setViewingEmployee] = useState<Employee | null>(null)
  const [showViewModal, setShowViewModal] = useState(false)

  // Form fields
  const [firstName, setFirstName] = useState('')
  const [middleName, setMiddleName] = useState('')
  const [lastName, setLastName] = useState('')
  const [position, setPosition] = useState('')
  const [baseSalary, setBaseSalary] = useState('')
  const [employeeNumber, setEmployeeNumber] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [birthdate, setBirthdate] = useState('')
  const [dateHired, setDateHired] = useState('')
  const [department, setDepartment] = useState('')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [emergencyContactName, setEmergencyContactName] = useState('')
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('')
  const [emergencyContactRelationship, setEmergencyContactRelationship] = useState('')
  const [sssNumber, setSssNumber] = useState('')
  const [philhealthNumber, setPhilhealthNumber] = useState('')
  const [pagibigNumber, setPagibigNumber] = useState('')
  const [tinNumber, setTinNumber] = useState('')

  useEffect(() => {
    loadEmployees()
  }, [])

  const loadEmployees = async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (error) {
      setError(error.message)
    } else {
      setEmployees((data ?? []) as Employee[])
    }
    setLoading(false)
  }

  const openModal = (employee?: Employee) => {
    if (employee) {
      setEditingEmployee(employee)
      // Split the name into parts
      const nameParts = employee.name.split(' ')
      if (nameParts.length >= 3) {
        setFirstName(nameParts[0])
        setMiddleName(nameParts.slice(1, -1).join(' '))
        setLastName(nameParts[nameParts.length - 1])
      } else if (nameParts.length === 2) {
        setFirstName(nameParts[0])
        setMiddleName('')
        setLastName(nameParts[1])
      } else {
        setFirstName(employee.name)
        setMiddleName('')
        setLastName('')
      }
      setPosition(employee.position || '')
      setBaseSalary(employee.base_salary?.toString() || '')
      setEmployeeNumber(employee.employee_number || '')
      setEmail(employee.email || '')
      setPhone(employee.phone || '')
      setAddress(employee.address || '')
      setBirthdate(employee.birthdate || '')
      setDateHired(employee.date_hired || '')
      setDepartment(employee.department || '')
      setStatus((employee.status as 'active' | 'inactive') || 'active')
      setEmergencyContactName(employee.emergency_contact_name || '')
      setEmergencyContactPhone(employee.emergency_contact_phone || '')
      setEmergencyContactRelationship(employee.emergency_contact_relationship || '')
      setSssNumber(employee.sss_number || '')
      setPhilhealthNumber(employee.philhealth_number || '')
      setPagibigNumber(employee.pagibig_number || '')
      setTinNumber(employee.tin_number || '')
    } else {
      resetForm()
    }
    setShowModal(true)
  }

  const resetForm = () => {
    setEditingEmployee(null)
    setFirstName('')
    setMiddleName('')
    setLastName('')
    setPosition('')
    setBaseSalary('')
    setEmployeeNumber('')
    setEmail('')
    setPhone('')
    setAddress('')
    setBirthdate('')
    setDateHired('')
    setDepartment('')
    setStatus('active')
    setEmergencyContactName('')
    setEmergencyContactPhone('')
    setEmergencyContactRelationship('')
    setSssNumber('')
    setPhilhealthNumber('')
    setPagibigNumber('')
    setTinNumber('')
  }

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      alert('First name and last name are required')
      return
    }

    // Combine name parts
    const fullName = [firstName.trim(), middleName.trim(), lastName.trim()]
      .filter(part => part)
      .join(' ')

    // Auto-generate employee number if creating new employee and no number provided
    let finalEmployeeNumber = employeeNumber.trim()
    if (!editingEmployee && !finalEmployeeNumber) {
      // Get the highest employee number
      const { data: existingEmployees } = await supabase
        .from('employees')
        .select('employee_number')
        .not('employee_number', 'is', null)
        .order('created_at', { ascending: false })
      
      // Extract numbers and find the highest
      const numbers = existingEmployees
        ?.map(emp => {
          const match = emp.employee_number?.match(/EMP-(\d+)/)
          return match ? parseInt(match[1]) : 0
        })
        .filter(num => num > 0) || []
      
      const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1
      finalEmployeeNumber = `EMP-${String(nextNumber).padStart(4, '0')}`
    }

    const payload: Partial<Employee> = {
      name: fullName,
      position: position.trim() || null,
      base_salary: baseSalary ? Number(baseSalary) : null,
      employee_number: finalEmployeeNumber || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      address: address.trim() || null,
      birthdate: birthdate || null,
      date_hired: dateHired || null,
      department: department.trim() || null,
      status: status,
      emergency_contact_name: emergencyContactName.trim() || null,
      emergency_contact_phone: emergencyContactPhone.trim() || null,
      emergency_contact_relationship: emergencyContactRelationship.trim() || null,
      sss_number: sssNumber.trim() || null,
      philhealth_number: philhealthNumber.trim() || null,
      pagibig_number: pagibigNumber.trim() || null,
      tin_number: tinNumber.trim() || null,
    }

    if (editingEmployee) {
      const { error } = await supabase
        .from('employees')
        .update(payload)
        .eq('id', editingEmployee.id)
      
      if (error) {
        alert(error.message)
        return
      }
    } else {
      const { error } = await supabase
        .from('employees')
        .insert(payload)
      
      if (error) {
        alert(error.message)
        return
      }
    }

    setShowModal(false)
    resetForm()
    await loadEmployees()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this employee? This will also delete all associated payslips.')) {
      return
    }

    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', id)
    
    if (error) {
      alert(error.message)
      return
    }

    await loadEmployees()
  }

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.position && emp.position.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const activeEmployees = filteredEmployees.length
  const totalSalary = filteredEmployees.reduce((sum, emp) => sum + (emp.base_salary || 0), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">HRIS - Employee Management</h2>
          <p className="text-sm text-gray-600">Manage employee information and records</p>
        </div>
        <button
          onClick={() => openModal()}
          className="btn-primary"
        >
          + Add Employee
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-hover rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-600">Total Employees</p>
              <p className="mt-2 text-3xl font-bold text-blue-900">{activeEmployees}</p>
            </div>
            <div className="rounded-full bg-blue-200 p-3">
              <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card-hover rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-green-100 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-600">Total Payroll</p>
              <p className="mt-2 text-3xl font-bold text-green-900">₱{totalSalary.toLocaleString()}</p>
            </div>
            <div className="rounded-full bg-green-200 p-3">
              <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="card-hover rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100 p-6 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-600">Avg. Salary</p>
              <p className="mt-2 text-3xl font-bold text-purple-900">
                ₱{activeEmployees > 0 ? Math.round(totalSalary / activeEmployees).toLocaleString() : 0}
              </p>
            </div>
            <div className="rounded-full bg-purple-200 p-3">
              <svg className="h-8 w-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search employees by name or position..."
          className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Employee List */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Position</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Base Salary</th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                    <div className="loading-shimmer mx-auto h-8 w-48 rounded"></div>
                  </td>
                </tr>
              )}
              {error && !loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-red-600">{error}</td>
                </tr>
              )}
              {!loading && !error && filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-sm text-gray-500">
                    {searchTerm ? 'No employees found matching your search' : 'No employees yet. Add your first employee!'}
                  </td>
                </tr>
              )}
              {!loading && !error && filteredEmployees.map((employee) => (
                <tr key={employee.id} className="table-row-hover">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 font-semibold">
                        {employee.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="ml-4">
                        <button
                          onClick={() => { setViewingEmployee(employee); setShowViewModal(true); }}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {employee.name}
                        </button>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{employee.position || '-'}</td>
                  <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                    {employee.base_salary ? `₱${employee.base_salary.toLocaleString()}` : '-'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="badge-success">Active</span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    <button
                      onClick={() => openModal(employee)}
                      className="mr-3 text-blue-600 hover:text-blue-800"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(employee.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 pt-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-2xl font-bold text-gray-900">
                  {editingEmployee ? 'Edit Employee' : 'Add New Employee'}
                </h3>
                <button
                  onClick={() => { setShowModal(false); resetForm(); setActiveTab('basic'); }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveTab('basic')}
                  className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'basic'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Basic Info
                </button>
                <button
                  onClick={() => setActiveTab('contact')}
                  className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'contact'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Contact & Emergency
                </button>
                <button
                  onClick={() => setActiveTab('government')}
                  className={`rounded-t-lg px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'government'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Government IDs
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Basic Info Tab */}
              {activeTab === 'basic' && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">First Name *</label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        placeholder="John"
                        className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Middle Name</label>
                      <input
                        type="text"
                        value={middleName}
                        onChange={(e) => setMiddleName(e.target.value)}
                        placeholder="Michael"
                        className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Last Name *</label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        placeholder="Doe"
                        className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">
                        Employee Number {!editingEmployee && <span className="text-xs text-gray-500">(Auto-generated)</span>}
                      </label>
                      <input
                        type="text"
                        value={employeeNumber}
                        onChange={(e) => setEmployeeNumber(e.target.value)}
                        placeholder={editingEmployee ? "EMP-0001" : "Will be auto-generated"}
                        readOnly={!editingEmployee}
                        className={`w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 ${
                          !editingEmployee ? 'bg-gray-100 cursor-not-allowed' : ''
                        }`}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Position</label>
                      <input
                        type="text"
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        placeholder="Software Developer"
                        className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Department</label>
                      <input
                        type="text"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        placeholder="Engineering"
                        className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Base Salary</label>
                      <input
                        type="number"
                        value={baseSalary}
                        onChange={(e) => setBaseSalary(e.target.value)}
                        placeholder="25000"
                        className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                        className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Birthdate</label>
                      <input
                        type="date"
                        value={birthdate}
                        onChange={(e) => setBirthdate(e.target.value)}
                        className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Date Hired</label>
                      <input
                        type="date"
                        value={dateHired}
                        onChange={(e) => setDateHired(e.target.value)}
                        className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Contact & Emergency Tab */}
              {activeTab === 'contact' && (
                <div className="space-y-4">
                  <h4 className="text-lg font-semibold text-gray-900">Contact Information</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="john@example.com"
                        className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="09123456789"
                        className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Address</label>
                    <textarea
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Complete address"
                      rows={3}
                      className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <h4 className="mt-6 text-lg font-semibold text-gray-900">Emergency Contact</h4>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Contact Name</label>
                      <input
                        type="text"
                        value={emergencyContactName}
                        onChange={(e) => setEmergencyContactName(e.target.value)}
                        placeholder="Jane Doe"
                        className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Contact Phone</label>
                      <input
                        type="tel"
                        value={emergencyContactPhone}
                        onChange={(e) => setEmergencyContactPhone(e.target.value)}
                        placeholder="09987654321"
                        className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Relationship</label>
                    <input
                      type="text"
                      value={emergencyContactRelationship}
                      onChange={(e) => setEmergencyContactRelationship(e.target.value)}
                      placeholder="Spouse, Parent, Sibling, etc."
                      className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* Government IDs Tab */}
              {activeTab === 'government' && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">SSS Number</label>
                      <input
                        type="text"
                        value={sssNumber}
                        onChange={(e) => setSssNumber(e.target.value)}
                        placeholder="XX-XXXXXXX-X"
                        className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">PhilHealth Number</label>
                      <input
                        type="text"
                        value={philhealthNumber}
                        onChange={(e) => setPhilhealthNumber(e.target.value)}
                        placeholder="XX-XXXXXXXXX-X"
                        className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Pag-IBIG Number</label>
                      <input
                        type="text"
                        value={pagibigNumber}
                        onChange={(e) => setPagibigNumber(e.target.value)}
                        placeholder="XXXX-XXXX-XXXX"
                        className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">TIN Number</label>
                      <input
                        type="text"
                        value={tinNumber}
                        onChange={(e) => setTinNumber(e.target.value)}
                        placeholder="XXX-XXX-XXX-XXX"
                        className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="mt-4 rounded-lg bg-blue-50 p-4">
                    <p className="text-sm text-blue-800">
                      <strong>Note:</strong> Government ID numbers are confidential. Ensure proper data security and compliance with privacy regulations.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 border-t border-gray-200 bg-gray-50 px-6 py-4">
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowModal(false); resetForm(); setActiveTab('basic'); }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="btn-primary"
                >
                  {editingEmployee ? 'Update Employee' : 'Add Employee'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Employee Details Modal */}
      {showViewModal && viewingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-2xl font-bold text-blue-600">
                    {viewingEmployee.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">{viewingEmployee.name}</h3>
                    <p className="text-blue-100">{viewingEmployee.position || 'No position assigned'}</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowViewModal(false); setViewingEmployee(null); }}
                  className="text-white hover:text-blue-100"
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Basic Information Section */}
              <div className="mb-6 rounded-xl border border-gray-200 bg-gradient-to-br from-blue-50 to-white p-6">
                <h4 className="mb-4 flex items-center text-lg font-bold text-gray-900">
                  <svg className="mr-2 h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Basic Information
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Employee Number</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{viewingEmployee.employee_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Department</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{viewingEmployee.department || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Base Salary</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {viewingEmployee.base_salary ? `₱${viewingEmployee.base_salary.toLocaleString()}` : '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Status</p>
                    <p className="mt-1">
                      <span className={viewingEmployee.status === 'active' ? 'badge-success' : 'badge-error'}>
                        {viewingEmployee.status || 'Active'}
                      </span>
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Birthdate</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{formatDate(viewingEmployee.birthdate)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Date Hired</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{formatDate(viewingEmployee.date_hired)}</p>
                  </div>
                </div>
              </div>

              {/* Contact Information Section */}
              <div className="mb-6 rounded-xl border border-gray-200 bg-gradient-to-br from-green-50 to-white p-6">
                <h4 className="mb-4 flex items-center text-lg font-bold text-gray-900">
                  <svg className="mr-2 h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Contact Information
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Email</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{viewingEmployee.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Phone</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{viewingEmployee.phone || '-'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Address</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{viewingEmployee.address || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Emergency Contact Section */}
              <div className="mb-6 rounded-xl border border-gray-200 bg-gradient-to-br from-orange-50 to-white p-6">
                <h4 className="mb-4 flex items-center text-lg font-bold text-gray-900">
                  <svg className="mr-2 h-5 w-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Emergency Contact
                </h4>
                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Contact Name</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{viewingEmployee.emergency_contact_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Contact Phone</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{viewingEmployee.emergency_contact_phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Relationship</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{viewingEmployee.emergency_contact_relationship || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Government IDs Section */}
              <div className="rounded-xl border border-gray-200 bg-gradient-to-br from-purple-50 to-white p-6">
                <h4 className="mb-4 flex items-center text-lg font-bold text-gray-900">
                  <svg className="mr-2 h-5 w-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
                  </svg>
                  Government IDs
                </h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">SSS Number</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{viewingEmployee.sss_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">PhilHealth Number</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{viewingEmployee.philhealth_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Pag-IBIG Number</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{viewingEmployee.pagibig_number || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">TIN Number</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{viewingEmployee.tin_number || '-'}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 border-t border-gray-200 bg-gray-50 px-6 py-4">
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowViewModal(false); setViewingEmployee(null); }}
                  className="btn-secondary"
                >
                  Close
                </button>
                <button
                  onClick={() => { 
                    setShowViewModal(false); 
                    openModal(viewingEmployee);
                    setViewingEmployee(null);
                  }}
                  className="btn-primary"
                >
                  Edit Employee
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
