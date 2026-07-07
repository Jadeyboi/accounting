import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface HRStats {
  employeeCount: number
  pendingLeaves: number
  openJobPostings: number
  totalInventory: number
}

export default function HRDashboard() {
  const [stats, setStats] = useState<HRStats>({
    employeeCount: 0,
    pendingLeaves: 0,
    openJobPostings: 0,
    totalInventory: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)
    const [empRes, leaveRes, jobRes, invRes] = await Promise.all([
      supabase
        .from('employees')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'terminated'),
      supabase
        .from('leave_requests')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('job_openings')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'open'),
      supabase
        .from('inventory')
        .select('id', { count: 'exact', head: true }),
    ])
    setStats({
      employeeCount: empRes.count ?? 0,
      pendingLeaves: leaveRes.count ?? 0,
      openJobPostings: jobRes.count ?? 0,
      totalInventory: invRes.count ?? 0,
    })
    setLoading(false)
  }

  const cards = [
    {
      label: 'Active Employees',
      value: stats.employeeCount,
      icon: '👥',
      gradient: 'from-blue-500 to-blue-600',
      description: 'Non-terminated employees',
    },
    {
      label: 'Pending Leave Requests',
      value: stats.pendingLeaves,
      icon: '📋',
      gradient: 'from-yellow-500 to-yellow-600',
      description: 'Awaiting approval',
    },
    {
      label: 'Open Job Postings',
      value: stats.openJobPostings,
      icon: '💼',
      gradient: 'from-green-500 to-green-600',
      description: 'Currently accepting applications',
    },
    {
      label: 'Inventory Items',
      value: stats.totalInventory,
      icon: '📦',
      gradient: 'from-purple-500 to-purple-600',
      description: 'Total items tracked',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">HR Dashboard</h2>
        <p className="text-sm text-gray-600">Overview of HR metrics and activity</p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-500">Loading data...</div>
      ) : (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card, i) => (
              <div
                key={i}
                className={`rounded-xl p-6 bg-gradient-to-br ${card.gradient} text-white shadow-lg`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium opacity-80">{card.label}</p>
                    <p className="text-4xl font-bold mt-2">{card.value}</p>
                    <p className="text-xs opacity-70 mt-1">{card.description}</p>
                  </div>
                  <span className="text-3xl opacity-90">{card.icon}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Quick links */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-lg p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Quick Links</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Manage Employees', path: '/hris' },
                { label: 'Leave Requests', path: '/leave' },
                { label: 'Job Openings', path: '/job-openings' },
                { label: 'Inventory', path: '/inventory' },
                { label: 'Payroll', path: '/payroll' },
                { label: 'Activity Logs', path: '/activity-logs' },
              ].map((link, i) => (
                <a
                  key={i}
                  href={link.path}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 text-center hover:bg-blue-100 hover:border-blue-400 transition-all"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
