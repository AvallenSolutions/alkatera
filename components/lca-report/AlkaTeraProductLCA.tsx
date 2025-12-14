"use client";

import {
  CoverPage,
  ExecSummaryPage,
  MethodologyPage,
  ClimatePage
} from './pages/Part1';
import {
  WaterPage,
  CircularityPage,
  LandUsePage,
  CommitmentPage
} from './pages/Part2';
import {
  ClimateMethodologyPage,
  WaterMethodologyPage,
  CircularityMethodologyPage,
  LandUseMethodologyPage
} from './pages/Methodologies';
import { SupplyChainPage } from './pages/SupplyChain';
import type { LCAReportData } from './types';

interface AlkaTeraProductLCAProps {
  data: LCAReportData;
}

export const AlkaTeraProductLCA = ({ data }: AlkaTeraProductLCAProps) => {
  return (
    <div className="bg-neutral-100 min-h-screen py-8 print:bg-white print:py-0">
      <div className="print:hidden text-center mb-8 text-neutral-500">
        <p>Press Cmd+P / Ctrl+P to save as PDF</p>
        <p className="text-xs mt-2">Recommended settings: A4, No Margins, Background Graphics ON</p>
      </div>

      <CoverPage data={data} />
      <ExecSummaryPage data={data} />
      <MethodologyPage data={data} />
      <ClimatePage data={data} />
      <ClimateMethodologyPage data={data} />
      <WaterPage data={data} />
      <WaterMethodologyPage data={data} />
      <CircularityPage data={data} />
      <CircularityMethodologyPage data={data} />
      <LandUsePage data={data} />
      <LandUseMethodologyPage data={data} />
      <SupplyChainPage data={data} />
      <CommitmentPage data={data} />
    </div>
  );
};

export default AlkaTeraProductLCA;
