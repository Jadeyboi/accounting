-- Add garbage, ftm, and utilities categories to oakridge_billings
ALTER TABLE oakridge_billings DROP CONSTRAINT IF EXISTS oakridge_billings_category_check;
ALTER TABLE oakridge_billings ADD CONSTRAINT oakridge_billings_category_check
  CHECK (category IN ('rent', 'cusa', 'electricity', 'water', 'internet', 'garbage', 'ftm', 'utilities', 'other'));
