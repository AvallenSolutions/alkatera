"use client";

import { useState } from "react";
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
import { Loader2, Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

interface InviteSupplierModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: number;
  productName: string;
  materialId: string;
  materialName: string;
  materialType: "ingredient" | "packaging";
}

export function InviteSupplierModal({
  open,
  onOpenChange,
  productId,
  productName,
  materialId,
  materialName,
  materialType,
}: InviteSupplierModalProps) {
  const [supplierEmail, setSupplierEmail] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setSupplierEmail("");
    setSupplierName("");
    setPersonalMessage("");
    setSuccess(false);
    setError(null);
    onOpenChange(false);
  };

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/invite-supplier`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            productId,
            materialId,
            materialName,
            materialType,
            supplierEmail: supplierEmail.toLowerCase().trim(),
            supplierName: supplierName.trim() || undefined,
            personalMessage: personalMessage.trim() || undefined,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send invitation");
      }

      setSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err: any) {
      console.error("Error sending invitation:", err);
      setError(err.message || "Failed to send invitation. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Invite Supplier
          </DialogTitle>
          <DialogDescription>
            Send an invitation to your supplier to upload verified product data for{" "}
            <strong>{materialName}</strong>
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 flex flex-col items-center justify-center gap-4">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <div className="text-center">
              <h3 className="font-semibold text-lg">Invitation Sent!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your supplier will receive an email with instructions to join the platform.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Product:</span>
                <span className="font-medium">{productName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Material:</span>
                <span className="font-medium">{materialName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Type:</span>
                <span className="font-medium capitalize">{materialType}</span>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="supplier-email">
                Supplier Contact Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="supplier-email"
                type="email"
                placeholder="supplier@example.com"
                value={supplierEmail}
                onChange={(e) => setSupplierEmail(e.target.value)}
                disabled={isSubmitting}
                required
              />
              <p className="text-xs text-muted-foreground">
                The invitation will be sent to this email address
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="supplier-name">Supplier Company Name (Optional)</Label>
              <Input
                id="supplier-name"
                type="text"
                placeholder="e.g., Acme Materials Ltd"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="personal-message">Personal Message (Optional)</Label>
              <Textarea
                id="personal-message"
                placeholder="Add a personal note to your invitation..."
                value={personalMessage}
                onChange={(e) => setPersonalMessage(e.target.value)}
                disabled={isSubmitting}
                rows={3}
              />
            </div>

            <div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
              <p className="font-medium mb-1">What happens next:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Your supplier will receive an email invitation</li>
                <li>A copy will be sent to hello@alkatera.com</li>
                <li>They can complete their profile and upload product data</li>
                <li>You&apos;ll be notified when they accept</li>
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
                    <Mail className="mr-2 h-4 w-4" />
                    Send Invitation
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
