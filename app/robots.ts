import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard/',
          '/api/',
          '/login',
          '/signup',
          '/getaccess/signup',
          '/admin/',
          '/settings/',
          '/products/',
          '/suppliers/',
          '/reports/',
          '/certifications/',
          '/governance/',
          '/greenwash-guardian/',
          '/knowledge-bank/',
          '/people-culture/',
          '/community-impact/',
          '/rosa/',
          '/gaia/',
          '/operations/',
          '/production/',
          '/performance/',
          '/company/',
          '/dev/',
          '/data/',
          '/reporting/',
          '/password-reset',
          '/update-password',
          '/create-organization',
          '/complete-subscription',
          '/suspended',
          '/team-invite/',
          '/advisor-invite/',
          '/lca-report/',
        ],
      },
    ],
    sitemap: 'https://alkatera.com/sitemap.xml',
  };
}
