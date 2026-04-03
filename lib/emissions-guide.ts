/**
 * Emissions Guide Configuration
 *
 * Defines the 7-step guided journey for the Company Emissions page.
 * Each step has Rosa's conversational explanation and a CTA action.
 * Steps auto-complete based on data presence in the component.
 */

import {
  BookOpen,
  Building2,
  Gauge,
  Package,
  ClipboardList,
  Link as LinkIcon,
  BarChart3,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface EmissionsGuideStep {
  id: string
  title: string
  description: string
  rosa: string
  icon: LucideIcon
  action:
    | { type: 'link'; label: string; href: string }
    | { type: 'tab'; label: string; tab: string }
    | { type: 'callback'; label: string; callbackKey: 'calculate' }
    | { type: 'read'; label: string }
}

export const EMISSIONS_GUIDE_STEPS: EmissionsGuideStep[] = [
  {
    id: 'understand-scopes',
    title: 'Understand Your Scopes',
    description: 'Learn what Scope 1, 2, and 3 mean for your business',
    rosa: 'Every company\'s carbon footprint is split into three scopes. Scope 1 is what you burn directly: the gas in your boiler, diesel in your forklift. Scope 2 is the electricity and heat you buy from the grid. Scope 3 is everything else in your value chain: ingredients, packaging, transport, business travel, services. For most drinks companies, Scope 3 makes up 80% or more of total emissions.',
    icon: BookOpen,
    action: { type: 'read', label: 'Got it' },
  },
  {
    id: 'add-facilities',
    title: 'Add Your Facilities',
    description: 'Register your breweries, distilleries, warehouses, and offices',
    rosa: 'Every physical site where you operate is a facility. This could be your brewery, distillery, bottling line, warehouse, or head office. Adding them lets us track your direct energy use and assign emissions to specific locations. You can add as many as you need.',
    icon: Building2,
    action: { type: 'link', label: 'Go to Facilities', href: '/company/facilities' },
  },
  {
    id: 'enter-utilities',
    title: 'Enter Utility Data',
    description: 'Log electricity, gas, and fuel consumption for Scope 1 & 2',
    rosa: 'Once you have a facility, add your utility bills: electricity, natural gas, diesel, LPG, and so on. This gives you Scope 1 (fuels) and Scope 2 (electricity) automatically. Monthly data is most accurate, but annual totals work too. You\'ll find the data on your energy bills or supplier portal.',
    icon: Gauge,
    action: { type: 'link', label: 'Go to Facilities', href: '/company/facilities' },
  },
  {
    id: 'map-products',
    title: 'Map Your Products',
    description: 'Use product LCAs for Tier 1 Scope 3 Category 1 data',
    rosa: 'If you have product lifecycle assessments (LCAs), we calculate your Scope 3 Category 1 emissions automatically from ingredients, packaging, and processing. This is Tier 1 data, the gold standard for carbon reporting. Even partial LCAs improve your data quality significantly.',
    icon: Package,
    action: { type: 'link', label: 'Go to Products', href: '/products' },
  },
  {
    id: 'log-scope3',
    title: 'Log Scope 3 Activities',
    description: 'Add travel, commuting, services, waste, and logistics data',
    rosa: 'The Scope 3 tab has individual cards for each category: business travel, employee commuting, purchased services, capital goods, marketing materials, operational waste, and logistics. Each card has a simple form. Start with whatever you have data for and fill in the rest over time.',
    icon: ClipboardList,
    action: { type: 'tab', label: 'Go to Scope 3', tab: 'scope3' },
  },
  {
    id: 'connect-accounts',
    title: 'Connect Your Accounts',
    description: 'Link Xero or upload a CSV to estimate emissions from spend data',
    rosa: 'Connect your Xero account or upload a CSV of your financial transactions and we\'ll estimate emissions from your spending patterns. Spend-based estimates are Tier 4 (the least accurate), but they fill gaps quickly and give you a complete picture while you gather better data.',
    icon: LinkIcon,
    action: { type: 'link', label: 'Connect Xero', href: '/settings' },
  },
  {
    id: 'review-footprint',
    title: 'Review Your Footprint',
    description: 'Calculate your total emissions and see the full picture',
    rosa: 'Once you have some data in, hit Calculate to generate your full footprint. The donut chart shows your scope split, the bar chart ranks your emission sources, and the data quality card shows where you can improve next. You can recalculate any time as you add more data.',
    icon: BarChart3,
    action: { type: 'callback', label: 'Calculate Footprint', callbackKey: 'calculate' },
  },
]
