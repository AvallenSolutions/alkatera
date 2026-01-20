'use client';

import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { useAuth } from '@/hooks/useAuth';
import {
  getConversations,
  getConversationWithMessages,
  deleteConversation,
  sendGaiaQueryStream,
  submitFeedback,
  hasSubmittedFeedback,
  exportConversationAsMarkdown,
  exportConversationAsJson,
  GAIA_SUGGESTED_QUESTIONS,
  getContextualFollowUps,
  // New imports for improvements
  checkDataAvailability,
  generateSmartSuggestions,
  detectDataGapFromResponse,
  getDataGapResponse,
  shouldEnhanceResponse,
  type DataAvailability,
  type SmartSuggestion,
  type DataGapResponse,
} from '@/lib/gaia';
import type { GaiaStreamEvent } from '@/lib/gaia';
import type {
  GaiaConversation,
  GaiaConversationWithMessages,
  GaiaMessage,
  GaiaChartData,
  GaiaIssueReport,
} from '@/lib/types/gaia';
import { GaiaChartRenderer } from './GaiaChartRenderer';
import { GaiaSmartSuggestions } from './GaiaSmartSuggestions';
import { GaiaResponseLayout } from './GaiaResponseLayout';
import { cn } from '@/lib/utils';

interface GaiaChatProps {
  fullPage?: boolean;
}

export function GaiaChat({ fullPage = false }: GaiaChatProps) {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<GaiaConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<GaiaConversationWithMessages | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingChartData, setStreamingChartData] = useState<GaiaChartData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // New state for improvements
  const [dataAvailability, setDataAvailability] = useState<DataAvailability | null>(null);
  const [smartSuggestions, setSmartSuggestions] = useState<SmartSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(true);
  const [enhancedResponses, setEnhancedResponses] = useState<Record<string, DataGapResponse | null>>({});

  // Load conversations
  useEffect(() => {
    if (currentOrganization?.id) {
      loadConversations();
    }
  }, [currentOrganization?.id]);

  // Load data availability and smart suggestions (Improvement #1)
  useEffect(() => {
    async function loadDataAvailability() {
      if (!currentOrganization?.id) return;
      setIsLoadingSuggestions(true);
      try {
        const availability = await checkDataAvailability(currentOrganization.id);
        setDataAvailability(availability);
        const suggestions = generateSmartSuggestions(availability);
        setSmartSuggestions(suggestions);
      } catch (err) {
        console.error('Error loading data availability:', err);
        // Fall back to static suggestions on error
        setSmartSuggestions(GAIA_SUGGESTED_QUESTIONS.slice(0, 4).map(sq => ({
          question: sq.question,
          category: sq.category,
          icon: sq.icon,
          priority: 50,
          requiresData: [],
        })));
      } finally {
        setIsLoadingSuggestions(false);
      }
    }

    loadDataAvailability();
  }, [currentOrganization?.id]);

  // Scroll to bottom on new messages or streaming content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages, streamingContent]);

  async function loadConversations() {
    if (!currentOrganization?.id) return;
    setIsLoading(true);
    try {
      const convs = await getConversations(currentOrganization.id);
      setConversations(convs);
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadConversation(id: string) {
    setIsLoading(true);
    setError(null);
    try {
      const conv = await getConversationWithMessages(id);
      setActiveConversation(conv);

      // Check feedback status for all assistant messages
      if (conv?.messages) {
        const feedbackStatus: Record<string, boolean> = {};
        for (const msg of conv.messages) {
          if (msg.role === 'assistant') {
            feedbackStatus[msg.id] = await hasSubmittedFeedback(msg.id);
          }
        }
        setFeedbackSubmitted(feedbackStatus);
      }
    } catch (err) {
      console.error('Error loading conversation:', err);
      setError('Failed to load conversation');
    } finally {
      setIsLoading(false);
    }
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

  async function handleSend() {
    if (!input.trim() || isSending || isStreaming || !currentOrganization?.id) return;

    const userMessage = input.trim();
    setInput('');
    setIsSending(true);
    setError(null);
    setStreamingContent('');
    setStreamingChartData(null);

    // Optimistically add user message
    const tempUserMessage: GaiaMessage = {
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

      for await (const event of sendGaiaQueryStream({
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
              setStreamingChartData(event.chart_data as GaiaChartData);
            }
            break;
          case 'error':
            throw new Error(event.error || 'Stream error');
          case 'done':
            // Stream complete - reload conversation to get persisted message
            if (isNewConversation) {
              await loadConversations();
            }
            if (conversationId) {
              await loadConversation(conversationId);
            }
            // Process for data gap enhancement after loading
            if (event.message_id && streamingContent) {
              processResponseForDataGap(event.message_id, streamingContent);
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

  // Process response for data gap enhancement (Improvement #2)
  function processResponseForDataGap(messageId: string, content: string): void {
    if (shouldEnhanceResponse(content)) {
      const dataGapType = detectDataGapFromResponse(content);
      if (dataGapType) {
        const response = getDataGapResponse(dataGapType, dataAvailability || undefined);
        setEnhancedResponses(prev => ({ ...prev, [messageId]: response }));
      }
    }
  }

  // Handle explain action from data gap response
  function handleExplainClick(topic: string) {
    // Convert explanation topic to a question
    const explanationQueries: Record<string, string> = {
      carbon_scopes: 'Can you explain the difference between Scope 1, 2, and 3 emissions?',
      facility_tracking: 'What data should I track for my facilities?',
      supplier_engagement: 'How do I engage suppliers on sustainability?',
      lca_basics: 'What is a Life Cycle Assessment and why is it important?',
      scope3_categories: 'What are the 15 Scope 3 emissions categories?',
      fleet_tracking: 'What fleet data should I track for emissions reporting?',
      vitality_scoring: 'How is the Vitality Score calculated?',
    };

    const query = explanationQueries[topic] || `Can you explain ${topic}?`;
    setInput(query);
    handleSend();
  }

  // Handle issue report submission (Improvement #4)
  async function handleReportIssue(report: Omit<GaiaIssueReport, 'id' | 'user_id' | 'organization_id' | 'created_at' | 'status'>) {
    // In a full implementation, this would submit to an API endpoint
    // For now, we'll log it and show a success message
    console.log('Issue reported:', report);
    // Could implement: await submitIssueReport(report, currentOrganization.id);
  }

  async function handleExportMarkdown() {
    if (!activeConversation) return;
    try {
      const content = await exportConversationAsMarkdown(activeConversation.id);
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gaia-conversation-${activeConversation.id.substring(0, 8)}.md`;
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
      a.download = `gaia-conversation-${activeConversation.id.substring(0, 8)}.json`;
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
          <div className="p-4 border-b">
            <Button
              onClick={handleNewConversation}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Chat
            </Button>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {conversations.map(conv => (
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConversation(conv.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}

              {conversations.length === 0 && !isLoading && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  No conversations yet
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
            <h2 className="font-semibold">Gaia</h2>
            <p className="text-xs text-muted-foreground">
              Your AI Sustainability Assistant
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
            {/* Welcome Message with Smart Suggestions (Improvement #1) */}
            {(!activeConversation || activeConversation.messages.length === 0) && (
              <div className="text-center py-8">
                <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <Leaf className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  Hello! I'm Gaia
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  I can help you understand your environmental impacts, identify
                  improvement opportunities, and answer questions about your
                  sustainability metrics.
                </p>

                {/* Dynamic Smart Suggestions based on available data */}
                <GaiaSmartSuggestions
                  suggestions={smartSuggestions}
                  onSuggestionClick={handleSuggestionClick}
                  isLoading={isLoadingSuggestions}
                />

                {/* Data availability indicator */}
                {dataAvailability && !isLoadingSuggestions && (
                  <p className="text-xs text-muted-foreground mt-4">
                    {dataAvailability.hasProductLCAs || dataAvailability.hasFacilityData || dataAvailability.hasSupplierData
                      ? 'Suggestions personalized based on your available data'
                      : 'Get started by adding sustainability data to unlock personalized insights'}
                  </p>
                )}
              </div>
            )}

            {/* Messages - Using GaiaResponseLayout for assistant messages (Improvements #2, #3, #4) */}
            {activeConversation?.messages.map((message, msgIndex) => {
              // Get the previous user message for context
              const prevUserMessage = msgIndex > 0 && activeConversation.messages[msgIndex - 1]?.role === 'user'
                ? activeConversation.messages[msgIndex - 1]
                : null;

              if (message.role === 'user') {
                // User message - keep simple styling
                return (
                  <div
                    key={message.id}
                    className="flex gap-3 justify-end"
                  >
                    <div className="max-w-[80%] space-y-2 items-end">
                      <Card className="bg-emerald-600 text-white border-emerald-600">
                        <CardContent className="p-3">
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <p className="whitespace-pre-wrap text-sm text-white">
                              {message.content}
                            </p>
                          </div>
                          <div className="flex items-center justify-between mt-2 pt-2 border-t border-emerald-500/30">
                            <span className="text-xs text-emerald-100">
                              {formatTime(message.created_at)}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-medium">
                      {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  </div>
                );
              }

              // Assistant message - use GaiaResponseLayout for consistent display
              const followUps = getContextualFollowUps(message.content);
              const dataGapEnhancement = enhancedResponses[message.id] || null;

              // Check if this response should be enhanced on first render
              if (!enhancedResponses.hasOwnProperty(message.id) && !message.id.startsWith('temp-')) {
                // Process asynchronously to not block render
                setTimeout(() => processResponseForDataGap(message.id, message.content), 0);
              }

              return (
                <GaiaResponseLayout
                  key={message.id}
                  content={message.content}
                  chartData={message.chart_data}
                  dataSources={message.data_sources}
                  timestamp={message.created_at}
                  feedbackSubmitted={feedbackSubmitted[message.id]}
                  onFeedback={
                    !message.id.startsWith('temp-')
                      ? (rating) => handleFeedback(message.id, rating)
                      : undefined
                  }
                  followUpSuggestions={followUps}
                  onSuggestionClick={handleSuggestionClick}
                  dataGapResponse={dataGapEnhancement}
                  onExplainClick={handleExplainClick}
                  onReportIssue={handleReportIssue}
                  messageContext={{
                    query: prevUserMessage?.content,
                    response: message.content,
                    dataType: message.data_sources?.[0]?.table,
                  }}
                />
              );
            })}

            {/* Contextual Follow-up Suggestions are now shown in GaiaResponseLayout */}

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
                        <p className="whitespace-pre-wrap text-sm">
                          {streamingContent || (
                            <span className="flex items-center gap-2 text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                              Gaia is thinking...
                            </span>
                          )}
                          {streamingContent && (
                            <span className="inline-block w-2 h-4 ml-0.5 bg-emerald-500 animate-pulse" />
                          )}
                        </p>
                      </div>
                      {/* Show chart while streaming if available */}
                      {streamingChartData && (
                        <div className="mt-4">
                          <GaiaChartRenderer chartData={streamingChartData} />
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
                        Gaia is thinking...
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
              placeholder="Ask Gaia about your sustainability data..."
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
