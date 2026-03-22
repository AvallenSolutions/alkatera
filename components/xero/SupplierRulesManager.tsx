'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Loader2, Plus, Save, X, Trash2, Pencil, ChevronDown, ChevronRight, BookOpen } from 'lucide-react'
import { toast } from 'sonner'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { CATEGORY_LABELS, EMISSION_CATEGORY_OPTIONS } from '@/lib/xero/category-labels'

interface SupplierRule {
  id: string
  supplier_pattern: string
  emission_category: string
  priority: number
  is_system_default: boolean
}

export function SupplierRulesManager() {
  const { currentOrganization } = useOrganization()
  const [systemRules, setSystemRules] = useState<SupplierRule[]>([])
  const [customRules, setCustomRules] = useState<SupplierRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [systemOpen, setSystemOpen] = useState(false)

  // Add form
  const [isAdding, setIsAdding] = useState(false)
  const [newPattern, setNewPattern] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [newPriority, setNewPriority] = useState('100')

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPattern, setEditPattern] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editPriority, setEditPriority] = useState('')

  const loadRules = useCallback(async () => {
    if (!currentOrganization?.id) return

    // System defaults
    const { data: sysData } = await supabase
      .from('xero_supplier_rules')
      .select('id, supplier_pattern, emission_category, priority, is_system_default')
      .eq('is_system_default', true)
      .order('emission_category')
      .order('priority', { ascending: false })

    setSystemRules(sysData || [])

    // Custom rules
    const { data: customData } = await supabase
      .from('xero_supplier_rules')
      .select('id, supplier_pattern, emission_category, priority, is_system_default')
      .eq('organization_id', currentOrganization.id)
      .eq('is_system_default', false)
      .order('priority', { ascending: false })

    setCustomRules(customData || [])
    setIsLoading(false)
  }, [currentOrganization?.id])

  useEffect(() => {
    loadRules()
  }, [loadRules])

  async function handleAdd() {
    if (!currentOrganization?.id || !newPattern.trim() || !newCategory) {
      toast.error('Please fill in pattern and category')
      return
    }

    const { error } = await supabase
      .from('xero_supplier_rules')
      .insert({
        organization_id: currentOrganization.id,
        supplier_pattern: newPattern.trim(),
        emission_category: newCategory,
        priority: parseInt(newPriority) || 100,
        is_system_default: false,
      })

    if (error) {
      toast.error('Failed to add rule')
      return
    }

    toast.success('Rule added')
    setIsAdding(false)
    setNewPattern('')
    setNewCategory('')
    setNewPriority('100')
    loadRules()
  }

  async function handleSaveEdit(id: string) {
    if (!editPattern.trim() || !editCategory) {
      toast.error('Please fill in pattern and category')
      return
    }

    const { error } = await supabase
      .from('xero_supplier_rules')
      .update({
        supplier_pattern: editPattern.trim(),
        emission_category: editCategory,
        priority: parseInt(editPriority) || 100,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      toast.error('Failed to update rule')
      return
    }

    toast.success('Rule updated')
    setEditingId(null)
    loadRules()
  }

  async function handleDelete(id: string) {
    const { error } = await supabase
      .from('xero_supplier_rules')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error('Failed to delete rule')
      return
    }

    toast.success('Rule deleted')
    loadRules()
  }

  function startEditing(rule: SupplierRule) {
    setEditingId(rule.id)
    setEditPattern(rule.supplier_pattern)
    setEditCategory(rule.emission_category)
    setEditPriority(rule.priority.toString())
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Help text */}
      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 border text-sm space-y-1">
        <div className="flex items-center gap-2 font-medium">
          <BookOpen className="h-4 w-4" />
          How classification rules work
        </div>
        <p className="text-xs text-muted-foreground">
          Supplier rules use pattern matching (e.g. <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded">%british gas%</code>)
          to automatically classify transactions by supplier name. Org-specific rules always take priority over system defaults.
          Higher priority numbers are checked first.
        </p>
      </div>

      {/* Custom rules */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Custom Rules ({customRules.length})
          </h3>
          {!isAdding && (
            <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Add Rule
            </Button>
          )}
        </div>

        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pattern</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="w-20 text-right">Priority</TableHead>
                <TableHead className="w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Add new rule row */}
              {isAdding && (
                <TableRow>
                  <TableCell>
                    <Input
                      value={newPattern}
                      onChange={e => setNewPattern(e.target.value)}
                      placeholder="%supplier name%"
                      className="h-8 text-xs"
                    />
                  </TableCell>
                  <TableCell>
                    <Select value={newCategory} onValueChange={setNewCategory}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {EMISSION_CATEGORY_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      value={newPriority}
                      onChange={e => setNewPriority(e.target.value)}
                      className="h-8 text-xs text-right w-16"
                      min="1"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="sm" className="h-7 text-xs" onClick={handleAdd}>
                        <Save className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setIsAdding(false)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {customRules.length === 0 && !isAdding && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">
                    No custom rules yet. Click &quot;Add Rule&quot; to create one.
                  </TableCell>
                </TableRow>
              )}

              {customRules.map(rule => {
                const isEditing = editingId === rule.id

                return (
                  <TableRow key={rule.id}>
                    <TableCell>
                      {isEditing ? (
                        <Input
                          value={editPattern}
                          onChange={e => setEditPattern(e.target.value)}
                          className="h-8 text-xs"
                        />
                      ) : (
                        <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                          {rule.supplier_pattern}
                        </code>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <Select value={editCategory} onValueChange={setEditCategory}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {EMISSION_CATEGORY_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">
                          {CATEGORY_LABELS[rule.emission_category] || rule.emission_category}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isEditing ? (
                        <Input
                          type="number"
                          value={editPriority}
                          onChange={e => setEditPriority(e.target.value)}
                          className="h-8 text-xs text-right w-16"
                          min="1"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">{rule.priority}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveEdit(rule.id)}>
                            <Save className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 px-1.5" onClick={() => startEditing(rule)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 px-1.5 text-red-600 hover:text-red-700">
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete rule?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently delete the classification rule for pattern &quot;{rule.supplier_pattern}&quot;.
                                  Existing classifications will not be affected.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(rule.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* System defaults */}
      <Collapsible open={systemOpen} onOpenChange={setSystemOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors w-full">
            {systemOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            System Defaults ({systemRules.length})
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pattern</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="w-20 text-right">Priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {systemRules.map(rule => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <code className="text-xs bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                        {rule.supplier_pattern}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {CATEGORY_LABELS[rule.emission_category] || rule.emission_category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {rule.priority}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
