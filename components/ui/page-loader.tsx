interface PageLoaderProps {
  /** Kept for call-site compatibility; the quiet skeleton does not shout. */
  message?: string;
}

/**
 * The studio loading state: a quiet pulse skeleton in the page's shape
 * (statement line + two row blocks). No spinners in the house.
 */
export function PageLoader(_props: PageLoaderProps) {
  return (
    <div className="mx-auto max-w-4xl space-y-10 py-2" aria-busy="true" aria-live="polite">
      <div className="h-10 w-64 animate-pulse rounded-[6px] bg-studio-hairline/60" />
      <div className="space-y-3">
        <div className="h-14 animate-pulse rounded-[6px] bg-studio-hairline/40" />
        <div className="h-14 animate-pulse rounded-[6px] bg-studio-hairline/40" />
      </div>
    </div>
  );
}
