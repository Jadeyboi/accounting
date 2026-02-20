# Storage Upload Diagnostic Guide

## Error Details
```
POST https://blgvfnhpnieqzcyfgtnn.supabase.co/storage/v1/object/receipts/receipt-1771583984452.png 400 (Bad Request)
```

## Quick Diagnosis Steps

### 1. Check if Bucket Exists
Open your browser console and run:
```javascript
const { data, error } = await supabase.storage.listBuckets()
console.log('Buckets:', data)
console.log('Error:', error)
```

Look for a bucket named `receipts` in the output.

### 2. Check Bucket Policies
In Supabase Dashboard:
1. Go to Storage → receipts bucket
2. Click "Policies" tab
3. Verify you have policies for INSERT, SELECT, UPDATE, DELETE

### 3. Test Upload Manually
In Supabase Dashboard:
1. Go to Storage → receipts bucket
2. Click "Upload file"
3. Try uploading a test image
4. If this fails, the bucket configuration is wrong

### 4. Check Authentication
In browser console:
```javascript
const { data: { session } } = await supabase.auth.getSession()
console.log('Session:', session)
```

If session is null, you're not logged in.

## Common 400 Error Causes

### Cause 1: Bucket Doesn't Exist
**Symptom**: Error message mentions "Bucket not found"
**Fix**: Create the bucket in Supabase Dashboard (Storage → New bucket → name: "receipts")

### Cause 2: Missing Policies
**Symptom**: Error message mentions "Permission denied" or "new row violates row-level security policy"
**Fix**: Add RLS policies (see STORAGE_SETUP_GUIDE.md)

### Cause 3: Bucket Not Public
**Symptom**: Can upload but can't read files
**Fix**: 
- Go to Storage → receipts → Settings
- Enable "Public bucket"
- Or add proper RLS policies

### Cause 4: File Already Exists
**Symptom**: Error mentions "duplicate" or "already exists"
**Fix**: The code uses `upsert: false`, so duplicate filenames fail
- This is unlikely since we use timestamps
- Check if system clock is wrong

### Cause 5: Invalid File Type
**Symptom**: Error mentions "invalid file type" or "MIME type"
**Fix**: 
- Remove MIME type restrictions from bucket
- Or add the file type to allowed types

### Cause 6: File Too Large
**Symptom**: Error mentions "file too large" or "payload too large"
**Fix**: Increase bucket file size limit

## Immediate Fix Steps

### Option 1: Create Bucket via Dashboard (Fastest)
1. Open Supabase Dashboard
2. Go to Storage
3. Click "New bucket"
4. Name: `receipts`
5. Check "Public bucket"
6. Click "Create"
7. Done! Try uploading again

### Option 2: Check Existing Bucket Settings
1. Go to Storage → receipts
2. Click Settings (gear icon)
3. Verify:
   - Public bucket: ✅ Enabled
   - File size limit: At least 5MB
   - Allowed MIME types: Empty or includes image types
4. Save if you made changes

### Option 3: Reset Bucket
1. Delete existing `receipts` bucket (if any)
2. Create new bucket named `receipts`
3. Enable "Public bucket"
4. Test upload

## Verify the Fix

After applying fixes, test:
```javascript
// In browser console
const testFile = new File(['test'], 'test.txt', { type: 'text/plain' })
const { data, error } = await supabase.storage
  .from('receipts')
  .upload(`test-${Date.now()}.txt`, testFile)
  
console.log('Upload result:', data)
console.log('Upload error:', error)
```

If `data` has a path and `error` is null, it's working!

## Still Not Working?

1. **Check Supabase Project Status**
   - Go to Supabase Dashboard → Project Settings
   - Verify project is active and not paused

2. **Check API Keys**
   - Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local
   - Keys should match your project

3. **Check Browser Console**
   - Look for detailed error messages
   - Check Network tab for full error response

4. **Check Supabase Logs**
   - Go to Dashboard → Logs
   - Filter by "storage"
   - Look for error details

5. **Try Different File**
   - Try uploading a small text file
   - Try uploading a different image format
   - This helps isolate file-specific issues

## Contact Support

If none of these work:
1. Take screenshot of error in browser console
2. Take screenshot of Storage bucket settings
3. Take screenshot of Storage policies
4. Share with Supabase support or your team