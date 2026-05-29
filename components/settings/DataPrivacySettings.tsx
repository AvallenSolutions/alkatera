'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabaseClient'
import { Download, AlertTriangle, Loader2 } from 'lucide-react'

/**
 * Self-serve data-subject-rights controls (UK GDPR): download a copy of your
 * personal data, and permanently delete your account. Lives in the Profile tab.
 */
export function DataPrivacySettings() {
  const [exporting, setExporting] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch('/api/account/export')
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'alkatera-data-export.json'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Your data export has downloaded')
    } catch {
      toast.error('Could not export your data. Please try again.')
    } finally {
      setExporting(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Could not delete your account.')
        setDeleting(false)
        return
      }
      toast.success('Your account has been deleted.')
      await supabase.auth.signOut()
      window.location.href = '/'
    } catch {
      toast.error('Could not delete your account. Please try again.')
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Your data</CardTitle>
          <CardDescription>
            Download a copy of the personal data we hold about you (your right of access).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleExport} disabled={exporting}>
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download my data
          </Button>
        </CardContent>
      </Card>

      <Card className="border-red-200 dark:border-red-900/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="h-5 w-5" />
            Delete my account
          </CardTitle>
          <CardDescription>
            Permanently delete your account and personal data. Your organisation&apos;s records are
            retained. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!confirmOpen ? (
            <Button
              variant="outline"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
              onClick={() => setConfirmOpen(true)}
            >
              Delete my account
            </Button>
          ) : (
            <div className="space-y-3 max-w-sm">
              <p className="text-sm">
                Type <strong>DELETE</strong> to confirm. This is permanent.
              </p>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                aria-label="Type DELETE to confirm account deletion"
              />
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setConfirmOpen(false)
                    setConfirmText('')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={confirmText !== 'DELETE' || deleting}
                  onClick={handleDelete}
                >
                  {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Permanently delete
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
