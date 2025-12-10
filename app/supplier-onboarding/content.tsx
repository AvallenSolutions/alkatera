"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, AlertCircle, Mail, Package, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

interface InvitationDetails {
  invitation_id: string;
  organization_id: string;
  product_id: number;
  material_id: string;
  material_name: string;
  material_type: string;
  supplier_email: string;
  supplier_name: string | null;
  invited_at: string;
  expires_at: string;
  is_valid: boolean;
}

export default function SupplierOnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token");

  const [loading, setLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const validateToken = async () => {
      if (!token) {
        setError("No invitation token provided");
        setLoading(false);
        return;
      }

      try {
        const { data, error: validationError } = await supabase.rpc(
          "validate_supplier_invitation_token",
          { p_token: token }
        );

        if (validationError) {
          throw validationError;
        }

        if (!data || data.length === 0) {
          setError("Invalid invitation token");
          setLoading(false);
          return;
        }

        const invitationData = data[0] as InvitationDetails;

        if (!invitationData.is_valid) {
          setError("This invitation has expired or is no longer valid");
          setLoading(false);
          return;
        }

        setInvitation(invitationData);
      } catch (err: any) {
        console.error("Error validating token:", err);
        setError(err.message || "Failed to validate invitation");
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token]);

  const handleAcceptInvitation = () => {
    if (!invitation) return;

    const queryParams = new URLSearchParams({
      token: token!,
      email: invitation.supplier_email,
      name: invitation.supplier_name || "",
      material_id: invitation.material_id,
      material_name: invitation.material_name,
      material_type: invitation.material_type,
    });

    router.push(`/suppliers/new?${queryParams.toString()}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
          <p className="text-slate-400">Validating your invitation...</p>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <Card className="max-w-md w-full backdrop-blur-xl bg-white/5 border border-white/10">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-500/20">
                <AlertCircle className="h-6 w-6 text-red-500" />
              </div>
              <div>
                <CardTitle className="text-white">Invalid Invitation</CardTitle>
                <CardDescription>This invitation cannot be accessed</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>

            <div className="text-sm text-slate-400">
              <p className="mb-2">Possible reasons:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>The invitation link may have expired</li>
                <li>The invitation may have already been accepted</li>
                <li>The link may be invalid or corrupted</li>
              </ul>
            </div>

            <div className="pt-4">
              <p className="text-sm text-slate-400 mb-3">
                If you believe this is an error, please contact the organisation that invited you.
              </p>
              <Link href="mailto:hello@alkatera.com">
                <Button variant="outline" className="w-full">
                  <Mail className="mr-2 h-4 w-4" />
                  Contact Support
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const expiryDate = new Date(invitation.expires_at);
  const invitedDate = new Date(invitation.invited_at);
  const daysUntilExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 py-12 px-6">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 mb-4">
            <Mail className="h-8 w-8 text-blue-500" />
          </div>
          <h1 className="text-3xl font-bold text-white">Supplier Invitation</h1>
          <p className="text-slate-400">You've been invited to join the Alkatera platform</p>
        </div>

        <Card className="backdrop-blur-xl bg-white/5 border border-white/10">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-emerald-500/20">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <CardTitle className="text-white">Valid Invitation</CardTitle>
                <CardDescription>This invitation is active and ready to accept</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-800/50 p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">Material Requested</p>
                    <p className="text-sm font-semibold text-white">{invitation.material_name}</p>
                  </div>
                  <div className="px-2 py-1 rounded-full bg-blue-500/20">
                    <Package className="h-4 w-4 text-blue-400" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-700">
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">Material Type</p>
                    <p className="text-sm text-white capitalize">{invitation.material_type}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-slate-400">Your Email</p>
                    <p className="text-sm text-white truncate">{invitation.supplier_email}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <p className="text-sm text-amber-200">
                    Invitation expires in {daysUntilExpiry} {daysUntilExpiry === 1 ? "day" : "days"}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-white text-sm">What happens next?</h3>
              <div className="space-y-2">
                <div className="flex items-start gap-3 text-sm">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-semibold flex-shrink-0">
                    1
                  </div>
                  <p className="text-slate-300">
                    Complete your supplier profile with your company details
                  </p>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-semibold flex-shrink-0">
                    2
                  </div>
                  <p className="text-slate-300">
                    Upload verified product data for {invitation.material_name}
                  </p>
                </div>
                <div className="flex items-start gap-3 text-sm">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-semibold flex-shrink-0">
                    3
                  </div>
                  <p className="text-slate-300">
                    Your customer will be notified and can use your verified data
                  </p>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <Button
                onClick={handleAcceptInvitation}
                size="lg"
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Accept Invitation & Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>

            <div className="text-center">
              <p className="text-xs text-slate-400">
                Need help? Contact us at{" "}
                <a href="mailto:hello@alkatera.com" className="text-blue-400 hover:underline">
                  hello@alkatera.com
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-xs text-slate-500">
            Invited on {invitedDate.toLocaleDateString("en-GB", {
              day: "numeric",
              month: "long",
              year: "numeric"
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
