'use client';

/**
 * The marketing site's shared life: the scroll reveals, the bee and
 * butterfly that keep the cursor company, and Rosa's r-o-s-a run.
 * All from the Claude Design source's page script, re-homed as hooks.
 */

import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Fade-and-rise every [data-reveal] element inside root as it enters the
 * viewport, staggered by the attribute's millisecond value. The matching
 * transition lives in marketing.css (.mkt-home [data-reveal]).
 */
export function useReveal(root: RefObject<HTMLElement>) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const target = e.target as HTMLElement;
          const d = reduced ? 0 : parseInt(target.getAttribute('data-reveal') || '0', 10) + 160;
          setTimeout(() => target.classList.add('mkt-revealed'), d);
          io.unobserve(target);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -4% 0px' },
    );
    el.querySelectorAll('[data-reveal]').forEach((node) => io.observe(node));
    return () => io.disconnect();
  }, [root]);
}

/**
 * The cursor's company (a bee ahead, a butterfly trailing) and Rosa's
 * run across the viewport when someone types r-o-s-a. Renders the fixed
 * creatures; safe to drop on any marketing page.
 */
export function CursorCreatures() {
  const beeRef = useRef<HTMLImageElement>(null);
  const butterflyRef = useRef<HTMLImageElement>(null);
  const [rosaRun, setRosaRun] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2, seen: false };
    const bee = { x: -60, y: 120, dx: 0 };
    const fly = { x: window.innerWidth + 60, y: 200, dx: 0 };
    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.seen = true;
    };
    window.addEventListener('mousemove', onMove, { passive: true });
    let t = 0;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      t += 0.016;
      if (!mouse.seen) return;
      const bx = mouse.x + 34 + Math.sin(t * 2.1) * 10;
      const by = mouse.y - 26 + Math.cos(t * 2.7) * 8;
      bee.dx = bx - bee.x;
      bee.x += bee.dx * 0.07;
      bee.y += (by - bee.y) * 0.07;
      const fx = mouse.x - 60 + Math.sin(t * 1.3) * 26;
      const fy = mouse.y + 30 + Math.sin(t * 1.7) * 18;
      fly.dx = fx - fly.x;
      fly.x += fly.dx * 0.035;
      fly.y += (fy - fly.y) * 0.035;
      const be = beeRef.current;
      const fe = butterflyRef.current;
      if (be) {
        be.style.opacity = '0.9';
        be.style.transform = `translate(${bee.x - 15}px, ${bee.y - 15}px) scaleX(${bee.dx < 0 ? -1 : 1}) rotate(${Math.sin(t * 3) * 8}deg)`;
      }
      if (fe) {
        fe.style.opacity = '0.85';
        fe.style.transform = `translate(${fly.x - 13}px, ${fly.y - 13}px) scaleX(${fly.dx < 0 ? -1 : 1}) rotate(${Math.sin(t * 2.2) * 12}deg)`;
      }
    };
    raf = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  useEffect(() => {
    let buf = '';
    let running = false;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      buf = (buf + (e.key || '')).slice(-8).toLowerCase();
      if (buf.endsWith('rosa') && !running) {
        running = true;
        setRosaRun(true);
        setTimeout(() => {
          running = false;
          setRosaRun(false);
        }, 7200);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={beeRef}
        src="/assets/creatures/creature-bee0.svg"
        alt=""
        aria-hidden="true"
        style={{ position: 'fixed', left: 0, top: 0, width: 30, zIndex: 85, pointerEvents: 'none', opacity: 0, willChange: 'transform' }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={butterflyRef}
        src="/assets/creatures/creature-butterfly0.svg"
        alt=""
        aria-hidden="true"
        style={{ position: 'fixed', left: 0, top: 0, width: 26, zIndex: 85, pointerEvents: 'none', opacity: 0, willChange: 'transform' }}
      />
      {rosaRun && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          data-anim=""
          src="/assets/creatures/creature-rosa.svg"
          alt="Rosa the goldendoodle"
          style={{ position: 'fixed', bottom: 8, left: 0, width: 130, zIndex: 86, pointerEvents: 'none', animation: 'mkt-rosa-run 7s linear' }}
        />
      )}
    </>
  );
}
