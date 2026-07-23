/**
 * The Platform page's FAQ, verbatim from the Claude Design source
 * (Platform.dc.html). Shared between the visible accordion and the
 * FAQPage JSON-LD in app/platform/page.tsx so the two never drift.
 */
export const PLATFORM_FAQ = [
  {
    question: 'What is alkatera?',
    answer:
      'alkatera is a sustainability platform built specifically for drinks brands: breweries, distilleries, wineries, and soft drink makers. It measures the impact of what you produce right down to the impact per unit (per bottle, can, or serving), then helps you report it credibly and bring it down. Rather than a single company-wide carbon number, you see the full story of a product, from growing the ingredients all the way through to the empty container being recycled or thrown away.',
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
] as const;
