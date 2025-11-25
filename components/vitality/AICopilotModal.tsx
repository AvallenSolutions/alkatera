import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Sparkles, Send, Bot, User } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AICopilotModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export function AICopilotModal({ open, onOpenChange }: AICopilotModalProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m your Company Vitality AI Assistant. I can help you understand your environmental impacts, identify improvement opportunities, and answer questions about your sustainability metrics. What would you like to know?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const suggestedQuestions = [
    'What are my biggest climate impact contributors?',
    'Which facilities have the highest water scarcity risk?',
    'How can I improve my circularity score?',
    'What actions will reduce my land footprint?',
  ];

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    setTimeout(() => {
      const assistantMessage: Message = {
        role: 'assistant',
        content: 'I\'m currently being connected to the RAG backend. In the meantime, I can see that you\'re interested in understanding your sustainability metrics better. Once fully integrated, I\'ll be able to provide detailed insights based on your actual data, suggest specific actions, and help you navigate complex environmental reporting requirements.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1000);
  };

  const handleSuggestionClick = (question: string) => {
    setInput(question);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-100 to-blue-100">
              <Sparkles className="h-5 w-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <DialogTitle>Ask the Data (AI Copilot)</DialogTitle>
              <DialogDescription>
                Get instant insights from your company's environmental data
              </DialogDescription>
            </div>
            <Badge variant="outline" className="text-xs">
              Powered by RAG
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex-1 flex flex-col space-y-4 min-h-0">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-purple-600" />
                    </div>
                  )}

                  <Card
                    className={`max-w-[80%] ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <CardContent className="p-3">
                      <p className="text-sm">{message.content}</p>
                      <p
                        className={`text-xs mt-2 ${
                          message.role === 'user'
                            ? 'text-blue-100'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {message.timestamp.toLocaleTimeString('en-GB', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </CardContent>
                  </Card>

                  {message.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center">
                      <User className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-100 to-blue-100 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-purple-600" />
                  </div>
                  <Card className="bg-gray-50 border-gray-200">
                    <CardContent className="p-3">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </ScrollArea>

          {messages.length === 1 && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">
                Suggested questions:
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((question, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-xs h-auto py-2"
                    onClick={() => handleSuggestionClick(question)}
                  >
                    {question}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2 border-t">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask about your environmental impacts..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          <Card className="bg-amber-50 border-amber-200">
            <CardContent className="p-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                <strong>Coming Soon:</strong> Full RAG backend integration for context-aware answers based on your company's actual data.
              </p>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
