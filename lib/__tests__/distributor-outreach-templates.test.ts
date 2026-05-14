import { describe, it, expect } from 'vitest';
import {
  renderInitialOutreachEmail,
  renderReminderEmail,
  renderSubmissionReceiptEmail,
  renderDistributorNotificationEmail,
  brandUploadLink,
} from '@/lib/distributor/outreach/email-templates';

const baseArgs = {
  brandName: 'Château Margaux',
  distributorName: 'Liberty Wines',
  skuNames: ['Château Margaux 2018', 'Pavillon Rouge 2019', 'Pavillon Blanc 2020'],
  totalSkuCount: 3,
  uploadToken: 'abc123-token-deadbeef-1234567890',
  distributorContactEmail: 'sustainability@libertywines.co.uk',
};

describe('renderInitialOutreachEmail', () => {
  it('subject line names the distributor', () => {
    const { subject } = renderInitialOutreachEmail(baseArgs);
    expect(subject).toBe('Liberty Wines is requesting your sustainability data');
  });

  it('body includes the brand name, distributor name, and SKU list', () => {
    const { html } = renderInitialOutreachEmail(baseArgs);
    expect(html).toContain('Liberty Wines');
    expect(html).toContain('Château Margaux');
    expect(html).toContain('Pavillon Rouge 2019');
  });

  it('collapses overflow SKUs into a "+N more" line', () => {
    const many = renderInitialOutreachEmail({
      ...baseArgs,
      skuNames: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
      totalSkuCount: 7,
    });
    expect(many.html).toContain('+ 2 more');
  });

  it('includes a clickable upload link with the token', () => {
    const { html } = renderInitialOutreachEmail(baseArgs);
    expect(html).toContain(baseArgs.uploadToken);
    expect(html).toMatch(/href="https?:\/\/[^"]+\/brand-upload\//);
  });

  it('escapes HTML in brand and distributor names', () => {
    const dodgy = renderInitialOutreachEmail({
      ...baseArgs,
      brandName: '<script>alert(1)</script>',
      distributorName: 'Liberty & Co.',
    });
    expect(dodgy.html).not.toContain('<script>alert(1)</script>');
    expect(dodgy.html).toContain('Liberty &amp; Co.');
  });
});

describe('renderReminderEmail', () => {
  it('subject line says "Reminder:" and names the distributor', () => {
    const { subject } = renderReminderEmail(baseArgs);
    expect(subject).toBe('Reminder: Liberty Wines is still waiting for your sustainability data');
  });

  it('body keeps the upload link', () => {
    const { html } = renderReminderEmail(baseArgs);
    expect(html).toContain(baseArgs.uploadToken);
  });
});

describe('renderSubmissionReceiptEmail', () => {
  it('subject and body include the brand and distributor', () => {
    const { subject, html } = renderSubmissionReceiptEmail({
      brandName: 'Château Margaux',
      distributorName: 'Liberty Wines',
      submitterName: 'Sophie',
      fileNames: ['lca_2024.pdf', 'water_usage.xlsx'],
    });
    expect(subject).toContain('Château Margaux');
    expect(html).toContain('Liberty Wines');
    expect(html).toContain('lca_2024.pdf');
    expect(html).toContain('water_usage.xlsx');
  });
});

describe('renderDistributorNotificationEmail', () => {
  it('subject names the brand and body counts the files', () => {
    const { subject, html } = renderDistributorNotificationEmail({
      brandName: 'Château Margaux',
      distributorName: 'Liberty Wines',
      submitterName: 'Sophie',
      submitterEmail: 'sophie@margaux.fr',
      fileCount: 3,
      brandDetailUrl: 'https://example.com/distributor/brands/abc',
    });
    expect(subject).toBe('Château Margaux submitted sustainability data');
    expect(html).toContain('3 sustainability documents');
    expect(html).toContain('sophie@margaux.fr');
  });

  it('pluralises correctly for a single file', () => {
    const { html } = renderDistributorNotificationEmail({
      brandName: 'X',
      distributorName: 'Y',
      submitterName: 'Z',
      submitterEmail: 'z@x.com',
      fileCount: 1,
      brandDetailUrl: 'https://example.com',
    });
    expect(html).toContain('1 sustainability document');
    expect(html).not.toContain('1 sustainability documents');
  });
});

describe('brandUploadLink', () => {
  it('produces an absolute URL using SITE_URL', () => {
    const link = brandUploadLink('mytoken');
    expect(link).toMatch(/^https?:\/\//);
    expect(link.endsWith('/brand-upload/mytoken')).toBe(true);
  });

  it('URL-encodes the token', () => {
    const link = brandUploadLink('a/b c');
    expect(link).toContain('a%2Fb%20c');
  });
});
