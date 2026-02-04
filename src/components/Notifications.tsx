import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Employee, LeaveRequest } from '@/types'

interface Notification {
  id: string
  type: 'birthday' | 'regularization' | 'anniversary' | 'leave'
  employee: Employee
  date: string
  daysUntil: number
  message: string
  leaveType?: string
  leaveDays?: number
}

interface NotificationsProps {
  onClose?: () => void
}

export default function Notifications({ onClose }: NotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)

  const calculateDaysUntil = (targetDate: string): number => {
    const today = new Date()
    const target = new Date(targetDate)
    
    // For birthdays and anniversaries, we need to check this year's date
    if (target.getFullYear() !== today.getFullYear()) {
      target.setFullYear(today.getFullYear())
      
      // If the date has already passed this year, check next year
      if (target < today) {
        target.setFullYear(today.getFullYear() + 1)
      }
    }
    
    const diffTime = target.getTime() - today.getTime()
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  const generateNotifications = (employees: Employee[], leaveRequests: LeaveRequest[]): Notification[] => {
    const notifications: Notification[] = []
    const today = new Date()

    employees.forEach(employee => {
      // Birthday notifications (30 days ahead)
      if (employee.birthdate) {
        const daysUntil = calculateDaysUntil(employee.birthdate)
        if (daysUntil >= 0 && daysUntil <= 30) {
          notifications.push({
            id: `birthday-${employee.id}`,
            type: 'birthday',
            employee,
            date: employee.birthdate,
            daysUntil,
            message: daysUntil === 0 
              ? `🎉 Today is ${employee.name}'s birthday!`
              : daysUntil === 1
              ? `🎂 ${employee.name}'s birthday is tomorrow`
              : `🎂 ${employee.name}'s birthday is in ${daysUntil} days`
          })
        }
      }

      // Regularization notifications (for probationary employees)
      if (employee.employment_status === 'probationary' && employee.date_hired) {
        const hiredDate = new Date(employee.date_hired)
        const regularizationDate = new Date(hiredDate)
        regularizationDate.setMonth(regularizationDate.getMonth() + 6) // 6 months after hire date
        
        const daysUntil = Math.ceil((regularizationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        
        if (daysUntil >= 0 && daysUntil <= 30) {
          notifications.push({
            id: `regularization-${employee.id}`,
            type: 'regularization',
            employee,
            date: regularizationDate.toISOString().split('T')[0],
            daysUntil,
            message: daysUntil === 0
              ? `📋 ${employee.name} is eligible for regularization today!`
              : daysUntil === 1
              ? `📋 ${employee.name} is eligible for regularization tomorrow`
              : `📋 ${employee.name} is eligible for regularization in ${daysUntil} days`
          })
        }
      }

      // Work anniversary notifications (yearly)
      if (employee.date_hired) {
        const hiredDate = new Date(employee.date_hired)
        const thisYearAnniversary = new Date(today.getFullYear(), hiredDate.getMonth(), hiredDate.getDate())
        
        // If this year's anniversary has passed, check next year
        if (thisYearAnniversary < today) {
          thisYearAnniversary.setFullYear(today.getFullYear() + 1)
        }
        
        const daysUntil = Math.ceil((thisYearAnniversary.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
        const yearsOfService = today.getFullYear() - hiredDate.getFullYear()
        
        // Only show if it's at least 1 year and within 30 days
        if (yearsOfService >= 1 && daysUntil >= 0 && daysUntil <= 30) {
          const nextYearOfService = yearsOfService + (thisYearAnniversary.getFullYear() > today.getFullYear() ? 0 : 1)
          
          notifications.push({
            id: `anniversary-${employee.id}`,
            type: 'anniversary',
            employee,
            date: thisYearAnniversary.toISOString().split('T')[0],
            daysUntil,
            message: daysUntil === 0
              ? `🎊 Today is ${employee.name}'s ${nextYearOfService} year work anniversary!`
              : daysUntil === 1
              ? `🎊 ${employee.name}'s ${nextYearOfService} year work anniversary is tomorrow`
              : `🎊 ${employee.name}'s ${nextYearOfService} year work anniversary is in ${daysUntil} days`
          })
        }
      }
    })

    // Leave notifications (approved leaves starting within 7 days)
    leaveRequests.forEach(leave => {
      const employee = employees.find(emp => emp.id === leave.employee_id)
      if (!employee || leave.status !== 'approved') return

      const startDate = new Date(leave.start_date)
      const daysUntil = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      
      // Only show leaves starting within the next 7 days
      if (daysUntil >= 0 && daysUntil <= 7) {
        const leaveTypeLabels = {
          'sick': 'Sick Leave',
          'vacation': 'Vacation Leave',
          'birthday': 'Birthday Leave',
          'emergency': 'Emergency Leave',
          'unpaid': 'Unpaid Leave',
          'paternity': 'Paternity Leave',
          'maternity': 'Maternity Leave'
        }

        const leaveTypeLabel = leaveTypeLabels[leave.leave_type] || leave.leave_type
        const isMultipleDays = leave.days_count > 1

        notifications.push({
          id: `leave-${leave.id}`,
          type: 'leave',
          employee,
          date: leave.start_date,
          daysUntil,
          leaveType: leave.leave_type,
          leaveDays: leave.days_count,
          message: daysUntil === 0
            ? `🏖️ ${employee.name} is on ${leaveTypeLabel} today${isMultipleDays ? ` (${leave.days_count} days)` : ''}`
            : daysUntil === 1
            ? `🏖️ ${employee.name} starts ${leaveTypeLabel} tomorrow${isMultipleDays ? ` (${leave.days_count} days)` : ''}`
            : `🏖️ ${employee.name} starts ${leaveTypeLabel} in ${daysUntil} days${isMultipleDays ? ` (${leave.days_count} days)` : ''}`
        })
      }
    })

    // Sort by days until (most urgent first)
    return notifications.sort((a, b) => a.daysUntil - b.daysUntil)
  }

  const fetchNotifications = async () => {
    setLoading(true)
    try {
      // Fetch employees
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('*')
        .order('name')

      if (employeesError) throw employeesError

      // Fetch approved leave requests starting within the next 7 days
      const today = new Date()
      const nextWeek = new Date()
      nextWeek.setDate(today.getDate() + 7)

      const { data: leaveRequests, error: leaveError } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('status', 'approved')
        .gte('start_date', today.toISOString().split('T')[0])
        .lte('start_date', nextWeek.toISOString().split('T')[0])
        .order('start_date')

      if (leaveError) throw leaveError

      const generatedNotifications = generateNotifications(employees || [], leaveRequests || [])
      setNotifications(generatedNotifications)
    } catch (error) {
      console.error('Error fetching notifications:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchNotifications()
  }, [])

  const urgentNotifications = notifications.filter(n => n.daysUntil <= 7)
  const upcomingNotifications = notifications.filter(n => n.daysUntil > 7)

  const getNotificationColor = (type: string, daysUntil: number) => {
    if (daysUntil === 0) return 'bg-red-50 border-red-200 text-red-800'
    if (daysUntil <= 3) return 'bg-orange-50 border-orange-200 text-orange-800'
    if (daysUntil <= 7) return 'bg-yellow-50 border-yellow-200 text-yellow-800'
    
    switch (type) {
      case 'birthday': return 'bg-pink-50 border-pink-200 text-pink-800'
      case 'regularization': return 'bg-blue-50 border-blue-200 text-blue-800'
      case 'anniversary': return 'bg-purple-50 border-purple-200 text-purple-800'
      case 'leave': return 'bg-green-50 border-green-200 text-green-800'
      default: return 'bg-gray-50 border-gray-200 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    })
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/4 mb-3"></div>
          <div className="space-y-2">
            <div className="h-3 bg-slate-200 rounded"></div>
            <div className="h-3 bg-slate-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    )
  }

  if (notifications.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-slate-900">📅 Notifications</h3>
          {onClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              ✕
            </button>
          )}
        </div>
        <p className="text-sm text-slate-600">No upcoming birthdays, regularizations, or anniversaries.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-slate-900">
          📅 Notifications ({notifications.length})
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showAll ? 'Show Less' : 'Show All'}
          </button>
          {onClose && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {/* Urgent notifications (within 7 days) */}
        {urgentNotifications.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-2">🚨 Urgent (Within 7 days)</h4>
            <div className="space-y-2">
              {urgentNotifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border ${getNotificationColor(notification.type, notification.daysUntil)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{notification.message}</p>
                      <p className="text-xs mt-1 opacity-75">
                        {notification.employee.position && `${notification.employee.position} • `}
                        {formatDate(notification.date)}
                      </p>
                    </div>
                    <span className="text-xs font-medium ml-2">
                      {notification.daysUntil === 0 ? 'Today' : `${notification.daysUntil}d`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming notifications (8-30 days) */}
        {showAll && upcomingNotifications.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-slate-700 mb-2">📋 Upcoming (8-30 days)</h4>
            <div className="space-y-2">
              {upcomingNotifications.map(notification => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-lg border ${getNotificationColor(notification.type, notification.daysUntil)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{notification.message}</p>
                      <p className="text-xs mt-1 opacity-75">
                        {notification.employee.position && `${notification.employee.position} • `}
                        {formatDate(notification.date)}
                      </p>
                    </div>
                    <span className="text-xs font-medium ml-2">{notification.daysUntil}d</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!showAll && upcomingNotifications.length > 0 && (
          <p className="text-xs text-slate-500 text-center">
            +{upcomingNotifications.length} more upcoming notifications
          </p>
        )}
      </div>
    </div>
  )
}