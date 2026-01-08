import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from '@supabase/supabase-js';
import { processMarkdown } from '../_lib/markdown-parser.ts';
import { processPdf } from '../_lib/pdf-parser.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Batch size for inserting sections to avoid CPU timeout
const SECTION_BATCH_SIZE = 50;

// Maximum execution time (in ms) before triggering recursive call
const MAX_EXECUTION_TIME = 50000; // 50 seconds (leaving buffer before 60s limit)

/**
 * Determines file type based on file extension
 */
function getFileType(filename: string): 'pdf' | 'markdown' | 'unknown' {
  const extension = filename.toLowerCase().split('.').pop();
  
  if (extension === 'pdf') {
    return 'pdf';
  }
  
  if (extension === 'md' || extension === 'markdown') {
    return 'markdown';
  }
  
  return 'unknown';
}

/**
 * Insert sections in batches to avoid timeouts
 */
async function insertSectionsInBatches(
  supabase: ReturnType<typeof createClient>,
  document_id: number,
  sections: Array<{ content: string }>,
  startIndex: number = 0
): Promise<{ inserted: number; remaining: number; error?: unknown }> {
  const sectionsToInsert = sections.slice(startIndex, startIndex + SECTION_BATCH_SIZE);
  
  if (sectionsToInsert.length === 0) {
    return { inserted: 0, remaining: 0 };
  }

  const { error } = await supabase.from('document_sections').insert(
    sectionsToInsert.map(({ content }) => ({
      document_id,
      content,
    }))
  );

  if (error) {
    return { inserted: 0, remaining: sections.length - startIndex, error };
  }

  const inserted = sectionsToInsert.length;
  const remaining = sections.length - (startIndex + inserted);

  return { inserted, remaining };
}

Deno.serve(async (req: Request) => {
  const startTime = Date.now();
  
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('Missing environment variables.');
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

  const { document_id, sections_offset = 0, cached_sections } = await req.json();

  let sections: Array<{ content: string }> = [];
  let documentName = '';
  let fileType: 'pdf' | 'markdown' | 'unknown' = 'unknown';

  // If cached_sections is provided, use it (recursive call)
  if (cached_sections && Array.isArray(cached_sections)) {
    sections = cached_sections;
    console.log(`Using ${sections.length} cached sections from offset ${sections_offset}`);
    
    // Get document name for logging
    const { data: doc } = await supabase
      .from('documents')
      .select('name')
      .eq('id', document_id)
      .single();
    documentName = doc?.name || 'unknown';
  } else {
    // First call - fetch and process the file
    const { data: document } = await supabase
      .from('documents_with_storage_path')
      .select()
      .eq('id', document_id)
      .single();

    if (!document?.storage_object_path) {
      return new Response(
        JSON.stringify({ error: 'Failed to find uploaded document' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    documentName = document.name;

    const { data: file } = await supabase.storage
      .from('files')
      .download(document.storage_object_path);

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'Failed to download storage object' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Determine file type and process accordingly
    fileType = getFileType(document.name);

    try {
      if (fileType === 'pdf') {
        console.log(`Processing PDF file: ${document.name}`);
        const arrayBuffer = await file.arrayBuffer();
        const processedPdf = await processPdf(arrayBuffer);
        sections = processedPdf.sections.map(({ content }) => ({ content }));
      } else if (fileType === 'markdown') {
        console.log(`Processing Markdown file: ${document.name}`);
        const fileContents = await file.text();
        const processedMd = processMarkdown(fileContents);
        sections = processedMd.sections.map(({ content }) => ({ content }));
      } else {
        console.warn(`Unknown file type for: ${document.name}. Treating as text.`);
        const fileContents = await file.text();
        const processedMd = processMarkdown(fileContents);
        sections = processedMd.sections.map(({ content }) => ({ content }));
      }
    } catch (error) {
      console.error('Error processing file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return new Response(
        JSON.stringify({ error: `Failed to process ${fileType} file: ${errorMessage}` }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (sections.length === 0) {
      console.warn(`No content extracted from file: ${document.name}`);
      return new Response(
        JSON.stringify({ error: 'No content could be extracted from the file' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Extracted ${sections.length} sections from ${document.name}`);
  }

  // Insert sections in batches
  let totalInserted = 0;
  let currentOffset = sections_offset;
  let shouldRecurse = false;

  while (currentOffset < sections.length) {
    // Check if we're approaching time limit
    const elapsedTime = Date.now() - startTime;
    if (elapsedTime > MAX_EXECUTION_TIME) {
      console.log(`Approaching time limit (${elapsedTime}ms), will recurse for remaining sections`);
      shouldRecurse = true;
      break;
    }

    const result = await insertSectionsInBatches(supabase, document_id, sections, currentOffset);
    
    if (result.error) {
      console.error('Error inserting sections:', result.error);
      return new Response(
        JSON.stringify({ error: 'Failed to save document sections' }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    totalInserted += result.inserted;
    currentOffset += result.inserted;

    console.log(`Inserted ${result.inserted} sections (total: ${totalInserted}/${sections.length})`);

    if (result.remaining === 0) {
      break;
    }
  }

  const remainingSections = sections.length - currentOffset;

  // If there are remaining sections, invoke recursively
  if (remainingSections > 0 || shouldRecurse) {
    console.log(`${remainingSections} sections remaining, invoking function recursively`);
    
    // Invoke the function again for remaining sections (fire and forget)
    fetch(`${supabaseUrl}/functions/v1/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.get('Authorization') || '',
      },
      body: JSON.stringify({
        document_id,
        sections_offset: currentOffset,
        cached_sections: sections, // Pass the already-parsed sections
      }),
    }).catch(error => {
      console.error('Error invoking recursive call:', error);
    });
  }

  console.log(
    `Processed ${totalInserted} sections for file '${documentName}' (remaining: ${remainingSections})`
  );

  return new Response(JSON.stringify({
    inserted: totalInserted,
    remaining: remainingSections,
    total: sections.length,
    recurse: remainingSections > 0 || shouldRecurse
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
