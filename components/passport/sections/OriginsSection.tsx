"use client";

import { motion } from 'framer-motion';
import { Leaf } from 'lucide-react';
import type { LCADataOrigins } from '@/lib/types/passport';
import SectionHeading from './SectionHeading';

interface OriginsSectionProps {
  data: LCADataOrigins;
  sectionNumber: string;
}

function countryCodeToFlag(code: string | null): string {
  if (!code || code.length !== 2) return '';
  const codePoints = Array.from(code.toUpperCase()).map(
    char => 0x1F1E6 - 65 + char.charCodeAt(0)
  );
  return String.fromCodePoint(...codePoints);
}

export default function OriginsSection({ data, sectionNumber }: OriginsSectionProps) {
  return (
    <section className="py-24 px-6 md:px-12 bg-white border-b border-stone-200">
      <div className="max-w-7xl mx-auto">
        <SectionHeading number={sectionNumber}>Supply Chain Transparency</SectionHeading>

        <p className="font-serif text-2xl text-stone-800 mb-12">
          <span className="text-lime-800 font-bold">{data.totalIngredients}</span>
          {' '}ingredients sourced from{' '}
          <span className="text-lime-800 font-bold">{data.totalCountries}</span>
          {' '}{data.totalCountries === 1 ? 'country' : 'countries'}
        </p>

        {data.ingredients.length > 0 && (
          <div className="mb-10">
            <p className="font-mono text-xs text-stone-400 uppercase tracking-widest mb-4">
              Ingredients
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.ingredients.map((item, index) => (
                <motion.div
                  key={`${item.name}-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-stone-50 rounded-lg border border-stone-100 p-4 hover:border-brand-accent transition-colors duration-300"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl leading-none">
                      {countryCodeToFlag(item.originCountryCode)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm font-bold text-stone-900 truncate">
                        {item.name}
                      </p>
                      <p className="text-sm text-stone-500">{item.originCountry}</p>
                    </div>
                    {item.isOrganic && (
                      <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full px-2 py-0.5 text-xs font-mono flex-shrink-0">
                        <Leaf className="w-3 h-3" />
                        Organic
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {data.packaging.length > 0 && (
          <div>
            <p className="font-mono text-xs text-stone-400 uppercase tracking-widest mb-4">
              Packaging
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.packaging.map((item, index) => (
                <motion.div
                  key={`${item.name}-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-stone-50 rounded-lg border border-stone-100 p-4 hover:border-brand-accent transition-colors duration-300"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl leading-none">
                      {countryCodeToFlag(item.originCountryCode)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm font-bold text-stone-900 truncate">
                        {item.name}
                      </p>
                      <p className="text-sm text-stone-500">{item.originCountry}</p>
                    </div>
                    {item.packagingCategory && (
                      <span className="inline-flex items-center bg-stone-100 border border-stone-200 rounded-full px-2 py-0.5 text-xs font-mono text-stone-600 flex-shrink-0 capitalize">
                        {item.packagingCategory}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
