import 'server-only';
import { Resend } from 'resend';
import { inngest } from '../client';
import { studioLayout, studioParagraph, studioNotice, STUDIO } from '@/lib/email/studio-layout';
import { resolveServerConfig, type OpenLCADatabaseSource } from '@/lib/openlca/client';

/**
 * DNS + endpoint health monitor (on Inngest).
 *
 * On ~26 June 2026 the alkatera.com zone was rebuilt during the Infomaniak
 * onboarding and the `openlca-agribalyse` A record was silently lost. Every
 * live Agribalyse emission-factor search returned zero results for ~3 weeks,
 * indistinguishable from "no matches" in the UI. This monitor resolves the
 * critical records hourly over DNS-over-HTTPS and probes the two gdt-servers,
 * so a lost record or dead endpoint is an email within the hour, not a
 * user-reported mystery weeks later.
 *
 * The canonical zone inventory lives in docs/dns-records.md — keep the
 * EXPECTED_RECORDS list below in sync with it when the zone changes.
 *
 * Deliberately noisy: alerts on EVERY failing hourly run. A missing record is
 * an active outage; silence is how the last one lasted three weeks.
 */

interface ExpectedRecord {
  name: string;
  type: 'A' | 'CNAME' | 'MX' | 'TXT';
  /** Substring that must appear in at least one answer for this name/type. */
  expect: string;
  /** What breaks when this record is missing — goes in the alert email. */
  serves: string;
}

const EXPECTED_RECORDS: ExpectedRecord[] = [
  { name: 'alkatera.com', type: 'A', expect: '75.2.60.5', serves: 'main app (Netlify)' },
  { name: 'www.alkatera.com', type: 'CNAME', expect: 'alkatera.netlify.app', serves: 'main app (Netlify)' },
  { name: 'openlca.alkatera.com', type: 'A', expect: '83.228.193.211', serves: 'ecoinvent live factor search' },
  { name: 'openlca-agribalyse.alkatera.com', type: 'A', expect: '83.228.193.211', serves: 'Agribalyse live factor search' },
  { name: 'alkatera.com', type: 'MX', expect: 'mta-gw.infomaniak.ch', serves: 'inbound company email (Infomaniak)' },
  { name: 'alkatera.com', type: 'TXT', expect: 'v=spf1 include:spf.infomaniak.ch', serves: 'email deliverability (SPF)' },
  { name: '_dmarc.alkatera.com', type: 'TXT', expect: 'v=DMARC1', serves: 'email deliverability (DMARC)' },
  { name: 'mail.alkatera.com', type: 'MX', expect: 'inbound-smtp.eu-west-1.amazonaws.com', serves: 'SES inbound reply handling' },
  { name: 'send.mail.alkatera.com', type: 'MX', expect: 'feedback-smtp.eu-west-1.amazonses.com', serves: 'Resend transactional sending' },
  { name: 'send.news.alkatera.com', type: 'MX', expect: 'feedback-smtp.eu-west-1.amazonses.com', serves: 'Resend newsletter sending' },
];

/** HTTPS endpoints that must answer 200 (DNS resolving is not enough). */
const EXPECTED_ENDPOINTS: { url: string; serves: string }[] = [
  { url: 'https://openlca.alkatera.com/api/version', serves: 'ecoinvent gdt-server' },
  { url: 'https://openlca-agribalyse.alkatera.com/api/version', serves: 'Agribalyse gdt-server' },
];

/**
 * Answering is not the same as being ready.
 *
 * `api/version` proves the JVM is alive. It says nothing about whether the
 * database actually loaded, and that is a real failure mode here: the
 * container is capped at 10.5 GB with a 60 to 90 second load, so an
 * out-of-memory or a failed mount can leave gdt-server up and cheerfully
 * returning 200 while holding no processes at all. To a user that is
 * indistinguishable from the outages this monitor was written for, because
 * ingredient search simply returns nothing.
 *
 * So each server is also asked for its process list and expected to have a
 * plausible number of them. The floors are deliberately far below the real
 * counts (ecoinvent 3.12 has ~23,000 processes, Agribalyse 3.2 ~2,500): this
 * is a "did the database load at all" test, not a completeness audit, and a
 * floor set near the true count would false-alarm on every dataset update.
 */
const READINESS_PROBES: {
  source: OpenLCADatabaseSource;
  serves: string;
  minProcesses: number;
}[] = [
  { source: 'ecoinvent', serves: 'ecoinvent gdt-server', minProcesses: 1000 },
  { source: 'agribalyse', serves: 'Agribalyse gdt-server', minProcesses: 500 },
];

export interface DnsCheckResult {
  name: string;
  type: string;
  expect: string;
  serves: string;
  ok: boolean;
  answers: string[];
  error?: string;
}

export interface EndpointCheckResult {
  url: string;
  serves: string;
  ok: boolean;
  status?: number;
  error?: string;
  /** Processes the server reported holding, when the readiness probe ran. */
  processCount?: number;
}

const DNS_TYPE_CODES: Record<string, number> = { A: 1, CNAME: 5, MX: 15, TXT: 16 };

/**
 * Resolve name/type via DNS-over-HTTPS. Tries Cloudflare then Google so a
 * single resolver outage doesn't page anyone. Returns the answer data strings.
 */
async function resolveDoH(name: string, type: ExpectedRecord['type']): Promise<string[]> {
  const providers = [
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`,
    `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
  ];
  let lastError: unknown;
  for (const url of providers) {
    try {
      const res = await fetch(url, {
        headers: { accept: 'application/dns-json' },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`resolver HTTP ${res.status}`);
      const json = (await res.json()) as { Answer?: { type: number; data: string }[] };
      const wantCode = DNS_TYPE_CODES[type];
      return (json.Answer || [])
        .filter((a) => a.type === wantCode)
        .map((a) => a.data.replace(/^"|"$/g, ''));
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function runDnsChecks(): Promise<DnsCheckResult[]> {
  const results: DnsCheckResult[] = [];
  for (const rec of EXPECTED_RECORDS) {
    try {
      const answers = await resolveDoH(rec.name, rec.type);
      const ok = answers.some((a) => a.toLowerCase().includes(rec.expect.toLowerCase()));
      results.push({ ...rec, ok, answers });
      if (!ok) {
        console.error(
          `[dns-health] ${rec.type} ${rec.name}: expected "${rec.expect}", got [${answers.join(', ') || 'no answers'}] — ${rec.serves} is at risk`
        );
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({ ...rec, ok: false, answers: [], error });
      console.error(`[dns-health] ${rec.type} ${rec.name}: lookup failed — ${error}`);
    }
  }
  return results;
}

export async function runEndpointChecks(): Promise<EndpointCheckResult[]> {
  const results: EndpointCheckResult[] = [];
  for (const ep of EXPECTED_ENDPOINTS) {
    try {
      const res = await fetch(ep.url, { signal: AbortSignal.timeout(15_000) });
      results.push({ ...ep, ok: res.ok, status: res.status });
      if (!res.ok) console.error(`[dns-health] ${ep.url} answered HTTP ${res.status} — ${ep.serves} degraded`);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({ ...ep, ok: false, error });
      console.error(`[dns-health] ${ep.url} unreachable — ${error}`);
    }
  }

  results.push(...(await runReadinessChecks()));
  return results;
}

/**
 * Ask each OpenLCA server for its process list and check it holds a plausible
 * number. Catches a server that is up but empty, which the liveness probe
 * above reports as perfectly healthy.
 *
 * Skipped silently when the server is not configured in this environment: a
 * missing OPENLCA_AGRIBALYSE_SERVER_URL means "not deployed here", not "down".
 */
export async function runReadinessChecks(): Promise<EndpointCheckResult[]> {
  const results: EndpointCheckResult[] = [];

  for (const probe of READINESS_PROBES) {
    const config = resolveServerConfig(probe.source);
    if (!config) continue;

    const url = `${config.serverUrl.replace(/\/$/, '')}/data/processes`;
    try {
      const res = await fetch(url, {
        headers: config.apiKey ? { 'X-API-Key': config.apiKey } : {},
        signal: AbortSignal.timeout(30_000),
      });

      if (!res.ok) {
        results.push({
          url,
          serves: `${probe.serves} (readiness)`,
          ok: false,
          status: res.status,
        });
        console.error(`[dns-health] ${url} answered HTTP ${res.status} — ${probe.serves} not ready`);
        continue;
      }

      const body = await res.json();
      const count = Array.isArray(body) ? body.length : 0;
      const ok = count >= probe.minProcesses;
      results.push({
        url,
        serves: `${probe.serves} (readiness)`,
        ok,
        status: res.status,
        processCount: count,
        error: ok
          ? undefined
          : `holds ${count} processes, expected at least ${probe.minProcesses} — the database may not have loaded`,
      });
      if (!ok) {
        console.error(
          `[dns-health] ${probe.serves} answered 200 but holds only ${count} processes — database likely not loaded`,
        );
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({ url, serves: `${probe.serves} (readiness)`, ok: false, error });
      console.error(`[dns-health] readiness probe failed for ${probe.serves} — ${error}`);
    }
  }

  return results;
}

function buildAlertEmail(
  dnsFailures: DnsCheckResult[],
  endpointFailures: EndpointCheckResult[]
): { subject: string; html: string } {
  const parts: string[] = [];
  for (const f of dnsFailures) {
    const got = f.error ? `lookup failed (${f.error})` : f.answers.length ? `got ${f.answers.join(', ')}` : 'NO RECORD';
    parts.push(`<li style="margin-bottom:6px;"><strong>${f.type} ${f.name}</strong>: expected "${f.expect}", ${got}<br/><span style="color:${STUDIO.dim};">Breaks: ${f.serves}</span></li>`);
  }
  for (const f of endpointFailures) {
    // A readiness failure answers perfectly well and is still broken, so
    // "unreachable" is only right when nothing came back at all.
    const got = f.error
      ? f.status
        ? `HTTP ${f.status}, but ${f.error}`
        : `unreachable (${f.error})`
      : `HTTP ${f.status}`;
    parts.push(`<li style="margin-bottom:6px;"><strong>${f.url}</strong>: ${got}<br/><span style="color:${STUDIO.dim};">Breaks: ${f.serves}</span></li>`);
  }

  const subject = `DNS/endpoint check failing: ${[...dnsFailures.map((f) => f.name), ...endpointFailures.map((f) => f.url)].join(', ').slice(0, 120)}`;
  const html = studioLayout({
    eyebrow: 'DNS health',
    content: [
      studioParagraph(
        'The hourly health check found problems. The canonical zone inventory is <code>docs/dns-records.md</code>; fix the zone at manager.infomaniak.com &rarr; Web &amp; Domains &rarr; alkatera.com &rarr; DNS zone.',
      ),
      studioNotice(
        'danger',
        'alkatera.com DNS / endpoint failure',
        `<ul style="margin:0;padding-left:18px;">${parts.join('')}</ul>`,
      ),
    ].join(''),
    footerNote:
      'Sent by the alka<strong>tera</strong> DNS health monitor. It alerts on every failing hourly run until the problem is fixed.',
  });
  return { subject, html };
}

export const dnsHealthMonitor = inngest.createFunction(
  {
    id: 'dns-health-monitor',
    name: 'DNS + endpoint health monitor',
    concurrency: { limit: 1 },
    retries: 1,
    // Hourly at :23 (off the top of the hour to avoid resolver herd effects).
    // Also accepts the event for manual dispatch from admin tooling.
    triggers: [{ event: 'monitoring/dns-health.check' }, { cron: '23 * * * *' }],
  },
  async ({ step }) => {
    const dnsChecks = await step.run('check-dns-records', runDnsChecks);
    const endpointChecks = await step.run('check-endpoints', runEndpointChecks);

    const dnsFailures = dnsChecks.filter((c) => !c.ok);
    const endpointFailures = endpointChecks.filter((c) => !c.ok);

    if (dnsFailures.length === 0 && endpointFailures.length === 0) {
      return { dns: dnsChecks.length, endpoints: endpointChecks.length, failures: 0 };
    }

    const emailResult = await step.run('send-alert-email', async () => {
      const resendApiKey = process.env.RESEND_API_KEY;
      if (!resendApiKey) {
        console.warn('[dns-health] RESEND_API_KEY not set — alert not emailed');
        return { sent: false, reason: 'no-api-key' };
      }
      const to = process.env.ADMIN_EMAIL || 'hello@alkatera.com';
      const { subject, html } = buildAlertEmail(dnsFailures, endpointFailures);
      const resend = new Resend(resendApiKey);
      await resend.emails.send({
        from: 'alkatera Monitoring <alerts@mail.alkatera.com>',
        to,
        subject,
        html,
      });
      console.warn(`[dns-health] alert emailed to ${to}: ${subject}`);
      return { sent: true, to };
    });

    return {
      dns: dnsChecks.length,
      endpoints: endpointChecks.length,
      failures: dnsFailures.length + endpointFailures.length,
      email: emailResult,
      dnsFailures,
      endpointFailures,
    };
  }
);
