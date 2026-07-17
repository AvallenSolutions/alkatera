import 'server-only';
import { Resend } from 'resend';
import { inngest } from '../client';
import {
  resolveServerConfig,
  isAgribalyseConfigured,
  type OpenLCADatabaseSource,
} from '@/lib/openlca/client';
import { checkCertExpiry, parseHostPort, type CertExpiry } from '@/lib/openlca/cert-expiry';

/**
 * OpenLCA TLS certificate expiry monitor (on Inngest).
 *
 * The live ecoinvent + Agribalyse search depends on two self-hosted gdt-servers
 * behind Let's Encrypt certs that renew via certbot. In June 2026 that renewal
 * silently broke, both certs expired, and live search failed for weeks while
 * looking like "no results". This monitor reads the certs daily and emails an
 * alert well before expiry so it can't happen unnoticed again.
 *
 * Flow:
 *   Netlify Schedule fn (daily) → inngest.send('monitoring/openlca-cert.check')
 *                                      │
 *                                      ▼
 *                            openlcaCertMonitor
 *                            - reads cert notAfter for each configured server
 *                            - logs status every run
 *                            - emails ADMIN_EMAIL on threshold days
 *                              (and daily once expired / unreadable)
 *
 * The check is also exposed on-demand at GET /api/admin/openlca/cert-check.
 */

/**
 * Email when the remaining days hit one of these thresholds. The daily run
 * decrements daysRemaining by 1 each day, so each threshold fires exactly once
 * — stateless dedup, no tracking table needed. Once expired (or unreadable) we
 * alert every day because that is an active or imminent outage.
 */
const WARN_THRESHOLD_DAYS = [14, 10, 7, 3, 2, 1];

export interface CertCheckResult extends CertExpiry {
  source: OpenLCADatabaseSource;
}

/** Decide whether a single server's cert state warrants an email this run. */
export function shouldAlert(check: CertCheckResult): boolean {
  if (!check.ok || check.daysRemaining === null) return true; // couldn't read it — investigate
  if (check.daysRemaining <= 0) return true; // expired — daily nag
  return WARN_THRESHOLD_DAYS.includes(check.daysRemaining);
}

/** Run the cert check for every configured OpenLCA server. */
export async function runCertChecks(): Promise<CertCheckResult[]> {
  const sources: OpenLCADatabaseSource[] = ['ecoinvent'];
  if (isAgribalyseConfigured()) sources.push('agribalyse');

  const results: CertCheckResult[] = [];
  for (const source of sources) {
    const cfg = resolveServerConfig(source);
    if (!cfg) continue; // not configured — nothing to monitor
    const { host, port } = parseHostPort(cfg.serverUrl);
    const expiry = await checkCertExpiry(host, port);
    results.push({ ...expiry, source });

    if (expiry.ok) {
      const tag = expiry.expired ? ' EXPIRED' : '';
      console.log(
        `[openlca-cert-monitor] ${source} ${host}:${port} expires ${expiry.validTo} (${expiry.daysRemaining}d)${tag}`
      );
    } else {
      console.error(`[openlca-cert-monitor] ${source} ${host}:${port} CHECK FAILED: ${expiry.error}`);
    }
  }
  return results;
}

function statusLine(c: CertCheckResult): string {
  if (!c.ok) return `${c.source} (${c.host}): could not read certificate — ${c.error}`;
  if (c.expired) return `${c.source} (${c.host}): EXPIRED ${Math.abs(c.daysRemaining ?? 0)} day(s) ago — live search is DOWN`;
  return `${c.source} (${c.host}): expires in ${c.daysRemaining} day(s) on ${c.validTo}`;
}

function buildEmail(alerting: CertCheckResult[]): { subject: string; html: string } {
  const anyExpired = alerting.some((c) => c.expired || !c.ok);
  const minDays = Math.min(...alerting.map((c) => c.daysRemaining ?? -1));
  const subject = anyExpired
    ? '🔴 OpenLCA TLS certificate EXPIRED — live LCA search is down'
    : `⚠️ OpenLCA TLS certificate expiring in ${minDays} day(s)`;

  const rows = alerting
    .map((c) => `<li style="margin-bottom:6px">${statusLine(c)}</li>`)
    .join('');

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px">
      <h2 style="color:${anyExpired ? '#dc2626' : '#d97706'};margin:0 0 8px">
        ${anyExpired ? 'OpenLCA certificate expired' : 'OpenLCA certificate expiring soon'}
      </h2>
      <p style="color:#374151;margin:0 0 12px">
        The self-hosted OpenLCA server(s) backing the ecoinvent / Agribalyse
        emission-factor search need attention:
      </p>
      <ul style="color:#111827;padding-left:18px">${rows}</ul>
      <p style="color:#374151;margin:16px 0 4px"><strong>To renew (on the VPS):</strong></p>
      <pre style="background:#f3f4f6;padding:12px;border-radius:6px;font-size:12px;overflow:auto">ssh ubuntu@&lt;openlca-vps&gt;
sudo certbot renew --force-renewal
# renewal hooks stop/start openlca-nginx automatically</pre>
      <p style="color:#6b7280;font-size:12px;margin-top:16px">
        Sent by the alka<strong>tera</strong> OpenLCA cert monitor. If certs are
        already valid again, you can ignore this — the next daily check will go quiet.
      </p>
    </div>`;

  return { subject, html };
}

export const openlcaCertMonitor = inngest.createFunction(
  {
    id: 'openlca-cert-monitor',
    name: 'OpenLCA TLS cert expiry monitor',
    concurrency: { limit: 1 },
    retries: 1,
    triggers: [{ event: 'monitoring/openlca-cert.check' }, { cron: '0 8 * * *' }],
  },
  async ({ step }) => {
    const checks = await step.run('check-certs', runCertChecks);

    const alerting = checks.filter(shouldAlert);
    if (alerting.length === 0) {
      return { checked: checks.length, alerts: 0, checks };
    }

    const emailResult = await step.run('send-alert-email', async () => {
      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) {
        console.warn('[openlca-cert-monitor] RESEND_API_KEY not set — alert not emailed');
        return { sent: false, reason: 'no-api-key' };
      }
      const to = process.env.ADMIN_EMAIL || 'hello@alkatera.com';
      const { subject, html } = buildEmail(alerting);
      const resend = new Resend(resendApiKey);
      await resend.emails.send({
        from: 'alkatera Monitoring <alerts@mail.alkatera.com>',
        to,
        subject,
        html,
      });
      console.warn(`[openlca-cert-monitor] alert emailed to ${to}: ${subject}`);
      return { sent: true, to };
    });

    return { checked: checks.length, alerts: alerting.length, email: emailResult, checks };
  }
);
