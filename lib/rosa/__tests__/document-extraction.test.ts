import { describe, expect, it } from 'vitest';
import {
  buildUploadPath,
  ownsUploadPath,
  inferMediaType,
  toAnthropicBlock,
  isSupportedMediaType,
  type LoadedAttachment,
} from '../document-extraction';

describe('buildUploadPath', () => {
  it('prefixes with org/user and sanitises the filename', () => {
    const p = buildUploadPath('org-1', 'user-1', 'abc123', 'January bill!.pdf');
    expect(p.startsWith('org-1/user-1/')).toBe(true);
    expect(p).toContain('abc123');
    expect(p).not.toContain('!');
  });
});

describe('ownsUploadPath', () => {
  it('accepts paths scoped to the caller', () => {
    expect(ownsUploadPath('org-1/user-1/abc.pdf', 'org-1', 'user-1')).toBe(true);
  });
  it('rejects cross-org access', () => {
    expect(ownsUploadPath('org-2/user-1/abc.pdf', 'org-1', 'user-1')).toBe(false);
  });
  it('rejects cross-user access inside same org', () => {
    expect(ownsUploadPath('org-1/user-2/abc.pdf', 'org-1', 'user-1')).toBe(false);
  });
  it('rejects too-short paths', () => {
    expect(ownsUploadPath('abc.pdf', 'org-1', 'user-1')).toBe(false);
  });
});

describe('inferMediaType', () => {
  it('resolves common extensions', () => {
    expect(inferMediaType('bill.pdf')).toBe('application/pdf');
    expect(inferMediaType('meter.jpg')).toBe('image/jpeg');
    expect(inferMediaType('label.PNG')).toBe('image/png');
    expect(inferMediaType('drawing.webp')).toBe('image/webp');
  });
  it('falls back to mime type argument', () => {
    expect(inferMediaType('file.bin', 'application/pdf')).toBe('application/pdf');
  });
  it('returns null for unsupported types', () => {
    expect(inferMediaType('deck.pptx')).toBe(null);
  });
});

describe('isSupportedMediaType', () => {
  it('accepts PDF and image types', () => {
    expect(isSupportedMediaType('application/pdf')).toBe(true);
    expect(isSupportedMediaType('image/png')).toBe(true);
  });
  it('rejects spreadsheets and docx for now', () => {
    expect(isSupportedMediaType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe(false);
  });
});

describe('toAnthropicBlock', () => {
  const base: LoadedAttachment = {
    file_id: 'org/user/abc.pdf',
    filename: 'bill.pdf',
    media_type: 'application/pdf',
    base64: 'AAAA',
    size_bytes: 10,
  };

  it('emits a document block for PDFs', () => {
    const b = toAnthropicBlock(base);
    expect(b.type).toBe('document');
    expect(b.source.media_type).toBe('application/pdf');
  });

  it('emits an image block for images', () => {
    const b = toAnthropicBlock({ ...base, media_type: 'image/png' });
    expect(b.type).toBe('image');
    expect(b.source.media_type).toBe('image/png');
  });
});
