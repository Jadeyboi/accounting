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

  const calculateDaysUntil = (_targetDate: string): number => 0 // replaced below

  // Get today as local YYYY-MM-DD (no UTC shift)
  const localToday = (): string => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }

  // Integer days between two local date strings (0 = same day)
  const daysBetween = (fromISO: string, toISO: string): number => {
    const [fy,fm,fd] = fromISO.split('-').map(Number)
    const [ty,tm,td] = toISO.split('-').map(Number)
    return Math.round((new Date(ty,tm-1,td).getTime() - new Date(fy,fm-1,fd).getTime()) / 86400000)
  }

  // Next occurrence of a date's MM-DD on or after todayISO
  const nextOccurrence = (dateISO: string, todayISO: string): string => {
    const [,em,ed] = dateISO.split('-').map(Number)
    const curYear = Number(todayISO.split('-')[0])
    const thisYear = `${curYear}-${String(em).padStart(2,'0')}-${String(ed).padStart(2,'0')}`
    if (thisYear >= todayISO) return thisYear
    return `${curYear+1}-${String(em).padStart(2,'0')}-${String(ed).padStart(2,'0')}`
  }

  // Years completed between hire date and a given anniversary date
  const completedYears = (hiredISO: string, anniversaryISO: string): number =>
    Number(anniversaryISO.split('-')[0]) - Number(hiredISO.split('-')[0])

  const ordinal = (n: number): string =>
    n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`

  const generateNotifications = (employees: Employee[], leaveRequests: LeaveRequest[]): Notification[] => {
    const notifications: Notification[] = []
    const todayISO = localToday()

    employees.forEach(employee => {
      // ── Birthday ──────────────────────────────────────────────────────────
      if (employee.birthdate) {
        const nextDate = nextOccurrence(employee.birthdate, todayISO)
        const days = daysBetween(todayISO, nextDate)
        if (days >= 0 && days <= 30) {
          notifications.push({
            id: `birthday-${employee.id}`,
            type: 'birthday',
            employee,
            date: nextDate,
            daysUntil: days,
            message: days === 0
              ? `🎂 Today is ${employee.name}'s Birthday!`
              : days === 1
              ? `🎂 ${employee.name}'s birthday is tomorrow`
              : `🎂 ${employee.name}'s birthday is in ${days} days`
          })
        }
      }

      // ── Regularization ────────────────────────────────────────────────────
      if (employee.employment_status === 'probationary' && employee.date_hired) {
        const hd = new Date(employee.date_hired)
        const rd = new Date(hd)
        rd.setMonth(rd.getMonth() + 6)
        const regISO = `${rd.getFullYear()}-${String(rd.getMonth()+1).padStart(2,'0')}-${String(rd.getDate()).padStart(2,'0')}`
        const days = daysBetween(todayISO, regISO)
        if (days >= 0 && days <= 30) {
          notifications.push({
            id: `regularization-${employee.id}`,
            type: 'regularization',
            employee,
            date: regISO,
            daysUntil: days,
            message: days === 0
              ? `📋 ${employee.name} is eligible for regularization Today!`
              : days === 1
              ? `📋 ${employee.name} is eligible for regularization tomorrow`
              : `📋 ${employee.name} is eligible for regularization in ${days} days`
          })
        }
      }

      // ── Work Anniversary ──────────────────────────────────────────────────
      if (employee.date_hired) {
        const nextDate = nextOccurrence(employee.date_hired, todayISO)
        const days = daysBetween(todayISO, nextDate)
        const years = completedYears(employee.date_hired, nextDate)
        if (years >= 1 && days >= 0 && days <= 30) {
          notifications.push({
            id: `anniversary-${employee.id}`,
            type: 'anniversary',
            employee,
            date: nextDate,
            daysUntil: days,
            message: days === 0
              ? `🎉 Today is ${employee.name}'s ${ordinal(years)} Work Anniversary!`
              : days === 1
              ? `🎉 ${employee.name}'s ${ordinal(years)} work anniversary is tomorrow`
              : `🎉 ${employee.name}'s ${ordinal(years)} work anniversary is in ${days} days`
          })
        }
      }
    })

    // Leave notifications (approved leaves starting within 7 days)
    leaveRequests.forEach(leave => {
      const employee = employees.find(emp => emp.id === leave.employee_id)
      if (!employee || leave.status !== 'approved') return

      const daysUntil = daysBetween(localToday(), leave.start_date)
      
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

      // Fetch approved leave requests starting today or within the next 7 days
      const todayLocal = localToday()
      const nextWeekLocal = (() => {
        const d = new Date()
        d.setDate(d.getDate() + 7)
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      })()

      const { data: leaveRequests, error: leaveError } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('status', 'approved')
        .gte('start_date', todayLocal)
        .lte('start_date', nextWeekLocal)
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