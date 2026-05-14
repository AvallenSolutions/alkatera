import {
  Sparkles,
  Leaf,
  Bot,
  FileText,
  ShieldCheck,
  Layers,
  Activity,
  Camera,
} from 'lucide-react';

interface Props {
  brandName: string;
  distributorName: string;
}

/**
 * Sales pitch for the main alka**tera** platform, embedded between the
 * hero and the data review so a brand that lands here from a distributor
 * outreach sees the bigger product before deciding whether to fill in
 * the form by hand each time. Two columns — "what you get" and "what
 * your distributors get" — keep the framing win-win.
 */
export function AlkateraPitch({ brandName, distributorName }: Props) {
  return (
    <section className="relative rounded-2xl border border-lime-400/40 bg-gradient-to-br from-lime-400/10 via-background to-background overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime-400/80 to-transparent" />

      <div className="p-6 sm:p-8 space-y-6">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wide font-semibold text-lime-300 bg-lime-400/10 border border-lime-400/30 rounded-full px-2.5 py-1">
            <Sparkles className="h-3 w-3" />
            Save yourself the next form
          </div>
          <h2 className="text-2xl font-semibold tracking-tight">
            Do this once. Share it with every distributor.
          </h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            If {distributorName} asks for this, the rest of {brandName}'s buyers will too.
            alka<strong>tera</strong> lets you answer the whole question once, share it with the
            distributors you sell through, and give them a richer picture than any spreadsheet
            ever could.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 pt-2">
          <div className="space-y-4">
            <div className="text-xs uppercase tracking-wide font-semibold text-lime-300">
              What you get
            </div>
            <ul className="space-y-3 text-sm">
              <PitchPoint icon={<Leaf className="h-4 w-4" />}>
                <strong className="text-foreground">All of your sustainability in one place.</strong>{' '}
                Carbon, water, packaging, waste and social impact tracked together, with the
                same numbers feeding every report you publish.
              </PitchPoint>
              <PitchPoint icon={<FileText className="h-4 w-4" />}>
                <strong className="text-foreground">Compliance-ready reports in minutes.</strong>{' '}
                LCAs, ESG reports, board decks and retailer questionnaires generated from the
                same data, so nothing falls out of sync.
              </PitchPoint>
              <PitchPoint icon={<Bot className="h-4 w-4" />}>
                <strong className="text-foreground">Rosa, your sustainability partner.</strong>{' '}
                Day-to-day coaching on what to measure, how to improve, and where to focus next,
                tailored to {brandName}'s category and footprint.
              </PitchPoint>
              <PitchPoint icon={<Camera className="h-4 w-4" />}>
                <strong className="text-foreground">Evidence once, used everywhere.</strong>{' '}
                Upload a certificate or LCA once and we attach it to every distributor request,
                every report, every audit.
              </PitchPoint>
            </ul>
          </div>

          <div className="space-y-4">
            <div className="text-xs uppercase tracking-wide font-semibold text-lime-300">
              What {distributorName} and your other distributors get
            </div>
            <ul className="space-y-3 text-sm">
              <PitchPoint icon={<ShieldCheck className="h-4 w-4" />}>
                <strong className="text-foreground">Verified, brand-confirmed data.</strong>{' '}
                Every number marked as coming straight from you, not scraped from a website
                three years ago.
              </PitchPoint>
              <PitchPoint icon={<Layers className="h-4 w-4" />}>
                <strong className="text-foreground">Per-product and per-batch detail.</strong>{' '}
                Distributors can see how your 2024 vintage differs from 2023, and which SKU
                carries which footprint, rather than one brand average.
              </PitchPoint>
              <PitchPoint icon={<Activity className="h-4 w-4" />}>
                <strong className="text-foreground">Always up to date.</strong>{' '}
                When you publish new figures on alka<strong>tera</strong>, every distributor you
                share with sees them straight away. No more annual chase.
              </PitchPoint>
              <PitchPoint icon={<Sparkles className="h-4 w-4" />}>
                <strong className="text-foreground">A picture that gets richer over time.</strong>{' '}
                Each season your brand looks more credible to the buyers, retailers and auditors
                who care about this.
              </PitchPoint>
            </ul>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-lime-400/20">
          <div className="text-xs text-muted-foreground max-w-md">
            Free to start. You stay in control of what you share with each distributor.
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <a
              href="/signup"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-lime-400 hover:bg-lime-300 text-black font-semibold px-5 py-2.5 text-sm transition-colors whitespace-nowrap"
            >
              <span>
                Start your free alka<strong>tera</strong> profile
              </span>
              <span aria-hidden="true">→</span>
            </a>
            <a
              href="/login"
              className="text-xs text-muted-foreground hover:text-foreground underline self-center"
            >
              Already on alka<strong>tera</strong>? Sign in
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function PitchPoint({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <div className="mt-0.5 text-lime-300 shrink-0">{icon}</div>
      <div className="text-muted-foreground">{children}</div>
    </li>
  );
}
