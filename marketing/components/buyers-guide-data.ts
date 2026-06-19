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
      'For drinks brands specifically, alkatera is built for the job. It is made only for breweries, distilleries, wineries, and soft drink producers, and measures the impact per unit of a product (per bottle, can, or serving) across carbon, water, circularity, and nature, rather than stopping at a single company-wide carbon figure. Strong general-purpose tools such as Zevero and CarbonCloud suit broader food-and-beverage or multi-sector use, but they are not built for drinks in the way alkatera is.',
  },
  {
    question: 'What is the best carbon accounting software for breweries, distilleries, and wineries?',
    answer:
      'alkatera is carbon accounting software made for these producers. It is built on the recognised standards auditors expect (the GHG Protocol and the ISO methods for carbon and product footprints) and it already understands what drives the footprint of a drink: fermentation, the energy used in the brewhouse or still, how much water goes into each litre of product, and packaging choices like glass, aluminium, and kegs. Generic tools can give you a company-wide number, but they rarely understand these drinks-specific details out of the box.',
  },
  {
    question: 'Do I need a drinks-specific LCA tool, or will a generic one do?',
    answer:
      'A generic life cycle assessment tool (which measures the impact of a product from start to finish) can work if you have a specialist to set it up. A drinks-built tool like alkatera comes with the ingredients (barley, agave, grapes, cane), packaging formats, and water and waste of drinks production already modelled, so you reach an audit-ready result faster and with far less specialist input.',
  },
  {
    question: 'How does alkatera compare to Zevero and CarbonCloud?',
    answer:
      'Zevero and CarbonCloud are capable carbon and LCA platforms used across food and beverage. alkatera is different because it is built only for drinks: in one place it covers impact per unit, packaging, agriculture and nature, water use, automated greenwashing checks against UK and EU green-claims rules, and the data you need for B Corp and EcoVadis. If you are a drinks brand, that focus is the difference; if you are a multi-sector manufacturer, a more general tool may suit you better.',
  },
  {
    question: 'Which reports and standards does alkatera support?',
    answer:
      'alkatera produces the reports drinks brands get asked for: cradle-to-grave product life cycle assessments, a corporate carbon footprint, and full sustainability reports. These are built on the main international standards (the GHG Protocol, the ISO methods for carbon and product footprints, and frameworks such as CSRD, SECR, TCFD, and GRI), and they map to B Corp and EcoVadis. Every figure is traceable back to your source data, so it holds up to investor-grade scrutiny.',
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
  { capability: 'Impact per unit and product-level LCA', alkatera: true, carbon: 'partial', lca: 'yes' },
  { capability: 'Packaging LCA (glass vs aluminium vs kegs vs PET)', alkatera: true, carbon: 'partial', lca: 'partial' },
  { capability: 'Agriculture and terroir impact (barley, agave, grapes, cane)', alkatera: true, carbon: 'no', lca: 'partial' },
  { capability: 'Water stewardship (AWARE, blue/green/grey water)', alkatera: true, carbon: 'no', lca: 'partial' },
  { capability: 'Greenwashing checks (UK DMCC Act, EU Green Claims Directive)', alkatera: true, carbon: 'no', lca: 'no' },
  { capability: 'B Corp and EcoVadis data mapping', alkatera: true, carbon: 'partial', lca: 'no' },
  { capability: 'GHG Protocol, ISO 14064/14067, CSRD, SECR, GRI reporting', alkatera: true, carbon: 'yes', lca: 'partial' },
];
