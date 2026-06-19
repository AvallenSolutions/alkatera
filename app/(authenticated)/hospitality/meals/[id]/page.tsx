'use client';

import { useParams } from 'next/navigation';
import { RecipeEditor } from '@/components/hospitality/RecipeEditor';
import { RECIPE_KINDS } from '@/lib/hospitality/recipe-kinds';

export default function MealEditorPage() {
  const params = useParams<{ id: string }>();
  return <RecipeEditor cfg={RECIPE_KINDS.meal} recipeId={params.id} />;
}
