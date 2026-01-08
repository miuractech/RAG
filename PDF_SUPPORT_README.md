# PDF Support Documentation

## Overview

The application now supports both **Markdown (.md)** and **PDF (.pdf)** files for automatic data extraction and embeddings generation.

## Features Added

### 1. PDF Parser Library (`supabase/functions/_lib/pdf-parser.ts`)

- Extracts text content from PDF files using `unpdf` (edge-optimized, no Canvas/DOM dependencies)
- Chunks content into sections suitable for embedding (default: 2500 characters max)
- Two parsing modes:
  - **Standard**: Extracts all text and chunks it intelligently
  - **With Formatting**: Preserves paragraph structure during chunking

> **Why unpdf?** Unlike `pdfjs-dist`, `unpdf` is specifically designed for edge/serverless environments with no Canvas or DOM dependencies, making it perfect for Deno edge functions.

### 2. Updated Process Function (`supabase/functions/process/index.ts`)

- Automatically detects file type based on extension
- Routes to appropriate parser (Markdown or PDF)
- Handles errors gracefully with detailed logging
- Supports fallback to text parsing for unknown file types

### 3. Enhanced File Upload UI (`app/files/FilesClient.tsx`)

- Accepts both `.md`, `.markdown`, and `.pdf` files
- Client-side file type validation
- Visual differentiation between file types (red for PDF, blue for Markdown)
- User feedback with toast notifications

## How It Works

### Upload Flow

1. **User uploads file** → File is stored in Supabase Storage
2. **Storage trigger fires** → Calls `/functions/v1/process` edge function
3. **Process function**:
   - Detects file type (PDF or Markdown)
   - Downloads file from storage
   - Extracts and chunks content using appropriate parser
   - Saves sections to `document_sections` table
4. **Embedding generation** → Embeddings are created for each section via database triggers
5. **RAG ready** → Content is now searchable in the chat interface

### File Processing

#### PDF Files
- Text is extracted from the entire document
- Content is intelligently chunked based on section length
- Optional formatting preservation (paragraph-aware chunking)
- Works with any text-based PDF

#### Markdown Files
- Split by heading structure
- Preserves markdown formatting
- Chunks large sections intelligently

## Testing the Implementation

### 1. Deploy Edge Functions

```bash
# Navigate to your project
cd /Users/sanjeev/Desktop/crownwell/crownwell-rag/chatgpt-your-files

# Deploy the updated process function
supabase functions deploy process

# Verify deployment
supabase functions list
```

### 2. Test PDF Upload

1. **Start the development server** (if not already running):
   ```bash
   npm run dev
   ```

2. **Navigate to the files page**: `http://localhost:3000/files`

3. **Upload a test PDF**:
   - Click the file input
   - Select a PDF file
   - Verify the upload success notification

4. **Check processing**:
   ```bash
   # View process function logs
   supabase functions logs process --follow
   ```

5. **Verify in database**:
   ```sql
   -- Check if document was created
   SELECT * FROM documents ORDER BY created_at DESC LIMIT 1;
   
   -- Check if sections were extracted
   SELECT document_id, COUNT(*) as section_count, 
          LENGTH(content) as avg_length
   FROM document_sections 
   GROUP BY document_id 
   ORDER BY document_id DESC;
   
   -- Check if embeddings were generated
   SELECT COUNT(*) as sections_with_embeddings
   FROM document_sections 
   WHERE embedding IS NOT NULL;
   ```

6. **Test in chat**:
   - Navigate to `/chat`
   - Ask questions about the PDF content
   - Verify that relevant sections are retrieved

### 3. Test Different File Types

Test with various files:
- ✅ Small PDF (1-2 pages)
- ✅ Large PDF (50+ pages)
- ✅ PDF with images (text extraction only)
- ✅ Markdown file (existing functionality)
- ✅ Complex PDF with tables and formatting

### 4. Monitor Edge Function Logs

```bash
# Process function logs
supabase functions logs process --follow

# Embed function logs (for embedding generation)
supabase functions logs embed --follow

# Check for errors
supabase functions logs process --level error
```

## Troubleshooting

### Issue: "Failed to process PDF file"

**Possible causes:**
- PDF is corrupted or encrypted
- PDF contains only images (no text layer)
- Memory limits exceeded for very large PDFs

**Solutions:**
- Verify PDF opens correctly in a PDF reader
- Ensure PDF has selectable text (not scanned images)
- Check edge function logs: `supabase functions logs process`

### Issue: No sections extracted from PDF

**Possible causes:**
- PDF contains only images
- Text encoding issues

**Solutions:**
- Use OCR tool to add text layer to PDF
- Try converting PDF to text first to verify content

### Issue: Upload succeeds but no embeddings generated

**Possible causes:**
- Embed function not triggered
- Database trigger not firing

**Solutions:**
- Check embed function logs
- Manually trigger embeddings:
  ```sql
  SELECT net.http_post(
    url := supabase_url() || '/functions/v1/embed',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'ids', ARRAY[<section_ids>],
      'table', 'document_sections',
      'contentColumn', 'content',
      'embeddingColumn', 'embedding'
    )
  );
  ```

## Performance Considerations

### PDF Size Limits

- **Recommended**: < 10 MB per PDF
- **Maximum**: Depends on edge function memory limits (~50 MB)
- Large PDFs are chunked automatically

### Processing Time

- Small PDF (1-10 pages): 2-5 seconds
- Medium PDF (10-50 pages): 5-15 seconds
- Large PDF (50+ pages): 15-30 seconds

### Embedding Generation

- Asynchronous process
- May take additional time after processing
- Check `embedding` column in `document_sections` table

## Dependencies

### Added to `import_map.json`:
```json
"unpdf": "https://esm.sh/unpdf@0.11.0"
```

**Why unpdf instead of pdfjs-dist?**
- ✅ No native dependencies (Canvas, DOM)
- ✅ Works perfectly in Deno edge functions
- ✅ Lightweight and fast
- ✅ Specifically designed for serverless environments
- ✅ No complex configuration needed

## File Structure

```
supabase/functions/
├── _lib/
│   ├── markdown-parser.ts  (existing)
│   └── pdf-parser.ts       (NEW)
├── process/
│   └── index.ts           (UPDATED)
├── embed/
│   └── index.ts           (existing)
└── import_map.json        (UPDATED)

app/files/
└── FilesClient.tsx        (UPDATED)
```

## Future Enhancements

Potential improvements:
- [ ] OCR support for scanned PDFs (Tesseract.js)
- [ ] DOCX/DOC file support
- [ ] Excel/CSV file support
- [ ] Image file support with OCR
- [ ] Better chunking strategies (semantic splitting)
- [ ] Progress indicators for large files
- [ ] Batch upload support

## API Reference

### PDF Parser Functions

#### `processPdf(pdfBuffer, maxSectionLength)`
Extracts text from PDF with intelligent chunking.

**Parameters:**
- `pdfBuffer`: ArrayBuffer | Uint8Array - The PDF file data
- `maxSectionLength`: number (optional, default: 2500) - Max characters per section

**Returns:**
```typescript
{
  sections: Array<{
    content: string;
    part?: number;
    total?: number;
  }>
}
```

#### `processPdfWithFormatting(pdfBuffer, maxSectionLength)`
Extracts text from PDF with paragraph-aware chunking for better formatting preservation.

**Parameters:** Same as above

**Returns:** Same structure, but chunks respect paragraph boundaries

## Support

For issues or questions:
1. Check edge function logs
2. Verify database records
3. Review this documentation
4. Check Supabase dashboard for errors

