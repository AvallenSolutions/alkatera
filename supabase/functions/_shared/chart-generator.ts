/**
 * Chart Generator for Sustainability Reports
 *
 * Generates deterministic chart PNGs via QuickChart.io (Chart.js-based).
 * Charts are used in PPTX reports where CSS rendering isn't available.
 * PDF reports use CSS-based charts instead (conic-gradient, flex bars).
 *
 * QuickChart.io is free, requires no API key, and renders Chart.js configs
 * to PNG images via URL. Same input always produces same output.
 */

const QUICKCHART_BASE = 'https://quickchart.io/chart';
const CHART_WIDTH = 600;
const CHART_HEIGHT = 400;
const CHART_BG = 'white';

// alkatera brand palette
const COLOURS = {
  brand: '#ccff00',
  scope1: '#22c55e',   // Green
  scope2: '#3b82f6',   // Blue
  scope3: '#f97316',   // Orange
  neutral: '#78716c',  // Stone
  dark: '#1c1917',
  light: '#f5f5f4',
};

/**
 * Builds a QuickChart.io URL from a Chart.js config
 */
function buildChartUrl(config: Record<string, any>, width = CHART_WIDTH, height = CHART_HEIGHT): string {
  const encoded = encodeURIComponent(JSON.stringify(config));
  return `${QUICKCHART_BASE}?c=${encoded}&w=${width}&h=${height}&bkg=${CHART_BG}&f=png`;
}

/**
 * Generates a Scope 1/2/3 doughnut chart
 */
export function generateScopePieChartUrl(scope1: number, scope2: number, scope3: number): string {
  const config = {
    type: 'doughnut',
    data: {
      labels: ['Scope 1 (Direct)', 'Scope 2 (Energy)', 'Scope 3 (Value Chain)'],
      datasets: [{
        data: [scope1, scope2, scope3],
        backgroundColor: [COLOURS.scope1, COLOURS.scope2, COLOURS.scope3],
        borderWidth: 2,
        borderColor: CHART_BG,
      }],
    },
    options: {
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 13 }, padding: 16 } },
        title: { display: true, text: 'GHG Emissions by Scope', font: { size: 16 } },
        datalabels: {
          display: true,
          color: '#fff',
          font: { weight: 'bold', size: 14 },
          formatter: (value: number, ctx: any) => {
            const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
            return total > 0 ? `${((value / total) * 100).toFixed(0)}%` : '';
          },
        },
      },
    },
  };
  return buildChartUrl(config);
}

/**
 * Generates a multi-year emissions trend line chart
 */
export function generateEmissionsTrendChartUrl(trends: { year: number; total: number }[]): string {
  const config = {
    type: 'line',
    data: {
      labels: trends.map(t => t.year.toString()),
      datasets: [{
        label: 'Total Emissions (tCO2e)',
        data: trends.map(t => t.total),
        borderColor: COLOURS.scope1,
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 5,
        pointBackgroundColor: COLOURS.scope1,
      }],
    },
    options: {
      plugins: {
        title: { display: true, text: 'Emissions Trend', font: { size: 16 } },
        legend: { display: false },
      },
      scales: {
        y: {
          title: { display: true, text: 'tCO2e' },
          beginAtZero: true,
        },
      },
    },
  };
  return buildChartUrl(config);
}

/**
 * Generates a horizontal bar chart of product impacts (top 10)
 */
export function generateProductImpactBarChartUrl(products: { name: string; impact: number }[]): string {
  const sorted = [...products].sort((a, b) => b.impact - a.impact).slice(0, 10);
  const config = {
    type: 'horizontalBar',
    data: {
      labels: sorted.map(p => p.name.length > 25 ? p.name.substring(0, 22) + '...' : p.name),
      datasets: [{
        label: 'Climate Impact (kg CO2e)',
        data: sorted.map(p => p.impact),
        backgroundColor: COLOURS.scope2,
        borderWidth: 0,
      }],
    },
    options: {
      plugins: {
        title: { display: true, text: 'Product Carbon Footprints', font: { size: 16 } },
        legend: { display: false },
      },
      scales: {
        x: {
          title: { display: true, text: 'kg CO2e per functional unit' },
          beginAtZero: true,
        },
      },
    },
  };
  return buildChartUrl(config, 600, 350);
}

/**
 * Generates a radar chart of social/sustainability scores
 */
export function generateSocialScoresRadarChartUrl(pillars: { label: string; score: number }[]): string {
  const config = {
    type: 'radar',
    data: {
      labels: pillars.map(p => p.label),
      datasets: [{
        label: 'Score',
        data: pillars.map(p => p.score),
        backgroundColor: 'rgba(204, 255, 0, 0.2)',
        borderColor: COLOURS.brand,
        borderWidth: 2,
        pointBackgroundColor: COLOURS.brand,
        pointRadius: 4,
      }],
    },
    options: {
      plugins: {
        title: { display: true, text: 'Sustainability Scores', font: { size: 16 } },
        legend: { display: false },
      },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { stepSize: 25 },
        },
      },
    },
  };
  return buildChartUrl(config, 500, 500);
}

/**
 * Generates all relevant chart URLs based on available report data.
 * Returns a map of chart key to QuickChart.io URL.
 * These URLs are ephemeral (served on demand by QuickChart) so no upload needed.
 */
export function generateAllChartUrls(data: {
  emissions?: { scope1: number; scope2: number; scope3: number };
  trends?: { year: number; total: number }[];
  products?: { name: string; impact: number }[];
  socialScores?: { label: string; score: number }[];
}): Record<string, string> {
  const urls: Record<string, string> = {};

  if (data.emissions && (data.emissions.scope1 + data.emissions.scope2 + data.emissions.scope3) > 0) {
    urls['scope-pie'] = generateScopePieChartUrl(data.emissions.scope1, data.emissions.scope2, data.emissions.scope3);
  }

  if (data.trends && data.trends.length >= 2) {
    urls['emissions-trend'] = generateEmissionsTrendChartUrl(data.trends);
  }

  if (data.products && data.products.length > 0) {
    urls['product-bar'] = generateProductImpactBarChartUrl(data.products);
  }

  if (data.socialScores && data.socialScores.length >= 3) {
    urls['social-radar'] = generateSocialScoresRadarChartUrl(data.socialScores);
  }

  return urls;
}
