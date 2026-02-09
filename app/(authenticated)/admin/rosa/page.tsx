'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Dog,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Users,
  Clock,
  BookOpen,
  Plus,
  Edit,
  Trash2,
  Loader2,
  CheckCircle,
  AlertCircle,
  BarChart3,
  Send,
} from 'lucide-react';
import { useIsAlkateraAdmin } from '@/hooks/usePermissions';
import {
  getAdminStats,
  getKnowledgeBase,
  createKnowledgeEntry,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
  getAllFeedback,
  markFeedbackReviewed,
} from '@/lib/gaia';
import type {
  RosaAdminStats,
  RosaKnowledgeEntry,
  RosaKnowledgeEntryInput,
  RosaFeedbackWithMessage,
} from '@/lib/types/gaia';
import { format } from 'date-fns';
import { RosaChat } from '@/components/gaia';

export default function AdminRosaPage() {
  const { isAlkateraAdmin, isLoading: isAdminLoading } = useIsAlkateraAdmin();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<RosaAdminStats | null>(null);
  const [knowledgeEntries, setKnowledgeEntries] = useState<RosaKnowledgeEntry[]>([]);
  const [feedback, setFeedback] = useState<RosaFeedbackWithMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Knowledge base form state
  const [isKnowledgeDialogOpen, setIsKnowledgeDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<RosaKnowledgeEntry | null>(null);
  const [knowledgeForm, setKnowledgeForm] = useState<RosaKnowledgeEntryInput>({
    entry_type: 'guideline',
    title: '',
    content: '',
    category: '',
    priority: 50,
  });

  useEffect(() => {
    if (isAlkateraAdmin) {
      loadAllData();
    }
  }, [isAlkateraAdmin]);

  async function loadAllData() {
    setIsLoading(true);
    try {
      // Use Promise.allSettled to handle partial failures gracefully
      const results = await Promise.allSettled([
        getAdminStats(),
        getKnowledgeBase(),
        getAllFeedback(),
      ]);

      // Extract results, using defaults for failed promises
      const [statsResult, knowledgeResult, feedbackResult] = results;

      if (statsResult.status === 'fulfilled') {
        setStats(statsResult.value);
      } else {
        console.error('Error loading stats:', statsResult.reason);
        // Set default stats to show the page
        setStats({
          total_conversations: 0,
          total_messages: 0,
          active_users: 0,
          positive_feedback_rate: 0,
          avg_response_time_ms: 0,
          top_questions: [],
          feedback_pending_review: 0,
          knowledge_entries: 0,
        });
      }

      if (knowledgeResult.status === 'fulfilled') {
        setKnowledgeEntries(knowledgeResult.value);
      } else {
        console.error('Error loading knowledge base:', knowledgeResult.reason);
        setKnowledgeEntries([]);
      }

      if (feedbackResult.status === 'fulfilled') {
        setFeedback(feedbackResult.value);
      } else {
        console.error('Error loading feedback:', feedbackResult.reason);
        setFeedback([]);
      }
    } catch (err) {
      console.error('Error loading admin data:', err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSaveKnowledgeEntry() {
    try {
      if (editingEntry) {
        const updated = await updateKnowledgeEntry(editingEntry.id, knowledgeForm);
        setKnowledgeEntries(entries =>
          entries.map(e => (e.id === updated.id ? updated : e))
        );
      } else {
        const created = await createKnowledgeEntry(knowledgeForm);
        setKnowledgeEntries(entries => [created, ...entries]);
      }
      setIsKnowledgeDialogOpen(false);
      resetKnowledgeForm();
    } catch (err) {
      console.error('Error saving knowledge entry:', err);
    }
  }

  async function handleDeleteKnowledgeEntry(id: string) {
    try {
      await deleteKnowledgeEntry(id);
      setKnowledgeEntries(entries => entries.filter(e => e.id !== id));
    } catch (err) {
      console.error('Error deleting knowledge entry:', err);
    }
  }

  async function handleReviewFeedback(feedbackId: string, notes?: string) {
    try {
      await markFeedbackReviewed(feedbackId, notes);
      setFeedback(items =>
        items.map(f =>
          f.id === feedbackId
            ? { ...f, reviewed_at: new Date().toISOString(), admin_notes: notes ?? null }
            : f
        )
      );
    } catch (err) {
      console.error('Error reviewing feedback:', err);
    }
  }

  function resetKnowledgeForm() {
    setEditingEntry(null);
    setKnowledgeForm({
      entry_type: 'guideline',
      title: '',
      content: '',
      category: '',
      priority: 50,
    });
  }

  function openEditDialog(entry: RosaKnowledgeEntry) {
    setEditingEntry(entry);
    setKnowledgeForm({
      entry_type: entry.entry_type,
      title: entry.title,
      content: entry.content,
      example_question: entry.example_question || undefined,
      example_answer: entry.example_answer || undefined,
      category: entry.category || '',
      priority: entry.priority,
      is_active: entry.is_active,
    });
    setIsKnowledgeDialogOpen(true);
  }

  if (isAdminLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!isAlkateraAdmin) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-medium mb-2">Access Denied</h3>
            <p className="text-muted-foreground">
              You do not have permission to access this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
          <Dog className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Rosa Admin Dashboard</h1>
          <p className="text-muted-foreground">
            Manage and improve Rosa&apos;s knowledge and performance
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <MessageSquare className="h-5 w-5 mx-auto mb-2 text-emerald-500" />
              <div className="text-2xl font-bold">{stats.total_conversations}</div>
              <div className="text-xs text-muted-foreground">Total Chats</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="h-5 w-5 mx-auto mb-2 text-blue-500" />
              <div className="text-2xl font-bold">{stats.active_users}</div>
              <div className="text-xs text-muted-foreground">Active Users (30d)</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <ThumbsUp className="h-5 w-5 mx-auto mb-2 text-green-500" />
              <div className="text-2xl font-bold">
                {stats.positive_feedback_rate.toFixed(0)}%
              </div>
              <div className="text-xs text-muted-foreground">Positive Rate</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="h-5 w-5 mx-auto mb-2 text-amber-500" />
              <div className="text-2xl font-bold">
                {(stats.avg_response_time_ms / 1000).toFixed(1)}s
              </div>
              <div className="text-xs text-muted-foreground">Avg Response</div>
            </CardContent>
          </Card>
          <Card className="border-red-500/30 bg-red-500/5">
            <CardContent className="p-4 text-center">
              <AlertCircle className="h-5 w-5 mx-auto mb-2 text-red-500" />
              <div className="text-2xl font-bold text-red-500">
                {stats.feedback_pending_review}
              </div>
              <div className="text-xs text-muted-foreground">Pending Review</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <BookOpen className="h-5 w-5 mx-auto mb-2 text-purple-500" />
              <div className="text-2xl font-bold">{stats.knowledge_entries}</div>
              <div className="text-xs text-muted-foreground">Knowledge Entries</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">
            <BarChart3 className="h-4 w-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="knowledge">
            <BookOpen className="h-4 w-4 mr-2" />
            Knowledge Base
          </TabsTrigger>
          <TabsTrigger value="feedback">
            <ThumbsUp className="h-4 w-4 mr-2" />
            Feedback Review
          </TabsTrigger>
          <TabsTrigger value="test">
            <Send className="h-4 w-4 mr-2" />
            Test Rosa
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
                <CardDescription>Rosa usage overview</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Messages</span>
                    <span className="font-medium">{stats?.total_messages || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Knowledge Entries</span>
                    <span className="font-medium">{stats?.knowledge_entries || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Feedback Responses</span>
                    <span className="font-medium">{feedback.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest feedback from users</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {feedback.slice(0, 5).map(f => (
                    <div
                      key={f.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                    >
                      {f.rating === 'positive' ? (
                        <ThumbsUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <ThumbsDown className="h-4 w-4 text-red-500" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">
                          {f.feedback_text || 'No comment'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(f.created_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                      {!f.reviewed_at && (
                        <Badge variant="outline" className="text-xs">
                          Pending
                        </Badge>
                      )}
                    </div>
                  ))}
                  {feedback.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No feedback yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Knowledge Base Tab */}
        <TabsContent value="knowledge">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Knowledge Base</CardTitle>
                <CardDescription>
                  Manage instructions and guidelines that improve Rosa&apos;s responses
                </CardDescription>
              </div>
              <Dialog open={isKnowledgeDialogOpen} onOpenChange={setIsKnowledgeDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    onClick={() => resetKnowledgeForm()}
                    className="bg-gradient-to-r from-emerald-500 to-teal-500"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Entry
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>
                      {editingEntry ? 'Edit Knowledge Entry' : 'Add Knowledge Entry'}
                    </DialogTitle>
                    <DialogDescription>
                      Add instructions, definitions, or example Q&A pairs to improve Rosa
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Type</label>
                        <Select
                          value={knowledgeForm.entry_type}
                          onValueChange={(v) =>
                            setKnowledgeForm({ ...knowledgeForm, entry_type: v as any })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="guideline">Guideline</SelectItem>
                            <SelectItem value="instruction">Instruction</SelectItem>
                            <SelectItem value="definition">Definition</SelectItem>
                            <SelectItem value="example_qa">Example Q&A</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Category</label>
                        <Select
                          value={knowledgeForm.category || ''}
                          onValueChange={(v) =>
                            setKnowledgeForm({ ...knowledgeForm, category: v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="general">General</SelectItem>
                            <SelectItem value="emissions">Emissions</SelectItem>
                            <SelectItem value="water">Water</SelectItem>
                            <SelectItem value="products">Products</SelectItem>
                            <SelectItem value="suppliers">Suppliers</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Title</label>
                      <Input
                        value={knowledgeForm.title}
                        onChange={(e) =>
                          setKnowledgeForm({ ...knowledgeForm, title: e.target.value })
                        }
                        placeholder="Entry title"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Content</label>
                      <Textarea
                        value={knowledgeForm.content}
                        onChange={(e) =>
                          setKnowledgeForm({ ...knowledgeForm, content: e.target.value })
                        }
                        placeholder="Main content of this entry"
                        rows={4}
                      />
                    </div>

                    {knowledgeForm.entry_type === 'example_qa' && (
                      <>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Example Question</label>
                          <Input
                            value={knowledgeForm.example_question || ''}
                            onChange={(e) =>
                              setKnowledgeForm({
                                ...knowledgeForm,
                                example_question: e.target.value,
                              })
                            }
                            placeholder="What is my carbon footprint?"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Example Answer</label>
                          <Textarea
                            value={knowledgeForm.example_answer || ''}
                            onChange={(e) =>
                              setKnowledgeForm({
                                ...knowledgeForm,
                                example_answer: e.target.value,
                              })
                            }
                            placeholder="Based on your data..."
                            rows={3}
                          />
                        </div>
                      </>
                    )}

                    <div className="space-y-2">
                      <label className="text-sm font-medium">
                        Priority (higher = more important)
                      </label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={knowledgeForm.priority}
                        onChange={(e) =>
                          setKnowledgeForm({
                            ...knowledgeForm,
                            priority: parseInt(e.target.value) || 0,
                          })
                        }
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsKnowledgeDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleSaveKnowledgeEntry}>
                      {editingEntry ? 'Save Changes' : 'Add Entry'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {knowledgeEntries.length === 0 ? (
                <div className="text-center py-8">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No knowledge entries yet</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {knowledgeEntries.map(entry => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-medium">{entry.title}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {entry.entry_type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>{entry.category || '-'}</TableCell>
                        <TableCell>{entry.priority}</TableCell>
                        <TableCell>
                          <Badge
                            variant={entry.is_active ? 'default' : 'secondary'}
                            className={entry.is_active ? 'bg-green-500' : ''}
                          >
                            {entry.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(entry)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteKnowledgeEntry(entry.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Feedback Review Tab */}
        <TabsContent value="feedback">
          <Card>
            <CardHeader>
              <CardTitle>User Feedback</CardTitle>
              <CardDescription>
                Review and respond to user feedback on Rosa&apos;s responses
              </CardDescription>
            </CardHeader>
            <CardContent>
              {feedback.length === 0 ? (
                <div className="text-center py-8">
                  <ThumbsUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No feedback yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {feedback.map(f => (
                    <Card key={f.id} className={!f.reviewed_at ? 'border-amber-500/50' : ''}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          {f.rating === 'positive' ? (
                            <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center">
                              <ThumbsUp className="h-5 w-5 text-green-500" />
                            </div>
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center">
                              <ThumbsDown className="h-5 w-5 text-red-500" />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant={f.rating === 'positive' ? 'default' : 'destructive'}>
                                {f.rating}
                              </Badge>
                              {!f.reviewed_at && (
                                <Badge variant="outline" className="text-amber-500 border-amber-500">
                                  Needs Review
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(f.created_at), 'MMM d, yyyy h:mm a')}
                              </span>
                            </div>

                            {f.feedback_text && (
                              <p className="text-sm mb-3">{f.feedback_text}</p>
                            )}

                            <div className="bg-muted/50 rounded-lg p-3 text-sm">
                              <p className="text-xs text-muted-foreground mb-1">
                                Original Response:
                              </p>
                              <p className="line-clamp-3">{f.message?.content}</p>
                            </div>

                            {f.admin_notes && (
                              <div className="mt-2 text-sm text-muted-foreground">
                                <strong>Admin Notes:</strong> {f.admin_notes}
                              </div>
                            )}
                          </div>

                          {!f.reviewed_at && (
                            <Button
                              size="sm"
                              onClick={() => handleReviewFeedback(f.id)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Mark Reviewed
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Test Rosa Tab */}
        <TabsContent value="test">
          <Card>
            <CardHeader>
              <CardTitle>Test Rosa</CardTitle>
              <CardDescription>
                Test Rosa&apos;s responses with sample queries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[600px]">
                <RosaChat />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
