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
            © 2026 Alkatera Ltd
          </p>
        </div>

        <div>
          <h4 className="font-mono text-[#ccff00] text-xs uppercase tracking-widest mb-6">Platform</h4>
          <ul className="space-y-4 text-gray-400">
            <li>
              <Link href="#" className="hover:text-white transition-colors">
                Carbon Analytics
              </Link>
            </li>
            <li>
              <Link href="#" className="hover:text-white transition-colors">
                Water Footprint
              </Link>
            </li>
            <li>
              <Link href="#" className="hover:text-white transition-colors">
                Supply Chain
              </Link>
            </li>
            <li>
              <Link href="#" className="hover:text-white transition-colors">
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
          <h4 className="font-mono text-[#ccff00] text-xs uppercase tracking-widest mb-6">Newsletter</h4>
          <form className="flex border-b border-white/30 pb-2" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder="Email Address"
              className="bg-transparent outline-none w-full placeholder:text-gray-600 font-mono text-sm"
            />
            <button
              type="submit"
              className="text-[#ccff00] uppercase text-xs font-bold hover:text-white transition-colors"
            >
              Submit
            </button>
          </form>
        </div>
      </div>

      <div className="mt-16 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-gray-600 font-mono text-xs">
          Avallen Solutions Ltd trading as Alkatera
        </p>
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
