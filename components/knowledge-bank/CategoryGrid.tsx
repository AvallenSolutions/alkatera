'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
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

const colorMap: Record<string, string> = {
  blue: 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20',
  purple: 'bg-purple-500/10 text-purple-500 hover:bg-purple-500/20',
  green: 'bg-green-500/10 text-green-500 hover:bg-green-500/20',
  red: 'bg-red-500/10 text-red-500 hover:bg-red-500/20',
  yellow: 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20',
  orange: 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20',
  slate: 'bg-slate-500/10 text-slate-500 hover:bg-slate-500/20',
  sky: 'bg-sky-500/10 text-sky-500 hover:bg-sky-500/20',
  rose: 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20',
  violet: 'bg-violet-500/10 text-violet-500 hover:bg-violet-500/20',
  emerald: 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20',
  teal: 'bg-teal-500/10 text-teal-500 hover:bg-teal-500/20',
  amber: 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20',
  indigo: 'bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20',
  cyan: 'bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20',
}

export function CategoryGrid({ categories }: CategoryGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {categories.map((category) => {
        const Icon = iconMap[category.icon] || FolderOpen
        const colorClass = colorMap[category.color] || colorMap.blue

        return (
          <Link key={category.id} href={`/knowledge-bank/categories/${category.id}`}>
            <Card className="group h-full transition-all hover:shadow-lg hover:border-neon-lime/50">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className={cn(
                    'flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl transition-colors',
                    colorClass
                  )}>
                    <Icon className="h-7 w-7" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-lg line-clamp-1 group-hover:text-neon-lime transition-colors">
                      {category.name}
                    </h3>
                    {category.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {category.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-2xl font-bold text-foreground">
                        {category.item_count || 0}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {category.item_count === 1 ? 'item' : 'items'}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
