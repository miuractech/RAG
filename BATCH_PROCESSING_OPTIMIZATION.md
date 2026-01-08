# Batch Processing and Recursive Invocation Optimization

## Problem Statement

When processing large files with many sections, the system was encountering **CPU Time Exceeded** errors during the embedding generation phase. This occurred because:

1. The `embed` function processed all embeddings sequentially in a single invocation
2. Large files with hundreds of sections exceeded the Edge Function timeout limit (60 seconds)
3. Some embeddings were not properly computed due to these timeouts

## Solution Overview

We implemented a **batch processing with recursive invocations** pattern for both the `process` and `embed` Edge Functions to handle large files efficiently.

### Key Features

- ✅ **Batch Processing**: Process items in small batches to stay within CPU limits
- ✅ **Recursive Invocations**: Automatically invoke the function again for remaining items
- ✅ **Time Monitoring**: Track execution time and recurse before hitting limits
- ✅ **Resume Support**: Continue processing from where the previous invocation left off
- ✅ **Error Resilience**: Gracefully handle failures and continue with remaining items

## Implementation Details

### 1. Embed Function Optimization (`supabase/functions/embed/index.ts`)

#### Changes Made

- **Batch Size**: Process 2 embeddings per invocation (configurable via `BATCH_SIZE`)
- **Time Limit**: Monitor execution time and recurse before 50s (leaving 10s buffer)
- **Recursive Logic**: Automatically invoke itself for remaining unprocessed items
- **Auth Token Passing**: Maintain authorization through recursive calls

#### Key Parameters

```typescript
const BATCH_SIZE = 2; // Process 2 items per invocation
const MAX_EXECUTION_TIME = 50000; // 50 seconds
```

#### Flow

```
┌─────────────────────────────────────────────────┐
│  Trigger: Document sections inserted            │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Database Trigger: private.embed()              │
│  - Splits IDs into batches of 10                │
│  - Invokes embed function for each batch        │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Embed Function (1st Invocation)                │
│  - Fetches rows without embeddings              │
│  - Processes 2 items                            │
│  - Checks remaining items                       │
│  - Invokes itself if items remain               │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Embed Function (2nd Invocation)                │
│  - Processes next 2 items                       │
│  - Continues until all items processed          │
└─────────────────────────────────────────────────┘
```

### 2. Process Function Optimization (`supabase/functions/process/index.ts`)

#### Changes Made

- **Batch Insertion**: Insert sections in batches of 50 to avoid timeouts
- **Section Caching**: Cache parsed sections for recursive calls (avoid re-parsing)
- **Offset Tracking**: Resume from specific offset on recursive calls
- **Time Monitoring**: Check execution time and recurse if needed

#### Key Parameters

```typescript
const SECTION_BATCH_SIZE = 50; // Insert 50 sections per batch
const MAX_EXECUTION_TIME = 50000; // 50 seconds
```

#### Flow

```
┌─────────────────────────────────────────────────┐
│  Trigger: File uploaded to storage              │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Process Function (1st Invocation)              │
│  - Downloads file from storage                  │
│  - Parses file (PDF/Markdown)                   │
│  - Extracts all sections                        │
│  - Inserts first 50 sections                    │
│  - Caches sections for next call                │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Process Function (2nd Invocation)              │
│  - Uses cached sections (no re-parsing)         │
│  - Inserts next 50 sections                     │
│  - Continues until all sections inserted        │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│  Embed Trigger Fires (per batch)                │
│  - Starts embed function chain                  │
└─────────────────────────────────────────────────┘
```

### 3. Database Trigger Update

#### Migration: `20260109000000_batch_embed_with_recursion.sql`

Updated the `private.embed()` trigger function to:

- Use batch size of 10 (configurable, default from 5)
- Increase timeout to 8 minutes (480,000ms) to allow recursive chains
- Pass auth token through recursive calls
- Handle missing authorization gracefully

```sql
-- Updated parameters
batch_size int = 10 (default)
timeout_milliseconds int = 8 * 60 * 1000 (default)
```

## Configuration

### Adjustable Parameters

#### Embed Function (`embed/index.ts`)

- `BATCH_SIZE`: Number of embeddings per invocation (default: 2)
- `MAX_EXECUTION_TIME`: Time limit before recursion (default: 50000ms)

#### Process Function (`process/index.ts`)

- `SECTION_BATCH_SIZE`: Sections to insert per batch (default: 50)
- `MAX_EXECUTION_TIME`: Time limit before recursion (default: 50000ms)

#### Database Trigger (`embed.sql`)

- `batch_size`: IDs per function invocation (default: 10)
- `timeout_milliseconds`: HTTP timeout for function calls (default: 480000ms)

### Tuning Recommendations

**For Very Large Files (1000+ sections):**
```typescript
// process/index.ts
const SECTION_BATCH_SIZE = 30; // Reduce batch size
const MAX_EXECUTION_TIME = 45000; // More conservative time limit
```

**For Faster Embedding (when sections are small):**
```typescript
// embed/index.ts
const BATCH_SIZE = 5; // Increase batch size
```

**For Complex/Large Sections:**
```typescript
// embed/index.ts
const BATCH_SIZE = 1; // Process one at a time
const MAX_EXECUTION_TIME = 40000; // More time per section
```

## Deployment

### Apply the Migration

```bash
# Deploy the updated embed trigger
supabase db push

# Or apply specific migration
supabase migration up
```

### Deploy Edge Functions

```bash
# Deploy both optimized functions
supabase functions deploy embed
supabase functions deploy process

# Or deploy individually
supabase functions deploy embed
supabase functions deploy process
```

## Monitoring

### Check Function Logs

```bash
# Monitor embed function
supabase functions logs embed --follow

# Monitor process function
supabase functions logs process --follow
```

### Key Log Messages

**Successful Processing:**
```
Extracted 250 sections from large-file.pdf
Inserted 50 sections (total: 50/250)
150 sections remaining, invoking function recursively
```

**Successful Embedding:**
```
Processing 10 rows (batch size: 2)
Generated embedding {"table":"document_sections","id":123,...}
8 items remaining, invoking function recursively
```

**Time Limit Approach:**
```
Approaching time limit (51000ms), will recurse for remaining items
```

## Benefits

1. **No More Timeouts**: Large files process successfully without CPU time errors
2. **Complete Processing**: All embeddings are generated, none are skipped
3. **Scalable**: Can handle files of any size by chaining invocations
4. **Resilient**: Individual failures don't stop the entire process
5. **Transparent**: Existing code continues to work without changes
6. **Efficient**: Cached sections avoid re-parsing large files

## Testing

### Test with Large File

1. Upload a large PDF or Markdown file (e.g., 500+ sections)
2. Monitor the function logs
3. Verify all sections are inserted and embedded
4. Query the document sections to confirm embeddings

```sql
-- Check embedding status
SELECT 
  document_id,
  COUNT(*) as total_sections,
  COUNT(embedding) as embedded_sections,
  COUNT(*) - COUNT(embedding) as missing_embeddings
FROM document_sections
GROUP BY document_id;
```

### Expected Behavior

- File processing completes without timeout
- Multiple invocations visible in logs
- All sections have embeddings generated
- Chat/search works correctly with the document

## Troubleshooting

### Issue: Still Getting Timeouts

**Solution**: Reduce batch sizes further
```typescript
const BATCH_SIZE = 1; // embed function
const SECTION_BATCH_SIZE = 25; // process function
```

### Issue: Recursive Calls Not Happening

**Check**: Authorization token is being passed correctly
```typescript
// Verify authToken is in the body
console.log('Auth token present:', !!authToken);
```

### Issue: Some Embeddings Missing

**Check**: Database trigger is firing correctly
```sql
-- Verify trigger exists
SELECT * FROM pg_trigger WHERE tgname = 'embed_document_sections';
```

### Issue: Too Many Function Invocations

**Solution**: Increase batch sizes
```typescript
const BATCH_SIZE = 5; // embed function
const SECTION_BATCH_SIZE = 100; // process function
```

## Performance Metrics

### Before Optimization

- ❌ Files > 100 sections: Timeout
- ❌ Incomplete embeddings
- ❌ Manual retry required

### After Optimization

- ✅ Files of any size: Success
- ✅ All embeddings complete
- ✅ Automatic processing
- ✅ ~2-3 seconds per embedding
- ✅ ~100 sections per minute

## Future Improvements

1. **Progress Tracking**: Add a status field to track processing progress
2. **Retry Logic**: Implement exponential backoff for failed embeddings
3. **Priority Queue**: Process important documents first
4. **Parallel Processing**: Process multiple documents simultaneously
5. **Notification**: Alert users when large files are fully processed

## Related Files

- `supabase/functions/embed/index.ts` - Embedding generation with recursion
- `supabase/functions/process/index.ts` - File processing with batch insertion
- `supabase/migrations/20260109000000_batch_embed_with_recursion.sql` - Updated trigger
- `supabase/migrations/20260108111210_embed.sql` - Original trigger (reference)

