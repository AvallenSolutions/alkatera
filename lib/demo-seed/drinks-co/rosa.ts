import {
  replaceRows,
  type SeedCtx,
} from './shared';

/**
 * Rosa's history for the demo org.
 *
 * Rosa is the flagship surface and appears on every page, but the seed left
 * every one of her tables empty, so a fully-populated org still opened a cold
 * assistant: no past conversations, nothing remembered, and an empty learning
 * dashboard. This fills the durable half.
 *
 * Deliberately NOT seeded: rosa_priority_tile_cache and
 * rosa_progress_tracker_cache. Both key on a signals_hash computed from the
 * org's live data, so a seeded row either goes stale immediately (and is
 * regenerated on first load, which is the correct behaviour) or, worse,
 * matches by accident and serves tiles that contradict the data. Letting them
 * generate on demand is the honest option.
 */
export async function seedRosa(ctx: SeedCtx): Promise<void> {
  const { svc, orgId } = ctx;

  await seedConversations(ctx);
  await seedMemory(ctx);
  await seedTelemetry(ctx);
  await seedPendingAction(ctx);

  void svc;
  void orgId;
}

/**
 * Three past conversations with realistic turns, and feedback on the answers.
 *
 * The feedback matters beyond the drawer: /admin/rosa-learning reads
 * gaia_feedback and groups it by the topic of the USER'S question, so without
 * a spread of question shapes and ratings that page has nothing to show and
 * cannot be evaluated.
 */
async function seedConversations(ctx: SeedCtx): Promise<void> {
  const { svc, orgId } = ctx;

  // Spread across the last ~6 weeks, in DAYS not months.
  //
  // These were originally 1, 2 and 3 months back, which meant the learning
  // dashboard's default 30-day window showed "nobody has rated an answer yet"
  // on a freshly-seeded org, and the oldest thread fell outside 90 days
  // entirely. Anything seeded for a demo has to land inside the default view.
  const threads: Array<{
    title: string;
    daysAgo: number;
    turns: Array<{ q: string; a: string; rating?: 'positive' | 'negative'; note?: string }>;
  }> = [
    {
      title: 'Where our footprint actually sits',
      daysAgo: 40,
      turns: [
        {
          q: 'What is driving our product footprint the most?',
          a: 'Packaging is the largest single contributor across the range, at roughly 40% of the average product footprint. Glass is the reason: the 750ml bottles carry more embodied carbon than everything inside them combined. The Floral Haze IPA in aluminium sits well below the range average for exactly that reason.',
          rating: 'positive',
        },
        {
          q: 'How do I reduce the glass impact?',
          a: 'Three levers, in order of impact for you: move to a lighter bottle (a 420g to 380g change on the Bacchus alone is worth about 4%), raise recycled content in the bottles you buy, and shorten the inbound haul from the glass supplier. The first two need a supplier conversation, the third is a sourcing decision.',
          rating: 'positive',
        },
      ],
    },
    {
      title: 'Reporting scope',
      daysAgo: 18,
      turns: [
        {
          q: 'What is scope 3 and which categories apply to us?',
          a: 'Scope 3 covers the emissions in your value chain that you do not own. For a drinks producer the material ones are purchased goods and services, upstream transport, waste, business travel and the end-of-life of your packaging.',
          rating: 'negative',
          note: 'It did not tell me which categories we actually have data for, only the general list.',
        },
        {
          q: 'Where can I find our supplier data?',
          a: 'Your supplier records live under Suppliers, and the per-supplier ESG assessments hang off each one. Ten suppliers are on file with assessments completed.',
          rating: 'positive',
        },
      ],
    },
    {
      title: 'Getting the B Corp submission moving',
      daysAgo: 5,
      turns: [
        {
          q: 'How do I add evidence for a B Corp requirement?',
          a: 'Open the requirement from the B Corp readiness view and attach a document to it. The evidence library will suggest documents you have already uploaded that look relevant.',
          rating: 'negative',
          note: 'The evidence documents it suggested would not open, they 404.',
        },
        {
          q: 'What is our current B Corp readiness?',
          a: 'You are tracking towards submission with the strongest scores in Environment and the biggest gaps in Governance. The readiness view lists the specific requirements still short of evidence.',
        },
      ],
    },
  ];

  // Idempotent: clear this seed's threads by title, then rebuild. gaia_messages
  // and gaia_feedback cascade from the conversation.
  const titles = threads.map(t => t.title);
  await svc.from('gaia_conversations').delete().eq('organization_id', orgId).in('title', titles);

  let conversationCount = 0;
  let messageCount = 0;
  let feedbackCount = 0;

  for (const thread of threads) {
    const created = new Date(Date.now() - thread.daysAgo * 24 * 3600 * 1000).toISOString();
    const { data: conv, error: convErr } = await svc
      .from('gaia_conversations')
      .insert({
        organization_id: orgId,
        user_id: ctx.ownerUserId,
        title: thread.title,
        message_count: thread.turns.length * 2,
        created_at: created,
        updated_at: created,
        last_message_at: created,
      })
      .select('id')
      .single();
    if (convErr || !conv) {
      ctx.warnings.push(`rosa conversation "${thread.title}": ${convErr?.message}`);
      continue;
    }
    conversationCount++;
    const conversationId = (conv as any).id;

    for (let i = 0; i < thread.turns.length; i++) {
      const turn = thread.turns[i];
      // Two minutes apart so the ordering the analytics rely on (walk back from
      // the rated answer to the preceding user message) is unambiguous.
      const qAt = new Date(new Date(created).getTime() + i * 4 * 60_000).toISOString();
      const aAt = new Date(new Date(created).getTime() + (i * 4 + 2) * 60_000).toISOString();

      const { error: qErr } = await svc.from('gaia_messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: turn.q,
        created_at: qAt,
      });
      if (qErr) {
        ctx.warnings.push(`rosa question: ${qErr.message}`);
        continue;
      }
      messageCount++;

      const { data: answer, error: aErr } = await svc
        .from('gaia_messages')
        .insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: turn.a,
          // A plausible tool trail, which is what distinguishes a real
          // tool-based answer from the old pre-tool architecture.
          data_sources: [{ tool: 'get_product_footprint' }, { tool: 'get_org_context' }],
          tokens_used: 900 + i * 120,
          processing_time_ms: 3200 + i * 400,
          created_at: aAt,
        })
        .select('id')
        .single();
      if (aErr || !answer) {
        ctx.warnings.push(`rosa answer: ${aErr?.message}`);
        continue;
      }
      messageCount++;

      if (turn.rating) {
        const { error: fErr } = await svc.from('gaia_feedback').insert({
          message_id: (answer as any).id,
          user_id: ctx.ownerUserId,
          organization_id: orgId,
          rating: turn.rating,
          feedback_text: turn.note ?? null,
          created_at: aAt,
        });
        if (fErr) ctx.warnings.push(`rosa feedback: ${fErr.message}`);
        else feedbackCount++;
      }
    }
  }

  ctx.report.rosaConversations = `${conversationCount} conversations, ${messageCount} messages, ${feedbackCount} rated`;
}

/**
 * What Rosa has been asked to remember.
 *
 * Org scope is a fact about the business and reaches every user; user scope is
 * a personal preference. Both are read into the system prompt on every turn by
 * buildMemoryBlock(), so this is the most directly visible seeded data there is:
 * it changes how Rosa answers.
 */
async function seedMemory(ctx: SeedCtx): Promise<void> {
  const { orgId } = ctx;

  const rows = [
    {
      organization_id: orgId,
      user_id: null,
      scope: 'org',
      key: 'reporting_framework',
      value: 'We report to VSME, not CSRD. We are below the CSRD threshold.',
    },
    {
      organization_id: orgId,
      user_id: null,
      scope: 'org',
      key: 'correction_glass_supplier',
      value: 'Our glass comes from Encirc in Cheshire, not from the continent. Inbound haul is short.',
    },
    {
      organization_id: orgId,
      user_id: null,
      scope: 'org',
      key: 'reporting_year',
      value: 'Our reporting year runs January to December.',
    },
    {
      organization_id: orgId,
      user_id: ctx.ownerUserId,
      scope: 'user',
      key: 'response_style',
      value: 'Lead with the number. Keep it short. I do not need the methodology unless I ask.',
    },
    {
      organization_id: orgId,
      user_id: ctx.ownerUserId,
      scope: 'user',
      key: 'persona',
      value: 'leadership',
    },
  ];

  // rosa_memory's uniqueness is an expression index on COALESCE(user_id, ...),
  // which ON CONFLICT cannot match, so upsert() is not an option here. Delete
  // this seed's keys and reinsert.
  const keys = rows.map(r => r.key);
  const { error: delErr } = await ctx.svc
    .from('rosa_memory')
    .delete()
    .eq('organization_id', orgId)
    .in('key', keys);
  if (delErr) {
    ctx.warnings.push(`rosa memory (clear): ${delErr.message}`);
    return;
  }
  const { error } = await ctx.svc.from('rosa_memory').insert(rows);
  if (error) {
    ctx.warnings.push(`rosa memory: ${error.message}`);
    return;
  }
  ctx.report.rosaMemory = `${rows.length} memories (3 org, 2 user)`;
}

/**
 * Behaviour signals.
 *
 * rosa_telemetry is what /admin/rosa-learning reads for the tile click and
 * snooze rates. Seeding a spread rather than a single event means the derived
 * rates are meaningful rather than 0% or 100%.
 */
async function seedTelemetry(ctx: SeedCtx): Promise<void> {
  const { orgId } = ctx;
  const rows: Record<string, unknown>[] = [];

  // Twelve weeks of hub usage: tiles shown most weeks, clicked about a third
  // of the time, snoozed occasionally.
  for (let week = 11; week >= 0; week--) {
    const at = new Date(Date.now() - week * 7 * 24 * 3600 * 1000).toISOString();
    for (let i = 0; i < 3; i++) {
      rows.push({ organization_id: orgId, user_id: ctx.ownerUserId, event: 'tile.shown', payload: {}, created_at: at });
    }
    if (week % 3 !== 0) {
      rows.push({ organization_id: orgId, user_id: ctx.ownerUserId, event: 'tile.clicked', payload: {}, created_at: at });
    }
    if (week % 5 === 0) {
      rows.push({ organization_id: orgId, user_id: ctx.ownerUserId, event: 'tile.snoozed', payload: {}, created_at: at });
    }
  }
  rows.push({ organization_id: orgId, user_id: ctx.ownerUserId, event: 'tracker.opened', payload: {}, created_at: new Date().toISOString() });
  rows.push({ organization_id: orgId, user_id: ctx.ownerUserId, event: 'persona.set', payload: { persona: 'leadership' }, created_at: new Date().toISOString() });

  const count = await replaceRows(ctx, 'rosa_telemetry', { organization_id: orgId }, rows);
  ctx.report.rosaTelemetry = `${count} telemetry events over 12 weeks`;
}

/**
 * One pending action, so the propose-then-confirm flow has something to show.
 *
 * Rosa never writes directly: she proposes, and the user clicks Confirm. With
 * no pending row that entire interaction is invisible on a seeded org.
 */
async function seedPendingAction(ctx: SeedCtx): Promise<void> {
  const { orgId } = ctx;

  const rows = [
    {
      organization_id: orgId,
      user_id: ctx.ownerUserId,
      tool_name: 'propose_set_target',
      payload: {
        metric_key: 'total_emissions',
        baseline_value: 1240,
        baseline_date: '2025-01-01',
        target_value: 868,
        target_date: '2030-12-31',
      },
      preview: 'Set a target: cut total emissions from 1,240 tCO2e (2025 baseline) to 868 tCO2e by the end of 2030, a 30% reduction.',
      status: 'pending',
      // The route expires pending actions after 24h, so keep this one live.
      expires_at: new Date(Date.now() + 20 * 3600 * 1000).toISOString(),
    },
  ];

  const count = await replaceRows(ctx, 'rosa_pending_actions', { organization_id: orgId, status: 'pending' }, rows);
  ctx.report.rosaPendingActions = `${count} pending action awaiting confirmation`;
}
