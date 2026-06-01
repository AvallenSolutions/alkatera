'use client';

import Script from 'next/script';
import { useConsent } from '@/lib/consent';

export function GoogleAnalytics() {
  const consent = useConsent();

  // Only load Google Analytics after explicit opt-in (PECR / UK GDPR).
  if (consent !== 'accepted') return null;

  return (
    <>
      <Script
        strategy="afterInteractive"
        src="https://www.googletagmanager.com/gtag/js?id=G-V8EFDYPLRD"
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-V8EFDYPLRD');
          `,
        }}
      />
    </>
  );
}
