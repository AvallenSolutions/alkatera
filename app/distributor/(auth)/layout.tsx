export default function DistributorAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            body {
              background: #0a0e0f !important;
              background-color: #0a0e0f !important;
            }
          `,
        }}
      />
      <div className="min-h-screen flex items-center justify-center px-4 py-12 relative overflow-hidden">
        {/* Subtle ambient glow behind the auth card */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full bg-sky-500/10 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[260px] h-[120px] rounded-full bg-sky-400/10 blur-3xl" />
        </div>
        <div className="w-full max-w-md relative">{children}</div>
      </div>
    </>
  );
}
