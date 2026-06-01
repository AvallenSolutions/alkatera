// Channel colour palette, shared by the channel donut (client component) and
// the legend (server component). Kept in a plain module — NOT a 'use client'
// file — so the server component can read it directly (you cannot dot into a
// value imported from a client module on the server).
//
// Leads with the tenant's brand colour, then genuinely contrasting hues so each
// channel is distinguishable. The brand primary and accent are too close in
// some tenants (e.g. Foodbuy's are both teal), so the accent is not used here.
export const CHANNEL_COLOURS = [
  'rgb(var(--brand-primary-rgb))',
  '#f59e0b',
  '#6366f1',
  '#f43f5e',
  '#94a3b8',
]
