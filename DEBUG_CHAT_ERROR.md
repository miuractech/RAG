# Debugging Chat Error

## Current Error
```
Error sending message: Error: Failed to send message
at onSubmit (page.tsx:414:15)
```

## Possible Causes

### 1. Authentication Issue
The user may not be authenticated properly.

**Check:**
- Are you logged in?
- Is the session token valid?
- Check browser console for auth errors

### 2. Edge Function Error
The Supabase Edge Function may be returning an error.

**Check:**
```bash
# View real-time logs from Supabase dashboard
# Go to: https://supabase.com/dashboard/project/[your-project-id]/functions
```

### 3. Network/CORS Issue
Request may be failing due to network or CORS issues.

**Check:**
- Browser Network tab (F12 → Network)
- Look for the POST request to `/functions/v1/chat`
- Check response status and body

### 4. Invalid Input
Message or file IDs may contain invalid data.

**Check:**
- Are context files selected?
- Is the message text valid?

## Debug Steps

### Step 1: Open Browser DevTools
Press F12 or right-click → Inspect

### Step 2: Check Console Tab
Look for detailed error messages before the "Failed to send message" error.

### Step 3: Check Network Tab
1. Clear the network log
2. Try sending a message
3. Look for the request to `chat` function
4. Click on it and check:
   - **Status Code**: Should be 200, if not check what it is
   - **Response**: Click "Response" tab to see error details
   - **Request Payload**: Check what's being sent

### Step 4: Check Function Logs in Supabase Dashboard

1. Go to https://supabase.com/dashboard/project/insvpcqgugglayvrlcnf/functions
2. Click on "chat" function
3. Click "Logs" tab
4. Look for recent errors

Common errors:
- `"Value is not a valid ByteString"` - Should be fixed now
- `"Missing environment variables"` - Check OPENAI_API_KEY is set
- `"No authorization header passed"` - Auth issue
- `"There was an error reading your documents"` - Database/RPC issue

## Quick Fixes

### Fix 1: Clear Browser Cache and Reload
```
Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
```

### Fix 2: Re-login
1. Log out
2. Clear browser storage (F12 → Application → Storage → Clear site data)
3. Log back in

### Fix 3: Check Environment Variables in Supabase

Ensure these are set in Supabase Dashboard:
- `OPENAI_API_KEY` - Your OpenAI API key
- `SUPABASE_URL` - Auto-set
- `SUPABASE_ANON_KEY` - Auto-set
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-set (for backend only)

### Fix 4: Test Without Context Files
Try sending a message WITHOUT selecting any context files to isolate the issue.

### Fix 5: Test Simple Search Mode
Uncheck "Agentic Search" and try again with simple search mode.

## Getting Detailed Error Information

### Add Debug Logging to page.tsx

Temporarily add this after line 411 in `app/chat/page.tsx`:

```typescript
if (!response.ok) {
  const errorData = await response.json().catch((e: Error) => ({ error: e }));
  console.error('Full error response:', {
    status: response.status,
    statusText: response.statusText,
    errorData,
    url: response.url
  });
  throw new Error(errorData.error || 'Failed to send message');
}
```

This will log the complete error details to the console.

## Common Scenarios

### Scenario 1: OpenAI API Key Missing
**Error**: "Missing environment variables" or 401 from OpenAI
**Fix**: Add OPENAI_API_KEY in Supabase Dashboard → Settings → Edge Functions Secrets

### Scenario 2: ByteString Error (Should be fixed)
**Error**: "Value is not a valid ByteString"
**Fix**: Already fixed with our sanitization changes. Make sure functions are deployed.

### Scenario 3: RLS Policy Issue
**Error**: "permission denied" or "no rows returned"
**Fix**: Check that document_sections table has proper RLS policies for authenticated users

### Scenario 4: No Documents/Embeddings
**Error**: "No documents found" or empty responses
**Fix**: 
1. Upload some files
2. Wait for processing to complete
3. Check that embeddings are generated

## Test Commands

### Test 1: Verify Functions are Deployed
```bash
supabase functions list
```

Expected: Should show chat, embed, process

### Test 2: Test Chat Function Directly
```bash
curl -i --location --request POST 'https://[your-project-ref].supabase.co/functions/v1/chat' \
  --header 'Authorization: Bearer [your-access-token]' \
  --header 'Content-Type: application/json' \
  --data '{"message":"Hello", "messages":[], "useAgenticSearch": false, "fileIds": null}'
```

### Test 3: Check Database
```sql
-- Check if there are documents
SELECT COUNT(*) FROM documents;

-- Check if there are document sections
SELECT COUNT(*) FROM document_sections;

-- Check if embeddings are generated
SELECT COUNT(*) FROM document_sections WHERE embedding IS NOT NULL;
```

## Next Steps

1. Follow the debug steps above
2. Report back with:
   - HTTP status code from Network tab
   - Error details from Response tab
   - Any console errors
   - Function logs from Supabase dashboard

This will help identify the exact issue.
