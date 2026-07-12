'use client'

/**
 * A small popover wrapper around the shared InlineIngredientSearch, used in the
 * recipe editor to let the user override the auto-matched emission factor for an
 * ingredient. Maps the picker's selection onto the same EmissionFactorMatch shape
 * that RecipeEditor.persist() writes onto product_materials.
 */

import { useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { InlineIngredientSearch } from '@/components/lca/InlineIngredientSearch'
import type { EmissionFactorMatch } from '@/lib/products/ef-auto-match'

export function IngredientFactorPicker({
  organizationId,
  ingredientName,
  onPicked,
  label = 'Change factor',
}: {
  organizationId: string
  ingredientName: string
  onPicked: (match: EmissionFactorMatch) => void
  label?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-[10px] text-muted-foreground">
          <Search className="h-3 w-3" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-96 p-3">
        <p className="mb-2 text-xs text-muted-foreground">
          Search for a better emission factor for this ingredient.
        </p>
        <InlineIngredientSearch
          organizationId={organizationId}
          value={ingredientName}
          materialType="ingredient"
          placeholder="Search for an ingredient factor…"
          onSelect={(sel) => {
            onPicked({
              matched_source_name: sel.name,
              data_source: sel.data_source,
              data_source_id: sel.data_source_id,
              supplier_product_id: sel.supplier_product_id,
              carbon_intensity: sel.carbon_intensity,
              // Route the calc to the right gdt-server (mirrors the picker's own logic).
              openlca_database:
                sel.ef_source_type === 'agribalyse_live'
                  ? 'agribalyse'
                  : sel.ef_source_type === 'ecoinvent_live'
                    ? 'ecoinvent'
                    : undefined,
              ef_source: sel.ef_source,
              ef_source_type: sel.ef_source_type,
              ef_data_quality_grade: sel.ef_data_quality_grade,
              ef_uncertainty_percent: sel.ef_uncertainty_percent,
            })
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
