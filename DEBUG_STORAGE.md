# Storage Debugging Guide

## You created the bucket but still getting errors?

### Quick Diagnostic Steps:

#### 1. Verify Bucket Name (Case Sensitive!)
Open your browser console (F12) and run:
```javascript
const { data, error } = await supabase.storage.listBuckets()
console.log('All buckets:', data)
console.log('Error:', error)
```

**Check the output:**
- Is there a bucket named exactly `receipts` (lowercase)?
- Or is it named `Receipts`, `RECEIPTS`, or something else?

**If the name is different:**
The bucket name MUST be exactly `receipts` (all lowercase, no spaces).

---

#### 2. Check Bucket Permissions
In Supabase Dashboard:
1. Go to Storage → Click on your receipts bucket
2. Click "Policies" tab
3. Check if there are any policies listed

**If NO policies exist:**
You need to add RLS policies. Run this in SQL Editor:

```sql
-- Allow authenticated users to upload
CREATE POLICY "Allow authenticated uploads"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts');

-- Allow public reads (if bucket is public)
CREATE POLICY "Allow public reads"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'receipts');
```

---

#### 3. Check if Bucket is Public
In Supabase Dashboard:
1. Go to Storage → receipts bucket
2. Click the settings/gear icon
3. Look for "Public bucket" setting
4. **It should be ENABLED (checked)**

**If it's not public:**
- Enable "Public bucket"
- Or add proper RLS policies for authenticated users

---

#### 4. Test Upload Directly
In browser console:
```javascript
// Create a test file
const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' })

// Try to upload
const { data, error } = await supabase.storage
  .from('receipts')
  .upload(`test-${Date.now()}.txt`, testFile)

console.log('Upload result:', data)
console.log('Upload error:', error)
```

**Check the error message:**
- "Bucket not found" = Bucket doesn't exist or wrong name
- "Permission denied" = Missing RLS policies
- "new row violates row-level security" = RLS policies not configured
- Success = Storage is working, might be a code issue

---

#### 5. Check Environment Variables
Make sure your `.env.local` file has the correct values:
```
VITE_SUPABASE_URL=https://blgvfnhpnieqzcyfgtnn.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**After changing .env.local:**
- Stop the dev server (Ctrl+C)
- Restart: `npm run dev`

---

#### 6. Clear Browser Cache
Sometimes the app caches old code:
1. Hard refresh: `Ctrl + Shift + R` (Windows) or `Cmd + Shift + R` (Mac)
2. Or clear browser cache completely
3. Or try in incognito/private window

---

## Common Issues & Solutions

### Issue: "Bucket not found" but bucket exists
**Possible causes:**
1. **Wrong bucket name** - Check spelling and case (must be exactly `receipts`)
2. **Wrong project** - Make sure you're in the correct Supabase project
3. **API keys mismatch** - Verify your .env.local has keys from the correct project

**Solution:**
```javascript
// In browser console, check which project you're connected to:
const { data: { session } } = await supabase.auth.getSession()
console.log('Project URL:', supabase.supabaseUrl)
console.log('User:', session?.user?.email)
```

Compare the URL with your Supabase dashboard URL.

---

### Issue: "Permission denied" or "RLS policy violation"
**Cause:** Missing or incorrect Row Level Security policies

**Solution:**
1. Go to Supabase Dashboard → Storage → receipts → Policies
2. Add the policies from step 2 above
3. Or make the bucket public (easier for development)

---

### Issue: Works in dashboard but not in app
**Possible causes:**
1. **Not logged in** - Check if user is authenticated
2. **Wrong API key** - Using wrong anon key
3. **CORS issue** - Unlikely but possible

**Solution:**
```javascript
// Check authentication:
const { data: { session } } = await supabase.auth.getSession()
console.log('Logged in:', !!session)
console.log('User:', session?.user?.email)
```

If not logged in, log in first, then try uploading.

---

### Issue: Bucket exists but StorageStatus shows error
**Cause:** The listBuckets() call might be failing

**Solution:**
Check browser console for detailed error messages. The StorageStatus component logs errors to console.

---

## Still Not Working?

### Last Resort Checks:

1. **Delete and recreate bucket:**
   - Delete the receipts bucket
   - Create new bucket named `receipts`
   - Make it public
   - Try again

2. **Check Supabase project status:**
   - Go to Dashboard → Project Settings
   - Make sure project is active (not paused)

3. **Try different browser:**
   - Test in Chrome, Firefox, or Edge
   - Rules out browser-specific issues

4. **Check Supabase logs:**
   - Go to Dashboard → Logs
   - Filter by "storage"
   - Look for error messages

---

## Report the Issue

If none of these work, please provide:
1. Screenshot of Storage buckets list in Supabase Dashboard
2. Screenshot of bucket policies (if any)
3. Console error messages (full text)
4. Output of the diagnostic commands above

This will help identify the exact issue!