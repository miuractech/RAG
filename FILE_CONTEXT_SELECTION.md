# File Context Selection Feature

## Overview
This feature allows users to select specific files (up to 10) to query from within the chat interface. Selected files are displayed in the chat for transparency, and the RAG system filters document searches to only the selected files.

## Changes Made

### 1. Database Migration
**File**: `supabase/migrations/20260110000000_match_with_file_filter.sql`

Enhanced the `match_document_sections` function to accept an optional `file_ids` parameter:
- When `file_ids` is `null` or not provided: searches across all user's documents (default behavior)
- When `file_ids` is provided: filters results to only those document sections belonging to the specified files

### 2. FileSelector Component
**File**: `components/FileSelector.tsx`

Created a new aside component with the following features:
- Displays all user's uploaded files in a scrollable sidebar
- Search functionality to filter files by name
- Visual distinction between PDF and Markdown files
- Checkbox selection with max limit enforcement (10 files)
- Selected count display
- "Clear all" functionality
- Responsive design with file icons and timestamps

### 3. Chat Page Updates
**File**: `app/chat/page.tsx`

Major updates to the chat interface:
- **Layout**: Changed from centered single column to flex layout with FileSelector aside
- **State Management**: 
  - Added `selectedFileIds` state to track selected files
  - Added `documents` state for file name lookup
  - Added helper function `getSelectedFileDetails()` to map IDs to names
- **Message Structure**: Extended Message interface to include `selectedFiles` array
- **Selected Files Display**: Shows selected files above each user message with file badges
- **API Integration**: Passes `fileIds` to backend in all chat requests (initial, regenerate, edit)

### 4. Backend Updates

#### Chat Function
**File**: `supabase/functions/chat/index.ts`

- Accepts `fileIds` parameter from request
- Passes `fileIds` to both agentic search and simple search modes
- Maintains backward compatibility (works with or without file selection)

#### Agentic Search
**File**: `supabase/functions/_lib/agentic-search.ts`

- Extended `AgenticSearchConfig` interface with `fileIds` parameter
- Updated `performAgenticSearch` to pass file IDs to database queries
- All query variations respect the file filter

## User Experience

### File Selection
1. User opens the chat page
2. Right sidebar shows all uploaded files
3. User can search and select up to 10 files
4. Selected files show with checkmarks and highlighted background
5. Selection count is displayed at the top

### Querying with Context
1. When user types a message, selected files are captured with the message
2. Message displays with file context badges showing which files are being queried
3. Backend filters search to only the selected files
4. If no files selected, all files are searched (default behavior)

### Visual Feedback
- Selected files shown as blue badges above user messages
- Format: "📁 Context Files (2/10): file1.md, file2.pdf"
- File type icons distinguish PDFs from Markdown files
- Hover states and transitions for better UX

## Technical Benefits

1. **Performance**: Reduced search space when querying specific files
2. **Accuracy**: More relevant results by narrowing context
3. **Transparency**: Users know exactly which files are being queried
4. **Flexibility**: Can switch between all-files and specific-files mode per message
5. **Scalability**: Efficient filtering at the database level

## Migration Instructions

1. **Apply Database Migration**:
   ```bash
   # If using Supabase CLI
   supabase db push
   
   # Or apply the migration manually through Supabase dashboard
   ```

2. **Deploy Edge Functions**:
   ```bash
   supabase functions deploy chat
   ```

3. **Deploy Frontend**:
   ```bash
   # Build and deploy your Next.js app
   npm run build
   ```

## Backward Compatibility

All changes are backward compatible:
- If `fileIds` is not provided, the system searches all files (original behavior)
- Existing chat functionality remains unchanged
- No breaking changes to existing APIs or database schema

## Future Enhancements

Potential improvements:
1. Save file selection preferences per user
2. Create file groups/collections for quick selection
3. Show file preview on hover
4. Bulk upload and selection
5. File tagging and categorization
6. Analytics on which files are most queried

## Testing Checklist

- [ ] Upload multiple files (MD and PDF)
- [ ] Select files in the sidebar
- [ ] Verify file badges appear in chat messages
- [ ] Test search functionality works
- [ ] Test max selection limit (10 files)
- [ ] Test chat with selected files
- [ ] Test chat with no files selected (all files mode)
- [ ] Test regenerate with file context
- [ ] Test edit message with file context
- [ ] Verify agentic search respects file filter
- [ ] Verify simple search respects file filter

