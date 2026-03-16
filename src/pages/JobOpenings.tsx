import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { JobOpening, Applicant } from '@/types'

const formatDate = (d: string | null | undefined) => {
  if (!d) return '-'
  const date = new Date(d)
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}-${date.getFullYear()}`
}

const employmentTypeLabel: Record<string, string> = {
  full_time: 'Full Time', part_time: 'Part Time', contract: 'Contract', internship: 'Internship',
}

const statusColors: Record<string, string> = {
  open: 'bg-green-100 text-green-700', closed: 'bg-red-100 text-red-700', on_hold: 'bg-yellow-100 text-yellow-700',
}

const applicantStatusColors: Record<string, string> = {
  new: 'bg-blue-100 text-blue-700', reviewing: 'bg-purple-100 text-purple-700',
  interview: 'bg-yellow-100 text-yellow-700', offer: 'bg-orange-100 text-orange-700',
  hired: 'bg-green-100 text-green-700', rejected: 'bg-red-100 text-red-700',
}

// Extract just the storage path from cv_url (handles both old full URLs and new paths)
const getCvPath = (cv_url: string): string => {
  if (cv_url.startsWith('http')) {
    // Old format: extract filename after /cvs/
    const match = cv_url.match(/\/cvs\/(.+)$/)
    return match ? match[1] : cv_url
  }
  return cv_url
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
  // Applicants
  const [applicants, setApplicants] = useState<Applicant[]>([])
  const [loadingApplicants, setLoadingApplicants] = useState(false)
  const [showApplicantModal, setShowApplicantModal] = useState(false)
  const [editingApplicant, setEditingApplicant] = useState<Applicant | null>(null)
  const [viewingApplicant, setViewingApplicant] = useState<Applicant | null>(null)
  const [showApplicantView, setShowApplicantView] = useState(false)
  const [uploadingCV, setUploadingCV] = useState(false)
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [signedCvUrl, setSignedCvUrl] = useState<string | null>(null)
  // Applicant form
  const [appFirstName, setAppFirstName] = useState('')
  const [appLastName, setAppLastName] = useState('')
  const [appEmail, setAppEmail] = useState('')
  const [appPhone, setAppPhone] = useState('')
  const [appAddress, setAppAddress] = useState('')
  const [appExpectedSalary, setAppExpectedSalary] = useState('')
  const [appAvailableStart, setAppAvailableStart] = useState('')
  const [appHybridComfortable, setAppHybridComfortable] = useState(false)
  const [appStatus, setAppStatus] = useState<Applicant['status']>('new')
  const [appNotes, setAppNotes] = useState('')
  const [appAppliedDate, setAppAppliedDate] = useState('')

  // Job form state
  const [title, setTitle] = useState('')
  const [department, setDepartment] = useState('')
  const [employmentType, setEmploymentType] = useState<string>('')
  const [location, setLocation] = useState('')
  const [salaryMin, setSalaryMin] = useState('')
  const [salaryMax, setSalaryMax] = useState('')
  const [description, setDescription] = useState('')
  const [requirements, setRequirements] = useState('')
  const [responsibilities, setResponsibilities] = useState('')
  const [jobStatus, setJobStatus] = useState<'open' | 'closed' | 'on_hold'>('open')
  const [postedBy, setPostedBy] = useState('')
  const [deadline, setDeadline] = useState('')
  const [slots, setSlots] = useState('1')

  useEffect(() => { loadJobs() }, [])

  const loadJobs = async () => {
    setLoading(true)
    const { data } = await supabase.from('job_openings').select('*').order('created_at', { ascending: false })
    setJobs((data ?? []) as JobOpening[])
    setLoading(false)
  }

  const loadApplicants = async (jobId: string) => {
    setLoadingApplicants(true)
    const { data } = await supabase.from('applicants').select('*').eq('job_opening_id', jobId).order('created_at', { ascending: false })
    setApplicants((data ?? []) as Applicant[])
    setLoadingApplicants(false)
  }

  const resetJobForm = () => {
    setEditingJob(null); setTitle(''); setDepartment(''); setEmploymentType(''); setLocation('')
    setSalaryMin(''); setSalaryMax(''); setDescription(''); setRequirements('')
    setResponsibilities(''); setJobStatus('open'); setPostedBy(''); setDeadline(''); setSlots('1')
  }

  const resetApplicantForm = () => {
    setEditingApplicant(null); setCvFile(null)
    setAppFirstName(''); setAppLastName(''); setAppEmail(''); setAppPhone(''); setAppAddress('')
    setAppExpectedSalary(''); setAppAvailableStart(''); setAppHybridComfortable(false)
    setAppStatus('new'); setAppNotes(''); setAppAppliedDate(new Date().toISOString().split('T')[0])
  }

  const openJobModal = (job?: JobOpening) => {
    if (job) {
      setEditingJob(job); setTitle(job.title); setDepartment(job.department || '')
      setEmploymentType(job.employment_type || ''); setLocation(job.location || '')
      setSalaryMin(job.salary_min?.toString() || ''); setSalaryMax(job.salary_max?.toString() || '')
      setDescription(job.description || ''); setRequirements(job.requirements || '')
      setResponsibilities(job.responsibilities || ''); setJobStatus(job.status)
      setPostedBy(job.posted_by || ''); setDeadline(job.deadline || ''); setSlots(job.slots?.toString() || '1')
    } else { resetJobForm() }
    setShowModal(true)
  }

  const openApplicantModal = (applicant?: Applicant) => {
    if (applicant) {
      setEditingApplicant(applicant); setAppFirstName(applicant.first_name); setAppLastName(applicant.last_name)
      setAppEmail(applicant.email || ''); setAppPhone(applicant.phone || ''); setAppAddress(applicant.address || '')
      setAppExpectedSalary(applicant.expected_salary?.toString() || '')
      setAppAvailableStart(applicant.available_start || ''); setAppHybridComfortable(applicant.hybrid_comfortable ?? false)
      setAppStatus(applicant.status); setAppNotes(applicant.notes || '')
      setAppAppliedDate(applicant.applied_date || new Date().toISOString().split('T')[0])
    } else { resetApplicantForm() }
    setShowApplicantModal(true)
  }

  const handleSaveJob = async () => {
    if (!title.trim()) { alert('Job title is required'); return }
    const payload = {
      title: title.trim(), department: department.trim() || null, employment_type: employmentType || null,
      location: location.trim() || null, salary_min: salaryMin ? Number(salaryMin) : null,
      salary_max: salaryMax ? Number(salaryMax) : null, description: description.trim() || null,
      requirements: requirements.trim() || null, responsibilities: responsibilities.trim() || null,
      status: jobStatus, posted_by: postedBy.trim() || null, deadline: deadline || null,
      slots: slots ? Number(slots) : 1, updated_at: new Date().toISOString(),
    }
    if (editingJob) {
      const { error } = await supabase.from('job_openings').update(payload).eq('id', editingJob.id)
      if (error) { alert(error.message); return }
    } else {
      const { error } = await supabase.from('job_openings').insert(payload)
      if (error) { alert(error.message); return }
    }
    setShowModal(false); resetJobForm(); await loadJobs()
  }

  const handleSaveApplicant = async () => {
    if (!appFirstName.trim() || !appLastName.trim()) { alert('First and last name are required'); return }
    if (!viewingJob) return
    let cv_url: string | null = editingApplicant?.cv_url ?? null
    if (cvFile) {
      setUploadingCV(true)
      try {
        const ext = cvFile.name.split('.').pop()
        const fileName = `cv-${Date.now()}.${ext}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('cvs').upload(fileName, cvFile, { cacheControl: '3600', upsert: false })
        if (uploadError) throw uploadError
        // Store the storage path, not a public URL
        cv_url = uploadData.path
      } catch (err: any) {
        alert(err.message || 'CV upload failed'); setUploadingCV(false); return
      }
      setUploadingCV(false)
    }
    const payload = {
      job_opening_id: viewingJob.id,
      first_name: appFirstName.trim(), last_name: appLastName.trim(),
      email: appEmail.trim() || null, phone: appPhone.trim() || null, address: appAddress.trim() || null,
      expected_salary: appExpectedSalary ? Number(appExpectedSalary) : null,
      available_start: appAvailableStart.trim() || null, hybrid_comfortable: appHybridComfortable,
      cv_url, status: appStatus, notes: appNotes.trim() || null,
      applied_date: appAppliedDate || new Date().toISOString().split('T')[0],
      updated_at: new Date().toISOString(),
    }
    if (editingApplicant) {
      const { error } = await supabase.from('applicants').update(payload).eq('id', editingApplicant.id)
      if (error) { alert(error.message); return }
    } else {
      const { error } = await supabase.from('applicants').insert(payload)
      if (error) { alert(error.message); return }
    }
    setShowApplicantModal(false); resetApplicantForm(); await loadApplicants(viewingJob.id)
  }

  const handleDeleteJob = async (id: string) => {
    if (!confirm('Delete this job opening?')) return
    await supabase.from('job_openings').delete().eq('id', id)
    await loadJobs()
  }

  const handleDeleteApplicant = async (id: string) => {
    if (!confirm('Delete this applicant?')) return
    await supabase.from('applicants').delete().eq('id', id)
    if (viewingJob) await loadApplicants(viewingJob.id)
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

  const navLink = `rounded-lg px-4 py-2 font-medium transition-all`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Job Openings</h2>
          <p className="text-sm text-gray-600">Manage company job postings and applicants</p>
        </div>
        <button onClick={() => openJobModal()} className="btn-primary">+ Post Job</button>
      </div>

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

      <div className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by title or department..."
          className="flex-1 min-w-48 rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500">
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="on_hold">On Hold</option>
          <option value="closed">Closed</option>
        </select>
      </div>

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
              {loading && <tr><td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">Loading...</td></tr>}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500">
                  {searchTerm || filterStatus !== 'all' ? 'No jobs match your filters.' : 'No job openings yet. Post your first one!'}
                </td></tr>
              )}
              {!loading && filtered.map((job) => (
                <tr key={job.id} className="table-row-hover">
                  <td className="px-6 py-4">
                    <button onClick={() => { setViewingJob(job); setShowViewModal(true); loadApplicants(job.id) }}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline text-left">
                      {job.title}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700">{job.department || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{job.employment_type ? employmentTypeLabel[job.employment_type] : '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">
                    {job.salary_min || job.salary_max ? `₱${job.salary_min?.toLocaleString() ?? '?'} – ₱${job.salary_max?.toLocaleString() ?? '?'}` : 'Negotiable'}
                  </td>
                  <td className="px-6 py-4 text-center text-sm text-gray-700">{job.slots ?? 1}</td>
                  <td className="px-6 py-4 text-sm text-gray-700">{formatDate(job.deadline)}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusColors[job.status]}`}>
                      {job.status === 'on_hold' ? 'On Hold' : job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm">
                    <button onClick={() => openJobModal(job)} className="mr-3 text-blue-600 hover:text-blue-800">Edit</button>
                    <button onClick={() => handleDeleteJob(job.id)} className="text-red-600 hover:text-red-800">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Job Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-5 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">{editingJob ? 'Edit Job Opening' : 'Post New Job'}</h3>
              <button onClick={() => { setShowModal(false); resetJobForm() }} className="text-gray-400 hover:text-gray-600">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Job Title *</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Senior Software Developer"
                  className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Department</label>
                  <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Engineering"
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
                  <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Cebu City / Remote"
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
                  <input type="number" value={salaryMin} onChange={(e) => setSalaryMin(e.target.value)} placeholder="20000"
                    className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Salary Max (₱)</label>
                  <input type="number" value={salaryMax} onChange={(e) => setSalaryMax(e.target.value)} placeholder="40000"
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
                  <select value={jobStatus} onChange={(e) => setJobStatus(e.target.value as 'open' | 'closed' | 'on_hold')}
                    className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500">
                    <option value="open">Open</option>
                    <option value="on_hold">On Hold</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Posted By</label>
                <input type="text" value={postedBy} onChange={(e) => setPostedBy(e.target.value)} placeholder="HR Manager name"
                  className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Job Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the role..." rows={3}
                  className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Responsibilities</label>
                <textarea value={responsibilities} onChange={(e) => setResponsibilities(e.target.value)} placeholder="List key responsibilities..." rows={3}
                  className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Requirements</label>
                <textarea value={requirements} onChange={(e) => setRequirements(e.target.value)} placeholder="List qualifications..." rows={3}
                  className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
              <button onClick={() => { setShowModal(false); resetJobForm() }} className="btn-secondary">Cancel</button>
              <button onClick={handleSaveJob} className="btn-primary">{editingJob ? 'Update Job' : 'Post Job'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Job View Modal with Applicants */}
      {showViewModal && viewingJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">{viewingJob.title}</h3>
                  <p className="mt-1 text-blue-100 text-sm">{viewingJob.department || 'No department'}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {viewingJob.employment_type && (
                      <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white">{employmentTypeLabel[viewingJob.employment_type]}</span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[viewingJob.status]}`}>
                      {viewingJob.status === 'on_hold' ? 'On Hold' : viewingJob.status.charAt(0).toUpperCase() + viewingJob.status.slice(1)}
                    </span>
                  </div>
                </div>
                <button onClick={() => { setShowViewModal(false); setViewingJob(null) }} className="text-white hover:text-blue-100">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="space-y-5 p-6">
              <div className="grid gap-4 md:grid-cols-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Location</p><p className="mt-1 text-sm font-medium text-gray-900">{viewingJob.location || '-'}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Slots</p><p className="mt-1 text-sm font-medium text-gray-900">{viewingJob.slots ?? 1}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Salary Range</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    {viewingJob.salary_min || viewingJob.salary_max ? `₱${viewingJob.salary_min?.toLocaleString() ?? '?'} – ₱${viewingJob.salary_max?.toLocaleString() ?? '?'}` : 'Negotiable'}
                  </p>
                </div>
                <div><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Deadline</p><p className="mt-1 text-sm font-medium text-gray-900">{formatDate(viewingJob.deadline)}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Posted By</p><p className="mt-1 text-sm font-medium text-gray-900">{viewingJob.posted_by || '-'}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Date Posted</p><p className="mt-1 text-sm font-medium text-gray-900">{formatDate(viewingJob.created_at)}</p></div>
              </div>
              {viewingJob.description && <div><h4 className="mb-2 text-sm font-bold text-gray-900">Job Description</h4><p className="whitespace-pre-wrap text-sm text-gray-700">{viewingJob.description}</p></div>}
              {viewingJob.responsibilities && <div><h4 className="mb-2 text-sm font-bold text-gray-900">Responsibilities</h4><p className="whitespace-pre-wrap text-sm text-gray-700">{viewingJob.responsibilities}</p></div>}
              {viewingJob.requirements && <div><h4 className="mb-2 text-sm font-bold text-gray-900">Requirements</h4><p className="whitespace-pre-wrap text-sm text-gray-700">{viewingJob.requirements}</p></div>}

              {/* Applicants Section */}
              <div className="border-t border-gray-200 pt-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-bold text-gray-900">Applicants ({applicants.length})</h4>
                  <button onClick={() => openApplicantModal()} className="btn-primary text-sm">+ Add Applicant</button>
                </div>
                {loadingApplicants ? <p className="text-sm text-gray-500">Loading applicants...</p> : applicants.length === 0 ? (
                  <p className="text-sm text-gray-500">No applicants yet for this position.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Name</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Contact</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-500">Expected Salary</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Start</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold uppercase text-gray-500">Hybrid</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold uppercase text-gray-500">Status</th>
                          <th className="px-3 py-2 text-center text-xs font-semibold uppercase text-gray-500">CV</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {applicants.map((app) => (
                          <tr key={app.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2">
                              <button onClick={async () => {
                                setViewingApplicant(app)
                                setShowApplicantView(true)
                                setSignedCvUrl(null)
                                if (app.cv_url) {
                                  const { data } = await supabase.storage.from('cvs').createSignedUrl(getCvPath(app.cv_url), 3600)
                                  setSignedCvUrl(data?.signedUrl ?? null)
                                }
                              }}
                                className="font-medium text-blue-600 hover:underline text-left">
                                {app.first_name} {app.last_name}
                              </button>
                            </td>
                            <td className="px-3 py-2 text-gray-600">{app.email || app.phone || '-'}</td>
                            <td className="px-3 py-2 text-right text-gray-700">{app.expected_salary ? `₱${app.expected_salary.toLocaleString()}` : '-'}</td>
                            <td className="px-3 py-2 text-gray-700">{app.available_start || '-'}</td>
                            <td className="px-3 py-2 text-center">{app.hybrid_comfortable ? '✅' : '❌'}</td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${applicantStatusColors[app.status]}`}>
                                {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              {app.cv_url ? (
                                <button onClick={async () => {
                                  const { data } = await supabase.storage.from('cvs').createSignedUrl(getCvPath(app.cv_url!), 3600)
                                  if (data?.signedUrl) window.open(data.signedUrl, '_blank')
                                }} className="text-blue-600 hover:underline text-xs">View CV</button>
                              ) : <span className="text-gray-400 text-xs">None</span>}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button onClick={() => openApplicantModal(app)} className="mr-2 text-blue-600 hover:text-blue-800 text-xs">Edit</button>
                              <button onClick={() => handleDeleteApplicant(app.id)} className="text-red-600 hover:text-red-800 text-xs">Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
              <button onClick={() => { setShowViewModal(false); setViewingJob(null) }} className="btn-secondary">Close</button>
              <button onClick={() => { setShowViewModal(false); openJobModal(viewingJob); setViewingJob(null) }} className="btn-primary">Edit Job</button>
            </div>
          </div>
        </div>
      )}

      {/* Applicant Add/Edit Modal */}
      {showApplicantModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-6 py-5 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">{editingApplicant ? 'Edit Applicant' : 'Add Applicant'}</h3>
              <button onClick={() => { setShowApplicantModal(false); resetApplicantForm() }} className="text-gray-400 hover:text-gray-600">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">First Name *</label>
                  <input type="text" value={appFirstName} onChange={(e) => setAppFirstName(e.target.value)} placeholder="Juan"
                    className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Last Name *</label>
                  <input type="text" value={appLastName} onChange={(e) => setAppLastName(e.target.value)} placeholder="Dela Cruz"
                    className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                  <input type="email" value={appEmail} onChange={(e) => setAppEmail(e.target.value)} placeholder="applicant@email.com"
                    className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
                  <input type="tel" value={appPhone} onChange={(e) => setAppPhone(e.target.value)} placeholder="09123456789"
                    className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Address</label>
                <input type="text" value={appAddress} onChange={(e) => setAppAddress(e.target.value)} placeholder="City, Province"
                  className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Expected Salary (₱)</label>
                  <input type="number" value={appExpectedSalary} onChange={(e) => setAppExpectedSalary(e.target.value)} placeholder="30000"
                    className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Available to Start</label>
                  <select value={appAvailableStart} onChange={(e) => setAppAvailableStart(e.target.value)}
                    className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500">
                    <option value="">Select...</option>
                    <option value="Immediately">Immediately</option>
                    <option value="1 week">1 week</option>
                    <option value="2 weeks">2 weeks</option>
                    <option value="1 month">1 month</option>
                    <option value="More than 1 month">More than 1 month</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Application Status</label>
                  <select value={appStatus} onChange={(e) => setAppStatus(e.target.value as Applicant['status'])}
                    className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500">
                    <option value="new">New</option>
                    <option value="reviewing">Reviewing</option>
                    <option value="interview">Interview</option>
                    <option value="offer">Offer</option>
                    <option value="hired">Hired</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Date Applied</label>
                  <input type="date" value={appAppliedDate} onChange={(e) => setAppAppliedDate(e.target.value)}
                    className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <input type="checkbox" id="hybrid" checked={appHybridComfortable} onChange={(e) => setAppHybridComfortable(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <label htmlFor="hybrid" className="text-sm font-medium text-gray-700">Comfortable with hybrid setup</label>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Upload CV {editingApplicant?.cv_url && <span className="text-xs text-gray-500">(leave blank to keep existing)</span>}
                </label>
                <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setCvFile(e.target.files?.[0] ?? null)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 file:mr-4 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100" />
                {editingApplicant?.cv_url && !cvFile && (
                  <a href={editingApplicant.cv_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-blue-600 hover:underline">View current CV</a>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
                <textarea value={appNotes} onChange={(e) => setAppNotes(e.target.value)} placeholder="Interview notes, observations..."
                  rows={3} className="w-full rounded-lg border-gray-300 px-4 py-2 focus:border-blue-500 focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
              <button onClick={() => { setShowApplicantModal(false); resetApplicantForm() }} className="btn-secondary">Cancel</button>
              <button onClick={handleSaveApplicant} disabled={uploadingCV} className="btn-primary disabled:opacity-50">
                {uploadingCV ? 'Uploading CV...' : editingApplicant ? 'Update Applicant' : 'Add Applicant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Applicant View Modal */}
      {showApplicantView && viewingApplicant && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-white">{viewingApplicant.first_name} {viewingApplicant.last_name}</h3>
                  <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${applicantStatusColors[viewingApplicant.status]}`}>
                    {viewingApplicant.status.charAt(0).toUpperCase() + viewingApplicant.status.slice(1)}
                  </span>
                </div>
                <button onClick={() => { setShowApplicantView(false); setViewingApplicant(null); setSignedCvUrl(null) }} className="text-white hover:text-blue-100">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="space-y-4 p-6">
              <div className="grid gap-3 md:grid-cols-2">
                <div><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Email</p><p className="mt-1 text-sm text-gray-900">{viewingApplicant.email || '-'}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Phone</p><p className="mt-1 text-sm text-gray-900">{viewingApplicant.phone || '-'}</p></div>
                <div className="md:col-span-2"><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Address</p><p className="mt-1 text-sm text-gray-900">{viewingApplicant.address || '-'}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Expected Salary</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{viewingApplicant.expected_salary ? `₱${viewingApplicant.expected_salary.toLocaleString()}` : '-'}</p>
                </div>
                <div><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Available to Start</p><p className="mt-1 text-sm text-gray-900">{viewingApplicant.available_start || '-'}</p></div>
                <div><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Hybrid Setup</p>
                  <p className="mt-1 text-sm text-gray-900">{viewingApplicant.hybrid_comfortable ? '✅ Comfortable' : '❌ Not comfortable'}</p>
                </div>
                <div><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Date Applied</p><p className="mt-1 text-sm text-gray-900">{formatDate(viewingApplicant.applied_date)}</p></div>
              </div>
              {viewingApplicant.cv_url && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">CV / Resume</p>
                  {signedCvUrl ? (
                    <a href={signedCvUrl} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      Download / View CV
                    </a>
                  ) : (
                    <p className="text-sm text-gray-500">Generating secure link...</p>
                  )}
                </div>
              )}
              {viewingApplicant.notes && (
                <div><p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Notes</p><p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">{viewingApplicant.notes}</p></div>
              )}
            </div>
            <div className="sticky bottom-0 flex justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
              <button onClick={() => { setShowApplicantView(false); setViewingApplicant(null); setSignedCvUrl(null) }} className="btn-secondary">Close</button>
              <button onClick={() => { setShowApplicantView(false); openApplicantModal(viewingApplicant); setViewingApplicant(null); setSignedCvUrl(null) }} className="btn-primary">Edit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
