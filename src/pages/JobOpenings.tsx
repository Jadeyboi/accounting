import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { JobOpening } from '@/types'

const formatDate = (d: string | null | undefined) => {
  if (!d) return '-'
  const date = new Date(d)
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${date.getFullYear()}`
}

const employmentTypeLabel: Record<string, string> = {
  full_time: 'Full Time',
  part_time: 'Part Time',
  contract: 'Contract',
  internship: 'Internship',
}

const statusColors: Record<string, string> = {
  open: 'bg-green-100 text-green-700',
  closed: 'bg-red-100 text-red-700',
  on_hold: 'bg-yellow-100 text-yellow-700',
}

export default function JobOpenings() {
  const [jobs, setJobs] = useState<JobOpening[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [showModal, setShowModal] = useState(false)
  const [editingJob, setEditingJob] = useState<JobOpening | null>(null)
  const [viewingJob, setViewingJob] = useState<JobOpening | null>(null)
  const [showViewModal, setShowViewModal] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [department, setDepartment] = useState('')
  const [employmentType, setEmploymentType] = useState<string>('')
  const [location, setLocation] = useState('')
  const [salaryMin, setSalaryMin] = useState('')
  const [salaryMax, setSalaryMax] = useState('')
  const [description, setDescription] = useState('')
  const [requirements, setRequirements] = useState('')
  const [responsibilities, setResponsibilities] = useState('')
  const [status, setStatus] = useState<'open' | 'closed' | 'on_hold'>('open')
  const [postedBy, setPostedBy] = useState('')
  const [deadline, setDeadline] = useState('')
  const [slots, setSlots] = useState('1')

  useEffect(() => { loadJobs() }, [])

  const loadJobs = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('job_openings')
      .select('*')
      .order('created_at', { ascending: false })
    setJobs((data ?? []) as JobOpening[])
    setLoading(false)
  }

  const resetForm = () => {
    setEditingJob(null)
    setTitle(''); setDepartment(''); setEmploymentType(''); setLocation('')
    setSalaryMin(''); setSalaryMax(''); setDescription(''); setRequirements('')
    setResponsibilities(''); setStatus('open'); setPostedBy(''); setDeadline(''); setSlots('1')
  }

  const openModal = (job?: JobOpening) => {
    if (job) {
      setEditingJob(job)
      setTitle(job.title)
      setDepartment(job.department || '')
      setEmploymentType(job.employment_type || '')
      setLocation(job.location || '')
      setSalaryMin(job.salary_min?.toString() || '')
      setSalaryMax(job.salary_max?.toString() || '')
      setDescription(job.description || '')
      setRequirements(job.requirements || '')
      setResponsibilities(job.responsibilities || '')
      setStatus(job.status)
      setPostedBy(job.posted_by || '')
      setDeadline(job.deadline || '')
      setSlots(job.slots?.toString() || '1')
    } else {
      resetForm()
    }
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!title.trim()) { alert('Job title is required'); return }
    const payload = {
      title: title.trim(),
      department: department.trim() || null,
      employment_type: employmentType || null,
      location: location.trim() || null,
      salary_min: salaryMin ? Number(salaryMin) : null,
      salary_max: salaryMax ? Number(salaryMax) : null,
      description: description.trim() || null,
      requirements: requirements.trim() || null,
      responsibilities: responsibilities.trim() || null,
      status,
      posted_by: postedBy.trim() || null,
      deadline: deadline || null,
      slots: slots ? Number(slots) : 1,
      updated_at: new Date().toISOString(),
    }
    if (editingJob) {
      const { error } = await supabase.from('job_openings').update(payload).eq('id', editingJob.id)
      if (error) { alert(error.message); return }
    } else {
      const { error } = await supabase.from('job_openings').insert(payload)
      if (error) { alert(error.message); return }
    }
    setShowModal(false)
    resetForm()
    await loadJobs()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this job opening?')) return
    await supabase.from('job_openings').delete().eq('id', id)
    await loadJobs()
  }

  const filtered = jobs.filter(j => {
    const matchSearch = j.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (j.department?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
    const matchStatus = filterStatus === 'all' || j.status === filterStatus
    return matchSearch && matchStatus
  })

  const openCount = jobs.filter(j => j.status === 'open').length
  const closedCount = jobs.filter(j => j.status === 'closed').length
  const onHoldCount = jobs.filter(j => j.status === 'on_hold').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Job Openings</h2>
          <p className="text-sm text-gray-600">Manage company job postings and vacancies</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary">+ Post Job</button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card-hover rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-green-100 p-6 shadow-lg">
          <p className="text-sm font-medium text-green-600">Open Positions</p>
          <p className="mt-2 text-3xl font-bold text-green-900">{openCount}</p>
        </div>
        <div className="card-hover rounded-xl border border-yellow-200 bg-gradient-to-br from-yellow-50 to-yellow-100 p-6 shadow-lg">
          <p className="text-sm font-medium text-yellow-600">On Hold</p>
          <p className="mt-2 text-3xl font-bold text-yellow-900">{onHoldCount}</p>
        </div>
        <div className="card-hover rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-red-100 p-6 shadow-lg">
          <p className="text-sm font-medium text-red-600">Closed</p>
          <p className="mt-2 text-3xl font-bold text-red-900">{closedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by title or department..."
          className="flex-1 min-w-48 rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="on_hold">On Hold</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {/* Job List */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Position</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Department</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Salary Range</th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">Slots</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-600">Deadline</th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-600">Status</th>
                <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {loading && (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">Loading...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">
                  {searchTerm || filterStatus !== 'all' ? 'No jobs match your filters.' : 'No job openings yet. Post your first one!'}
                </td></tr>
              )}
              {!loading && filtered.map((job) => (
                <tr key={job.id} className="table-row-hover">
                  <td className="px-6 py-4">
                    <button
                      onClick={() => { setViewingJob(job); setShowViewModal(true) }}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline text-left"
                    >
                      {job.title}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{job.department || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {job.employment_type ? employmentTypeLabel[job.employment_type] : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {job.salary_min || job.salary_max
                      ? `₱${job.salary_min?.toLocaleString() ?? '?'} – ₱${job.salary_max?.toLocaleString() ?? '?'}`
                      : 'Negotiable'}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-700">{job.slots ?? 1}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{formatDate(job.deadline)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusColors[job.status]}`}>
                      {job.status === 'on_hold' ? 'On Hold' : job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    <button onClick={() => openModal(job)} className="mr-3 text-blue-600 hover:text-blue-800">Edit</button>
                    <button onClick={() => handleDelete(job.id)} className="text-red-600 hover:text-red-800">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">{editingJob ? 'Edit Job Opening' : 'Post New Job'}</h3>
                <button onClick={() => { setShowModal(false); resetForm() }} className="text-gray-400 hover:text-gray-600">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Job Title *</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Senior Software Developer"
                  className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Department</label>
                  <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Engineering"
                    className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Employment Type</label>
                  <select value={employmentType} onChange={(e) => setEmploymentType(e.target.value)}
                    className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500">
                    <option value="">Select type...</option>
                    <option value="full_time">Full Time</option>
                    <option value="part_time">Part Time</option>
                    <option value="contract">Contract</option>
                    <option value="internship">Internship</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Location</label>
                  <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Cebu City / Remote"
                    className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Number of Slots</label>
                  <input type="number" value={slots} onChange={(e) => setSlots(e.target.value)} min="1"
                    className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Salary Min (₱)</label>
                  <input type="number" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)}
                    placeholder="20000"
                    className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Salary Max (₱)</label>
                  <input type="number" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)}
                    placeholder="40000"
                    className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Application Deadline</label>
                  <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                    className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value as 'open' | 'closed' | 'on_hold')}
                    className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500">
                    <option value="open">Open</option>
                    <option value="on_hold">On Hold</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Posted By</label>
                <input type="text" value={postedBy} onChange={(e) => setPostedBy(e.target.value)}
                  placeholder="HR Manager name"
                  className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Job Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the role..."
                  rows={4}
                  className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Responsibilities</label>
                <textarea value={responsibilities} onChange={(e) => setResponsibilities(e.target.value)}
                  placeholder="List key responsibilities..."
                  rows={4}
                  className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Requirements</label>
                <textarea value={requirements} onChange={(e) => setRequirements(e.target.value)}
                  placeholder="List qualifications and requirements..."
                  rows={4}
                  className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
              <button onClick={() => { setShowModal(false); resetForm() }} className="btn-secondary">Cancel</button>
              <button onClick={handleSave} className="btn-primary">{editingJob ? 'Update Job' : 'Post Job'}</button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {showViewModal && viewingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">{viewingJob.title}</h3>
                  <p className="mt-1 text-blue-100 text-sm">{viewingJob.department || 'No department'}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {viewingJob.employment_type && (
                      <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white">
                        {employmentTypeLabel[viewingJob.employment_type]}
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[viewingJob.status]}`}>
                      {viewingJob.status === 'on_hold' ? 'On Hold' : viewingJob.status.charAt(0).toUpperCase() + viewingJob.status.slice(1)}
                    </span>
                  </div>
                </div>
                <button onClick={() => { setShowViewModal(false); setViewingJob(null) }} className="text-white hover:text-blue-100">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="space-y-5 p-6">
              <div className="grid gap-4 md:grid-cols-2 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Location</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{viewingJob.location || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Slots Available</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{viewingJob.slots ?? 1}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Salary Range</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {viewingJob.salary_min || viewingJob.salary_max
                      ? `₱${viewingJob.salary_min?.toLocaleString() ?? '?'} – ₱${viewingJob.salary_max?.toLocaleString() ?? '?'}`
                      : 'Negotiable'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Application Deadline</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{formatDate(viewingJob.deadline)}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Posted By</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{viewingJob.posted_by || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Date Posted</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{formatDate(viewingJob.created_at)}</p>
                </div>
              </div>
              {viewingJob.description && (
                <div>
                  <h4 className="mb-2 text-sm font-bold text-gray-900">Job Description</h4>
                  <p className="whitespace-pre-wrap text-sm text-gray-700">{viewingJob.description}</p>
                </div>
              )}
              {viewingJob.responsibilities && (
                <div>
                  <h4 className="mb-2 text-sm font-bold text-gray-900">Responsibilities</h4>
                  <p className="whitespace-pre-wrap text-sm text-gray-700">{viewingJob.responsibilities}</p>
                </div>
              )}
              {viewingJob.requirements && (
                <div>
                  <h4 className="mb-2 text-sm font-bold text-gray-900">Requirements</h4>
                  <p className="whitespace-pre-wrap text-sm text-gray-700">{viewingJob.requirements}</p>
                </div>
              )}
            </div>
            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
              <button onClick={() => { setShowViewModal(false); setViewingJob(null) }} className="btn-secondary">Close</button>
              <button onClick={() => { setShowViewModal(false); openModal(viewingJob); setViewingJob(null) }} className="btn-primary">Edit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
