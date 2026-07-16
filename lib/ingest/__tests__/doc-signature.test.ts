import { describe, expect, it } from 'vitest';
import { docSignature } from '../doc-signature';

describe('docSignature', () => {
  it('normalises a versioned recipe filename to a stable pattern', () => {
    expect(docSignature('BEV_ECM_TobyCo_Recipe_2025_v3.xlsx')).toBe('bev ecm tobyco recipe # v#');
  });

  it('collapses digit runs so dates and batch numbers do not fragment the key', () => {
    expect(docSignature('Invoice 2026-01 Biffa.pdf')).toBe(docSignature('Invoice 2026-07 Biffa.pdf'));
  });

  it('matches the real Toby & Co naming scheme across versions', () => {
    const a = docSignature('Toby & Co THE GREEN ONE 17th June 2025 BEV 25 ECM170625 1.xlsx');
    const b = docSignature('Toby & Co THE GREEN ONE 3rd July 2025 BEV 25 ECM030725 2.xlsx');
    expect(a).toBe('toby co the green one #');
    expect(a).toBe(b);
  });

  it('strips diacritics and non-alphanumerics', () => {
    expect(docSignature('Café_Reçu-2026.pdf')).toBe('cafe recu #');
  });

  it('caps the token count', () => {
    const sig = docSignature('one two three four five six seven eight.pdf');
    expect(sig).toBe('one two three four five six');
  });

  it('returns null for generic scanner names', () => {
    expect(docSignature('scan_20260714.jpg')).toBeNull();
    expect(docSignature('IMG_0042.png')).toBeNull();
    expect(docSignature('document.pdf')).toBeNull();
    expect(docSignature('')).toBeNull();
  });

  it('returns null when only digits remain', () => {
    expect(docSignature('20260714.pdf')).toBeNull();
  });
});
