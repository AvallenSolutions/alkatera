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
import { AlertCircle } from "lucide-react";
import { PillButton } from "@/components/studio/pill-button";
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
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Send ESG survey</DialogTitle>
          <DialogDescription>
            Send the ESG self-assessment to a supplier. We&apos;ll add them to your
            supplier list and email them a link to complete it.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8">
            <p className="text-sm text-studio-good">
              Survey sent. The supplier has been added to your list and emailed a link to
              complete the assessment.
            </p>
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
                  <li>A copy is sent to you and hello@alkatera.com</li>
                  <li>Their score appears on their profile once verified</li>
                </ul>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <PillButton
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </PillButton>
                <PillButton type="submit" variant="room" disabled={isSubmitting}>
                  {isSubmitting ? "Sending…" : "Send survey"}
                </PillButton>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
