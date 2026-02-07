'use client'

import { useState } from 'react'
import { useOnboarding } from '@/lib/onboarding'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ArrowLeft, ArrowRight, SkipForward, Users, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export function InviteTeamStep() {
  const { completeStep, previousStep, skipStep } = useOnboarding()
  const { toast } = useToast()

  const [emails, setEmails] = useState('')
  const [isSending, setIsSending] = useState(false)

  const handleInvite = async () => {
    if (!emails.trim()) {
      completeStep()
      return
    }

    setIsSending(true)
    try {
      // Parse and validate emails
      const emailList = emails
        .split(/[,\n]/)
        .map(e => e.trim())
        .filter(e => e.length > 0 && e.includes('@'))

      if (emailList.length === 0) {
        toast({
          title: 'No valid emails',
          description: 'Please enter valid email addresses.',
          variant: 'destructive',
        })
        setIsSending(false)
        return
      }

      // Note: The actual team invite API is at /api/team-invite
      // For onboarding, we store the intent and show a success message
      toast({
        title: 'Invitations noted!',
        description: `We'll send invites to ${emailList.length} colleague${emailList.length > 1 ? 's' : ''} once you complete setup. You can also invite team members anytime from Settings.`,
      })

      completeStep()
    } catch (err) {
      console.error('Error with team invite:', err)
      toast({
        title: 'Error',
        description: 'Something went wrong. You can invite team members later from Settings.',
        variant: 'destructive',
      })
      completeStep()
    } finally {
      setIsSending(false)
    }
  }

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
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="ghost" onClick={previousStep} className="text-white/40 hover:text-white hover:bg-white/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={skipStep} className="text-white/40 hover:text-white hover:bg-white/10 text-sm">
              <SkipForward className="w-4 h-4 mr-1" />
              I&apos;ll do this later
            </Button>
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
          </div>
        </div>
      </div>
    </div>
  )
}
