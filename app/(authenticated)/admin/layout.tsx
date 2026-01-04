"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useIsAlkateraAdmin } from "@/hooks/usePermissions";
import { Loader2, Shield, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Link from "next/link";

/**
 * Admin Layout - Authentication Guard
 *
 * This layout wraps all /admin routes and ensures only Alkatera administrators
 * can access them. Non-admin users are redirected to the dashboard.
 */

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAlkateraAdmin, isLoading } = useIsAlkateraAdmin();
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (!isAlkateraAdmin) {
        // Redirect non-admin users to dashboard
        router.push('/dashboard');
      } else {
        setShowContent(true);
      }
    }
  }, [isAlkateraAdmin, isLoading, router]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin mx-auto text-[#ccff00]" />
          <p className="text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // Access denied state
  if (!isAlkateraAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen p-8">
        <Alert variant="destructive" className="max-w-2xl">
          <Shield className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-4">
              You don't have permission to access the admin panel. Only Alkatera administrators can access this area.
            </p>
            <Button asChild>
              <Link href="/dashboard">Return to Dashboard</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Render children only if authenticated as admin
  return showContent ? <>{children}</> : null;
}
