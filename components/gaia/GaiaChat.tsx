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
} from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { useAuth } from '@/hooks/useAuth';
import {
  getConversations,
  getConversationWithMessages,
  createConversation,
  deleteConversation,
  sendGaiaQuery,
  submitFeedback,
  hasSubmittedFeedback,
  GAIA_SUGGESTED_QUESTIONS,
} from '@/lib/gaia';
import type {
  GaiaConversation,
  GaiaConversationWithMessages,
  GaiaMessage,
  GaiaChartData,
} from '@/lib/types/gaia';
import { GaiaChartRenderer } from './GaiaChartRenderer';
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
  const [error, setError] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load conversations
  useEffect(() => {
    if (currentOrganization?.id) {
      loadConversations();
    }
  }, [currentOrganization?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

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
    if (!input.trim() || isSending || !currentOrganization?.id) return;

    const userMessage = input.trim();
    setInput('');
    setIsSending(true);
    setError(null);

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
      const response = await sendGaiaQuery({
        message: userMessage,
        conversation_id: activeConversation?.id,
        organization_id: currentOrganization.id,
      });

      if (response.is_new_conversation) {
        // Reload conversations to get the new one
        await loadConversations();
      }

      // Load the full conversation to get proper message IDs
      await loadConversation(response.conversation_id);
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

          <Badge variant="outline" className="ml-auto text-xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
            Online
          </Badge>
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
                  Hello! I'm Gaia
                </h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  I can help you understand your environmental impacts, identify
                  improvement opportunities, and answer questions about your
                  sustainability metrics.
                </p>

                <div className="flex flex-wrap justify-center gap-2">
                  {GAIA_SUGGESTED_QUESTIONS.slice(0, 4).map((sq, i) => (
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
                        <p className="whitespace-pre-wrap text-sm">
                          {message.content}
                        </p>
                      </div>

                      {/* Chart rendering */}
                      {message.chart_data && (
                        <div className="mt-4">
                          <GaiaChartRenderer chartData={message.chart_data} />
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
                </div>

                {message.role === 'user' && (
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-medium">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {isSending && (
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
              disabled={isSending}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isSending}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
            >
              {isSending ? (
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
