// Wiki lint: run `node wiki/lint.js` from the repo root after any ingest.
// Checks frontmatter completeness, filename/slug match, unresolved wikilinks,
// em dashes, orphan pages. `node wiki/lint.js --index` also prints a
// regenerated wiki/index.md to stdout (pipe or paste it over index.md).
const fs = require('fs');
const path = require('path');
const matter = require('gray-matter');

const PAGES_DIR = path.join(__dirname, 'pages');
const WIKILINK = /\[\[([a-z0-9-]+)(?:\|([^\]\n]+))?\]\]/g;
const TYPES = ['concept', 'standard', 'legislation', 'glossary', 'guide'];
const TYPE_LABELS = {
  guide: 'Guides',
  concept: 'Core concepts',
  standard: 'Standards and methods',
  legislation: 'Legislation and compliance',
  glossary: 'Glossary',
};
const TYPE_ORDER = ['guide', 'concept', 'standard', 'legislation', 'glossary'];

const files = fs.readdirSync(PAGES_DIR).filter((f) => f.endsWith('.md'));
const pages = [];
const problems = [];

for (const file of files) {
  const raw = fs.readFileSync(path.join(PAGES_DIR, file), 'utf8');
  let data, content;
  try {
    ({ data, content } = matter(raw));
  } catch (err) {
    problems.push(`${file}: frontmatter does not parse (${err.reason || err.message})`);
    continue;
  }
  const slug = data.slug;

  if (!data.title) problems.push(`${file}: missing title`);
  if (!slug) problems.push(`${file}: missing slug`);
  if (slug && file !== `${slug}.md`) problems.push(`${file}: filename does not match slug "${slug}"`);
  if (!TYPES.includes(data.type)) problems.push(`${file}: bad type "${data.type}"`);
  if (!data.summary) problems.push(`${file}: missing summary`);
  else if (String(data.summary).length > 200) problems.push(`${file}: summary over 200 chars (${String(data.summary).length})`);
  if (!Array.isArray(data.sources) || data.sources.length === 0) problems.push(`${file}: no sources`);
  if (!data.last_reviewed) problems.push(`${file}: missing last_reviewed`);
  if (!['draft', 'published'].includes(data.status)) problems.push(`${file}: bad status "${data.status}"`);
  if (raw.includes('—')) problems.push(`${file}: contains an em dash`);

  const words = content.trim().split(/\s+/).length;
  if (words < 150) problems.push(`${file}: body only ${words} words`);

  const links = [];
  let m;
  while ((m = WIKILINK.exec(content)) !== null) links.push(m[1]);
  pages.push({ file, slug, title: data.title, type: data.type, summary: data.summary, status: data.status, links, words });
}

const slugs = new Set(pages.map((p) => p.slug));
const inbound = new Map();
for (const page of pages) {
  for (const target of page.links) {
    if (!slugs.has(target)) problems.push(`${page.file}: wikilink to unknown slug "${target}"`);
    inbound.set(target, (inbound.get(target) || 0) + 1);
  }
  if (page.links.length === 0) problems.push(`${page.file}: no outbound wikilinks`);
}
for (const page of pages) {
  if (!inbound.has(page.slug)) problems.push(`${page.file}: orphan (no inbound links)`);
}

console.log(`${pages.length} pages, ${pages.filter((p) => p.status === 'published').length} published`);
if (problems.length) {
  console.log(`\n${problems.length} problems:`);
  for (const p of problems.sort()) console.log(`  - ${p}`);
  process.exitCode = 1;
} else {
  console.log('\nNo problems found.');
}

if (process.argv.includes('--index')) {
  const lines = ['# Wiki index', '', 'Table of contents. One line per page, grouped by type. Regenerated after every ingest.', ''];
  for (const type of TYPE_ORDER) {
    const group = pages.filter((p) => p.type === type).sort((a, b) => String(a.title).localeCompare(String(b.title)));
    if (!group.length) continue;
    lines.push(`## ${TYPE_LABELS[type]}`, '');
    for (const p of group) {
      const flag = p.status === 'draft' ? ' (draft)' : '';
      lines.push(`- [[${p.slug}]]: ${p.summary}${flag}`);
    }
    lines.push('');
  }
  console.log('\n===INDEX===\n');
  console.log(lines.join('\n'));
}
