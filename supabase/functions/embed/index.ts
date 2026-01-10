// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from '@supabase/supabase-js';
import { sanitizeText } from '../_lib/text-sanitizer.ts';

console.log("Hello from Functions!")

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Initialize Supabase AI session for generating embeddings
const model = new Supabase.ai.Session('gte-small');

// Maximum items to process in a single invocation
const BATCH_SIZE = 2;

// Maximum execution time (in ms) before triggering recursive call
const MAX_EXECUTION_TIME = 50000; // 50 seconds (leaving buffer before 60s limit)

Deno.serve(async (req: Request) => {
  const startTime = Date.now();
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return new Response(
      JSON.stringify({
        error: 'Missing environment variables.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Use service role key to bypass RLS policies
  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
    },
  });

  const { ids, table, contentColumn, embeddingColumn, authToken } = await req.json();

  // Get rows that still need embeddings
  const { data: rows, error: selectError } = await supabase
    .from(table)
    .select(`id, ${contentColumn}` as '*')
    .in('id', ids)
    .is(embeddingColumn, null);

  if (selectError) {
    console.error('Error selecting rows:', selectError);
    return new Response(JSON.stringify({ error: selectError }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!rows || rows.length === 0) {
    console.log('No rows to process or all embeddings already generated');
    return new Response(JSON.stringify({ 
      message: 'No rows to process',
      processed: 0 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log(`Processing ${rows.length} rows (batch size: ${BATCH_SIZE})`);

  let processedCount = 0;
  let shouldRecurse = false;

  // Process items in smaller batches
  for (let i = 0; i < rows.length && i < BATCH_SIZE; i++) {
    const row = rows[i];
    const { id, [contentColumn]: content } = row;

    // Check if we're approaching time limit
    const elapsedTime = Date.now() - startTime;
    if (elapsedTime > MAX_EXECUTION_TIME) {
      console.log(`Approaching time limit (${elapsedTime}ms), will recurse for remaining items`);
      shouldRecurse = true;
      break;
    }

    if (!content) {
      console.error(`No content available in column '${contentColumn}' for id ${id}`);
      processedCount++;
      continue;
    }

    // Sanitize content to prevent ByteString errors
    const sanitizedContent = sanitizeText(content);
    
    if (!sanitizedContent) {
      console.error(`Content became empty after sanitization for id ${id}`);
      processedCount++;
      continue;
    }

    try {
      // Generate embedding using Supabase AI
      const output = await model.run(sanitizedContent, {
        mean_pool: true,
        normalize: true,
      });

      const embedding = JSON.stringify(output);

      const { error } = await supabase
        .from(table)
        .update({
          [embeddingColumn]: embedding,
        })
        .eq('id', id);

      if (error) {
        console.error(
          `Failed to save embedding on '${table}' table with id ${id}:`,
          error
        );
      } else {
        console.log(
          `Generated embedding ${JSON.stringify({
            table,
            id,
            contentColumn,
            embeddingColumn,
          })}`
        );
      }
    } catch (error) {
      console.error(`Error generating embedding for id ${id}:`, error);
    }

    processedCount++;
  }

  // Check if there are more rows to process
  const { data: remainingRows, error: remainingError } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .in('id', ids)
    .is(embeddingColumn, null);

  const remainingCount = remainingError ? 0 : (remainingRows?.length || 0);

  if (remainingCount > 0 || shouldRecurse) {
    console.log(`${remainingCount} items remaining, invoking function recursively`);
    
    // Invoke the function again for remaining items (fire and forget)
    fetch(`${supabaseUrl}/functions/v1/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authToken || req.headers.get('Authorization') || '',
      },
      body: JSON.stringify({
        ids,
        table,
        contentColumn,
        embeddingColumn,
        authToken: authToken || req.headers.get('Authorization'),
      }),
    }).catch(error => {
      console.error('Error invoking recursive call:', error);
    });

    // Don't await the recursive call to avoid blocking
    // The recursive call will process the remaining items
  }

  return new Response(JSON.stringify({ 
    processed: processedCount,
    remaining: remainingCount,
    recurse: remainingCount > 0 || shouldRecurse
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/embed' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
