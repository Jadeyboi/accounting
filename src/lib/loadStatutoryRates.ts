/**
 * loadStatutoryRates.ts
 *
 * Loads the effective-dated statutory rate schedule from the DB and applies it
 * to the calculation engine. Call once on app start (and after editing rates).
 * If the table is missing or empty, the built-in 2025 default remains in effect.
 */

import { supabase } from '@/lib/supabase'
import { setStatutoryRates, type StatutoryRates } from '@/lib/statutoryDeductions'

/** Fetch the most recent schedule whose effective_date <= today and apply it. */
export async function loadStatutoryRates(asOf: string = new Date().toISOString().slice(0, 10)): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('statutory_rates')
      .select('config, effective_date')
      .lte('effective_date', asOf)
      .order('effective_date', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error || !data?.config) return // keep built-in default
    setStatutoryRates(data.config as StatutoryRates)
  } catch {
    // network/table issues — keep built-in default
  }
}
