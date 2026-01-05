'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { Logo } from './Logo';
import Link from 'next/link';

interface NavigationProps {
  onOpenContact?: () => void;
}

export const Navigation = ({ onOpenContact }: NavigationProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { label: 'Platform', href: '/platform' },
    { label: 'Manifesto', href: '/manifesto' },
    { label: 'Impact', href: '/impact' },
    { label: 'Knowledge', href: '/knowledge' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-6 flex justify-between items-center text-white">
      <div className="z-50">
        <Link href="/">
          <Logo />
        </Link>
      </div>

      <div className="hidden md:flex items-center gap-8 font-mono text-xs tracking-widest uppercase">
        {navItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="hover:opacity-50 transition-opacity duration-300"
          >
            {item.label}
          </Link>
        ))}
        <Link
          href="/contact"
          className="border border-white px-6 py-2 rounded-full hover:bg-white hover:text-black transition-colors duration-300"
        >
          Get Access
        </Link>
      </div>

      <button
        className="md:hidden z-50"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle menu"
      >
        {isOpen ? <X /> : <Menu />}
      </button>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", damping: 20 }}
            className="fixed inset-0 bg-[#0a0a0a] z-40 flex flex-col justify-center items-center gap-8 md:hidden"
          >
            {navItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="text-4xl font-serif hover:text-[#ccff00] transition-colors"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/contact"
              onClick={() => setIsOpen(false)}
              className="mt-8 text-[#ccff00] font-mono uppercase tracking-widest border border-[#ccff00] px-8 py-4 rounded-full"
            >
              Get Access
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};
