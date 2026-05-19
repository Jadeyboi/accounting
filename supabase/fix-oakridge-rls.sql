-- Fix RLS policy for oakridge_billings
-- The old policy used auth.role() which doesn't work properly
-- Replace with auth.uid() IS NOT NULL which works for any logged-in user

DROP POLICY IF EXISTS "Allow all for authenticated" ON oakridge_billings;

CREATE POLICY "Allow all for authenticated" ON oakridge_billings
  FOR ALL USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
