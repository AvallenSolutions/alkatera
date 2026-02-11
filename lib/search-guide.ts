/**
 * Rosa's Search Guide — Contextual tips for navigating ingredient & packaging databases
 *
 * Content is displayed in the SearchGuidePanel component inside the RecipeEditorPanel.
 * Written in Rosa's conversational voice to match the DashboardGuide tone.
 */

export interface SearchGuideTip {
  id: string
  title: string
  /** Rosa's explanation text (conversational tone) */
  rosa: string
}

export interface SearchGuideSection {
  id: string
  title: string
  description: string
  tips: SearchGuideTip[]
}

export const SEARCH_GUIDE_SECTIONS: SearchGuideSection[] = [
  {
    id: 'understanding-results',
    title: 'Understanding Search Results',
    description: 'What all those badges and labels mean',
    tips: [
      {
        id: 'source-badges',
        title: 'Source Badges Explained',
        rosa: "When you search, you'll see coloured badges next to each result. These tell you where the environmental data comes from. Green 'Primary' badges mean your own supplier has provided verified data \u2014 that's the gold standard! Purple 'ecoInvent' badges are from the world's leading LCA database. Teal 'Agribalyse' badges come from France's agricultural database, which is brilliant for food and drink ingredients. Orange 'DEFRA' badges use UK government emission factors. And blue 'Internal' badges are our curated estimates.",
      },
      {
        id: 'process-names',
        title: 'Decoding Process Names',
        rosa: "Database names can look intimidating! Something like 'Barley grain, feed, conventional, at farm {GLO}' just means: the product (barley grain), its use (feed grade), farming method (conventional, not organic), and where the data applies ({GLO} means global average, {FR} means France, {GB} means Great Britain). You don't need to understand every word \u2014 just look for the ingredient name, whether it says organic or conventional, and the country code in curly braces.",
      },
      {
        id: 'co2-factor',
        title: 'The CO\u2082 Number',
        rosa: "Each result shows a number like '0.450 kg CO\u2082e/kg'. This is the carbon intensity \u2014 how much greenhouse gas is emitted to produce one unit of that material. Lower is better! For ingredients, this typically includes farming, processing and transport to the factory gate. For packaging, it covers raw material extraction through to manufacturing the finished packaging component.",
      },
    ],
  },
  {
    id: 'choosing-match',
    title: 'Choosing the Right Match',
    description: 'How to pick the best result for your product',
    tips: [
      {
        id: 'priority-order',
        title: 'Which Source to Prefer',
        rosa: "Always prefer results in this order: (1) Primary data from your supplier \u2014 this is specific to YOUR supply chain, so it's the most accurate. (2) Peer-Reviewed library data \u2014 these have been vetted by scientists. (3) ecoInvent or Agribalyse \u2014 these are respected LCA databases with thousands of processes. (4) DEFRA factors \u2014 good for UK-specific calculations but less granular. (5) Internal estimates \u2014 useful as a starting point but you should upgrade these when you can.",
      },
      {
        id: 'location-matching',
        title: 'Match the Location',
        rosa: "Pay attention to the country codes! If your barley comes from the UK, try to pick a result with {GB} or {Europe without Switzerland}. If there's no exact country match, {GLO} (global average) is your safest fallback. French data ({FR}) from Agribalyse is often very good for agricultural ingredients even if you're not sourcing from France, because agricultural practices are similar across Western Europe.",
      },
      {
        id: 'unit-matching',
        title: 'Check the Units',
        rosa: "Make sure the unit shown on the search result matches what you need. Most ingredients use 'kg' but some use litres or cubic metres. If the units don't match, the carbon calculation will be wrong. Water is a common gotcha \u2014 some databases measure it in kg, others in cubic metres. One cubic metre of water is 1,000 kg!",
      },
    ],
  },
  {
    id: 'data-quality',
    title: 'Data Quality Levels',
    description: 'Understanding confidence and accuracy',
    tips: [
      {
        id: 'confidence-levels',
        title: 'Confidence Percentages',
        rosa: "After you select a result, you'll see a confidence badge on the ingredient card. Supplier Verified (95%) means your actual supplier measured their emissions. Hybrid Source (80%) combines DEFRA and ecoInvent data. Ecoinvent Database (70%) uses generic industry averages. These percentages reflect how closely the data represents YOUR specific ingredient from YOUR specific supplier. Higher is better, but any data is better than none!",
      },
      {
        id: 'uncertainty',
        title: 'Uncertainty Ranges',
        rosa: "Some results show an uncertainty percentage (like \u00b115%). This tells you how much the real value might vary from the stated number. A result showing 0.500 kg CO\u2082e with 10% uncertainty means the true value is likely between 0.450 and 0.550. Don't stress too much about uncertainty \u2014 it's normal in LCA. What matters is you're measuring and improving over time.",
      },
    ],
  },
  {
    id: 'search-tips',
    title: 'Tips for Better Searches',
    description: 'Get more relevant results',
    tips: [
      {
        id: 'search-terms',
        title: 'What to Search For',
        rosa: "Keep your search terms simple and specific. For ingredients, use the common name: 'barley', 'hops', 'yeast', 'grape'. For packaging, use the material: 'glass bottle', 'aluminium can', 'cardboard box'. If you get too many results, add detail: 'organic barley' or 'green glass bottle 330ml'. If you get too few, try a broader term: 'glass' instead of 'green glass bottle'.",
      },
      {
        id: 'no-results',
        title: "What If Nothing Matches?",
        rosa: "If you can't find an exact match, pick the closest alternative. 'Wheat grain' can stand in for 'spelt' in a pinch. For unusual ingredients, try the category instead: 'fruit juice' if you can't find 'elderflower juice'. You can always refine later when better data becomes available. The most important thing is to get started \u2014 an approximate footprint is infinitely more useful than no footprint at all.",
      },
      {
        id: 'first-search-slow',
        title: 'First Search Is Slower',
        rosa: "Your very first search in a session might take a few seconds longer because we're loading the full ecoInvent process library into memory. After that, searches will be much snappier. If a search takes over 10 seconds, it's probably still loading \u2014 don't worry, it's normal the first time!",
      },
    ],
  },
]

export const TOTAL_SECTIONS = SEARCH_GUIDE_SECTIONS.length
export const TOTAL_TIPS = SEARCH_GUIDE_SECTIONS.reduce((acc, s) => acc + s.tips.length, 0)
