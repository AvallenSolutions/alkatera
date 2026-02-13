'use client'

import { useState } from 'react'
import { useOnboarding } from '@/lib/onboarding'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ArrowLeft, ArrowRight, SkipForward, Users, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabaseClient'

interface InviteResult {
  email: string
  success: boolean
  message: string
}

export function InviteTeamStep() {
  const { completeStep, previousStep, skipStep } = useOnboarding()
  const { toast } = useToast()

  const [emails, setEmails] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [results, setResults] = useState<InviteResult[]>([])

  const handleInvite = async () => {
    if (!emails.trim()) {
      completeStep()
      return
    }

    setIsSending(true)
    setResults([])

    try {
      // Parse and validate emails
      const emailList = emails
        .split(/[,\n]/)
        .map(e => e.trim().toLowerCase())
        .filter(e => e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))

      if (emailList.length === 0) {
        toast({
          title: 'No valid emails',
          description: 'Please enter valid email addresses.',
          variant: 'destructive',
        })
        setIsSending(false)
        return
      }

      // Deduplicate
      const uniqueEmails = Array.from(new Set(emailList))

      // Force a session refresh so the JWT contains the current_organization_id
      // that was set earlier in onboarding when the org was created
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession()

      if (sessionError || !session) {
        toast({
          title: 'Authentication error',
          description: 'Please refresh the page and try again.',
          variant: 'destructive',
        })
        setIsSending(false)
        return
      }

      const apiUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/invite-member`
      const inviteResults: InviteResult[] = []

      // Send invites sequentially to avoid rate limits
      for (const email of uniqueEmails) {
        try {
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              email,
              role: 'company_user',
            }),
          })

          const result = await response.json()

          if (response.ok) {
            inviteResults.push({ email, success: true, message: 'Invite sent' })
          } else {
            inviteResults.push({
              email,
              success: false,
              message: result.error || 'Failed to send invite',
            })
          }
        } catch {
          inviteResults.push({
            email,
            success: false,
            message: 'Network error — try again from Settings',
          })
        }
      }

      setResults(inviteResults)

      const successCount = inviteResults.filter(r => r.success).length
      const failCount = inviteResults.filter(r => !r.success).length

      if (successCount > 0 && failCount === 0) {
        toast({
          title: 'Invitations sent!',
          description: `${successCount} invitation${successCount > 1 ? 's' : ''} sent successfully.`,
        })
      } else if (successCount > 0 && failCount > 0) {
        toast({
          title: 'Some invitations sent',
          description: `${successCount} sent, ${failCount} failed. Check results below.`,
        })
      } else {
        toast({
          title: 'Invitations failed',
          description: 'Check the results below for details.',
          variant: 'destructive',
        })
      }
    } catch (err) {
      console.error('Error with team invite:', err)
      toast({
        title: 'Error',
        description: 'Something went wrong. You can invite team members later from Settings.',
        variant: 'destructive',
      })
    } finally {
      setIsSending(false)
    }
  }

  const hasResults = results.length > 0
  const allSucceeded = hasResults && results.every(r => r.success)

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto w-16 h-16 bg-purple-400/20 backdrop-blur-md border border-purple-400/30 rounded-2xl flex items-center justify-center">
            <Users className="w-8 h-8 text-purple-400" />
          </div>
          <h3 className="text-xl font-serif font-bold text-white">
            One Last Thing...
          </h3>
          <p className="text-sm text-white/50">
            Sustainability is a team sport! Invite colleagues to:
          </p>
        </div>

        <ul className="text-sm text-white/50 space-y-1 text-left max-w-xs mx-auto">
          <li>&bull; View your dashboards</li>
          <li>&bull; Add their department&apos;s data</li>
          <li>&bull; Collaborate on improvements</li>
        </ul>

        {!hasResults ? (
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-2">
            <Label htmlFor="onb-emails" className="text-sm font-medium text-white/70">
              Email addresses (comma or newline separated)
            </Label>
            <Textarea
              id="onb-emails"
              placeholder="colleague@company.com, other@company.com"
              value={emails}
              onChange={e => setEmails(e.target.value)}
              rows={3}
              disabled={isSending}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:ring-[#ccff00]/50"
            />
            <p className="text-xs text-white/30">
              They&apos;ll receive an email invitation to join your organisation.
            </p>
          </div>
        ) : (
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4 space-y-2">
            <p className="text-sm font-medium text-white/70 mb-3">Invitation results:</p>
            {results.map(r => (
              <div key={r.email} className="flex items-center gap-2 text-sm">
                {r.success ? (
                  <CheckCircle2 className="w-4 h-4 text-[#ccff00] flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                )}
                <span className={r.success ? 'text-white' : 'text-red-300'}>{r.email}</span>
                {!r.success && (
                  <span className="text-xs text-white/30 ml-auto">{r.message}</span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={previousStep} className="text-white/40 hover:text-white hover:bg-white/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            {!hasResults && (
              <Button variant="ghost" onClick={skipStep} className="text-white/40 hover:text-white hover:bg-white/10 text-sm">
                <SkipForward className="w-4 h-4 mr-1" />
                I&apos;ll do this later
              </Button>
            )}
            {hasResults ? (
              <Button
                onClick={completeStep}
                className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium rounded-xl"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleInvite}
                disabled={isSending}
                className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium rounded-xl"
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : null}
                {emails.trim() ? 'Send invites' : 'Continue'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
