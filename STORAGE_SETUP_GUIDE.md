# Supabase Storage Setup Guide

## Issue
Getting a 400 Bad Request error when uploading receipts:
```
POST https://[project].supabase.co/storage/v1/object/receipts/receipt-[timestamp].png 400 (Bad Request)
```

## Root Cause
The `receipts` storage bucket either:
1. Doesn't exist in your Supabase project
2. Doesn't have the correct access policies configured
3. Has incorrect bucket settings (not public or missing permissions)

## Solution

### Step 1: Create the Storage Bucket

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Storage** in the left sidebar
4. Click **"New bucket"** or **"Create bucket"**
5. Configure the bucket:
   - **Name**: `receipts` (must be exactly this name)
   - **Public bucket**: ✅ Check this box (allows public read access)
   - **File size limit**: Set to your preference (e.g., 5MB or 10MB)
   - **Allowed MIME types**: Leave empty or specify: `image/png, image/jpeg, image/jpg, application/pdf`
6. Click **"Create bucket"**

### Step 2: Configure Bucket Policies

After creating the bucket, you need to set up Row Level Security (RLS) policies:

#### Option A: Using Supabase Dashboard (Recommended)

1. Go to **Storage** → Click on the `receipts` bucket
2. Click on **"Policies"** tab
3. Click **"New Policy"**
4. Create the following policies:

**Policy 1: Allow authenticated uploads**
- Policy name: `Allow authenticated users to upload receipts`
- Allowed operation: `INSERT`
- Target roles: `authenticated`
- Policy definition: `bucket_id = 'receipts'`

**Policy 2: Allow public reads** (if bucket is public)
- Policy name: `Allow public read access to receipts`
- Allowed operation: `SELECT`
- Target roles: `public`
- Policy definition: `bucket_id = 'receipts'`

**Policy 3: Allow authenticated updates**
- Policy name: `Allow authenticated users to update receipts`
- Allowed operation: `UPDATE`
- Target roles: `authenticated`
- Policy definition: `bucket_id = 'receipts'`

**Policy 4: Allow authenticated deletes**
- Policy name: `Allow authenticated users to delete receipts`
- Allowed operation: `DELETE`
- Target roles: `authenticated`
- Policy definition: `bucket_id = 'receipts'`

#### Option B: Using SQL Editor

1. Go to **SQL Editor** in your Supabase Dashboard
2. Run the SQL script from `supabase/setup-receipts-storage.sql`

### Step 3: Verify the Setup

1. Go to **Storage** → `receipts` bucket
2. Try uploading a test file manually through the dashboard
3. If successful, the bucket is configured correctly
4. Test the upload from your application

### Step 4: Check Bucket Settings

If still having issues, verify:

1. **Bucket is Public**: 
   - Go to Storage → receipts bucket → Settings
   - Ensure "Public bucket" is enabled

2. **File Size Limits**:
   - Check if your files exceed the bucket's size limit
   - Adjust if necessary

3. **MIME Types**:
   - If you set allowed MIME types, ensure your files match
   - Or remove MIME type restrictions

### Common Issues and Solutions

#### Issue: "Bucket not found"
**Solution**: Create the bucket with exact name `receipts`

#### Issue: "Permission denied"
**Solution**: 
- Ensure RLS policies are created
- Check that user is authenticated
- Verify bucket is public if using public access

#### Issue: "File too large"
**Solution**: 
- Increase bucket file size limit
- Or compress images before upload

#### Issue: "Invalid MIME type"
**Solution**: 
- Remove MIME type restrictions
- Or add the file type to allowed MIME types

### Testing the Fix

After setup, test by:
1. Logging into your application
2. Going to a page with receipt upload (e.g., Monthly transactions)
3. Try uploading an image or PDF
4. Check browser console for any errors
5. Verify file appears in Supabase Storage dashboard

### Alternative: Quick Fix via Dashboard

If you need a quick fix:
1. Go to Storage in Supabase Dashboard
2. Create bucket named `receipts`
3. Check "Public bucket" option
4. Click "Create"
5. That's it! The default policies should work for public buckets

### Security Considerations

**For Production:**
- Consider making the bucket private (uncheck "Public bucket")
- Use authenticated-only policies
- Implement file type validation
- Add file size limits
- Consider adding virus scanning
- Implement proper access control based on user roles

**Current Setup:**
- Public bucket allows anyone to read files
- Only authenticated users can upload/modify/delete
- Suitable for development and testing
- Review security requirements before production deployment

## Verification Checklist

- [ ] Bucket named `receipts` exists
- [ ] Bucket is set to public (or has proper RLS policies)
- [ ] Upload policy exists for authenticated users
- [ ] Read policy exists (public or authenticated)
- [ ] File size limit is appropriate
- [ ] MIME types are configured (or unrestricted)
- [ ] Test upload works from dashboard
- [ ] Test upload works from application

## Need Help?

If you're still experiencing issues:
1. Check Supabase logs in Dashboard → Logs
2. Check browser console for detailed error messages
3. Verify your Supabase project URL and anon key are correct
4. Ensure you're logged in when testing uploads
5. Try uploading directly through Supabase Dashboard to isolate the issue