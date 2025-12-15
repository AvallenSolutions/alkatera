"use client";

import { PageWrapper, SectionHeader } from '../Layout';
import { SimplePieChart } from '../Charts';
import type { LCAReportData } from '../types';
import { AlkaTeraLogoVertical } from '../Logo';
import { Building2 } from 'lucide-react';

export const WaterPage = ({ data }: { data: LCAReportData }) => (
  <PageWrapper theme="dark" pageNumber={4}>
    <SectionHeader number="04" title="Water Footprint" theme="dark" />

    <div className="grid grid-cols-2 gap-8 mb-10">
      <div className="bg-[#292524] p-6 rounded-2xl border border-white/5">
        <div className="text-xs font-mono text-neutral-500 mb-4 uppercase">Total Water Consumption</div>
        <div className="text-6xl font-serif text-[#3b82f6]">{data.waterFootprint.totalConsumption}</div>
      </div>
      <div className="bg-[#292524] p-6 rounded-2xl border border-white/5">
        <div className="text-xs font-mono text-neutral-500 mb-4 uppercase">Scarcity Weighted (AWARE)</div>
        <div className="text-6xl font-serif text-[#3b82f6] opacity-80">{data.waterFootprint.scarcityWeighted}</div>
      </div>
    </div>

    <h3 className="text-xl font-serif mb-6">Water Sources Breakdown</h3>
    <div className="flex gap-12 mb-10">
      <div className="w-1/2 h-[250px]">
        <SimplePieChart data={data.waterFootprint.breakdown} />
      </div>
      <div className="w-1/2 flex flex-col justify-center gap-3">
        {data.waterFootprint.breakdown.map((item) => (
          <div key={item.name} className="flex items-center gap-4">
            <div className="w-3 h-3 rounded shadow-sm" style={{ backgroundColor: item.color }} />
            <span className="text-sm text-neutral-300">{item.name}</span>
          </div>
        ))}
      </div>
    </div>

    <h3 className="text-xl font-serif mb-4">Water Sources by Location</h3>
    <div className="w-full text-sm">
      <div className="flex text-[10px] font-mono text-neutral-500 uppercase border-b border-white/10 pb-2 mb-2">
        <div className="w-1/4">Source</div>
        <div className="w-1/4">Location</div>
        <div className="w-1/4 text-right">Volume</div>
        <div className="w-1/4 text-right">Risk Score</div>
      </div>
      {data.waterFootprint.sources.map((source, i) => (
        <div key={i} className="flex py-2 border-b border-white/5 text-neutral-300">
          <div className="w-1/4 truncate pr-2">{source.source}</div>
          <div className="w-1/4 text-neutral-500 truncate pr-2">{source.location}</div>
          <div className="w-1/4 text-right">{source.volume}</div>
          <div className="w-1/4 text-right flex items-center justify-end gap-2">
            <span className={source.risk === 'MEDIUM' ? 'text-yellow-500' : source.risk === 'HIGH' ? 'text-red-500' : 'text-green-500'}>{source.risk}</span>
            <span className="font-mono text-xs opacity-50">{source.score.toFixed(3)}</span>
          </div>
        </div>
      ))}
    </div>
  </PageWrapper>
);

export const CircularityPage = ({ data }: { data: LCAReportData }) => (
  <PageWrapper theme="dark" pageNumber={5}>
    <SectionHeader number="05" title="Circularity & Waste" theme="dark" />

    <div className="grid grid-cols-3 gap-6 mb-16">
      <div className="bg-[#292524] p-8 rounded-2xl border border-white/5 aspect-square flex flex-col justify-center">
        <div className="text-xs font-mono text-neutral-500 mb-4 uppercase">Total Waste</div>
        <div className="text-5xl font-serif text-orange-500">{data.circularity.totalWaste}</div>
      </div>
      <div className="bg-[#292524] p-8 rounded-2xl border border-white/5 aspect-square flex flex-col justify-center">
        <div className="text-xs font-mono text-neutral-500 mb-4 uppercase">Recycling Rate</div>
        <div className="text-5xl font-serif text-green-500">{data.circularity.recyclingRate}%</div>
      </div>
      <div className="bg-[#292524] p-8 rounded-2xl border border-white/5 aspect-square flex flex-col justify-center">
        <div className="text-xs font-mono text-neutral-500 mb-4 uppercase">Circularity Score</div>
        <div className="text-5xl font-serif text-[#ccff00]">{data.circularity.circularityScore}</div>
      </div>
    </div>

    <h3 className="text-xl font-serif mb-8">Waste Stream Breakdown</h3>
    <div className="space-y-8">
      {data.circularity.wasteStream.map((stream) => (
        <div key={stream.label} className="flex items-center gap-8">
          <div className="w-32 text-sm text-neutral-400">{stream.label}</div>
          <div className="flex-1 h-8 bg-[#292524] rounded-full overflow-hidden flex">
            <div
              className="h-full bg-green-500"
              style={{ width: stream.recycled ? '70%' : '30%' }}
            />
            <div
              className="h-full bg-neutral-700"
              style={{ width: stream.recycled ? '30%' : '70%' }}
            />
          </div>
          <div className="w-24 text-right font-mono text-sm">
            {stream.value}
            <span className={`ml-4 ${stream.recycled ? 'text-green-500' : 'text-red-500'}`}>
              {stream.recycled ? 'R' : 'X'}
            </span>
          </div>
        </div>
      ))}
    </div>
  </PageWrapper>
);

export const LandUsePage = ({ data }: { data: LCAReportData }) => (
  <PageWrapper theme="dark" pageNumber={6}>
    <SectionHeader number="06" title="Land Use & Nature" theme="dark" />

    <div className="bg-[#292524] p-12 rounded-3xl border border-white/5 mb-16 inline-block min-w-[300px]">
      <div className="text-xs font-mono text-neutral-500 mb-4 uppercase">Total Land Use</div>
      <div className="text-6xl font-serif text-emerald-500">{data.landUse.totalLandUse}</div>
    </div>

    <h3 className="text-xl font-serif mb-6">Material Land Footprint</h3>
    <div className="w-full text-sm">
      <div className="flex text-[10px] font-mono text-neutral-500 uppercase border-b border-white/10 pb-2 mb-4">
        <div className="w-1/4">Material</div>
        <div className="w-1/4">Origin</div>
        <div className="w-1/6 text-right">Mass</div>
        <div className="w-1/6 text-right">Intensity</div>
        <div className="w-1/6 text-right">Footprint</div>
      </div>
      {data.landUse.breakdown.map((item, i) => (
        <div key={i} className="flex py-4 border-b border-white/5 text-neutral-300">
          <div className="w-1/4">{item.material}</div>
          <div className="w-1/4 text-neutral-500">{item.origin}</div>
          <div className="w-1/6 text-right">{item.mass}</div>
          <div className="w-1/6 text-right opacity-60">{item.intensity}</div>
          <div className="w-1/6 text-right text-emerald-500">{item.footprint}</div>
        </div>
      ))}
    </div>
  </PageWrapper>
);

export const CommitmentPage = ({ data }: { data: LCAReportData }) => (
  <PageWrapper theme="light" pageNumber={7} className="flex flex-col justify-between items-center text-center pt-20 pb-32">
    <div className="mb-12 flex-none">
      <div className="w-32 h-32 rounded-full border-2 border-dashed border-neutral-300 flex flex-col items-center justify-center bg-neutral-50">
        <Building2 className="w-8 h-8 text-neutral-400 mb-2" />
        <span className="text-[10px] font-mono uppercase text-neutral-400">Org Logo</span>
      </div>
    </div>

    <div className="flex-1 flex flex-col justify-center max-w-2xl">
      <h2 className="text-5xl font-serif mb-12">Commitment to Transparency</h2>
      <div className="text-xl text-neutral-600 leading-loose">
        {data.commitment.text}
      </div>
    </div>

    <div className="mt-8 flex-none mb-4">
      <AlkaTeraLogoVertical
        iconClassName="text-[#4d7c0f]"
        wordmarkClassName="text-black"
        iconSize="w-10 h-10"
        textSize="text-xl"
      />
    </div>
  </PageWrapper>
);
