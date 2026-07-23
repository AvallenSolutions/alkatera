/**
 * The Ask Queue's shared vocabulary — see tasks/data-revolution-plan.md,
 * Pillar 3. An "ask" is an `agent_exceptions` row with `kind = 'ask'`: a
 * small, plain-language question the platform generated from a real data
 * gap, answerable in under 30 seconds.
 *
 * Every ask carries a `target` the answer writes to (or `null` for the one
 * navigational shape — a growth-band gap has no single field to flip, the
 * "answer" is going and adding the record). `answer_shape` says how the UI
 * collects the answer:
 *
 *   - `number`        — a numeric field, prefilled with the current value,
 *                        editable. Used for plausibility flags (a run's
 *                        production volume, a packaging weight) where the
 *                        likely fix is correcting the number itself.
 *   - `confirm_value`  — the current value is shown; one tap confirms it's
 *                        right. Used for draft-gap materials where the only
 *                        useful question is "is this right?", not "what's
 *                        the new number?" (the factor itself is never a
 *                        user-facing choice — see Pillar 2).
 *   - `yes_no`         — a plain yes/no. Used for hospitality's
 *                        quantities-confirmed gap.
 *   - `choice`         — a small set of named options, each with its own
 *                        write outcome. Used for estimated utility entries
 *                        ("about right" vs "I have the real figure").
 *   - `link`           — no inline answer at all: a deep link is the whole
 *                        interaction (growth-band gaps — "add a facility"
 *                        isn't a number or a yes/no, it's a trip to another
 *                        room). These resolve through the existing
 *                        approve/defer actions on `agent_exceptions`, not
 *                        the new 'answer' action.
 */

export type AskAnswerShape = 'number' | 'confirm_value' | 'yes_no' | 'choice' | 'link';

export type AskType =
  | 'draft_gap_material'
  | 'draft_gap_hospitality_quantities'
  | 'draft_gap_utility'
  | 'plausibility_production_run'
  | 'plausibility_packaging_weight'
  | 'growth_signal'
  // The two questions an LCA genuinely cannot answer for itself. Both used to
  // be steps in the compliance wizard, asked in ISO vocabulary before the user
  // had any way to know what the words meant.
  | 'dossier_boundary'
  | 'dossier_gap_distribution'
  // Asked once per product that sells more than one way: the sales split is
  // what turns the headline from "the main route" into the weighted mix.
  | 'dossier_sales_split'
  // Day-one: the product carrying most of the footprint is still an estimate.
  // Confirming its recipe is the single biggest step from estimate to real, so
  // it leads the queue on arrival. A link ask — the answer is opening the recipe.
  | 'flagship_recipe';

export interface AskTarget {
  table: string;
  id: string;
  field: string;
}

export interface AskChoiceOption {
  value: string;
  label: string;
}

/**
 * The full shape stored in `agent_exceptions.payload` for a `kind = 'ask'`
 * row. `title`/`question` are also mirrored onto the row's `title`/`summary`
 * columns at insert time so the existing queue UI renders them with zero
 * changes — payload is the extra structure the ask-specific surfaces read.
 */
export interface AskPayload {
  ask_type: AskType;
  question: string;
  answer_shape: AskAnswerShape;
  /** Only for answer_shape: 'choice'. */
  options?: AskChoiceOption[];
  /** Current value shown for 'number' (prefill) and 'confirm_value' (display-only). */
  current_value?: number | string | null;
  unit?: string | null;
  /** Null only for answer_shape: 'link'. */
  target: AskTarget | null;
  /**
   * 0..1 share of the relevant footprint this ask's target represents, when
   * computable (lib/asks/impact.ts). Null when there is nothing sensible to
   * divide by — the UI only ever renders the "worth about N% of your
   * footprint" line when this is non-null.
   */
  impact_share: number | null;
  /**
   * Always present, used purely for queue ordering (never shown to the
   * user): impact_share when computable, otherwise a small negative value
   * derived from a per-ask-type fallback tier so computable asks always
   * outrank fallback ones and fallback ones still order sensibly among
   * themselves. See lib/asks/impact.ts.
   */
  priority_score: number;
  /** Stable identity for idempotent regeneration — see the partial unique index. */
  dedupe_key: string;
  /** Deep link: the only interaction for 'link' asks, an escape hatch for the rest. */
  href?: string | null;
  /** Only for ask_type: 'growth_signal' — lets other surfaces (room panels) dedupe against it. */
  growth_signal_id?: string;
  product_name?: string | null;
  facility_name?: string | null;
}

/** A generator's output before it's turned into an agent_exceptions insert row. */
export interface AskCandidate {
  title: string;
  payload: AskPayload;
}
