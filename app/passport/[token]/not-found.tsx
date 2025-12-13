import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function PassportNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-6">
          <AlertCircle className="h-8 w-8 text-red-600" />
        </div>
        <h1 className="text-3xl font-bold text-neutral-900 mb-3">
          Product Passport Not Found
        </h1>
        <p className="text-neutral-600 mb-6">
          This product passport could not be found. It may have been disabled or the link may be incorrect.
        </p>
        <Link href="/">
          <Button variant="outline">
            Go to Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
