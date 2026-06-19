'use client';

import { useParams } from 'next/navigation';
import { RecipeEditor } from '@/components/hospitality/RecipeEditor';
import { RECIPE_KINDS } from '@/lib/hospitality/recipe-kinds';

export default function DrinkEditorPage() {
  const params = useParams<{ id: string }>();
  return <RecipeEditor cfg={RECIPE_KINDS.drink} recipeId={params.id} />;
}
