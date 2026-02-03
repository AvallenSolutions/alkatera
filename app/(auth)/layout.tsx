export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {/* Inline style to override body background - renders with SSR */}
      <style dangerouslySetInnerHTML={{
        __html: `
          body {
            background: transparent !important;
            background-color: transparent !important;
          }
        `
      }} />
      {children}
    </>
  )
}
