import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inngest } from '../client';
import { generateSuggestions } from '@/lib/suppliers/ingredient-match-generate';

/**
 * Suggest ingredient -> supplier-product matches for an organisation, then
 * tell the brand. Fired when a supplier publishes product data
 * (smart-import confirm) so the brand hears "your products use ingredients
 * this supplier just published data for, apply?".
 */

function service(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export const ingredientMatchSuggest = inngest.createFunction(
  {
    id: 'ingredient-match-suggest',
    name: 'Suggest ingredient to supplier-product matches',
    concurrency: { limit: 3 },
    retries: 2,
    triggers: [{ event: 'ingredients/match.suggest' }],
  },
  async ({ event, step }) => {
    const { organization_id } = event.data as { organization_id: string };

    const result = await step.run('generate-suggestions', async () => {
      return generateSuggestions(service(), organization_id);
    });

    if (result.created > 0) {
      await step.run('notify-owners', async () => {
        const supabase = service();
        const { data: members } = await supabase
          .from('organization_members')
          .select('user_id, roles!inner(name)')
          .eq('organization_id', organization_id)
          .in('roles.name', ['owner', 'admin']);
        const userIds = ((members ?? []) as Array<{ user_id: string }>).map((m) => m.user_id);
        if (userIds.length === 0) return { notified: 0 };

        await supabase.from('user_notifications').insert(
          userIds.map((uid) => ({
            user_id: uid,
            organization_id,
            notification_type: 'ingredient_match_suggested',
            title: `${result.created} supplier match${result.created === 1 ? '' : 'es'} to review`,
            message:
              `We found ${result.created} of your ingredients that may match supplier products with real data. ` +
              `Review them to improve your footprints.`,
            entity_type: 'ingredient_match',
            entity_id: organization_id,
            metadata: { created: result.created },
          })),
        );
        return { notified: userIds.length };
      });
    }

    return { organization_id, ...result };
  },
);
