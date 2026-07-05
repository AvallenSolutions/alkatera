import 'server-only';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

// File-based knowledge wiki (Karpathy LLM-wiki pattern). Markdown pages live in
// wiki/pages/*.md with YAML frontmatter and [[slug]] wikilinks; Claude Code
// maintains the content (see wiki/CLAUDE.md), this module reads and renders it.
// Pages are read from disk, so consumers must be statically generated at build
// time (or, like app/sitemap.ts, have wiki/pages included in their function
// trace via next.config.js outputFileTracingIncludes).

export type WikiPageType = 'concept' | 'standard' | 'legislation' | 'glossary' | 'guide';

export interface WikiSource {
  title: string;
  url: string;
}

export interface WikiPageMeta {
  title: string;
  slug: string;
  type: WikiPageType;
  tags: string[];
  summary: string;
  sources: WikiSource[];
  lastReviewed: string; // YYYY-MM-DD
  status: 'draft' | 'published';
}

export interface WikiPage extends WikiPageMeta {
  body: string;
}

export const WIKI_TYPE_LABELS: Record<WikiPageType, string> = {
  guide: 'Guides',
  concept: 'Core concepts',
  standard: 'Standards and methods',
  legislation: 'Legislation and compliance',
  glossary: 'Glossary',
};

export const WIKI_TYPE_ORDER: WikiPageType[] = ['guide', 'concept', 'standard', 'legislation', 'glossary'];

const PAGES_DIR = path.join(process.cwd(), 'wiki', 'pages');
const VALID_TYPES: WikiPageType[] = ['concept', 'standard', 'legislation', 'glossary', 'guide'];

let cache: WikiPage[] | null = null;

function toDateString(value: unknown): string {
  // gray-matter parses unquoted YAML dates into Date objects.
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'string') return value;
  return '';
}

function loadPages(): WikiPage[] {
  if (cache && process.env.NODE_ENV !== 'development') return cache;

  let files: string[] = [];
  try {
    files = fs.readdirSync(PAGES_DIR).filter((f) => f.endsWith('.md'));
  } catch (error) {
    console.error('Wiki pages directory not readable:', error);
    return [];
  }

  const pages: WikiPage[] = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(PAGES_DIR, file), 'utf8');
      const { data, content } = matter(raw);
      if (!data.slug || !data.title) {
        console.error(`Wiki page ${file} missing slug or title; skipped`);
        continue;
      }
      pages.push({
        title: String(data.title),
        slug: String(data.slug),
        type: VALID_TYPES.includes(data.type) ? data.type : 'concept',
        tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
        summary: String(data.summary || ''),
        sources: Array.isArray(data.sources)
          ? data.sources
              .filter((s: any) => s && s.title)
              .map((s: any) => ({ title: String(s.title), url: String(s.url || '') }))
          : [],
        lastReviewed: toDateString(data.last_reviewed),
        status: data.status === 'published' ? 'published' : 'draft',
        body: content.trim(),
      });
    } catch (error) {
      console.error(`Error parsing wiki page ${file}:`, error);
    }
  }

  pages.sort((a, b) => a.title.localeCompare(b.title));
  cache = pages;
  return pages;
}

function stripBody({ body: _body, ...meta }: WikiPage): WikiPageMeta {
  return meta;
}

export function getPublishedWikiPages(): WikiPageMeta[] {
  return loadPages()
    .filter((p) => p.status === 'published')
    .map(stripBody);
}

export function getWikiPage(slug: string): WikiPage | null {
  return loadPages().find((p) => p.slug === slug && p.status === 'published') || null;
}

const WIKILINK = /\[\[([a-z0-9-]+)(?:\|([^\]\n]+))?\]\]/g;

// [[slug]] / [[slug|label]] -> markdown link to /wiki/slug; links to drafts or
// missing pages degrade to plain text so nothing user-facing ever 404s.
function resolveWikilinks(markdown: string): string {
  const titles = new Map(getPublishedWikiPages().map((p) => [p.slug, p.title]));
  return markdown.replace(WIKILINK, (_match, slug: string, label?: string) => {
    const title = titles.get(slug);
    if (!title) return label || slug.replace(/-/g, ' ');
    return `[${label || title}](/wiki/${slug})`;
  });
}

export function renderWikiHtml(page: WikiPage): string {
  const html = marked.parse(resolveWikilinks(page.body), { async: false }) as string;
  // Content is authored in-repo and reviewed before deploy; sanitising is
  // belt-and-braces so a bad ingest can never inject markup.
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2']),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ['href', 'rel'],
    },
  });
}

export function getPublishedWikiPagesFull(): WikiPage[] {
  return loadPages().filter((p) => p.status === 'published');
}

// Wikilinks resolved to absolute markdown links for consumers outside the app
// router (e.g. Rosa's knowledge base), so citations survive being quoted
// anywhere. Unresolvable links degrade to plain text.
export function wikiBodyForExport(page: WikiPage, siteUrl: string): string {
  const titles = new Map(getPublishedWikiPagesFull().map((p) => [p.slug, p.title]));
  return page.body.replace(WIKILINK, (_match, slug: string, label?: string) => {
    const title = titles.get(slug);
    if (!title) return label || slug.replace(/-/g, ' ');
    return `[${label || title}](${siteUrl}/wiki/${slug})`;
  });
}

export interface WikiMapNode {
  slug: string;
  title: string;
  type: WikiPageType;
  tags: string[];
  summary: string;
  inShort: string;
  lastReviewed: string;
  sources: WikiSource[];
  links: string[];
  html: string;
}

// The first body paragraph ("**In short:** ...") as plain text, for the map
// drawer: markdown emphasis stripped, wikilinks flattened to their labels.
function extractInShort(body: string, titles: Map<string, string>): string {
  const firstParagraph = body.split(/\n\s*\n/)[0] || '';
  return firstParagraph
    .replace(/^\*\*In short:\*\*\s*/i, '')
    .replace(WIKILINK, (_m, slug: string, label?: string) => label || titles.get(slug) || slug.replace(/-/g, ' '))
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim();
}

// Serialisable node list for the interactive map at /wiki: page metadata plus
// the outbound wikilink graph (published targets only).
export function getWikiMapData(): WikiMapNode[] {
  const published = loadPages().filter((p) => p.status === 'published');
  const titles = new Map(published.map((p) => [p.slug, p.title]));
  return published.map((page) => {
    const links = new Set<string>();
    const re = new RegExp(WIKILINK.source, 'g');
    let match;
    while ((match = re.exec(page.body)) !== null) {
      if (match[1] !== page.slug && titles.has(match[1])) links.add(match[1]);
    }
    return {
      slug: page.slug,
      title: page.title,
      type: page.type,
      tags: page.tags,
      summary: page.summary,
      inShort: extractInShort(page.body, titles),
      lastReviewed: page.lastReviewed,
      sources: page.sources,
      links: Array.from(links),
      // Full rendered article for the map's in-place reader popout; internal
      // links stay as /wiki/<slug> so the client can intercept them.
      html: renderWikiHtml(page),
    };
  });
}

export function getWikiBacklinks(slug: string): WikiPageMeta[] {
  const needle = new RegExp(`\\[\\[${slug}(\\|[^\\]]+)?\\]\\]`);
  return loadPages()
    .filter((p) => p.status === 'published' && p.slug !== slug && needle.test(p.body))
    .map(stripBody);
}
