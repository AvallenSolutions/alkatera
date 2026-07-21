"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ClipboardCheck, CheckCircle2, AlertCircle, Copy, Check } from "lucide-react";
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

// Same address shape the old hand-rolled validator used, now expressed as zod.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const esgSurveySchema = z.object({
  supplierEmail: z
    .string()
    .trim()
    .min(1, "Supplier email is required")
    .regex(EMAIL_RE, "Please enter a valid email address"),
  contactPersonName: z.string().trim().optional(),
  supplierName: z.string().trim().optional(),
  personalMessage: z.string().trim().optional(),
});

type EsgSurveyValues = z.infer<typeof esgSurveySchema>;

export function SendEsgSurveyDialog({
  open,
  onOpenChange,
  defaultEmail = "",
  defaultSupplierName = "",
  defaultContactName = "",
  onSent,
}: SendEsgSurveyDialogProps) {
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What actually happened, as opposed to what we hoped happened. Kept so the
  // panel can distinguish "delivered to the provider" from "we created the
  // invitation but the email never left", and so the link is always offered
  // as a fallback the brand can send themselves.
  const [result, setResult] = useState<{
    emailSent: boolean;
    emailError: string | null;
    invitationUrl: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const form = useForm<EsgSurveyValues>({
    resolver: zodResolver(esgSurveySchema),
    defaultValues: {
      supplierEmail: defaultEmail,
      contactPersonName: defaultContactName,
      supplierName: defaultSupplierName,
      personalMessage: "",
    },
  });
  const isSubmitting = form.formState.isSubmitting;

  // Sync prefilled values when the dialog is (re)opened for a specific supplier.
  useEffect(() => {
    if (open) {
      form.reset({
        supplierEmail: defaultEmail,
        contactPersonName: defaultContactName,
        supplierName: defaultSupplierName,
        personalMessage: "",
      });
      setSuccess(false);
      setError(null);
      setResult(null);
      setCopied(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultEmail, defaultSupplierName, defaultContactName]);

  const handleClose = () => {
    onOpenChange(false);
  };

  const onSubmit = async (values: EsgSurveyValues) => {
    setError(null);

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
          supplierEmail: values.supplierEmail.toLowerCase().trim(),
          supplierName: values.supplierName?.trim() || undefined,
          contactPersonName: values.contactPersonName?.trim() || undefined,
          personalMessage: values.personalMessage?.trim() || undefined,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Failed to send survey");
      }

      // The route reports email_sent separately from HTTP status: the
      // invitation and supplier record can be created successfully while the
      // email itself fails. Reading only response.ok is what let sixteen
      // undelivered surveys report as sent in July 2026.
      setResult({
        emailSent: payload.email_sent !== false,
        emailError: payload.email_error ?? null,
        invitationUrl: payload.invitation?.invitation_url ?? null,
      });
      setSuccess(true);
      onSent?.();
      // Deliberately no auto-close: the panel now carries the invitation link,
      // and closing it out from under the user would take that away.
    } catch (err: any) {
      console.error("Error sending ESG survey:", err);
      setError(err.message || "Failed to send survey. Please try again.");
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
          <div className="py-6 flex flex-col gap-4">
            <div className="flex flex-col items-center gap-3 text-center">
              {result?.emailSent ? (
                <>
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                  <div>
                    <h3 className="font-semibold text-lg">Survey sent</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      The supplier has been added to your list and emailed a link
                      to complete the assessment. We&apos;ll show a warning here if
                      it bounces.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-12 w-12 text-amber-500" />
                  <div>
                    <h3 className="font-semibold text-lg">
                      Survey created, but the email didn&apos;t send
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {result?.emailError
                        ? result.emailError
                        : "The email provider rejected the message."}{" "}
                      The supplier is on your list and the link below still
                      works, so you can send it yourself.
                    </p>
                  </div>
                </>
              )}
            </div>

            {result?.invitationUrl && (
              <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
                <p className="text-xs font-medium">
                  Invitation link
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    — sending this from your own mailbox usually gets a better
                    response than a platform they don&apos;t recognise.
                  </span>
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-background px-2 py-1.5 text-xs">
                    {result.invitationUrl}
                  </code>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(result.invitationUrl!);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      } catch {
                        // Clipboard is blocked in some embedded/insecure
                        // contexts; the link is on screen to copy by hand.
                        setCopied(false);
                      }
                    }}
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    <span className="ml-2">{copied ? "Copied" : "Copy"}</span>
                  </Button>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button type="button" onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <FormField
                control={form.control}
                name="supplierEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Supplier Contact Email <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="supplier@example.com"
                        disabled={isSubmitting || !!defaultEmail}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="contactPersonName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Person Name (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="e.g., Sarah Johnson"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="supplierName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier Company Name (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="e.g., Acme Materials Ltd"
                        disabled={isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="personalMessage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Personal Message (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add a personal note to your request..."
                        disabled={isSubmitting}
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
                <p className="font-medium mb-1">What happens next:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>The supplier is added to your supplier list</li>
                  <li>They receive an email with a link to the ESG survey</li>
                  <li>Replies come straight back to your address</li>
                  <li>You&apos;ll get the link to send yourself as well</li>
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
                <Button type="submit" loading={isSubmitting}>
                  {!isSubmitting && <ClipboardCheck className="mr-2 h-4 w-4" />}
                  {isSubmitting ? "Sending..." : "Send Survey"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
