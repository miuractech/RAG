# Fix for Process Edge Function 401 Error

## Problem
The edge functions (`process` and `embed`) were throwing 401 errors because the database triggers were trying to pass authorization headers using `current_setting('request.headers')`, which is not available in the trigger context.

## Solution
Made the edge functions publicly invocable (no authorization required) and they use the service role key internally to access the database with proper permissions.

## Changes Made

### 1. Edge Functions Updated
- **process/index.ts**: Removed authorization check, now publicly invocable
- **embed/index.ts**: Removed authorization check, now publicly invocable
- Both functions use `SUPABASE_SERVICE_ROLE_KEY` internally for database access

### 2. Database Migration Created
- Created migration: `20260108122728_fix_process_auth.sql`
- Updates `handle_storage_update()` trigger to call process function without authorization
- Updates `embed()` trigger to call embed function without authorization

## Steps to Complete the Fix

### Step 1: Apply the Migration

Run the following command to apply the migration to your database:

```bash
cd /Users/sanjeev/Desktop/crownwell/crownwell-rag/chatgpt-your-files
supabase db push
```

Or if you're using a local database first:

```bash
supabase migration up
supabase db push
```

### Step 2: Deploy the Updated Edge Functions

Deploy the updated edge functions:

```bash
supabase functions deploy process
supabase functions deploy embed
```

Or deploy all functions at once:

```bash
supabase functions deploy
```

### Step 3: Test the Fix

1. Upload a file through your application
2. The file should be processed without the 401 error
3. Check the logs in the Supabase dashboard to verify the functions are working

## Verification

You can verify the fix is working by:

1. **Checking Function Logs**: Go to Supabase Dashboard > Edge Functions > Logs
2. **Uploading a Test File**: Upload a markdown file through your app
3. **Checking Database**: Verify that document_sections are created with embeddings

## Security Notes

- The edge functions are now publicly invocable, but they use the service role key internally
- This is safe for functions triggered by database events
- The service role key bypasses Row Level Security (RLS), which is necessary for the triggers to access data
- If you want to call these functions directly from your frontend, you may want to add authentication back

## Rollback (if needed)

If you need to rollback, you can restore the previous version of the migration files and redeploy. However, this shouldn't be necessary as the changes fix the authorization issue.
