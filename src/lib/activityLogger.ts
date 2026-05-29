import { supabase } from './supabase'

export async function logActivity(
  action: string,
  module: string,
  description: string,
  metadata?: any
) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('activity_logs').insert({
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      action,
      module,
      description,
      metadata: metadata ?? null,
    })
  } catch (err) {
    console.error('Failed to log activity:', err)
  }
}
