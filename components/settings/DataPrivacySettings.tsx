'use client'

import { useState } from 'react'
import { Eyebrow, Panel } from '@/components/studio'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabaseClient'
import { Download, AlertTriangle } from 'lucide-react'

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
      <Panel className="space-y-4">
        <div className="space-y-1">
          <Eyebrow tone="dim">Your data</Eyebrow>
          <p className="text-sm text-studio-dim">
            Download a copy of the personal data we hold about you (your right of access).
          </p>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={exporting}>
          <Download className="mr-2 h-4 w-4" />
          {exporting ? 'Preparing your data' : 'Download my data'}
        </Button>
      </Panel>

      <Panel className="space-y-4 border-studio-stale/30">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-studio-stale" />
            <Eyebrow tone="inherit" className="text-studio-stale">Delete my account</Eyebrow>
          </div>
          <p className="text-sm text-studio-dim">
            Permanently delete your account and personal data. Your organisation&apos;s records are
            retained. This cannot be undone.
          </p>
        </div>
        <div>
          {!confirmOpen ? (
            <Button
              variant="outline"
              className="text-studio-stale hover:text-studio-stale hover:bg-secondary"
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
                  {deleting ? 'Deleting' : 'Permanently delete'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  )
}
