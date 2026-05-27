/**
 * Central model configuration for all LLM calls on alka**tera**.
 *
 * When Google releases a new Gemini model, change the constants below.
 * This file is the ONLY place model IDs should live; everywhere else
 * imports from here. Optional env overrides let us hot-swap a model
 * during an incident without a redeploy.
 *
 * Why Gemini: we moved off Anthropic in May 2026 for sustainability
 * reasons — Anthropic's partnership with xAI and the Colossus datacentre
 * runs counter to our positioning. Gemini runs on Google Cloud's lower-
 * carbon infrastructure.
 */

/**
 * Used for Rosa (tool-calling, reasoning-heavy work, document understanding).
 * Default: Gemini 3.1 Pro. Override with env GEMINI_ROSA_MODEL during an
 * incident or A/B test.
 */
export const GEMINI_ROSA_MODEL =
  process.env.GEMINI_ROSA_MODEL?.trim() || 'gemini-3.1-pro';

/**
 * Used for narrative helpers, classifiers, extractors, single-shot prompts.
 * Default: Gemini 3.5 Flash. Override with env GEMINI_FAST_MODEL.
 */
export const GEMINI_FAST_MODEL =
  process.env.GEMINI_FAST_MODEL?.trim() || 'gemini-3.5-flash';

/**
 * Embeddings (knowledge bank vector search). Unchanged by the Anthropic→Gemini
 * migration since this was always Gemini.
 */
export const GEMINI_EMBEDDING_MODEL =
  process.env.GEMINI_EMBEDDING_MODEL?.trim() || 'text-embedding-004';
