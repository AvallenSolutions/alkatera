# alkatera.com DNS zone — canonical inventory

**This file is the source of truth for what the alkatera.com DNS zone must contain.**
DNS is hosted on Infomaniak (`nsany1.infomaniak.com` / `nsany2.infomaniak.com`), managed at
manager.infomaniak.com → Web & Domains → alkatera.com → DNS zone.

After ANY zone change (or any Infomaniak service activation, which can rewrite the zone),
diff the live zone against this table. The hourly `dns-health-monitor` Inngest function
checks the critical subset automatically and emails alerts on failure.

## Why this file exists

On ~26 June 2026 the domain was onboarded to Infomaniak (kSuite mail + nameservers) and the
zone was rebuilt. The `openlca-agribalyse` A record was not re-added, which silently killed
all live Agribalyse emission-factor searches for ~3 weeks (it looked like "no results", not
an outage). The record was restored on 16 July 2026. A zone with no source of truth loses
records every time it is rebuilt; this inventory closes that hole.

## Records

### Platform (critical — monitored hourly)

| Host | Type | Target | TTL | Serves |
|---|---|---|---|---|
| `alkatera.com` | A | `75.2.60.5` | 5 min | Netlify load balancer (main app) |
| `www.alkatera.com` | CNAME | `alkatera.netlify.app` | 5 min | Netlify (main app) |
| `openlca.alkatera.com` | A | `83.228.193.211` | 1 h | gdt-server, ecoinvent live search (Infomaniak VPS) |
| `openlca.alkatera.com` | AAAA | `2001:1600:13:101::2349` | 1 h | Same VPS over IPv6 |
| `openlca-agribalyse.alkatera.com` | A | `83.228.193.211` | 1 h | gdt-server, Agribalyse live search (same VPS, separate vhost). **Lost in the 26 Jun 2026 zone rebuild; restored 16 Jul 2026.** |

Note: `openlca-agribalyse` has no AAAA record. If IPv6 is confirmed working for the
Agribalyse vhost, add `AAAA 2001:1600:13:101::2349` for parity with `openlca`.

### Email — Infomaniak kSuite (tim@alkatera.com etc.)

| Host | Type | Target | TTL |
|---|---|---|---|
| `alkatera.com` | MX 5 | `mta-gw.infomaniak.ch` | 1 h |
| `alkatera.com` | TXT | `v=spf1 include:spf.infomaniak.ch -all` | 1 h |
| `_dmarc.alkatera.com` | TXT | `v=DMARC1; p=quarantine; sp=quarantine; pct=50; rua=mailto:tim@alkatera.com; adkim=r; aspf=r` | 1 h |
| `20260112._domainkey.alkatera.com` | TXT | Infomaniak DKIM key (value held in Infomaniak) | 1 h |
| `autoconfig.alkatera.com` | CNAME | `infomaniak.com` | 1 h |
| `autodiscover.alkatera.com` | CNAME | `infomaniak.com` | 1 h |

### Email — Resend/Amazon SES (transactional + outreach, added 3–14 Jul 2026)

| Host | Type | Target | TTL | Purpose |
|---|---|---|---|---|
| `mail.alkatera.com` | MX 10 | `inbound-smtp.eu-west-1.amazonaws.com` | 5 min | SES inbound (reply handling) |
| `send.mail.alkatera.com` | MX 10 | `feedback-smtp.eu-west-1.amazonses.com` | 5 min | Resend sending domain (transactional, `alerts@mail.alkatera.com`) |
| `send.mail.alkatera.com` | TXT | `v=spf1 include:amazonses.com ~all` | 5 min | |
| `resend._domainkey.mail.alkatera.com` | TXT | Resend DKIM key (value held in Resend) | 5 min | |
| `send.news.alkatera.com` | MX 10 | `feedback-smtp.eu-west-1.amazonses.com` | 5 min | Resend sending domain (newsletter/bulletin) |
| `send.news.alkatera.com` | TXT | `v=spf1 include:amazonses.com ~all` | 5 min | |
| `resend._domainkey.news.alkatera.com` | TXT | Resend DKIM key (value held in Resend) | 5 min | |

### Infrastructure

| Host | Type | Target | TTL |
|---|---|---|---|
| `alkatera.com` | NS | `nsany1.infomaniak.com` | 1 h |
| `alkatera.com` | NS | `nsany2.infomaniak.com` | 1 h |

## Monitoring

- `lib/inngest/functions/dns-health.ts` (`dns-health-monitor`): hourly, resolves the
  critical records over DNS-over-HTTPS, probes both gdt-servers' `/api/version`, and
  emails `ADMIN_EMAIL` via Resend on any failure. Deliberately noisy (every failing
  run) because a missing record is an active outage.
- `lib/inngest/functions/monitoring.ts` (`openlca-cert-monitor`): daily TLS cert expiry
  check for the same two servers.

## Change log

| Date | Change |
|---|---|
| 26 Jun 2026 | Domain onboarded to Infomaniak (kSuite mail + NS). Zone rebuilt; `openlca-agribalyse` lost. |
| 2 Jul 2026 | Apex A → Netlify; SPF updated. |
| 3–14 Jul 2026 | Resend/SES records added (`mail`, `send.mail`, `send.news`, DKIM, DMARC). |
| 16 Jul 2026 | `openlca-agribalyse` A record restored (Infomaniak record id 36035657). This file + hourly DNS monitor created. |
