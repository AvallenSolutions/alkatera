import type { MetadataRoute } from 'next';

// Private/app areas no crawler should index. Shared between the wildcard rule
// and the named AI-crawler rules so they never drift apart.
const DISALLOW = [
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
  '/r/', // private per-prospect footprint reports (capability-token links)
];

// AI crawlers. Explicitly allowed (same private-path exclusions as everyone
// else) so alkatera can appear in AI answers and assistants. Two kinds:
// - Live retrieval / answer engines: surface us in ChatGPT, Claude, Perplexity,
//   Gemini answers. These are the ones that drive AI referral traffic.
// - Training crawlers: collect content for model training. Allowed too — being
//   in the training corpus helps models know about alkatera. Flip any of these
//   to `disallow: '/'` to opt out of training while staying in live answers.
const AI_CRAWLERS = [
  // Live retrieval / answer engines
  'OAI-SearchBot', // ChatGPT search index
  'ChatGPT-User', // ChatGPT live browsing on a user's behalf
  'PerplexityBot', // Perplexity index
  'Perplexity-User', // Perplexity live fetch
  'Claude-Web', // Claude live browsing
  'Claude-User',
  'Google-Extended', // Gemini / Vertex grounding (separate from Googlebot)
  // Training crawlers
  'GPTBot', // OpenAI training
  'ClaudeBot', // Anthropic training
  'anthropic-ai',
  'CCBot', // Common Crawl (feeds many models)
  'Applebot-Extended', // Apple Intelligence
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOW,
      },
      {
        userAgent: AI_CRAWLERS,
        allow: '/',
        disallow: DISALLOW,
      },
    ],
    sitemap: 'https://alkatera.com/sitemap.xml',
  };
}
