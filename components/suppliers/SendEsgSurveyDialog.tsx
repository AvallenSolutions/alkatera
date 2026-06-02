"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ClipboardCheck, CheckCircle2, AlertCircle } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

interface SendEsgSurveyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefill when sending to a known supplier. */
  defaultEmail?: string;
  defaultSupplierName?: string;
  defaultContactName?: string;
  /** Called after a successful send (e.g. to refresh a list). */
  onSent?: () => void;
}

const validateEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export function SendEsgSurveyDialog({
  open,
  onOpenChange,
  defaultEmail = "",
  defaultSupplierName = "",
  defaultContactName = "",
  onSent,
}: SendEsgSurveyDialogProps) {
  const [supplierEmail, setSupplierEmail] = useState(defaultEmail);
  const [supplierName, setSupplierName] = useState(defaultSupplierName);
  const [contactPersonName, setContactPersonName] = useState(defaultContactName);
  const [personalMessage, setPersonalMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync prefilled values when the dialog is (re)opened for a specific supplier.
  useEffect(() => {
    if (open) {
      setSupplierEmail(defaultEmail);
      setSupplierName(defaultSupplierName);
      setContactPersonName(defaultContactName);
      setPersonalMessage("");
      setSuccess(false);
      setError(null);
    }
  }, [open, defaultEmail, defaultSupplierName, defaultContactName]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!supplierEmail.trim()) {
      setError("Supplier email is required");
      return;
    }
    if (!validateEmail(supplierEmail)) {
      setError("Please enter a valid email address");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/send-esg-survey", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          supplierEmail: supplierEmail.toLowerCase().trim(),
          supplierName: supplierName.trim() || undefined,
          contactPersonName: contactPersonName.trim() || undefined,
          personalMessage: personalMessage.trim() || undefined,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Failed to send survey");
      }

      setSuccess(true);
      onSent?.();
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err: any) {
      console.error("Error sending ESG survey:", err);
      setError(err.message || "Failed to send survey. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Send ESG Survey
          </DialogTitle>
          <DialogDescription>
            Send the ESG self-assessment to a supplier. We&apos;ll add them to your
            supplier list and email them a link to complete it.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 flex flex-col items-center justify-center gap-4">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <div className="text-center">
              <h3 className="font-semibold text-lg">Survey Sent!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                The supplier has been added to your list and emailed a link to
                complete the assessment.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="esg-supplier-email">
                Supplier Contact Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="esg-supplier-email"
                type="email"
                placeholder="supplier@example.com"
                value={supplierEmail}
                onChange={(e) => setSupplierEmail(e.target.value)}
                disabled={isSubmitting || !!defaultEmail}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="esg-contact-name">Contact Person Name (Optional)</Label>
              <Input
                id="esg-contact-name"
                type="text"
                placeholder="e.g., Sarah Johnson"
                value={contactPersonName}
                onChange={(e) => setContactPersonName(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="esg-supplier-name">Supplier Company Name (Optional)</Label>
              <Input
                id="esg-supplier-name"
                type="text"
                placeholder="e.g., Acme Materials Ltd"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="esg-personal-message">Personal Message (Optional)</Label>
              <Textarea
                id="esg-personal-message"
                placeholder="Add a personal note to your request..."
                value={personalMessage}
                onChange={(e) => setPersonalMessage(e.target.value)}
                disabled={isSubmitting}
                rows={3}
              />
            </div>

            <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
              <p className="font-medium mb-1">What happens next:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>The supplier is added to your supplier list</li>
                <li>They receive an email with a link to the ESG survey</li>
                <li>A copy is sent to you and hello@alkatera.com</li>
                <li>Their score appears on their profile once verified</li>
              </ul>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    Send Survey
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
