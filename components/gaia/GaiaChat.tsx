'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Send,
  Loader2,
  Leaf,
  Plus,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Trash2,
  ChevronLeft,
  AlertCircle,
  RefreshCw,
  BarChart3,
  Table,
  PieChart,
  LineChart,
  Download,
  FileJson,
  FileText,
  ArrowRight,
  Navigation,
  Archive,
  ArchiveRestore,
  Search,
  X,
} from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { useAuth } from '@/hooks/useAuth';
import {
  getConversations,
  getArchivedConversations,
  getConversationWithMessages,
  deleteConversation,
  archiveConversation,
  unarchiveConversation,
  searchConversations,
  sendRosaQueryStream,
  submitFeedback,
  hasSubmittedFeedback,
  exportConversationAsMarkdown,
  exportConversationAsJson,
  ROSA_SUGGESTED_QUESTIONS,
  ROSA_PHOTO_URL,
  getContextualFollowUps,
} from '@/lib/gaia';
import {
  parseActionsFromResponse,
  getActionHandler,
} from '@/lib/gaia/action-handlers';
import type { RosaStreamEvent } from '@/lib/gaia';
import type {
  RosaConversation,
  RosaConversationWithMessages,
  RosaConversationSearchResult,
  RosaMessage,
  RosaChartData,
  RosaAction,
  RosaNavigatePayload,
  RosaUserContext,
} from '@/lib/types/gaia';
import { RosaChartRenderer } from './GaiaChartRenderer';
import { cn } from '@/lib/utils';
import Image from 'next/image';

// Helper function to render message content with images
// Detects image URLs and renders them as actual images
function renderMessageContent(content: string): React.ReactNode {
  // Regex to detect image URLs (Supabase storage, common image extensions)
  const imageUrlRegex = /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|svg)(?:\?[^\s]*)?|https?:\/\/[^\s]*supabase[^\s]*\/storage\/[^\s]+)/gi;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let key = 0;

  // Reset regex state
  imageUrlRegex.lastIndex = 0;

  while ((match = imageUrlRegex.exec(content)) !== null) {
    // Add text before the image URL
    if (match.index > lastIndex) {
      parts.push(
        <span key={key++}>{content.slice(lastIndex, match.index)}</span>
      );
    }

    // Add the image
    const imageUrl = match[0];
    parts.push(
      <div key={key++} className="my-3">
        <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="block">
          <img
            src={imageUrl}
            alt="Rosa shared image"
            className="max-w-full max-h-64 rounded-lg border border-border shadow-sm hover:opacity-90 transition-opacity"
            onError={(e) => {
              // If image fails to load, show the URL as a link instead
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              target.parentElement!.innerHTML = `<a href="${imageUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline break-all">${imageUrl}</a>`;
            }}
          />
        </a>
      </div>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after the last image
  if (lastIndex < content.length) {
    parts.push(
      <span key={key++}>{content.slice(lastIndex)}</span>
    );
  }

  // If no images found, return original content
  if (parts.length === 0) {
    return content;
  }

  return <>{parts}</>;
}

interface RosaChatProps {
  fullPage?: boolean;
}

export function RosaChat({ fullPage = false }: RosaChatProps) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [conversations, setConversations] = useState<RosaConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<RosaConversationWithMessages | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingChartData, setStreamingChartData] = useState<RosaChartData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<Record<string, boolean>>({});
  const [messageActions, setMessageActions] = useState<Record<string, RosaAction[]>>({});
  // Search and archive state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<RosaConversationSearchResult[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize action handler with router
  const actionHandler = useMemo(() => {
    const handler = getActionHandler();
    handler.setRouter(router);
    return handler;
  }, [router]);

  // Build user context for contextual suggestions
  const userContext: RosaUserContext = useMemo(() => ({
    currentRoute: pathname || undefined,
    currentPage: pathname?.split('/').pop() || undefined,
  }), [pathname]);

  // Load conversations
  useEffect(() => {
    if (currentOrganization?.id) {
      loadConversations();
    }
  }, [currentOrganization?.id]);

  // Scroll to bottom on new messages or streaming content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages, streamingContent]);

  async function loadConversations() {
    if (!currentOrganization?.id) return;
    setIsLoading(true);
    try {
      const convs = showArchived
        ? await getArchivedConversations(currentOrganization.id)
        : await getConversations(currentOrganization.id);
      setConversations(convs);
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setIsLoading(false);
    }
  }

  // Reload conversations when showArchived changes
  useEffect(() => {
    if (currentOrganization?.id) {
      setSearchQuery('');
      setSearchResults(null);
      loadConversations();
    }
  }, [showArchived]);

  // Search conversations with debounce
  useEffect(() => {
    if (!currentOrganization?.id) return;

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    // Debounce search by 300ms
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await searchConversations(
          currentOrganization.id,
          searchQuery.trim(),
          showArchived
        );
        setSearchResults(results);
      } catch (err) {
        console.error('Error searching conversations:', err);
        setSearchResults(null);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, currentOrganization?.id, showArchived]);

  async function loadConversation(id: string) {
    setIsLoading(true);
    setError(null);
    try {
      const conv = await getConversationWithMessages(id);
      setActiveConversation(conv);

      // Check feedback status and parse actions for all assistant messages
      if (conv?.messages) {
        const feedbackStatus: Record<string, boolean> = {};
        const newMessageActions: Record<string, RosaAction[]> = {};

        for (const msg of conv.messages) {
          if (msg.role === 'assistant') {
            feedbackStatus[msg.id] = await hasSubmittedFeedback(msg.id);

            // Parse actions from message content
            const actions = parseActionsFromResponse(msg.content, userContext);
            if (actions.length > 0) {
              newMessageActions[msg.id] = actions;
            }
          }
        }
        setFeedbackSubmitted(feedbackStatus);

        // Transfer pending actions to the last assistant message
        const pendingKey = `pending-${id}`;
        if (messageActions[pendingKey] && conv.messages.length > 0) {
          const lastMessage = conv.messages[conv.messages.length - 1];
          if (lastMessage.role === 'assistant') {
            newMessageActions[lastMessage.id] = messageActions[pendingKey];
          }
          // Clean up pending actions
          setMessageActions(prev => {
            const { [pendingKey]: _, ...rest } = prev;
            return { ...rest, ...newMessageActions };
          });
        } else {
          setMessageActions(prev => ({ ...prev, ...newMessageActions }));
        }
      }
    } catch (err) {
      console.error('Error loading conversation:', err);
      setError('Failed to load conversation');
    } finally {
      setIsLoading(false);
    }
  }

  // Execute a Rosa action (navigation, highlight, etc.)
  function executeAction(action: RosaAction) {
    actionHandler.executeAction(action);
  }

  async function handleNewConversation() {
    setActiveConversation(null);
    setInput('');
    setError(null);
    inputRef.current?.focus();
  }

  async function handleDeleteConversation(id: string) {
    try {
      await deleteConversation(id);
      setConversations(convs => convs.filter(c => c.id !== id));
      if (activeConversation?.id === id) {
        setActiveConversation(null);
      }
    } catch (err) {
      console.error('Error deleting conversation:', err);
    }
  }

  async function handleArchiveConversation(id: string) {
    try {
      await archiveConversation(id);
      setConversations(convs => convs.filter(c => c.id !== id));
      if (activeConversation?.id === id) {
        setActiveConversation(null);
      }
    } catch (err) {
      console.error('Error archiving conversation:', err);
    }
  }

  async function handleUnarchiveConversation(id: string) {
    try {
      await unarchiveConversation(id);
      setConversations(convs => convs.filter(c => c.id !== id));
      if (activeConversation?.id === id) {
        setActiveConversation(null);
      }
    } catch (err) {
      console.error('Error unarchiving conversation:', err);
    }
  }

  function handleClearSearch() {
    setSearchQuery('');
    setSearchResults(null);
    searchInputRef.current?.focus();
  }

  async function handleSend() {
    if (!input.trim() || isSending || isStreaming || !currentOrganization?.id) return;

    const userMessage = input.trim();
    setInput('');
    setIsSending(true);
    setError(null);
    setStreamingContent('');
    setStreamingChartData(null);

    // Optimistically add user message
    const tempUserMessage: RosaMessage = {
      id: `temp-${Date.now()}`,
      conversation_id: activeConversation?.id || '',
      role: 'user',
      content: userMessage,
      chart_data: null,
      data_sources: [],
      tokens_used: null,
      processing_time_ms: null,
      created_at: new Date().toISOString(),
    };

    if (activeConversation) {
      setActiveConversation(prev => prev ? {
        ...prev,
        messages: [...prev.messages, tempUserMessage],
      } : null);
    }

    try {
      // Use streaming API
      let conversationId = activeConversation?.id;
      let isNewConversation = false;

      setIsStreaming(true);
      setIsSending(false);

      for await (const event of sendRosaQueryStream({
        message: userMessage,
        conversation_id: activeConversation?.id,
        organization_id: currentOrganization.id,
      })) {
        switch (event.type) {
          case 'start':
            conversationId = event.conversation_id;
            isNewConversation = event.is_new_conversation || false;
            break;
          case 'text':
            if (event.content) {
              setStreamingContent(prev => prev + event.content);
            }
            break;
          case 'chart':
            if (event.chart_data) {
              setStreamingChartData(event.chart_data as RosaChartData);
            }
            break;
          case 'error':
            throw new Error(event.error || 'Stream error');
          case 'done':
            // Parse actions from the complete response
            if (streamingContent) {
              const actions = parseActionsFromResponse(streamingContent, userContext);
              if (actions.length > 0 && conversationId) {
                // Store actions for the message (will be associated after reload)
                setMessageActions(prev => ({
                  ...prev,
                  [`pending-${conversationId}`]: actions,
                }));
              }
            }
            // Stream complete - reload conversation to get persisted message
            if (isNewConversation) {
              await loadConversations();
            }
            if (conversationId) {
              await loadConversation(conversationId);
            }
            break;
        }
      }
    } catch (err: unknown) {
      console.error('Error sending message:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);

      // Remove optimistic message on error
      if (activeConversation) {
        setActiveConversation(prev => prev ? {
          ...prev,
          messages: prev.messages.filter(m => m.id !== tempUserMessage.id),
        } : null);
      }
    } finally {
      setIsSending(false);
      setIsStreaming(false);
      setStreamingContent('');
      setStreamingChartData(null);
    }
  }

  async function handleFeedback(messageId: string, rating: 'positive' | 'negative') {
    if (!currentOrganization?.id || feedbackSubmitted[messageId]) return;

    try {
      await submitFeedback(messageId, currentOrganization.id, rating);
      setFeedbackSubmitted(prev => ({ ...prev, [messageId]: true }));
    } catch (err) {
      console.error('Error submitting feedback:', err);
    }
  }

  function handleSuggestionClick(question: string) {
    setInput(question);
    inputRef.current?.focus();
  }

  async function handleExportMarkdown() {
    if (!activeConversation) return;
    try {
      const content = await exportConversationAsMarkdown(activeConversation.id);
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rosa-conversation-${activeConversation.id.substring(0, 8)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting conversation:', err);
    }
  }

  async function handleExportJson() {
    if (!activeConversation) return;
    try {
      const content = await exportConversationAsJson(activeConversation.id);
      const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rosa-conversation-${activeConversation.id.substring(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting conversation:', err);
    }
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
  };

  return (
    <div className={cn(
      'flex bg-background',
      fullPage ? 'h-[calc(100vh-4rem)]' : 'h-[600px] rounded-lg border'
    )}>
      {/* Sidebar - Conversation History */}
      {showSidebar && (
        <div className="w-64 border-r flex flex-col bg-muted/30">
          <div className="p-4 border-b space-y-3">
            <Button
              onClick={handleNewConversation}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>

            {/* Search input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className="pl-8 pr-8 h-8 text-sm"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                  onClick={handleClearSearch}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>

            {/* Archive toggle */}
            <div className="flex rounded-lg bg-muted p-0.5">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'flex-1 h-7 text-xs rounded-md',
                  !showArchived && 'bg-background shadow-sm'
                )}
                onClick={() => setShowArchived(false)}
              >
                Active
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'flex-1 h-7 text-xs rounded-md',
                  showArchived && 'bg-background shadow-sm'
                )}
                onClick={() => setShowArchived(true)}
              >
                <Archive className="h-3 w-3 mr-1" />
                Archived
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {/* Loading indicator for search */}
              {isSearching && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}

              {/* Search results */}
              {!isSearching && searchResults !== null && (
                <>
                  {searchResults.length > 0 ? (
                    <>
                      <p className="text-xs text-muted-foreground px-2 py-1">
                        {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                      </p>
                      {searchResults.map(result => (
                        <div
                          key={result.conversation_id}
                          className={cn(
                            'group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors',
                            activeConversation?.id === result.conversation_id
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'hover:bg-muted'
                          )}
                          onClick={() => loadConversation(result.conversation_id)}
                        >
                          <MessageSquare className="h-4 w-4 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">
                              {result.title || 'New conversation'}
                            </p>
                            {result.match_type === 'message' && result.matched_content && (
                              <p className="text-xs text-muted-foreground truncate italic">
                                "...{result.matched_content.slice(0, 50)}..."
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                              {formatDate(result.updated_at)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No results found for "{searchQuery}"
                    </p>
                  )}
                </>
              )}

              {/* Regular conversation list */}
              {!isSearching && searchResults === null && conversations.map(conv => (
                <div
                  key={conv.id}
                  className={cn(
                    'group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors',
                    activeConversation?.id === conv.id
                      ? 'bg-emerald-500/10 text-emerald-600'
                      : 'hover:bg-muted'
                  )}
                  onClick={() => loadConversation(conv.id)}
                >
                  <MessageSquare className="h-4 w-4 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      {conv.title || 'New conversation'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(conv.updated_at)}
                    </p>
                  </div>
                  <div className="flex items-center opacity-0 group-hover:opacity-100">
                    <TooltipProvider>
                      {showArchived ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnarchiveConversation(conv.id);
                              }}
                            >
                              <ArchiveRestore className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Unarchive</TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleArchiveConversation(conv.id);
                              }}
                            >
                              <Archive className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Archive</TooltipContent>
                        </Tooltip>
                      )}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteConversation(conv.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Delete</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              ))}

              {!isSearching && searchResults === null && conversations.length === 0 && !isLoading && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {showArchived ? 'No archived conversations' : 'No conversations yet'}
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="p-4 border-b flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            <ChevronLeft className={cn('h-4 w-4 transition-transform', !showSidebar && 'rotate-180')} />
          </Button>

          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
            <Leaf className="h-5 w-5 text-white" />
          </div>

          <div>
            <h2 className="font-semibold">Rosa</h2>
            <p className="text-xs text-muted-foreground">
              Your sustainability guide
            </p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {activeConversation && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleExportMarkdown}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Export as Markdown</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={handleExportJson}
                    >
                      <FileJson className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Export as JSON</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Badge variant="outline" className="text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
              Online
            </Badge>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 max-w-3xl mx-auto">
            {/* Welcome Message */}
            {(!activeConversation || activeConversation.messages.length === 0) && (
              <div className="text-center py-8">
                <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <Leaf className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  Hello! I'm Rosa
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  I'm your sustainability guide. I can help you navigate the platform,
                  enter data, understand your environmental impacts, and answer
                  questions about your sustainability metrics.
                </p>

                <div className="flex flex-wrap justify-center gap-2">
                  {ROSA_SUGGESTED_QUESTIONS.slice(0, 4).map((sq, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleSuggestionClick(sq.question)}
                    >
                      {sq.question}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {activeConversation?.messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex gap-3',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                    <Leaf className="h-4 w-4 text-white" />
                  </div>
                )}

                <div className={cn(
                  'max-w-[80%] space-y-2',
                  message.role === 'user' && 'items-end'
                )}>
                  <Card className={cn(
                    message.role === 'user'
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-card border-border'
                  )}>
                    <CardContent className="p-3">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <div className="whitespace-pre-wrap text-sm">
                          {renderMessageContent(message.content)}
                        </div>
                      </div>

                      {/* Chart rendering */}
                      {message.chart_data && (
                        <div className="mt-4">
                          <RosaChartRenderer chartData={message.chart_data} />
                        </div>
                      )}

                      <div className={cn(
                        'flex items-center justify-between mt-2 pt-2 border-t',
                        message.role === 'user' ? 'border-emerald-500/30' : 'border-border'
                      )}>
                        <span className={cn(
                          'text-xs',
                          message.role === 'user' ? 'text-emerald-100' : 'text-muted-foreground'
                        )}>
                          {formatTime(message.created_at)}
                        </span>

                        {/* Feedback buttons for assistant messages */}
                        {message.role === 'assistant' && !message.id.startsWith('temp-') && (
                          <div className="flex items-center gap-1">
                            {feedbackSubmitted[message.id] ? (
                              <span className="text-xs text-muted-foreground">
                                Thanks for feedback!
                              </span>
                            ) : (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => handleFeedback(message.id, 'positive')}
                                    >
                                      <ThumbsUp className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Helpful</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => handleFeedback(message.id, 'negative')}
                                    >
                                      <ThumbsDown className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Not helpful</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Data sources */}
                  {message.role === 'assistant' && message.data_sources && message.data_sources.length > 0 && (
                    <div className="flex flex-wrap gap-1 px-1">
                      {message.data_sources.map((source, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {source.description}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Action buttons (navigation, etc.) */}
                  {message.role === 'assistant' && messageActions[message.id] && messageActions[message.id].length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 px-1">
                      {messageActions[message.id]
                        .filter(action => action.type === 'navigate')
                        .map((action, actionIdx) => {
                          const payload = action.payload as RosaNavigatePayload;
                          return (
                            <Button
                              key={actionIdx}
                              variant="outline"
                              size="sm"
                              className="text-xs bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/50"
                              onClick={() => executeAction(action)}
                            >
                              <ArrowRight className="h-3 w-3 mr-1.5" />
                              {payload.label || `Go to ${payload.path}`}
                            </Button>
                          );
                        })}
                    </div>
                  )}
                </div>

                {message.role === 'user' && (
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-medium">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
              </div>
            ))}

            {/* Contextual Follow-up Suggestions */}
            {activeConversation && activeConversation.messages.length > 0 && !isSending && !isStreaming && (() => {
              const lastMessage = activeConversation.messages[activeConversation.messages.length - 1];
              if (lastMessage.role !== 'assistant') return null;
              const followUps = getContextualFollowUps(lastMessage.content);
              if (followUps.length === 0) return null;
              return (
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  {followUps.map((question, i) => (
                    <Button
                      key={i}
                      variant="outline"
                      size="sm"
                      className="text-xs bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10"
                      onClick={() => handleSuggestionClick(question)}
                    >
                      {question}
                    </Button>
                  ))}
                </div>
              );
            })()}

            {/* Streaming response */}
            {isStreaming && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <Leaf className="h-4 w-4 text-white" />
                </div>
                <div className="max-w-[80%] space-y-2">
                  <Card className="bg-card border-border">
                    <CardContent className="p-3">
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <div className="whitespace-pre-wrap text-sm">
                          {streamingContent ? (
                            <>
                              {renderMessageContent(streamingContent)}
                              <span className="inline-block w-2 h-4 ml-0.5 bg-emerald-500 animate-pulse" />
                            </>
                          ) : (
                            <span className="flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                              Rosa is thinking...
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Show chart while streaming if available */}
                      {streamingChartData && (
                        <div className="mt-4">
                          <RosaChartRenderer chartData={streamingChartData} />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* Loading indicator (before streaming starts) */}
            {isSending && !isStreaming && (
              <div className="flex gap-3">
                <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <Leaf className="h-4 w-4 text-white" />
                </div>
                <Card className="bg-card">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                      <span className="text-sm text-muted-foreground">
                        Rosa is thinking...
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="flex justify-center">
                <Card className="bg-destructive/10 border-destructive/30">
                  <CardContent className="p-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-destructive" />
                    <span className="text-sm text-destructive">{error}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setError(null)}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Retry
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t">
          <div className="flex gap-2 max-w-3xl mx-auto">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask Rosa about your sustainability data..."
              disabled={isSending || isStreaming}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isSending || isStreaming}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
            >
              {isSending || isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Backwards compatibility alias
/** @deprecated Use RosaChat instead */
export const GaiaChat = RosaChat;
