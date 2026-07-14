import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import type { Employee, LeaveRequest } from '@/types'
import Notifications from './Notifications'

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

export default function NotificationsBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [loading, setLoading] = useState(true)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [dropdownPos, setDropdownPos] = useState({ top: 0, right: 0 })

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
        .neq('status', 'terminated')
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

  const urgentCount = notifications.filter(n => n.daysUntil <= 7).length
  const hasNotifications = notifications.length > 0

  const handleToggle = () => {
    if (!showDropdown && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPos({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right,
      })
    }
    setShowDropdown(!showDropdown)
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className={`relative rounded-lg p-2 transition-all ${
          hasNotifications 
            ? 'bg-red-100 text-red-600 hover:bg-red-200' 
            : 'bg-white text-gray-600 hover:bg-gray-100'
        } shadow-sm hover:shadow-md`}
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5v-5zM11 19H6.5A2.5 2.5 0 014 16.5v-9A2.5 2.5 0 016.5 5h11A2.5 2.5 0 0120 7.5v3.5" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7v6l4 4" />
        </svg>
        
        {/* Notification badge */}
        {hasNotifications && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
            {notifications.length > 9 ? '9+' : notifications.length}
          </span>
        )}
        
        {/* Urgent indicator */}
        {urgentCount > 0 && (
          <span className="absolute -top-1 -left-1 h-3 w-3 rounded-full bg-orange-500 animate-pulse"></span>
        )}
      </button>

      {/* Dropdown — rendered via portal to escape header stacking context */}
      {showDropdown && createPortal(
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0"
            style={{ zIndex: 9998 }}
            onClick={() => setShowDropdown(false)}
          />
          {/* Dropdown content */}
          <div
            className="fixed w-96 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl"
            style={{ top: dropdownPos.top, right: dropdownPos.right, zIndex: 9999 }}
          >
            <Notifications onClose={() => setShowDropdown(false)} />
          </div>
        </>,
        document.body
      )}
    </div>
  )
}