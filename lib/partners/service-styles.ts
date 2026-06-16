import type { LucideIcon } from 'lucide-react'

export interface PartnerService {
  icon: LucideIcon
  title: string
  description: string
}

export type PartnerAccent = 'emerald' | 'blue' | 'amber' | 'violet' | 'orange' | 'yellow'

export interface PartnerServiceCategory {
  label: string
  tagline: string
  accent: PartnerAccent
  services: PartnerService[]
}

export const ACCENT_STYLES: Record<
  PartnerAccent,
  {
    section: string
    iconBg: string
    iconColor: string
    badge: string
    cardBorder: string
  }
> = {
  emerald: {
    section: 'border-l-emerald-500',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    cardBorder: 'hover:border-emerald-300 dark:hover:border-emerald-700',
  },
  blue: {
    section: 'border-l-blue-500',
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    cardBorder: 'hover:border-blue-300 dark:hover:border-blue-700',
  },
  amber: {
    section: 'border-l-amber-500',
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    cardBorder: 'hover:border-amber-300 dark:hover:border-amber-700',
  },
  violet: {
    section: 'border-l-violet-500',
    iconBg: 'bg-violet-100 dark:bg-violet-900/40',
    iconColor: 'text-violet-600 dark:text-violet-400',
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    cardBorder: 'hover:border-violet-300 dark:hover:border-violet-700',
  },
  orange: {
    section: 'border-l-orange-500',
    iconBg: 'bg-orange-100 dark:bg-orange-900/40',
    iconColor: 'text-orange-600 dark:text-orange-400',
    badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    cardBorder: 'hover:border-orange-300 dark:hover:border-orange-700',
  },
  yellow: {
    section: 'border-l-yellow-500',
    iconBg: 'bg-yellow-100 dark:bg-yellow-900/40',
    iconColor: 'text-yellow-700 dark:text-yellow-400',
    badge: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    cardBorder: 'hover:border-yellow-300 dark:hover:border-yellow-700',
  },
}
