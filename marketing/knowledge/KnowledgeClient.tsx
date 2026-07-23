'use client';

/**
 * The Knowledge page: "the library", ported faithfully from the Claude
 * Design source (Knowledge.dc.html in project fc7cf965). The design's
 * hand-laid card list is replaced by the live blog_posts feed the old
 * page already used (server-fetched, passed in as props) so new
 * articles keep appearing; every card carries a pressed-flower species
 * SVG picked deterministically from its slug, per the design language.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { MarketingButton } from '../shared/MarketingButton';
import { spaceGrotesk } from '../shared/fonts';
import { F_BODY, F_MONO, F_STATEMENT, KICKER, LeafMark, SiteFooter, SiteNav } from '../shared/chrome';
import { CursorCreatures, useReveal } from '../shared/effects';
import { flowerForSlug } from './flowers';

export interface KnowledgePost {
  id: string;
  title: string;
  slug: string;
  excerpt?: string;
  tags: string[];
  read_time?: string;
  featured_image_url?: string;
  author_name?: string;
  content_type: string;
  published_at?: string;
}

/* The design's shelf of tags; cards match case-insensitively. */
const FILTER_TAGS = [
  'all', 'sustainability', 'drinks industry', 'lca', 'greenwashing',
  'circularity', 'b corp', 'legislation', 'reporting', 'business',
];

/* Kickers pick up a warning tint for the enforcement topics. */
function kickerColour(tags: string[]): string {
  const lower = tags.map((t) => t.toLowerCase());
  if (lower.some((t) => t.includes('greenwash'))) return '#BE123C';
  if (lower.some((t) => t.includes('legislation') || t.includes('csrd'))) return '#B45309';
  return '#6F6F68';
}

function postMatches(post: KnowledgePost, tag: string): boolean {
  if (tag === 'all') return true;
  return post.tags.some((t) => t.toLowerCase() === tag);
}

function cardKicker(post: KnowledgePost): string {
  const parts = [post.read_time, ...post.tags.slice(0, 2)].filter(Boolean);
  return parts.join(' · ');
}

/* The hero's treeline: species, sized and overlapped as designed. */
const TREELINE: { src: string; height: number; marginRight?: number; z?: number }[] = [
  { src: '/assets/species/grass-tall-meadow.svg', height: 76, marginRight: -20 },
  { src: '/assets/species/tree-birch.svg', height: 166, marginRight: -26 },
  { src: '/assets/species/flower-foxglove.svg', height: 60, marginRight: -20 },
  { src: '/assets/species/tree-scots-pine.svg', height: 190, marginRight: -30 },
  { src: '/assets/species/understory-fern.svg', height: 46, marginRight: -16 },
  { src: '/assets/species/tree-rowan.svg', height: 146, marginRight: -22 },
  { src: '/assets/creatures/creature-rosa.svg', height: 48, marginRight: -14, z: 2 },
  { src: '/assets/species/tree-field-maple.svg', height: 124, marginRight: -18 },
  { src: '/assets/species/grass-drooping.svg', height: 64 },
];

export function KnowledgeClient({ posts }: { posts: KnowledgePost[] }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const newsInputRef = useRef<HTMLInputElement>(null);
  const [activeTag, setActiveTag] = useState('all');
  const [newsDone, setNewsDone] = useState(false);
  const [newsError, setNewsError] = useState(false);

  useReveal(rootRef);

  const featured = posts[0];
  const rest = useMemo(() => posts.slice(1), [posts]);
  const featuredShown = featured && postMatches(featured, activeTag);
  const shownRest = useMemo(
    () => rest.filter((post) => postMatches(post, activeTag)),
    [rest, activeTag],
  );
  const nothingShown = !featuredShown && shownRest.length === 0;

  const submitNews = useCallback(() => {
    const v = newsInputRef.current?.value ?? '';
    if (/.+@.+\..+/.test(v)) {
      setNewsDone(true);
      setNewsError(false);
    } else {
      setNewsError(true);
    }
  }, []);

  return (
    <div ref={rootRef} className={`mkt-home ${spaceGrotesk.variable}`}>
      <SiteNav active="knowledge" />

      <main>
        {/* ————— Hero: the library, with the treeline ————— */}
        <section
          className="mkt-pad"
          style={{
            padding: '170px 48px 0', boxSizing: 'border-box', background: '#DFA32B',
            color: '#1A1B1D', position: 'relative', overflow: 'hidden',
          }}
        >
          <div style={{ position: 'absolute', right: -120, top: -60, width: 420, height: 420, opacity: 0.12, pointerEvents: 'none' }}>
            <LeafMark size={420} stroke="#1A1B1D" />
          </div>
          <div
            className="mkt-grid-collapse"
            style={{
              maxWidth: 1184, margin: '0 auto', position: 'relative', display: 'grid',
              gridTemplateColumns: 'minmax(300px,1.35fr) minmax(300px,0.65fr)', gap: 24, alignItems: 'end',
            }}
          >
            <div style={{ paddingBottom: 64 }}>
              <p data-reveal="0" style={{ ...KICKER, color: 'rgba(26,27,29,0.62)', margin: '0 0 26px' }}>
                alkatera·OS · The Library
              </p>
              <h1
                style={{
                  fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(44px,6vw,88px)',
                  lineHeight: 0.95, letterSpacing: '-0.035em', color: '#1A1B1D', margin: '0 0 26px', maxWidth: '16ch',
                }}
              >
                <span data-reveal="80" style={{ display: 'inline-block' }}>Knowledge for the</span>{' '}
                <span data-reveal="200" style={{ display: 'inline-block' }}>Conscious Producer</span>
              </h1>
              <p data-reveal="320" style={{ fontFamily: F_BODY, fontSize: 15, lineHeight: 1.6, color: 'rgba(26,27,29,0.72)', maxWidth: '58ch', margin: 0 }}>
                Insights, guides, and perspectives on building a regenerative drinks brand.
                From carbon accounting to supply chain strategy, explore the science and
                stories behind sustainable growth.
              </p>
            </div>
            <div
              data-reveal="380"
              style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', position: 'relative' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/assets/species/creature-bird.svg"
                alt=""
                aria-hidden="true"
                style={{ height: 28, width: 'auto', position: 'absolute', right: 196, bottom: 206 }}
              />
              {TREELINE.map((plant) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={plant.src}
                  src={plant.src}
                  alt={plant.src.includes('rosa') ? 'Rosa the goldendoodle' : ''}
                  aria-hidden={plant.src.includes('rosa') ? undefined : 'true'}
                  style={{
                    height: plant.height, width: 'auto', marginRight: plant.marginRight,
                    position: 'relative', zIndex: plant.z,
                  }}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ————— The tag shelf ————— */}
        <section
          className="mkt-pad"
          style={{
            background: '#ECEAE3', position: 'sticky', top: 60, zIndex: 40,
            borderTop: '1px solid #D9D6CB', borderBottom: '1px solid #D9D6CB',
            padding: '14px 48px', boxSizing: 'border-box',
          }}
        >
          <div
            style={{
              maxWidth: 1184, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 8,
              fontFamily: F_MONO, fontWeight: 700, fontSize: 9, letterSpacing: '0.16em',
              textTransform: 'uppercase',
            }}
          >
            {FILTER_TAGS.map((tag) => {
              const on = tag === activeTag;
              return (
                <span
                  key={tag}
                  onClick={() => setActiveTag(tag)}
                  style={{
                    cursor: 'pointer', padding: '6px 14px', borderRadius: 999,
                    border: `1px solid ${on ? '#1A1B1D' : '#D9D6CB'}`,
                    background: on ? '#1A1B1D' : 'transparent',
                    color: on ? '#F2F1EA' : '#6F6F68',
                    transition: 'all 0.15s',
                  }}
                >
                  {tag === 'all' ? 'All' : tag}
                </span>
              );
            })}
          </div>
        </section>

        {/* ————— Featured: the latest article ————— */}
        {featuredShown && (
          <section className="mkt-pad" style={{ background: '#ECEAE3', padding: '64px 48px 0', boxSizing: 'border-box' }}>
            <div style={{ maxWidth: 1184, margin: '0 auto' }}>
              <a
                data-reveal="0"
                className="mkt-card"
                href={`/blog/${featured.slug}`}
                style={{
                  display: 'grid', gridTemplateColumns: '1fr 220px', gap: 48, alignItems: 'center',
                  background: '#F2F1EA', border: '1px solid #D9D6CB', borderRadius: 6,
                  padding: '44px 44px 48px', textDecoration: 'none',
                }}
              >
                <div>
                  <p style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#A97C14', margin: '0 0 18px' }}>
                    Latest · {cardKicker(featured)}
                  </p>
                  <h2
                    style={{
                      fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(28px,3.4vw,48px)',
                      lineHeight: 1.0, letterSpacing: '-0.035em', color: '#1A1B1D', margin: '0 0 18px', maxWidth: '24ch',
                    }}
                  >
                    {featured.title}
                  </h2>
                  {featured.excerpt && (
                    <p style={{ fontFamily: F_BODY, fontSize: 14.5, lineHeight: 1.6, color: '#6F6F68', margin: '0 0 22px', maxWidth: '64ch' }}>
                      {featured.excerpt}
                    </p>
                  )}
                  <span style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#205E40', borderBottom: '1px solid #205E40', paddingBottom: 3 }}>
                    Read the article
                  </span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={flowerForSlug(featured.slug)}
                  alt=""
                  aria-hidden="true"
                  style={{ width: '100%', maxWidth: 200, justifySelf: 'center', opacity: 0.95 }}
                />
              </a>
            </div>
          </section>
        )}

        {/* ————— The article index ————— */}
        <section className="mkt-pad" style={{ background: '#ECEAE3', padding: '20px 48px 90px', boxSizing: 'border-box' }}>
          <div
            style={{
              maxWidth: 1184, margin: '0 auto', display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(350px,1fr))', gap: 20, paddingTop: 20,
            }}
          >
            {shownRest.map((post, i) => (
              <a
                key={post.id}
                data-reveal={String((i % 3) * 60)}
                className="mkt-card"
                href={`/blog/${post.slug}`}
                style={{
                  display: 'flex', flexDirection: 'column', background: '#F2F1EA',
                  border: '1px solid #D9D6CB', borderRadius: 6, padding: '30px 28px 26px',
                  textDecoration: 'none', position: 'relative', overflow: 'hidden', minHeight: 280,
                }}
              >
                <p style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: kickerColour(post.tags), margin: '0 0 14px' }}>
                  {cardKicker(post)}
                </p>
                <h3 style={{ fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 21, lineHeight: 1.1, letterSpacing: '-0.025em', color: '#1A1B1D', margin: '0 0 12px' }}>
                  {post.title}
                </h3>
                {post.excerpt && (
                  <p
                    style={{
                      fontFamily: F_BODY, fontSize: 13, lineHeight: 1.55, color: '#6F6F68',
                      margin: '0 0 18px', display: '-webkit-box', WebkitLineClamp: 4,
                      WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    }}
                  >
                    {post.excerpt}
                  </p>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={flowerForSlug(post.slug)}
                  alt=""
                  aria-hidden="true"
                  style={{ height: 64, width: 'auto', alignSelf: 'flex-end', marginTop: 'auto', opacity: 0.85 }}
                />
              </a>
            ))}

            {nothingShown && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '64px 24px' }}>
                <p style={{ fontFamily: F_STATEMENT, fontWeight: 600, fontSize: 19, letterSpacing: '-0.02em', color: '#1A1B1D', margin: '0 0 8px' }}>
                  Nothing on that shelf yet.
                </p>
                <p style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#6F6F68', margin: 0 }}>
                  Try another tag
                </p>
              </div>
            )}
          </div>
        </section>

        {/* ————— The newsletter ————— */}
        <section
          className="mkt-pad"
          style={{
            background: '#DFA32B', color: '#1A1B1D', position: 'relative', overflow: 'hidden',
            padding: '96px 48px', boxSizing: 'border-box',
          }}
        >
          <div style={{ position: 'absolute', left: -90, bottom: -90, width: 360, height: 360, opacity: 0.14 }}>
            <LeafMark size={360} stroke="#1A1B1D" />
          </div>
          <div
            className="mkt-grid-collapse"
            style={{
              maxWidth: 1184, margin: '0 auto', display: 'grid',
              gridTemplateColumns: 'minmax(300px,1fr) minmax(300px,440px)', gap: 48,
              alignItems: 'center', position: 'relative',
            }}
          >
            <div>
              <p data-reveal="0" style={{ ...KICKER, color: 'rgba(26,27,29,0.62)', margin: '0 0 20px' }}>
                The newsletter · Sustainability, monthly
              </p>
              <h2
                data-reveal="100"
                style={{
                  fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 'clamp(30px,3.6vw,52px)',
                  lineHeight: 0.98, letterSpacing: '-0.035em', margin: '0 0 16px',
                }}
              >
                The library posts you a letter.
              </h2>
              <p data-reveal="200" style={{ fontFamily: F_BODY, fontSize: 14, lineHeight: 1.6, color: 'rgba(26,27,29,0.72)', maxWidth: '46ch', margin: 0 }}>
                One considered email a month on regulation, retailer requirements and what
                the best drinks brands are doing about both.
              </p>
            </div>
            <div data-reveal="280" style={{ background: '#F2F1EA', borderRadius: 6, padding: '28px 26px' }}>
              {!newsDone && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <input
                    ref={newsInputRef}
                    type="email"
                    placeholder="you@yourbrand.com"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitNews();
                    }}
                    style={{
                      fontFamily: F_BODY, fontSize: 14, color: '#1A1B1D', background: '#ECEAE3',
                      border: '1px solid #D9D6CB', borderRadius: 999, padding: '12px 18px',
                      width: '100%', boxSizing: 'border-box',
                    }}
                  />
                  <MarketingButton size="lg" onClick={submitNews} style={{ width: '100%' }}>
                    Subscribe
                  </MarketingButton>
                  {newsError && (
                    <p style={{ fontFamily: F_MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#BE123C', margin: '2px 0 0' }}>
                      That address does not look right.
                    </p>
                  )}
                </div>
              )}
              {newsDone && (
                <>
                  <p style={{ fontFamily: F_STATEMENT, fontWeight: 700, fontSize: 20, letterSpacing: '-0.03em', color: '#047857', margin: '0 0 6px' }}>
                    You&apos;re on the list.
                  </p>
                  <p style={{ fontFamily: F_BODY, fontSize: 13.5, lineHeight: 1.5, color: '#6F6F68', margin: 0 }}>
                    One considered email a month, nothing more.
                  </p>
                </>
              )}
            </div>
          </div>
        </section>

        <SiteFooter
          platformLinksHref="/platform#modules"
          companyLinks={[
            { label: 'Manifesto', href: '/#manifesto' },
            { label: "Buyer's Guide", href: '/best-sustainability-platform-drinks-industry' },
            { label: 'Knowledge', href: '/knowledge' },
            { label: 'Contact', href: '/contact' },
          ]}
        />
      </main>

      <CursorCreatures />
    </div>
  );
}
