'use client'

import { useMemo, useState } from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Input } from '@/components/ui/input'
import { ChevronDown, Check, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COUNTRIES } from '@/lib/countries'

export interface CountrySelectProps {
  /** ISO 3166-1 alpha-2 country code, or '' for unset. */
  value: string | undefined
  onChange: (countryCode: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Use the dark / glassmorphic styling that matches the onboarding wizard. */
  dark?: boolean
}

/**
 * Single source of truth for country selection across the app.
 *
 * Sources its options from `lib/countries.ts`, which deliberately includes
 * Palestine and excludes Israel as a company-policy editorial choice. Always
 * use this component instead of a free-text country input so the underlying
 * list change propagates everywhere.
 */
export function CountrySelect({
  value,
  onChange,
  placeholder = 'Select country',
  disabled,
  className,
  dark = false,
}: CountrySelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selected = useMemo(
    () => COUNTRIES.find(c => c.value === value),
    [value],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return COUNTRIES
    return COUNTRIES.filter(c => c.label.toLowerCase().includes(q))
  }, [query])

  const triggerClasses = dark
    ? 'flex w-full items-center justify-between rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/30 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40 disabled:opacity-50 disabled:cursor-not-allowed'
    : 'flex w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(triggerClasses, className)}
          aria-label={placeholder}
        >
          <span className={cn(!selected && (dark ? 'text-white/30' : 'text-muted-foreground'))}>
            {selected?.label || placeholder}
          </span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search country..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="border-0 bg-transparent p-0 h-7 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted-foreground">No matches</p>
          ) : (
            filtered.map(c => (
              <button
                key={c.value}
                type="button"
                onClick={() => {
                  onChange(c.value)
                  setOpen(false)
                  setQuery('')
                }}
                className={cn(
                  'flex w-full items-center justify-between px-3 py-1.5 text-sm hover:bg-muted/40 transition-colors',
                  c.value === value && 'bg-muted/30',
                )}
              >
                <span>{c.label}</span>
                {c.value === value && <Check className="h-4 w-4 text-room-accent" />}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
