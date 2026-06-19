// Plain (non-client) data module so it can be imported by BOTH the server route
// (app/platform/page.tsx, for FAQPage JSON-LD) and the client component (for the
// visible FAQ), keeping the two in sync. Mirrors buyers-guide-data.ts.
import type { FaqItem } from './buyers-guide-data';

export type { FaqItem };

export const PLATFORM_FAQ_ITEMS: FaqItem[] = [
  {
    question: 'What is alkatera?',
    answer:
      'alkatera is a sustainability platform built specifically for drinks brands: breweries, distilleries, wineries, and soft drink makers. It measures the impact of what you produce right down to the impact per unit (per bottle, can, or serving), then helps you report it credibly and bring it down. Rather than a single company-wide carbon number, you see the full story of a product, from growing the ingredients all the way through to the empty container being recycled or thrown away.',
  },
  {
    question: 'What does alkatera measure?',
    answer:
      'alkatera measures your environmental impact across four areas: carbon (the emissions behind your product), water (how much you use, and how scarce it is where you operate), circularity (your packaging and waste, and how much can be reused or recycled), and nature (the effect on soil, land, and biodiversity). It tracks all of this per unit of product. Sustainability is about more than the environment, so alkatera also covers the social and governance side, such as how you look after your people and community and how responsibly the business is run, giving you the complete picture in one place.',
  },
  {
    question: 'What reports and footprints can alkatera produce?',
    answer:
      'alkatera produces the things drinks brands are actually asked for. You get a full product life cycle assessment, a "cradle to grave" view of one product from the field to the end of its life; a corporate carbon footprint for the whole business; and complete sustainability reports to share with customers, retailers, and investors. Everything is built on internationally recognised methods and is traceable back to your own data, so it stands up to scrutiny.',
  },
  {
    question: 'Can alkatera help with B Corp and EcoVadis?',
    answer:
      'Yes. Whether you are working towards B Corp certification or an EcoVadis rating, alkatera organises your impact data around what each assessment asks for. That means far less time gathering evidence, a clearer view of where you can improve your score, and everything kept current for when you need to recertify.',
  },
  {
    question: 'How does alkatera help me avoid greenwashing?',
    answer:
      'alkatera checks your sustainability and marketing claims against the rules that now govern them in the UK and EU (the DMCC Act and the EU Green Claims Directive) and flags anything that is not backed by solid evidence. So the claims you put on a label or in a campaign are ones you can confidently defend if a regulator or a customer asks.',
  },
  {
    question: 'Is alkatera built specifically for drinks?',
    answer:
      'Yes. alkatera is built only for drinks. It already understands the ingredients, packaging, and water use behind beer, wine, spirits, and soft drinks, so you reach an accurate, audit-ready result far faster than configuring a general-purpose carbon tool from scratch.',
  },
];
