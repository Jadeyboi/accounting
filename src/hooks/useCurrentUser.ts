import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface CurrentUser {
  id: string
  email: string | null
  role: string | null
  employeeId: string | null
}

export function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        if (isMounted) { setCurrentUser(null); setLoading(false) }
        return
      }

      const { data } = await supabase
        .from('users')
        .select('role, employee_id')
        .eq('id', session.user.id)
        .single()

      if (isMounted) {
        setCurrentUser({
          id: session.user.id,
          email: session.user.email ?? null,
          role: data?.role ?? null,
          employeeId: data?.employee_id ?? null,
        })
        setLoading(false)
      }
    }

    load()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      load()
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const isEmployee = currentUser?.role === 'employee'
  const isAdminOrHR = currentUser?.role === 'super_admin' || currentUser?.role === 'admin' || currentUser?.role === 'hr'

  return { currentUser, loading, isEmployee, isAdminOrHR }
}
