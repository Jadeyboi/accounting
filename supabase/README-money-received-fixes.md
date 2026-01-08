# Money Received Database Schema Fixes

## Problem
The Money Received system has a schema mismatch where the database has an old `amount` column with NOT NULL constraint, but the app expects new USD-based columns (`amount_usd`, `exchange_rate`, `amount_php`).

## Error
```
null value in column "amount" of relation "money_received" violates not-null constraint
```

## Available Fix Scripts

### 1. `money-received-simple-fix.sql` (RECOMMENDED)
- **Use this for**: Quick fix with minimal changes
- **What it does**: 
  - Makes old `amount` column nullable
  - Adds USD columns with default values
  - Adds necessary constraints and indexes
- **Safe**: Yes, minimal risk
- **Time**: ~30 seconds

### 2. `money-received-clean-fix.sql`
- **Use this for**: Complete table setup from scratch
- **What it does**:
  - Creates table if it doesn't exist
  - Adds all necessary columns
  - Sets up triggers, policies, and permissions
  - Comprehensive solution
- **Safe**: Yes, handles all edge cases
- **Time**: ~1 minute

### 3. `fix-money-received-immediate.sql`
- **Use this for**: Step-by-step fix with verification
- **What it does**:
  - Same as simple fix but with more verification steps
  - Shows table structure before and after
- **Safe**: Yes, includes verification
- **Time**: ~45 seconds

## How to Use

1. **Go to Supabase Dashboard** → SQL Editor
2. **Copy and paste** one of the fix scripts (recommend `money-received-simple-fix.sql`)
3. **Run the script**
4. **Test the Money Received page** in your app

## After Running the Fix

The Money Received page should work properly with:
- ✅ USD input as primary currency
- ✅ Automatic PHP conversion using live exchange rates
- ✅ Dual currency display (USD/PHP)
- ✅ All CRUD operations (Create, Read, Update, Delete)
- ✅ Filtering and statistics

## Verification

After running the fix, you should be able to:
1. Add new money received records with USD amounts
2. See automatic PHP conversion
3. View, edit, and delete records without errors
4. Use all filtering options

## Files to Ignore

These files have syntax errors or are outdated:
- ❌ `money-received-complete-fix.sql` (has syntax issues)
- ❌ `update-money-received-usd.sql` (complex, use simple version instead)