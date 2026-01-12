# Leave Requests Database Constraint Fixes

## Problem
The Leave Management system is showing a constraint violation error:
```
new row for relation "leave_requests" violates check constraint "leave_requests_leave_type_check"
```

## Possible Causes
1. **Constraint mismatch**: Database constraint doesn't match the app's leave type values
2. **Invalid existing data**: Records in the database have leave_type values that don't match the constraint
3. **Case sensitivity**: Constraint might be case-sensitive but app sends different case
4. **Missing constraint**: The constraint might not exist or be incorrectly defined

## Available Fix Scripts

### 1. `diagnose-leave-requests.sql` (START HERE)
- **Use this first**: Identifies the exact problem
- **What it does**: 
  - Checks if table exists
  - Shows current constraints
  - Lists existing leave_type values
  - Identifies invalid data
- **Safe**: Yes, read-only diagnostic
- **Time**: ~10 seconds

### 2. `fix-leave-requests-constraint.sql` (SIMPLE FIX)
- **Use this for**: Quick constraint fix
- **What it does**:
  - Drops and recreates the leave_type constraint
  - Shows any invalid existing data
  - Verifies the fix
- **Safe**: Yes, but doesn't fix invalid data
- **Time**: ~30 seconds

### 3. `leave-requests-complete-fix.sql` (COMPREHENSIVE)
- **Use this for**: Complete table setup and data cleanup
- **What it does**:
  - Creates table if missing
  - Fixes any invalid leave_type values in existing data
  - Recreates all constraints properly
  - Sets up indexes and permissions
- **Safe**: Yes, handles all edge cases
- **Time**: ~1 minute

## Expected Leave Type Values
The app expects these exact values (case-sensitive):
- `sick` - Sick Leave
- `vacation` - Vacation Leave  
- `birthday` - Birthday Leave
- `emergency` - Emergency Leave
- `unpaid` - Unpaid Leave

## How to Use

1. **Run diagnostic first**: Use `diagnose-leave-requests.sql` to identify the problem
2. **Choose appropriate fix**:
   - If constraint is missing/wrong: Use `fix-leave-requests-constraint.sql`
   - If data is invalid or table needs complete setup: Use `leave-requests-complete-fix.sql`
3. **Test the Leave page** after running the fix

## After Running the Fix

The Leave Management page should work properly with:
- ✅ All leave type options working (sick, vacation, birthday, emergency, unpaid)
- ✅ Leave request submission without constraint errors
- ✅ Proper leave balance calculations
- ✅ Approval/rejection workflow

## Verification Steps

After running a fix script:
1. Go to Leave Management page
2. Try creating a new leave request with each leave type
3. Verify no constraint violation errors occur
4. Check that existing leave requests display correctly