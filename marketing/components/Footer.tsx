'use client';

import { Logo } from './Logo';
import Link from 'next/link';

export const Footer = () => {
  return (
    <footer className="bg-black text-white py-20 px-6 md:px-20 border-t border-white/10">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
        <div>
          <div className="mb-6">
            <Logo />
          </div>
          <p className="text-gray-500 font-mono text-sm">
            &copy; 2026 Alkatera Ltd
          </p>
        </div>

        <div>
          <h4 className="font-mono text-[#ccff00] text-xs uppercase tracking-widest mb-6">Platform</h4>
          <ul className="space-y-4 text-gray-400">
            <li>
              <Link href="/platform" className="hover:text-white transition-colors">
                Carbon Analytics
              </Link>
            </li>
            <li>
              <Link href="/platform" className="hover:text-white transition-colors">
                Water Footprint
              </Link>
            </li>
            <li>
              <Link href="/platform" className="hover:text-white transition-colors">
                Supply Chain
              </Link>
            </li>
            <li>
              <Link href="/platform" className="hover:text-white transition-colors">
                Reporting
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-mono text-[#ccff00] text-xs uppercase tracking-widest mb-6">Company</h4>
          <ul className="space-y-4 text-gray-400">
            <li>
              <Link href="/platform" className="hover:text-white transition-colors">
                Platform
              </Link>
            </li>
            <li>
              <Link href="/manifesto" className="hover:text-white transition-colors">
                Manifesto
              </Link>
            </li>
            <li>
              <Link href="/knowledge" className="hover:text-white transition-colors">
                Knowledge
              </Link>
            </li>
            <li>
              <Link href="/contact" className="hover:text-white transition-colors">
                Contact
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-mono text-[#ccff00] text-xs uppercase tracking-widest mb-6">Get Started</h4>
          <p className="text-gray-400 font-mono text-sm mb-4">
            Founding Partner pricing available for a limited time.
          </p>
          <Link
            href="/getaccess"
            className="inline-block bg-[#ccff00] text-black font-mono text-xs font-bold uppercase tracking-widest px-6 py-3 rounded-full hover:scale-105 transition-transform duration-300"
          >
            Get Access
          </Link>
        </div>
      </div>

      <div className="mt-16 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="text-gray-600 font-mono text-xs space-y-1">
          <p>Avallen Solutions Ltd T/A alkatera | Company No. 15905045</p>
          <p>Registered Office: Sterling House, Fulbourne Road, London, E17 4EE</p>
        </div>
        <div className="flex items-center gap-6 text-gray-500 font-mono text-xs">
          <Link href="/terms" className="hover:text-white transition-colors">
            Terms &amp; Conditions
          </Link>
          <Link href="/privacy" className="hover:text-white transition-colors">
            Privacy Policy
          </Link>
          <Link href="/cookies" className="hover:text-white transition-colors">
            Cookie Policy
          </Link>
        </div>
      </div>
    </footer>
  );
};
