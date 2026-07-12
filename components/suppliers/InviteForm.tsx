'use client';

import type { FormEvent } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PillButton } from '@/components/studio/pill-button';
import { StateChip } from '@/components/studio/state-chip';

/**
 * The invite form, extracted to module level and driven entirely by props.
 * (Defined inside the page render before, its controlled inputs remounted
 * every keystroke and lost focus.) Quiet studio inputs, the ochre room pill
 * to send, busy text instead of a spinner.
 */
export function InviteForm({
  email,
  contactName,
  companyName,
  message,
  onEmailChange,
  onContactNameChange,
  onCompanyNameChange,
  onMessageChange,
  submitting,
  success,
  error,
  atLimit,
  onSubmit,
  onBack,
  onReset,
}: {
  email: string;
  contactName: string;
  companyName: string;
  message: string;
  onEmailChange: (value: string) => void;
  onContactNameChange: (value: string) => void;
  onCompanyNameChange: (value: string) => void;
  onMessageChange: (value: string) => void;
  submitting: boolean;
  success: boolean;
  error: string | null;
  atLimit: boolean;
  onSubmit: (event: FormEvent) => void;
  onBack: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <button
        type="button"
        onClick={onBack}
        className="mb-4 flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to directory
      </button>

      <div className="mb-4">
        <h3 className="font-display text-lg font-semibold text-foreground">Invite a supplier</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Send them an invitation to join the platform.
        </p>
      </div>

      {success ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8 text-center">
          <StateChip tone="good">Invitation sent</StateChip>
          <p className="max-w-xs text-sm text-muted-foreground">
            Your supplier will receive an email with instructions to join.
          </p>
          <PillButton variant="outline" size="sm" onClick={onReset}>
            Back to directory
          </PillButton>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-1 flex-col">
          <div className="flex-1 space-y-3 overflow-y-auto">
            {error && <p className="text-sm text-studio-stale">{error}</p>}

            <div className="space-y-1.5">
              <Label htmlFor="invite-email" className="text-xs">
                Supplier contact email <span className="text-studio-stale">*</span>
              </Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="supplier@example.com"
                value={email}
                onChange={(e) => onEmailChange(e.target.value)}
                disabled={submitting}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-contact-name" className="text-xs">
                Contact person name
              </Label>
              <Input
                id="invite-contact-name"
                type="text"
                placeholder="e.g. Sarah Johnson"
                value={contactName}
                onChange={(e) => onContactNameChange(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-company-name" className="text-xs">
                Supplier company name
              </Label>
              <Input
                id="invite-company-name"
                type="text"
                placeholder="e.g. Acme Materials Ltd"
                value={companyName}
                onChange={(e) => onCompanyNameChange(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-message" className="text-xs">
                Personal message
              </Label>
              <Textarea
                id="invite-message"
                placeholder="Add a personal note to your invitation..."
                value={message}
                onChange={(e) => onMessageChange(e.target.value)}
                disabled={submitting}
                rows={3}
              />
            </div>

            <div className="rounded-[6px] border border-studio-hairline bg-studio-paper p-3 text-xs text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">What happens next:</p>
              <ul className="list-inside list-disc space-y-0.5">
                <li>Your supplier will receive an email invitation</li>
                <li>A copy will be sent to you and hello@alkatera.com</li>
                <li>They can create a free account and complete their profile</li>
                <li>You&apos;ll be notified when they accept</li>
              </ul>
            </div>
          </div>

          <div className="mt-4 border-t border-studio-hairline pt-4">
            <PillButton
              type="submit"
              variant="room"
              className="w-full"
              disabled={submitting || atLimit}
            >
              {submitting ? 'Sending…' : 'Send invitation'}
            </PillButton>
          </div>
        </form>
      )}
    </div>
  );
}
