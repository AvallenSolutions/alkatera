"use client";

import { PageWrapper, SectionHeader } from '../Layout';
import type { LCAReportData } from '../types';

export const SupplyChainPage = ({ data }: { data: LCAReportData }) => (
  <PageWrapper theme="dark" pageNumber={13}>
    <SectionHeader number="07" title="Supply Chain Mapping" theme="dark" className="mb-6" />

    <div className="grid grid-cols-2 gap-4 mb-6">
      <div className="bg-[#292524] p-5 rounded-2xl border border-white/5">
        <div className="text-[10px] font-mono text-neutral-500 mb-2 uppercase tracking-wider">Total Transport Distance</div>
        <div className="text-3xl text-[#fbbf24] font-light font-mono">
          {data.supplyChain.totalDistance}
        </div>
      </div>
      <div className="bg-[#292524] p-5 rounded-2xl border border-white/5">
        <div className="text-[10px] font-mono text-neutral-500 mb-2 uppercase tracking-wider">Verified Suppliers</div>
        <div className="text-3xl text-[#4ade80] font-light font-mono">
          {data.supplyChain.verifiedSuppliers}
        </div>
      </div>
    </div>

    <div className="space-y-4">
      <h3 className="text-base font-normal mb-4 text-white">Supply Chain Network</h3>

      <div className="space-y-4">
        {data.supplyChain.network.map((category, i) => (
          <div key={i}>
            <div className="font-mono text-[10px] text-[#4ade80] uppercase tracking-wider mb-2 pl-1">
              &lt;&gt; {category.category}
            </div>

            <div className="space-y-2">
              {category.items.map((item, j) => (
                <div key={j} className="bg-[#292524] p-3 rounded-xl border border-white/5 flex items-center justify-between group hover:border-neutral-700 transition-colors">
                  <div>
                    <div className="text-white text-sm font-medium mb-0.5">{item.name}</div>
                    <div className="text-[10px] text-neutral-500">{item.location}</div>
                  </div>

                  <div className="flex items-center gap-8 text-right">
                    <div className="font-mono text-xs text-neutral-400">
                      {item.distance}
                    </div>
                    <div className="font-mono text-xs text-[#fbbf24] min-w-[80px]">
                      {item.co2}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  </PageWrapper>
);
