'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Brand } from '@/components/shared/Brand';

export const Footer = () => {
  return (
    <footer className="bg-[#1A1B1D] text-[#F2F1EA] py-20 px-6 md:px-20">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
        <div>
          <div className="mb-6 select-none font-display text-2xl tracking-[-0.02em] leading-none">
            <span className="font-medium">alka</span><span className="font-bold">tera</span>
          </div>
          <p className="text-[#F2F1EA]/50 font-mono text-sm">
            &copy; 2026 <Brand /> Ltd
          </p>
        </div>

        <div>
          <h4 className="font-mono text-[#F2F1EA]/60 text-[10px] font-bold uppercase tracking-[0.22em] mb-6">Platform</h4>
          <ul className="space-y-4 text-[#F2F1EA]/60">
            <li>
              <Link href="/platform" className="hover:text-[#F2F1EA] transition-colors duration-200 ease-studio">
                Carbon Analytics
              </Link>
            </li>
            <li>
              <Link href="/platform" className="hover:text-[#F2F1EA] transition-colors duration-200 ease-studio">
                Water Footprint
              </Link>
            </li>
            <li>
              <Link href="/platform" className="hover:text-[#F2F1EA] transition-colors duration-200 ease-studio">
                Supply Chain
              </Link>
            </li>
            <li>
              <Link href="/platform" className="hover:text-[#F2F1EA] transition-colors duration-200 ease-studio">
                Reporting
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-mono text-[#F2F1EA]/60 text-[10px] font-bold uppercase tracking-[0.22em] mb-6">Company</h4>
          <ul className="space-y-4 text-[#F2F1EA]/60">
            <li>
              <Link href="/platform" className="hover:text-[#F2F1EA] transition-colors duration-200 ease-studio">
                Platform
              </Link>
            </li>
            <li>
              <Link href="/manifesto" className="hover:text-[#F2F1EA] transition-colors duration-200 ease-studio">
                Manifesto
              </Link>
            </li>
            <li>
              <Link href="/best-sustainability-platform-drinks-industry" className="hover:text-[#F2F1EA] transition-colors duration-200 ease-studio">
                Buyer&apos;s Guide
              </Link>
            </li>
            <li>
              <Link href="/knowledge" className="hover:text-[#F2F1EA] transition-colors duration-200 ease-studio">
                Knowledge
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-[#F2F1EA] transition-colors duration-200 ease-studio">
                Contact
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-mono text-[#F2F1EA]/60 text-[10px] font-bold uppercase tracking-[0.22em] mb-6">Get Started</h4>
          <p className="text-[#F2F1EA]/60 font-sans text-sm mb-4">
            Founding Partner pricing available for a limited time.
          </p>
          <Link
            href="/getaccess"
            className="inline-block bg-[#F2F1EA] text-[#1A1B1D] font-mono text-[10px] font-bold uppercase tracking-[0.22em] px-6 py-3 rounded-full hover:opacity-90 transition-opacity duration-200 ease-studio"
          >
            Get Access
          </Link>
        </div>
      </div>

      <div className="mt-16 pt-10 pb-10 border-t border-b border-[#F2F1EA]/10 flex flex-col sm:flex-row items-center justify-between gap-8">
        <div>
          <p className="font-mono text-[#F2F1EA]/60 text-[10px] font-bold uppercase tracking-[0.22em] mb-2">Memberships &amp; Certifications</p>
          <p className="text-[#F2F1EA]/60 text-sm max-w-xs">
            alka<strong>tera</strong> is a proud member of the Porto Protocol, committed to a more sustainable drinks industry.
          </p>
        </div>
        <a
          href="https://www.portoprotocol.com"
          target="_blank"
          rel="noopener noreferrer"
          className="opacity-80 hover:opacity-100 transition-opacity duration-200 ease-studio flex-shrink-0"
          aria-label="Porto Protocol member"
        >
          <Image
            src="/images/partners/porto-protocol-logo.png"
            alt="Porto Protocol"
            width={200}
            height={63}
            className="h-14 w-auto"
          />
        </a>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="text-[#F2F1EA]/40 font-mono text-xs space-y-1">
          <p>Avallen Solutions Ltd T/A alkatera | Company No. 15905045</p>
          <p>Registered Office: Sterling House, Fulbourne Road, London, E17 4EE</p>
        </div>
        <div className="flex items-center gap-6 text-[#F2F1EA]/50 font-mono text-xs">
          <Link href="/terms" className="hover:text-[#F2F1EA] transition-colors duration-200 ease-studio">
            Terms &amp; Conditions
          </Link>
          <Link href="/privacy" className="hover:text-[#F2F1EA] transition-colors duration-200 ease-studio">
            Privacy Policy
          </Link>
          <Link href="/cookies" className="hover:text-[#F2F1EA] transition-colors duration-200 ease-studio">
            Cookie Policy
          </Link>
        </div>
      </div>
    </footer>
  );
};
