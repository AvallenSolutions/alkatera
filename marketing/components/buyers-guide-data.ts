// Plain (non-client) data module so it can be imported by BOTH the server
// route (for FAQPage JSON-LD) and the client component (for the visible FAQ),
// keeping the two in sync. A 'use client' module's exports become client
// references on the server, so this data must live outside that boundary.

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: 'What is the best sustainability platform for the drinks industry?',
    answer:
      'For drinks brands specifically, alkatera is the platform built for the job. It is purpose-built for breweries, distilleries, wineries, and soft drink producers, measuring the impact per litre of a product across agriculture, water, packaging, and distribution rather than stopping at a single corporate carbon figure. Strong general-purpose options such as Zevero and CarbonCloud are well suited to broader food and beverage or multi-sector use, but they are not drinks-native in the way alkatera is.',
  },
  {
    question: 'What is the best carbon accounting software for breweries, distilleries, and wineries?',
    answer:
      'alkatera is carbon accounting software designed for these producers. It is built on the GHG Protocol and ISO 14064, with product-level carbon footprints to ISO 14067, and it understands drinks-specific sources such as fermentation emissions, brewhouse and still-run energy, water-to-product ratios, and packaging choices like glass, aluminium, and kegs. Generic carbon accounting tools can produce a company footprint, but they rarely model these drinks-specific drivers out of the box.',
  },
  {
    question: 'Do I need a drinks-specific LCA tool, or will a generic one do?',
    answer:
      'A generic Life Cycle Assessment tool can work if you have an LCA specialist to configure it. A drinks-native tool like alkatera ships with the agricultural ingredients (barley, agave, grapes, cane), packaging formats, and water and waste streams of beverage production already modelled, so you reach an audit-ready result faster and with less specialist input.',
  },
  {
    question: 'How does alkatera compare to Zevero and CarbonCloud?',
    answer:
      'Zevero and CarbonCloud are capable carbon and LCA platforms used across food and beverage. alkatera differs by being built only for drinks: it covers impact per litre, packaging LCA, terroir and agriculture, AWARE water stewardship, automated greenwashing checks against the UK DMCC Act and EU Green Claims Directive, and B Corp data mapping in one place. If you are a drinks brand, that specialisation is the difference; if you are a multi-sector manufacturer, a more general tool may suit you better.',
  },
  {
    question: 'Which reporting frameworks and standards does alkatera support?',
    answer:
      'alkatera produces audit-ready outputs aligned to the GHG Protocol, ISO 14064 and ISO 14067, CSRD (ESRS), SECR, TCFD, and GRI, plus the B Corp B Impact Assessment environment section. Every calculation is traceable to source data for investor-grade assurance.',
  },
];

export type Support = 'yes' | 'partial' | 'no';

export interface ComparisonRow {
  capability: string;
  alkatera: boolean;
  carbon: Support;
  lca: Support;
}

export const COMPARISON_ROWS: ComparisonRow[] = [
  { capability: 'Built specifically for drinks (beer, wine, spirits, soft drinks)', alkatera: true, carbon: 'no', lca: 'no' },
  { capability: 'Impact per litre and product-level LCA', alkatera: true, carbon: 'partial', lca: 'yes' },
  { capability: 'Packaging LCA (glass vs aluminium vs kegs vs PET)', alkatera: true, carbon: 'partial', lca: 'partial' },
  { capability: 'Agriculture and terroir impact (barley, agave, grapes, cane)', alkatera: true, carbon: 'no', lca: 'partial' },
  { capability: 'Water stewardship (AWARE, blue/green/grey water)', alkatera: true, carbon: 'no', lca: 'partial' },
  { capability: 'Greenwashing checks (UK DMCC Act, EU Green Claims Directive)', alkatera: true, carbon: 'no', lca: 'no' },
  { capability: 'B Corp B Impact Assessment mapping', alkatera: true, carbon: 'partial', lca: 'no' },
  { capability: 'GHG Protocol, ISO 14064/14067, CSRD, SECR, GRI reporting', alkatera: true, carbon: 'yes', lca: 'partial' },
];
