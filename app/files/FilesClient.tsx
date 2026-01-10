'use client';

import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/components/ui/use-toast';
import { Pagination } from '@/components/ui/pagination';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';

type Document = {
  id: string;
  name: string;
  storage_object_path: string;
};

type FilesClientProps = {
  initialDocuments: Document[];
};

export default function FilesClient({ initialDocuments }: FilesClientProps) {
  const router = useRouter();
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [fileName, setFileName] = useState<string>('');
  const [uploadXhr, setUploadXhr] = useState<XMLHttpRequest | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(12);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Pagination logic
  const totalPages = Math.ceil(initialDocuments.length / itemsPerPage);
  const paginatedDocuments = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return initialDocuments.slice(startIndex, endIndex);
  }, [initialDocuments, currentPage, itemsPerPage]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of the page
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  const cancelUpload = () => {
    if (uploadXhr) {
      uploadXhr.abort();
      setUploadXhr(null);
    }
    setIsUploading(false);
    setUploadProgress(0);
    setFileName('');
    toast({
      description: 'Upload cancelled',
    });
  };

  const handleDelete = async (documentId: string, documentName: string) => {
    try {
      // Delete from database (this will cascade delete embeddings)
      const { error: dbError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (dbError) throw dbError;

      toast({
        description: `Successfully deleted ${documentName}`,
      });

      // Refresh the page to update the list
      router.refresh();
      setDeleteConfirmId(null);
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        variant: 'destructive',
        description: 'Failed to delete file. Please try again.',
      });
    }
  };

  const handleFileUpload = async (selectedFile: File) => {
    // Validate file type
    const fileNameLower = selectedFile.name.toLowerCase();
    const isValidFile = fileNameLower.endsWith('.md') || 
                       fileNameLower.endsWith('.markdown') || 
                       fileNameLower.endsWith('.pdf');
    
    if (!isValidFile) {
      toast({
        variant: 'destructive',
        description: 'Please upload a Markdown (.md) or PDF (.pdf) file.',
      });
      return;
    }

    setIsUploading(true);
    setFileName(selectedFile.name);
    setUploadProgress(0);

    try {
      const filePath = `${crypto.randomUUID()}/${selectedFile.name}`;
      
      // Get signed URL for upload
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session');
      }

      // Upload with XMLHttpRequest to track progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        setUploadXhr(xhr);
        
        // Track upload progress
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(Math.min(percentComplete, 99)); // Keep at 99% until complete
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadXhr(null);
            resolve();
          } else {
            setUploadXhr(null);
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          setUploadXhr(null);
          reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
          setUploadXhr(null);
          reject(new Error('Upload cancelled'));
        });

        // Build upload URL
        const uploadUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/files/${filePath}`;
        
        xhr.open('POST', uploadUrl);
        xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
        xhr.setRequestHeader('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
        
        // Create form data
        const formData = new FormData();
        formData.append('', selectedFile);
        
        xhr.send(formData);
      });

      setUploadProgress(100);
      
      toast({
        description: `Successfully uploaded ${selectedFile.name}. Processing...`,
      });

      // Small delay to show 100% before redirecting
      setTimeout(() => {
        setIsUploading(false);
        router.push('/chat');
      }, 500);

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        variant: 'destructive',
        description:
          error.message || 'There was an error uploading the file. Please try again.',
      });
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="max-w-6xl m-4 sm:m-10 flex flex-col gap-8 grow items-stretch">
      <div className="min-h-40 flex flex-col justify-center items-center border-b pb-8 gap-4">
        <Input
          type="file"
          name="file"
          accept=".md,.markdown,.pdf"
          className="cursor-pointer w-full max-w-xs"
          disabled={isUploading}
          onChange={async (e) => {
            const selectedFile = e.target.files?.[0];
            if (selectedFile) {
              await handleFileUpload(selectedFile);
              // Reset input
              e.target.value = '';
            }
          }}
        />
        <p className="text-sm text-gray-500">
          Upload Markdown (.md) or PDF (.pdf) files
        </p>
        
        {isUploading && (
          <div className="w-full max-w-xs space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 truncate max-w-[200px]" title={fileName}>
                {fileName}
              </span>
              <span className="text-gray-600 font-medium">
                {uploadProgress}%
              </span>
            </div>
            <Progress value={uploadProgress} className="h-2" />
            <div className="flex justify-between items-center">
              <p className="text-xs text-gray-500">
                {uploadProgress === 100 ? 'Upload complete! Processing...' : 'Uploading...'}
              </p>
              {uploadProgress < 100 && (
                <button
                  onClick={cancelUpload}
                  className="text-xs text-red-600 hover:text-red-800 font-medium"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      {initialDocuments && initialDocuments.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {paginatedDocuments.map((document) => {
            const isPdf = document.name.toLowerCase().endsWith('.pdf');
            
            return (
              <div
                key={document.id}
                className="relative flex flex-col gap-2 justify-center items-center border rounded-md p-4 sm:p-6 text-center overflow-hidden group"
              >
                {/* Delete button - shows on hover */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteConfirmId(document.id);
                  }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  title="Delete file"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {/* Confirmation dialog overlay */}
                {deleteConfirmId === document.id && (
                  <div className="absolute inset-0 bg-white bg-opacity-95 flex flex-col items-center justify-center gap-3 p-3 z-10">
                    <p className="text-sm font-semibold text-gray-900">Delete this file?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(document.id, document.name)}
                        className="px-3 py-1.5 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                      >
                        Delete
                      </button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="px-3 py-1.5 bg-gray-300 text-gray-700 text-sm rounded hover:bg-gray-400"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div
                  className="cursor-pointer w-full h-full flex flex-col gap-2 items-center justify-center"
                  onClick={async () => {
                  const { data, error } = await supabase.storage
                    .from('files')
                    .createSignedUrl(document.storage_object_path, 60);

                  if (error) {
                    toast({
                      variant: 'destructive',
                      description: 'Failed to download file. Please try again.',
                    });
                    return;
                  }

                  window.location.href = data.signedUrl;
                }}
              >
                {isPdf ? (
                  // PDF Icon
                  <svg
                    width="50px"
                    height="50px"
                    version="1.1"
                    viewBox="0 0 100 100"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="#dc2626"
                  >
                    <path d="m82 31.199c0.10156-0.60156-0.10156-1.1992-0.60156-1.6992l-24-24c-0.39844-0.39844-1-0.5-1.5977-0.5h-0.19922-31c-3.6016 0-6.6016 3-6.6016 6.6992v76.5c0 3.6992 3 6.6992 6.6016 6.6992h50.801c3.6992 0 6.6016-3 6.6016-6.6992l-0.003906-56.699v-0.30078zm-48-7.1992h10c1.1016 0 2 0.89844 2 2s-0.89844 2-2 2h-10c-1.1016 0-2-0.89844-2-2s0.89844-2 2-2zm32 52h-32c-1.1016 0-2-0.89844-2-2s0.89844-2 2-2h32c1.1016 0 2 0.89844 2 2s-0.89844 2-2 2zm0-16h-32c-1.1016 0-2-0.89844-2-2s0.89844-2 2-2h32c1.1016 0 2 0.89844 2 2s-0.89844 2-2 2zm0-16h-32c-1.1016 0-2-0.89844-2-2s0.89844-2 2-2h32c1.1016 0 2 0.89844 2 2s-0.89844 2-2 2zm-8-15v-17.199l17.199 17.199z" />
                  </svg>
                ) : (
                  // Markdown Icon
                  <svg
                    width="50px"
                    height="50px"
                    version="1.1"
                    viewBox="0 0 100 100"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="#0ea5e9"
                  >
                    <path d="m82 31.199c0.10156-0.60156-0.10156-1.1992-0.60156-1.6992l-24-24c-0.39844-0.39844-1-0.5-1.5977-0.5h-0.19922-31c-3.6016 0-6.6016 3-6.6016 6.6992v76.5c0 3.6992 3 6.6992 6.6016 6.6992h50.801c3.6992 0 6.6016-3 6.6016-6.6992l-0.003906-56.699v-0.30078zm-48-7.1992h10c1.1016 0 2 0.89844 2 2s-0.89844 2-2 2h-10c-1.1016 0-2-0.89844-2-2s0.89844-2 2-2zm32 52h-32c-1.1016 0-2-0.89844-2-2s0.89844-2 2-2h32c1.1016 0 2 0.89844 2 2s-0.89844 2-2 2zm0-16h-32c-1.1016 0-2-0.89844-2-2s0.89844-2 2-2h32c1.1016 0 2 0.89844 2 2s-0.89844 2-2 2zm0-16h-32c-1.1016 0-2-0.89844-2-2s0.89844-2 2-2h32c1.1016 0 2 0.89844 2 2s-0.89844 2-2 2zm-8-15v-17.199l17.199 17.199z" />
                  </svg>
                )}

                <span className="text-xs break-words">{document.name}</span>
                <span className="text-xs text-gray-400 uppercase">
                  {isPdf ? 'PDF' : 'Markdown'}
                </span>
              </div>
            );
          })}
          </div>
          
          {/* Pagination controls */}
          <div className="mt-8">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              itemsPerPage={itemsPerPage}
              totalItems={initialDocuments.length}
              onItemsPerPageChange={handleItemsPerPageChange}
              pageSizeOptions={[12, 24, 48, 96]}
            />
          </div>
        </>
      )}
    </div>
  );
}

