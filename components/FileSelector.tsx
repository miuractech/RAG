'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useState, useMemo } from 'react';
import { toast } from '@/components/ui/use-toast';
import { Input } from '@/components/ui/input';
import { X, Search, FileText, File, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Document {
  id: number;
  name: string;
  storage_object_path: string;
  created_at: string;
}

interface FileSelectorProps {
  selectedFileIds: number[];
  onSelectionChange: (fileIds: number[]) => void;
  maxSelection?: number;
}

export default function FileSelector({ 
  selectedFileIds, 
  onSelectionChange, 
  maxSelection = 10 
}: FileSelectorProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents_with_storage_path')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load documents',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleFile = (fileId: number) => {
    if (selectedFileIds.includes(fileId)) {
      onSelectionChange(selectedFileIds.filter(id => id !== fileId));
    } else {
      if (selectedFileIds.length >= maxSelection) {
        toast({
          title: 'Selection Limit',
          description: `You can only select up to ${maxSelection} files`,
          variant: 'destructive',
        });
        return;
      }
      onSelectionChange([...selectedFileIds, fileId]);
    }
  };

  const clearSelection = () => {
    onSelectionChange([]);
  };

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Reset to page 1 when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Pagination logic
  const totalPages = Math.ceil(filteredDocuments.length / itemsPerPage);
  const paginatedDocuments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredDocuments.slice(startIndex, endIndex);
  }, [filteredDocuments, currentPage, itemsPerPage]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const isPdf = (filename: string) => filename.toLowerCase().endsWith('.pdf');

  return (
    <div className="w-80 border-l border-border bg-background flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <h2 className="text-base font-semibold mb-1">File Context</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Select up to {maxSelection} files to query from
        </p>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm bg-background border-input"
          />
        </div>

        {/* Selected count */}
        {selectedFileIds.length > 0 && (
          <div className="mt-3 flex items-center justify-between text-sm">
            <span className="text-primary font-medium">
              {selectedFileIds.length} selected
            </span>
            <button
              onClick={clearSelection}
              className="text-destructive hover:text-destructive/80 text-xs font-medium transition-colors"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-sm text-muted-foreground">Loading files...</div>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-center px-4">
            <FileText className="h-12 w-12 text-muted-foreground/30 mb-2" />
            <div className="text-sm text-muted-foreground">
              {searchQuery ? 'No files found' : 'No files uploaded yet'}
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-primary hover:text-primary/80 mt-2 font-medium"
              >
                Clear search
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {paginatedDocuments.map((doc) => {
              const isSelected = selectedFileIds.includes(doc.id);
              const docIsPdf = isPdf(doc.name);
              
              return (
                <div
                  key={doc.id}
                  onClick={() => toggleFile(doc.id)}
                  className={`
                    flex items-start gap-3 p-3 rounded-lg cursor-pointer
                    transition-all duration-200
                    ${isSelected 
                      ? 'bg-primary/10 border border-primary/30 shadow-sm' 
                      : 'bg-card border border-border hover:bg-secondary/50 hover:border-border'
                    }
                  `}
                >
                  {/* Checkbox */}
                  <div className="flex-shrink-0 mt-0.5">
                    <div
                      className={`
                        w-4 h-4 rounded border-2 flex items-center justify-center transition-all
                        ${isSelected 
                          ? 'bg-primary border-primary' 
                          : 'border-input bg-background'
                        }
                      `}
                    >
                      {isSelected && (
                        <svg
                          className="w-3 h-3 text-primary-foreground"
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2.5"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* File Icon */}
                  <div className="flex-shrink-0">
                    {docIsPdf ? (
                      <File className="h-5 w-5 text-destructive" />
                    ) : (
                      <FileText className="h-5 w-5 text-accent" />
                    )}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {doc.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer with pagination and tip */}
      {!loading && documents.length > 0 && (
        <div className="border-t border-border bg-card">
          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="text-xs text-muted-foreground font-medium">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="h-8 w-8 p-0"
                  title="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="h-8 w-8 p-0"
                  title="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
          
          {/* Items per page selector */}
          <div className="px-4 py-3 border-b border-border flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">Items per page:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="border border-input rounded-md px-2 py-1 text-xs bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
            >
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={48}>48</option>
              <option value={96}>96</option>
            </select>
          </div>

          {/* Tip */}
          <div className="p-4 bg-secondary/30">
            <p className="text-xs text-muted-foreground">
              💡 Select files to narrow your search context
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

