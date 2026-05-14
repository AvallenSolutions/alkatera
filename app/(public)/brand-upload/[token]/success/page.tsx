import { CheckCircle2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

/**
 * Public confirmation page brand uploaders see after a successful submit.
 * Kept intentionally bare — no PII, no token echoing.
 */
export default function BrandUploadSuccessPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="max-w-md text-center space-y-4">
        <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
        <h1 className="text-2xl font-semibold">Thanks — we've received your documents</h1>
        <p className="text-sm text-muted-foreground">
          A receipt has been sent to the email address you provided. Your distributor will review
          and follow up if anything needs clarifying. You can safely close this page.
        </p>
        <p className="text-xs text-muted-foreground pt-4">
          Sent via alka<strong>tera</strong>
        </p>
      </div>
    </div>
  );
}
