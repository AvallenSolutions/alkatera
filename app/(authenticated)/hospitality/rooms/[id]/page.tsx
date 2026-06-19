'use client';

import { useParams } from 'next/navigation';
import { RecipeEditor } from '@/components/hospitality/RecipeEditor';
import { RoomAllocationPanel } from '@/components/hospitality/RoomAllocationPanel';
import { RECIPE_KINDS } from '@/lib/hospitality/recipe-kinds';

export default function RoomEditorPage() {
  const params = useParams<{ id: string }>();
  return (
    <RecipeEditor
      cfg={RECIPE_KINDS.room_night}
      recipeId={params.id}
      ingredientLabel="Consumables (per night)"
      renderExtra={(recipe) => (
        <RoomAllocationPanel roomId={params.id} consumablesCo2e={recipe.impact?.per_cover_co2e ?? null} />
      )}
    />
  );
}
