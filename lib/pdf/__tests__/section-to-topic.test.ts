import { describe, it, expect } from 'vitest';
import { SECTION_TO_TOPIC } from '../render-sustainability-report-html';
import { TOPIC_LIBRARY } from '@/lib/materiality/topic-library';

// Four of the map's values were ids that do not exist in the topic library,
// so the materiality callout could never render on those pages and nothing
// ever said so. This pins every mapping to a real topic forever.

describe('SECTION_TO_TOPIC', () => {
  it('maps every section to a topic id that exists in the topic library', () => {
    const realIds = new Set(TOPIC_LIBRARY.map(t => t.id));
    const phantoms = Object.entries(SECTION_TO_TOPIC)
      .filter(([, topicId]) => !realIds.has(topicId))
      .map(([section, topicId]) => `${section} -> ${topicId}`);
    expect(phantoms).toEqual([]);
  });

  it('covers both the legacy and canonical ids for the aliased sections', () => {
    expect(SECTION_TO_TOPIC['people']).toBe(SECTION_TO_TOPIC['people-culture']);
    expect(SECTION_TO_TOPIC['community']).toBe(SECTION_TO_TOPIC['community-impact']);
    expect(SECTION_TO_TOPIC['products']).toBe(SECTION_TO_TOPIC['product-footprints']);
  });
});
