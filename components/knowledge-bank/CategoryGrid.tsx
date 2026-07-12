'use client'

import Link from 'next/link'
import { Panel } from '@/components/studio/panel'
import {
  FileText,
  Video,
  ClipboardCheck,
  ShieldCheck,
  BookOpen,
  FolderOpen,
  Shield,
  CloudRain,
  Heart,
  Users,
  Leaf,
  RefreshCw,
  Home,
  Truck,
  ShoppingBag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { KnowledgeBankCategory } from '@/hooks/data/useKnowledgeBank'

interface CategoryGridProps {
  categories: KnowledgeBankCategory[]
}

const iconMap: Record<string, any> = {
  FileText,
  Video,
  ClipboardCheck,
  ShieldCheck,
  BookOpen,
  FolderOpen,
  Shield,
  CloudRain,
  Heart,
  Users,
  Leaf,
  RefreshCw,
  Home,
  TruckIcon: Truck,
  Truck,
  ShoppingBag,
}

// The studio token map: category.color names collapse to the six room inks
// plus dim, muted to gallery grade. Existing knowledge_bank_categories.color
// data keeps working; the tint chip is quiet on paper. Static class strings so
// Tailwind can see them.
const INK_CHIP: Record<string, string> = {
  forest: 'bg-studio-forest/10 text-studio-forest',
  teal: 'bg-studio-teal/10 text-studio-teal',
  cobalt: 'bg-studio-cobalt/10 text-studio-cobalt',
  plum: 'bg-studio-plum/10 text-studio-plum',
  ochre: 'bg-studio-ochre/15 text-studio-ochre-ink',
  brick: 'bg-studio-brick/10 text-studio-brick',
  dim: 'bg-studio-ink/[0.05] text-studio-dim',
}

const COLOUR_TO_INK: Record<string, keyof typeof INK_CHIP> = {
  blue: 'cobalt',
  cobalt: 'cobalt',
  green: 'forest',
  emerald: 'forest',
  forest: 'forest',
  purple: 'plum',
  violet: 'plum',
  indigo: 'plum',
  plum: 'plum',
  amber: 'ochre',
  orange: 'ochre',
  yellow: 'ochre',
  ochre: 'ochre',
  red: 'brick',
  rose: 'brick',
  brick: 'brick',
  teal: 'teal',
  cyan: 'teal',
  sky: 'teal',
  slate: 'dim',
  gray: 'dim',
  grey: 'dim',
}

export function CategoryGrid({ categories }: CategoryGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {categories.map((category) => {
        const Icon = iconMap[category.icon] || FolderOpen
        const ink = COLOUR_TO_INK[category.color] || 'cobalt'
        const chipClass = INK_CHIP[ink]

        return (
          <Link
            key={category.id}
            href={`/knowledge-bank/categories/${category.id}`}
            className="group block"
          >
            <Panel className="h-full transition-colors duration-150 ease-studio group-hover:border-room-accent">
              <div className="flex items-start gap-4">
                <div className={cn(
                  'flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[6px]',
                  chipClass
                )}>
                  <Icon className="h-7 w-7" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold text-lg line-clamp-1 transition-colors group-hover:text-room-accent">
                    {category.name}
                  </h3>
                  {category.description && (
                    <p className="text-sm text-studio-dim line-clamp-2 mt-1">
                      {category.description}
                    </p>
                  )}
                  <div className="flex items-baseline gap-2 mt-3">
                    <span className="font-display text-2xl font-bold tabular-nums text-foreground">
                      {category.item_count || 0}
                    </span>
                    <span className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-studio-dim">
                      {category.item_count === 1 ? 'ITEM' : 'ITEMS'}
                    </span>
                  </div>
                </div>
              </div>
            </Panel>
          </Link>
        )
      })}
    </div>
  )
}
