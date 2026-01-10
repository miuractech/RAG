'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { createBrowserClient } from '@supabase/ssr';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { Copy, RefreshCw, Edit2, Check, X } from 'lucide-react';
import FileSelector from '@/components/FileSelector';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  selectedFiles?: Array<{id: number; name: string}>;
  searchMetadata?: {
    iterations?: Array<{
      query: string;
      strategy: string;
      resultsFound: number;
      confidence: number;
    }>;
    totalQueries?: number;
  };
}

interface Document {
  id: number;
  name: string;
}

export default function ChatPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useAgenticSearch, setUseAgenticSearch] = useState(true);
  const [showSearchDetails, setShowSearchDetails] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [selectedFileIds, setSelectedFileIds] = useState<number[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);

  // Load documents for file name lookup
  useEffect(() => {
    const loadDocuments = async () => {
      const { data } = await supabase
        .from('documents_with_storage_path')
        .select('id, name');
      if (data) setDocuments(data);
    };
    loadDocuments();
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Copy to clipboard handler
  const handleCopy = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      toast({
        title: 'Copied!',
        description: 'Message copied to clipboard',
      });
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  };

  // Regenerate response handler
  const handleRegenerate = async (userMessageId: string) => {
    const userMessageIndex = messages.findIndex(m => m.id === userMessageId);
    if (userMessageIndex === -1) return;

    const userMessage = messages[userMessageIndex];
    
    // Remove all messages after the user message (including the assistant response)
    setMessages(prev => prev.slice(0, userMessageIndex + 1));
    
    // Resend the message
    setIsLoading(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: 'Authentication Error',
          description: 'Please sign in to use the chat.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      // Create new assistant message placeholder
      const assistantMessageId = Date.now().toString();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        searchMetadata: useAgenticSearch ? { iterations: [], totalQueries: 0 } : undefined,
      };
      
      setMessages(prev => [...prev, assistantMessage]);

      // Get conversation history up to this point
      const conversationHistory = messages.slice(0, userMessageIndex).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            message: userMessage.content,
            messages: conversationHistory,
            useAgenticSearch,
            fileIds: userMessage.selectedFiles?.map(f => f.id) || null,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch((e: Error) => ({ error: e }));
        throw new Error(errorData.error || 'Failed to send message');
      }

      const searchMetadataHeader = response.headers.get('X-Search-Metadata');
      let searchMetadata: Message['searchMetadata'] = undefined;
      if (searchMetadataHeader) {
        try {
          searchMetadata = JSON.parse(searchMetadataHeader);
        } catch (e) {
          console.warn('Failed to parse search metadata:', e);
        }
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value);
        assistantContent += chunk;
        
        setMessages(prev => 
          prev.map(m => 
            m.id === assistantMessageId 
              ? { ...m, content: assistantContent, searchMetadata }
              : m
          )
        );
      }
      
    } catch (error) {
      console.error('Error regenerating message:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to regenerate response.',
        variant: 'destructive',
      });
      setMessages(prev => prev.filter(m => m.content !== ''));
    } finally {
      setIsLoading(false);
    }
  };

  // Edit message handler
  const handleEdit = (messageId: string, content: string) => {
    setEditingId(messageId);
    setEditText(content);
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  // Submit edited message
  const handleSubmitEdit = async (messageId: string) => {
    if (!editText.trim()) return;

    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return;

    // Update the message
    const updatedMessages = [...messages];
    updatedMessages[messageIndex] = {
      ...updatedMessages[messageIndex],
      content: editText,
    };

    // Remove all messages after this one
    setMessages(updatedMessages.slice(0, messageIndex + 1));
    setEditingId(null);
    setEditText('');

    // Resend with the edited content
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: 'Authentication Error',
          description: 'Please sign in to use the chat.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      const assistantMessageId = Date.now().toString();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        searchMetadata: useAgenticSearch ? { iterations: [], totalQueries: 0 } : undefined,
      };
      
      setMessages(prev => [...prev, assistantMessage]);

      const conversationHistory = updatedMessages.slice(0, messageIndex).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            message: editText,
            messages: conversationHistory,
            useAgenticSearch,
            fileIds: selectedFileIds.length > 0 ? selectedFileIds : null,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch((e: Error) => ({ error: e }));
        throw new Error(errorData.error || 'Failed to send message');
      }

      const searchMetadataHeader = response.headers.get('X-Search-Metadata');
      let searchMetadata: Message['searchMetadata'] = undefined;
      if (searchMetadataHeader) {
        try {
          searchMetadata = JSON.parse(searchMetadataHeader);
        } catch (e) {
          console.warn('Failed to parse search metadata:', e);
        }
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value);
        assistantContent += chunk;
        
        setMessages(prev => 
          prev.map(m => 
            m.id === assistantMessageId 
              ? { ...m, content: assistantContent, searchMetadata }
              : m
          )
        );
      }
      
    } catch (error) {
      console.error('Error sending edited message:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send message.',
        variant: 'destructive',
      });
      setMessages(prev => prev.filter(m => m.content !== ''));
    } finally {
      setIsLoading(false);
    }
  };

  // Get selected file details
  const getSelectedFileDetails = () => {
    return selectedFileIds.map(id => {
      const doc = documents.find(d => d.id === id);
      return { id, name: doc?.name || 'Unknown' };
    });
  };

  // Submit handler
  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!input.trim() || isLoading) return;

    const userMessage = input;
    setInput('');
    setIsLoading(true);

    // Add user message to the chat with selected files info
    const newUserMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      selectedFiles: getSelectedFileDetails(),
    };
    
    setMessages(prev => [...prev, newUserMessage]);

    try {
      // Get current session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          title: 'Authentication Error',
          description: 'Please sign in to use the chat.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      // Create assistant message placeholder
      const assistantMessageId = (Date.now() + 1).toString();
      const assistantMessage: Message = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        searchMetadata: useAgenticSearch ? { iterations: [], totalQueries: 0 } : undefined,
      };
      
      setMessages(prev => [...prev, assistantMessage]);

      // Send message to chat function (embedding will be generated server-side)
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            message: userMessage,
            messages: messages.map(m => ({
              role: m.role,
              content: m.content,
            })),
            useAgenticSearch,
            fileIds: selectedFileIds.length > 0 ? selectedFileIds : null,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch((e: Error) => ({ error: e }));
        console.error(errorData);
        throw new Error(errorData.error || 'Failed to send message');
      }

      // Read search metadata from headers
      const searchMetadataHeader = response.headers.get('X-Search-Metadata');
      let searchMetadata: Message['searchMetadata'] = undefined;
      if (searchMetadataHeader) {
        try {
          searchMetadata = JSON.parse(searchMetadataHeader);
        } catch (e) {
          console.warn('Failed to parse search metadata:', e);
        }
      }

      // Read the streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value);
        assistantContent += chunk;
        
        // Update the assistant message in real-time
        setMessages(prev => 
          prev.map(m => 
            m.id === assistantMessageId 
              ? { ...m, content: assistantContent, searchMetadata }
              : m
          )
        );
      }
      
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send message. Please try again.',
        variant: 'destructive',
      });
      // Remove the empty assistant message if there was an error
      setMessages(prev => prev.filter(m => m.content !== ''));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex w-full h-full">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col items-center w-full h-full">
        {/* Settings Bar */}
        <div className="w-full flex items-center justify-between px-4 py-2 border-b bg-gray-50">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={useAgenticSearch}
              onChange={(e) => setUseAgenticSearch(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm font-medium">🤖 Agentic Search (Multi-Query)</span>
          </label>
          
          {useAgenticSearch && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showSearchDetails}
                onChange={(e) => setShowSearchDetails(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm">Show Search Details</span>
            </label>
          )}
        </div>
        
        <div className="text-xs text-gray-500">
          {useAgenticSearch ? '🔄 Up to 5 query variations' : '📍 Single query mode'}
        </div>
      </div>

      <div className="flex flex-col w-full max-w-5xl gap-6 grow my-2 sm:my-10 p-4 sm:p-8 sm:border rounded-sm overflow-y-auto">
        <div className="border-slate-400 rounded-lg flex flex-col justify-start gap-4 pr-2 grow overflow-y-scroll">
          {messages.map(({ id, role, content, searchMetadata, selectedFiles }, index) => (
            <div key={id} className="flex flex-col gap-2">
              {/* Selected Files Display (only for user messages) */}
              {role === 'user' && selectedFiles && selectedFiles.length > 0 && (
                <div className="self-end max-w-3xl">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-1">
                    <div className="text-xs font-semibold text-blue-900 mb-1">
                      📁 Context Files ({selectedFiles.length}/10):
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {selectedFiles.map((file) => (
                        <span
                          key={file.id}
                          className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full"
                        >
                          {file.name}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Message bubble */}
              <div className={cn('flex gap-2 items-start', role === 'user' ? 'flex-row-reverse' : 'flex-row')}>
                <div
                  className={cn(
                    'rounded-xl px-4 py-3 max-w-3xl',
                    role === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-900 prose prose-slate max-w-none'
                  )}
                >
                  {editingId === id ? (
                    // Edit mode for user messages
                    <div className="flex flex-col gap-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full min-h-[80px] p-2 border rounded text-gray-900 bg-white"
                        autoFocus
                      />
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleCancelEdit}
                          className="text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSubmitEdit(id)}
                          disabled={!editText.trim() || isLoading}
                          className="text-xs"
                        >
                          Send
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // Display mode
                    <>
                      {role === 'assistant' ? (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[rehypeHighlight]}
                          components={{
                            // Custom styling for markdown elements
                            code: ({ node, className, children, ...props }: any) => {
                              const isInline = !className;
                              return isInline ? (
                                <code className="bg-gray-200 rounded px-1 py-0.5 text-sm font-mono text-red-600" {...props}>
                                  {children}
                                </code>
                              ) : (
                                <code className={className} {...props}>
                                  {children}
                                </code>
                              );
                            },
                            pre: ({ node, children, ...props }) => (
                              <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto my-2" {...props}>
                                {children}
                              </pre>
                            ),
                            a: ({ node, children, ...props }) => (
                              <a className="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer" {...props}>
                                {children}
                              </a>
                            ),
                            ul: ({ node, children, ...props }) => (
                              <ul className="list-disc list-inside my-2 space-y-1" {...props}>
                                {children}
                              </ul>
                            ),
                            ol: ({ node, children, ...props }) => (
                              <ol className="list-decimal list-inside my-2 space-y-1" {...props}>
                                {children}
                              </ol>
                            ),
                            h1: ({ node, children, ...props }) => (
                              <h1 className="text-2xl font-bold mt-4 mb-2" {...props}>
                                {children}
                              </h1>
                            ),
                            h2: ({ node, children, ...props }) => (
                              <h2 className="text-xl font-bold mt-3 mb-2" {...props}>
                                {children}
                              </h2>
                            ),
                            h3: ({ node, children, ...props }) => (
                              <h3 className="text-lg font-bold mt-2 mb-1" {...props}>
                                {children}
                              </h3>
                            ),
                            p: ({ node, children, ...props }) => (
                              <p className="my-2 leading-relaxed" {...props}>
                                {children}
                              </p>
                            ),
                            blockquote: ({ node, children, ...props }) => (
                              <blockquote className="border-l-4 border-gray-400 pl-4 italic my-2" {...props}>
                                {children}
                              </blockquote>
                            ),
                            table: ({ node, children, ...props }) => (
                              <div className="overflow-x-auto my-2">
                                <table className="min-w-full border-collapse border border-gray-300" {...props}>
                                  {children}
                                </table>
                              </div>
                            ),
                            th: ({ node, children, ...props }) => (
                              <th className="border border-gray-300 px-4 py-2 bg-gray-200 font-semibold text-left" {...props}>
                                {children}
                              </th>
                            ),
                            td: ({ node, children, ...props }) => (
                              <td className="border border-gray-300 px-4 py-2" {...props}>
                                {children}
                              </td>
                            ),
                          }}
                        >
                          {content}
                        </ReactMarkdown>
                      ) : (
                        content
                      )}
                    </>
                  )}
                </div>

                {/* Action buttons */}
                {editingId !== id && content && (
                  <div className="flex flex-col gap-1 mt-1">
                    {role === 'assistant' ? (
                      <>
                        {/* Copy button */}
                        <button
                          onClick={() => handleCopy(content, id)}
                          className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                          title="Copy to clipboard"
                        >
                          {copiedId === id ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-600" />
                          )}
                        </button>
                        
                        {/* Regenerate button - only for the last assistant message */}
                        {index === messages.length - 1 && (
                          <button
                            onClick={() => {
                              // Find the user message that preceded this assistant message
                              const userMessageIndex = messages.slice(0, index).reverse().findIndex(m => m.role === 'user');
                              if (userMessageIndex !== -1) {
                                const actualIndex = index - 1 - userMessageIndex;
                                handleRegenerate(messages[actualIndex].id);
                              }
                            }}
                            className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                            title="Regenerate response"
                            disabled={isLoading}
                          >
                            <RefreshCw className={cn(
                              'w-4 h-4 text-gray-600',
                              isLoading && 'animate-spin'
                            )} />
                          </button>
                        )}
                      </>
                    ) : (
                      /* Edit button for user messages */
                      <button
                        onClick={() => handleEdit(id, content)}
                        className="p-1.5 rounded hover:bg-gray-200 transition-colors"
                        title="Edit message"
                        disabled={isLoading}
                      >
                        <Edit2 className="w-4 h-4 text-gray-600" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              
              {/* Show search metadata for assistant messages with agentic search */}
              {role === 'assistant' && searchMetadata && showSearchDetails && searchMetadata.iterations && searchMetadata.iterations.length > 0 && (
                <div className="self-start max-w-lg ml-2 p-2 bg-gray-100 rounded text-xs">
                  <div className="font-semibold mb-1">
                    🔍 Search Process ({searchMetadata.totalQueries} queries)
                  </div>
                  {searchMetadata.iterations.map((iter, idx) => (
                    <div key={idx} className="mb-1 pl-2 border-l-2 border-gray-300">
                      <div className="font-medium">{iter.strategy}</div>
                      <div className="text-gray-600">
                        Found: {iter.resultsFound} docs | 
                        Confidence: {(iter.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="self-start m-6 text-gray-500 before:text-gray-500 after:text-gray-500 dot-pulse" />
          )}
          {messages.length === 0 && (
            <div className="self-stretch flex grow items-center justify-center">
              <svg
                className="opacity-10"
                width="150px"
                height="150px"
                version="1.1"
                viewBox="0 0 100 100"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g>
                  <path d="m77.082 39.582h-29.164c-3.543 0-6.25 2.707-6.25 6.25v16.668c0 3.332 2.707 6.25 6.25 6.25h20.832l8.332 8.332v-8.332c3.543 0 6.25-2.918 6.25-6.25v-16.668c0-3.5391-2.707-6.25-6.25-6.25z" />
                  <path d="m52.082 25h-29.164c-3.543 0-6.25 2.707-6.25 6.25v16.668c0 3.332 2.707 6.25 6.25 6.25v8.332l8.332-8.332h6.25v-8.332c0-5.832 4.582-10.418 10.418-10.418h10.418v-4.168c-0.003907-3.543-2.7109-6.25-6.2539-6.25z" />
                </g>
              </svg>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <form
          className="flex items-center space-x-2 gap-2"
          onSubmit={onSubmit}
        >
          <Input 
            type="text" 
            autoFocus 
            placeholder="Send a message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
          />
          <Button type="submit" disabled={isLoading || !input.trim()}>
            Send
          </Button>
        </form>
      </div>
    </div>
    
    {/* File Selector Aside */}
    <FileSelector
      selectedFileIds={selectedFileIds}
      onSelectionChange={setSelectedFileIds}
      maxSelection={10}
    />
  </div>
  );
}
