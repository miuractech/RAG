# Deployment Guide - ByteString Error Fix

This guide will help you deploy the ByteString error fix to your Supabase project.

## What Was Fixed

The application was experiencing `"Value is not a valid ByteString"` errors when using context files. The fix adds comprehensive text sanitization to all edge functions to remove invalid UTF-8 characters, null bytes, and control characters before processing.

## Files Changed

### New Files
- `supabase/functions/_lib/text-sanitizer.ts` - Text sanitization utility library
- `BYTESTRING_ERROR_FIX.md` - Detailed documentation of the fix
- `DEPLOYMENT_GUIDE.md` - This file
- `test-text-sanitizer.ts` - Test script for the sanitizer

### Modified Files
- `supabase/functions/chat/index.ts` - Added sanitization for chat messages
- `supabase/functions/embed/index.ts` - Added sanitization for embeddings
- `supabase/functions/_lib/agentic-search.ts` - Added sanitization for search queries
- `supabase/functions/_lib/pdf-parser.ts` - Added sanitization for PDF content
- `supabase/functions/_lib/markdown-parser.ts` - Added sanitization for markdown content

## Pre-Deployment Testing (Optional)

Before deploying, you can test the sanitizer locally:

```bash
# Test the text sanitizer
deno run test-text-sanitizer.ts

# Test with Supabase CLI locally (if you have it set up)
supabase functions serve
```

## Deployment Steps

### Option 1: Deploy All Functions (Recommended)

Deploy all edge functions at once to ensure consistency:

```bash
# Make sure you're logged in to Supabase
supabase login

# Link to your project (if not already linked)
supabase link --project-ref your-project-ref

# Deploy all functions
supabase functions deploy chat
supabase functions deploy embed
supabase functions deploy process

# Verify deployment
supabase functions list
```

### Option 2: Deploy via Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to **Edge Functions**
3. For each function (chat, embed, process):
   - Click on the function name
   - Click **Deploy new version**
   - Upload the updated files
   - Click **Deploy**

### Option 3: Using CI/CD

If you have CI/CD set up, commit and push the changes:

```bash
git add .
git commit -m "Fix ByteString error with text sanitization"
git push origin main
```

Your CI/CD pipeline should automatically deploy the functions.

## Post-Deployment Verification

### 1. Check Function Logs

Monitor the edge function logs for any errors:

```bash
# View logs for chat function
supabase functions logs chat

# View logs for embed function
supabase functions logs embed

# View logs for process function
supabase functions logs process
```

### 2. Test in Production

1. **Upload a PDF file**:
   - Go to your application
   - Upload a PDF file (especially one with special characters)
   - Wait for processing to complete

2. **Test Chat with Context**:
   - Navigate to the chat page
   - Select some files as context (use the file selector on the right)
   - Send a message asking about the content
   - Verify you get a response without errors

3. **Check Browser Console**:
   - Open browser DevTools (F12)
   - Look for any errors in the Console tab
   - Verify no "ByteString" errors appear

### 3. Monitor for Issues

For the first few hours after deployment, monitor:

- Edge function logs for any sanitization warnings
- User reports of errors
- Database for any empty content after sanitization

## Troubleshooting

### Issue: Functions fail to deploy

**Solution**: Make sure you have the latest Supabase CLI:
```bash
npm install -g supabase
supabase --version
```

### Issue: TypeScript errors during deployment

**Solution**: The Deno environment handles these differently than local TypeScript. If functions deploy successfully, the warnings can be ignored.

### Issue: Chat still shows ByteString errors

**Possible causes**:
1. Functions didn't deploy properly - Check `supabase functions list`
2. Old function versions still cached - Wait 5-10 minutes or restart your browser
3. Content in database already has invalid characters - Re-process existing documents

**Solution for existing documents**:
```sql
-- Check for documents with null embeddings (need reprocessing)
SELECT id, name FROM documents WHERE id IN (
  SELECT DISTINCT document_id 
  FROM document_sections 
  WHERE embedding IS NULL
);

-- To reprocess, delete sections and re-upload files
-- Or run the embed function manually for existing sections
```

### Issue: Content becomes empty after sanitization

**Symptoms**: Files upload but no content appears in chat

**Solution**: The file likely has severe encoding issues. Try:
1. Re-save the file with proper UTF-8 encoding
2. Copy content to a new file
3. Check if it's a valid PDF/text file

## Monitoring Recommendations

### Set Up Alerts

Consider setting up alerts for:
- High error rates in edge functions
- Frequent sanitization warnings in logs
- Empty content after processing

### Regular Checks

Weekly checks recommended:
1. Review edge function logs for sanitization warnings
2. Check for documents with no sections
3. Verify chat functionality with various file types

## Rollback Plan

If you need to rollback:

```bash
# Revert to previous version using git
git revert HEAD
git push

# Or deploy a specific previous version
git checkout <previous-commit-hash>
supabase functions deploy chat
supabase functions deploy embed
supabase functions deploy process
```

## Additional Resources

- Supabase Edge Functions Docs: https://supabase.com/docs/guides/functions
- Deno Deploy Docs: https://deno.com/deploy/docs
- Text Encoding Issues: https://developer.mozilla.org/en-US/docs/Web/API/TextDecoder

## Support

If you encounter issues:

1. Check the `BYTESTRING_ERROR_FIX.md` for technical details
2. Review function logs: `supabase functions logs <function-name>`
3. Open an issue in the repository
4. Contact Supabase support if it's a platform issue

## Success Indicators

You'll know the deployment was successful when:

- ✅ PDFs with special characters upload successfully
- ✅ Chat with context files works without errors
- ✅ No "ByteString" errors in browser console
- ✅ Edge function logs show sanitization warnings (if applicable)
- ✅ Documents are processed and embeddings are generated
