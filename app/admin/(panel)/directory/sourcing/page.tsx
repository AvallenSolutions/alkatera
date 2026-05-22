import { Sparkles } from 'lucide-react';
import { BrandSourcing } from '@/components/admin/directory/brand-sourcing';

export const dynamic = 'force-dynamic';

export default function AdminSourcingPage() {
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-neon-lime/30 bg-gradient-to-br from-neon-lime/10 via-background to-background p-6 sm:p-7">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon-lime/80 to-transparent" />
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-neon-lime/15 border border-neon-lime/30 p-3 shrink-0 shadow-[0_0_24px_rgba(204,255,0,0.15)]">
            <Sparkles className="h-6 w-6 text-neon-lime" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold text-neon-lime bg-neon-lime/10 border border-neon-lime/30 rounded-full px-2.5 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-neon-lime shadow-[0_0_6px_rgba(204,255,0,0.8)]" />
              Find brands
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
              Source new brands from the web
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Search by category, country and credentials, or look up a brand by name. We search
              the web, pull together each brand's profile and products, and add them to the
              directory as <strong>pending</strong> for your review.
            </p>
          </div>
        </div>
      </div>

      <BrandSourcing />
    </div>
  );
}
