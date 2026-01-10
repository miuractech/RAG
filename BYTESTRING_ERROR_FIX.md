# ByteString Error Fix

## Problem Description

The application was experiencing a `"Value is not a valid ByteString"` error when using context files and trying to get chat responses. This error occurred in the Supabase Edge Functions when processing text content.

## Root Cause

The error was caused by invalid UTF-8 characters, null bytes, or special control characters in the text content being passed to the Supabase AI model (`model.run()`). These invalid characters can originate from:

1. **PDF files** - PDFs may contain binary data, special encoding, or characters that don't translate properly to UTF-8
2. **Markdown files** - Files with invalid encoding or special characters
3. **User input** - Messages containing problematic characters
4. **Document sections** - Content stored in the database that wasn't sanitized during processing

## Solution Implemented

Created a comprehensive text sanitization system with the following components:

### 1. Text Sanitizer Library (`_lib/text-sanitizer.ts`)

A new utility library that provides:

- **`sanitizeText(text: string)`** - Main sanitization function that:
  - Removes null bytes (`\0`)
  - Removes control characters (except newlines, tabs, carriage returns)
  - Removes invalid Unicode sequences (replacement character `\uFFFD`)
  - Normalizes Unicode to NFC form
  - Cleans up excessive whitespace
  - Validates UTF-8 encoding

- **`truncateText(text: string, maxLength: number)`** - Safely truncates text while preserving word boundaries

- **`validateAndSanitizeText(text: string)`** - Validates and sanitizes with detailed error reporting

### 2. Applied Sanitization to Edge Functions

Updated all edge functions to sanitize text before passing to the AI model:

#### **chat/index.ts**
- Sanitizes user messages before generating embeddings
- Provides helpful error message if message becomes empty after sanitization

#### **embed/index.ts**
- Sanitizes document section content before generating embeddings
- Logs and skips sections that become empty after sanitization

#### **_lib/agentic-search.ts**
- Sanitizes query variations before generating embeddings
- Skips queries that become empty after sanitization

#### **_lib/pdf-parser.ts**
- Sanitizes extracted PDF text immediately after extraction
- Prevents invalid characters from entering the database

#### **_lib/markdown-parser.ts**
- Sanitizes markdown content before processing
- Sanitizes individual sections after markdown-to-text conversion

## Benefits

1. **Prevents ByteString Errors** - Invalid characters are removed before reaching the AI model
2. **Data Quality** - Ensures clean text is stored in the database
3. **Better Error Messages** - Users get clear feedback if their input has issues
4. **Robust Processing** - Handles edge cases like PDFs with encoding issues
5. **Performance** - Efficient sanitization doesn't significantly impact processing time

## Testing Recommendations

To verify the fix:

1. **Test with PDFs**:
   - Upload a PDF file with special characters or mixed encoding
   - Try to chat with context files selected
   - Verify no ByteString errors occur

2. **Test with Markdown**:
   - Upload markdown files with various character encodings
   - Select them as context and ask questions
   - Ensure responses are generated successfully

3. **Test with Special Characters**:
   - Try sending messages with emojis, special symbols, etc.
   - Verify they're handled gracefully

4. **Test Error Handling**:
   - Try uploading a file with completely invalid content
   - Verify appropriate error messages are shown

## Deployment Steps

1. Deploy the updated edge functions to Supabase:
   ```bash
   supabase functions deploy chat
   supabase functions deploy embed
   supabase functions deploy process
   ```

2. Test in production with real PDFs and context files

3. Monitor edge function logs for any sanitization warnings

## Future Improvements

- Add metrics/logging to track how often sanitization removes content
- Consider adding user warnings when significant content is removed during sanitization
- Implement more sophisticated encoding detection for PDFs
- Add support for additional file formats with proper sanitization
