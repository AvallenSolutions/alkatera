"use client";

import { motion } from 'framer-motion';
import Image from 'next/image';
import { Trophy, Leaf, Wine } from 'lucide-react';
import type { LCADataProductIdentity, TierVisibility } from '@/lib/types/passport';

interface ProductIdentitySectionProps {
  data: LCADataProductIdentity;
  visibility: TierVisibility;
}

export default function ProductIdentitySection({
  data,
  visibility,
}: ProductIdentitySectionProps) {
  return (
    <section className="py-16 md:py-24 px-6 md:px-12 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12 items-center">
          <div className="lg:col-span-5">
            <div className="rounded-xl overflow-hidden shadow-lg aspect-[3/4] relative bg-gradient-to-br from-stone-100 via-lime-50 to-stone-200">
              {data.productImage ? (
                <Image
                  src={data.productImage}
                  alt={data.organizationName ? `Product by ${data.organizationName}` : 'Product image'}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 40vw"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Wine className="w-24 h-24 text-stone-300" />
                </div>
              )}
            </div>
          </div>

          <motion.div
            className="lg:col-span-7"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {(data.productCategory || data.volumeDisplay) && (
              <div className="flex flex-wrap gap-2 mb-4">
                {data.productCategory && (
                  <span className="bg-brand-accent px-3 py-1 inline-flex font-mono text-xs text-black uppercase tracking-widest font-bold">
                    {data.productCategory}
                  </span>
                )}
                {data.volumeDisplay && (
                  <span className="bg-stone-900 px-3 py-1 inline-flex font-mono text-xs text-white uppercase tracking-widest">
                    {data.volumeDisplay}
                  </span>
                )}
              </div>
            )}

            {data.productDescription && (
              <p className="text-stone-600 leading-relaxed text-lg mb-8 line-clamp-3">
                {data.productDescription}
              </p>
            )}

            {data.organizationLogo && (
              <div className="mb-6">
                <Image
                  src={data.organizationLogo}
                  alt={data.organizationName}
                  width={120}
                  height={40}
                  className="object-contain"
                />
              </div>
            )}

            {!data.organizationLogo && data.organizationName && (
              <p className="font-mono text-xs text-stone-500 uppercase tracking-wider mb-6">
                {data.organizationName}
              </p>
            )}

            {visibility.showCertifications && data.certifications.length > 0 && (
              <div className="mb-4">
                <p className="font-mono text-xs text-stone-400 uppercase tracking-widest mb-3">
                  Certifications
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.certifications.map((cert, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 bg-stone-100 border border-stone-200 rounded-full px-3 py-1 text-xs font-mono text-stone-700"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-lime-400" />
                      {cert.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {visibility.showCertifications && data.awards.length > 0 && (
              <div>
                <p className="font-mono text-xs text-stone-400 uppercase tracking-widest mb-3">
                  Awards
                </p>
                <div className="flex flex-wrap gap-2">
                  {data.awards.map((award, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 bg-stone-100 border border-stone-200 rounded-full px-3 py-1 text-xs font-mono text-stone-700"
                    >
                      <Trophy className="w-3 h-3 text-amber-500" />
                      {award.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
