// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { createClient } from '@supabase/supabase-js';
import { OpenAIStream, StreamingTextResponse } from 'ai';
import OpenAI from 'openai';
import { performAgenticSearch, generateAgenticSystemPrompt } from '../_lib/agentic-search.ts';

const openai = new OpenAI({
  apiKey: Deno.env.get('OPENAI_API_KEY'),
});

// These are automatically injected
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

// Initialize Supabase AI session for generating embeddings
const model = new Supabase.ai.Session('gte-small');

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({
          error: 'Missing environment variables.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    const authorization = req.headers.get('Authorization');
    
    if (!authorization) {
      return new Response(
        JSON.stringify({ error: `No authorization header passed` }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          authorization,
        },
      },
      auth: {
        persistSession: false,
      },
    });

    const { message, messages, useAgenticSearch = true } = await req.json();

    let content: string;
    let agenticResult: Awaited<ReturnType<typeof performAgenticSearch>> | undefined;

    // Use agentic search with query reconstruction and chaining
    if (useAgenticSearch) {
      console.log('[Chat] Using Agentic Search mode');
      
      try {
        // Perform agentic search with multiple query variations
        // Optimized for edge function resource limits
        agenticResult = await performAgenticSearch(
          message,
          supabase,
          model,
          {
            maxIterations: 3,            // Try up to 3 iterations (resource-optimized)
            confidenceThreshold: 0.65,   // Stop if we get good confidence results
            matchThreshold: 0.75,        // Slightly lower threshold to cast wider net
            resultsPerQuery: 4,          // Get 4 docs per query
            enableChaining: true,        // Enable contextual query chaining
            maxQueriesPerIteration: 3,   // Max 3 queries per iteration
            timeoutMs: 25000             // 25 second timeout for safety
          }
        );

        // Generate enhanced system prompt with agentic results
        content = generateAgenticSystemPrompt(agenticResult, message);

        // Log search summary
        console.log(`[Chat] Agentic search completed:
          - Total queries: ${agenticResult.totalQueries}
          - Iterations: ${agenticResult.iterations.length}
          - Context size: ${agenticResult.aggregatedContext.length} chars
        `);
      } catch (agenticError) {
        console.error('[Chat] Agentic search failed, falling back to simple search:', agenticError);
        // Fall back to simple search
        useAgenticSearch = false; // Mark as fallback for response headers
      }
    }
    
    // Simple search (either by choice or as fallback)
    if (!useAgenticSearch || !content) {
      // Fallback to original simple search
      console.log('[Chat] Using Simple Search mode');
      
      const embeddingOutput = await model.run(message, {
        mean_pool: true,
        normalize: true,
      });

      const embedding = Array.from(embeddingOutput);

      const { data: documents, error: matchError } = await supabase
        .rpc('match_document_sections', {
          embedding,
          match_threshold: 0.8,
        })
        .select('content')
        .limit(5);

      if (matchError) {
        console.error(matchError);
        return new Response(
          JSON.stringify({
            error: 'There was an error reading your documents, please try again.',
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const injectedDocs =
        documents && documents.length > 0
          ? documents.map(({ content }) => content).join('\n\n')
          : 'No documents found';

      content = `You're an AI assistant who answers questions about documents.

You're a chat bot, so keep your replies succinct.

You're only allowed to use the documents below to answer the question.

If the question isn't related to these documents, say:
"Sorry, I couldn't find any information on that."

If the information isn't available in the below documents, say:
"Sorry, I couldn't find any information on that."

Do not go off topic.

Documents:
${injectedDocs}`;
    }
    const completionMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
      [
        {
          role: 'system',
          content,
        },
        ...messages,
        {
          role: 'user',
          content: message,
        },
      ];

    const completionStream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: completionMessages, 
      stream: true,
    });
  
    const stream = OpenAIStream(completionStream);
    
    // Add search metadata to response headers if using agentic search
    const responseHeaders = { ...corsHeaders };
    if (useAgenticSearch && typeof agenticResult !== 'undefined') {
      responseHeaders['X-Search-Metadata'] = JSON.stringify({
        iterations: agenticResult.iterations,
        totalQueries: agenticResult.totalQueries,
      });
    }
    
    return new StreamingTextResponse(stream, { headers: responseHeaders });
  } catch (error) {
    console.error('Error in chat function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/chat' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
