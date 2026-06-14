// A one-page, exec-ready B Corp readiness summary as a self-contained HTML
// document for PDFShift. Plain, board-friendly: the headline numbers, where the
// brand stands, and the priority next steps.

export interface BcorpOnePagerData {
  orgName: string;
  generatedAt: string;
  certificationType: 'new' | 'recertification' | null;
  currentYearBand: number;
  year0ReadinessPct: number;
  programmeReadinessPct: number;
  readyToSubmit: boolean;
  blockingCount: number;
  nextActions: Array<{ code: string; name: string; bucket: string; reason: string }>;
  recertDeltas?: { new: number; changed: number; carried_over: number } | null;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderBcorpOnePagerHtml(d: BcorpOnePagerData): string {
  const statusLabel = d.readyToSubmit
    ? 'Ready to submit'
    : `${d.blockingCount} requirement${d.blockingCount === 1 ? '' : 's'} still blocking submission`;
  const statusColour = d.readyToSubmit ? '#16a34a' : d.blockingCount > 0 ? '#d97706' : '#64748b';
  const journey = d.certificationType === 'recertification' ? 'Recertification (2026 standard)' : 'New certification';

  const deltaBlock = d.recertDeltas
    ? `<div class="deltas">
         <div class="delta"><span class="dn new">${d.recertDeltas.new}</span><span class="dl">New in 2026</span></div>
         <div class="delta"><span class="dn chg">${d.recertDeltas.changed}</span><span class="dl">Changed</span></div>
         <div class="delta"><span class="dn co">${d.recertDeltas.carried_over}</span><span class="dl">Carried over</span></div>
       </div>`
    : '';

  const actions = d.nextActions.length
    ? d.nextActions
        .map(
          (a) => `<li>
            <span class="code">${esc(a.code)}</span>
            <span class="aname">${esc(a.name)}</span>
            <span class="bucket b-${esc(a.bucket)}">${esc(a.bucket)}</span>
            <div class="reason">${esc(a.reason)}</div>
          </li>`,
        )
        .join('')
    : '<li class="none">No outstanding requirements for the current year — on track.</li>';

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 32px 40px; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #ccff00; padding-bottom: 12px; }
  .brand { font-size: 13px; letter-spacing: .12em; text-transform: uppercase; color: #64748b; }
  .brand b { color: #0f172a; }
  h1 { font-size: 22px; margin: 4px 0 0; }
  .meta { text-align: right; font-size: 11px; color: #64748b; line-height: 1.5; }
  .scores { display: flex; gap: 16px; margin: 24px 0; }
  .score { flex: 1; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px; }
  .score .v { font-size: 34px; font-weight: 700; }
  .score .l { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #64748b; margin-top: 2px; }
  .status { display: inline-block; font-weight: 600; font-size: 14px; padding: 6px 12px; border-radius: 999px; background: ${statusColour}1a; color: ${statusColour}; }
  .deltas { display: flex; gap: 12px; margin: 18px 0; }
  .delta { flex: 1; text-align: center; border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }
  .dn { display: block; font-size: 24px; font-weight: 700; }
  .dn.new { color: #7c3aed; } .dn.chg { color: #d97706; } .dn.co { color: #64748b; }
  .dl { font-size: 10px; text-transform: uppercase; letter-spacing: .06em; color: #64748b; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .08em; color: #475569; margin: 24px 0 8px; }
  ul { list-style: none; padding: 0; margin: 0; }
  li { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
  li.none { color: #16a34a; }
  .code { font-family: monospace; font-size: 11px; color: #64748b; margin-right: 8px; }
  .aname { font-weight: 600; font-size: 13px; }
  .bucket { float: right; font-size: 9px; text-transform: uppercase; letter-spacing: .06em; padding: 2px 8px; border-radius: 999px; background: #f1f5f9; color: #475569; }
  .b-confirm { background: #dcfce7; color: #15803d; }
  .b-mandatory { background: #fef3c7; color: #b45309; }
  .reason { font-size: 11px; color: #64748b; margin-top: 4px; }
  .foot { margin-top: 28px; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px; }
</style></head>
<body>
  <div class="top">
    <div>
      <div class="brand">alka<b>tera</b> · B Corp readiness</div>
      <h1>${esc(d.orgName)}</h1>
    </div>
    <div class="meta">${esc(journey)}<br/>Year ${d.currentYearBand} of the programme<br/>${esc(d.generatedAt)}</div>
  </div>

  <div class="scores">
    <div class="score"><div class="v">${d.year0ReadinessPct}%</div><div class="l">Ready to submit (Year 0)</div></div>
    <div class="score"><div class="v">${d.programmeReadinessPct}%</div><div class="l">Whole programme (Year 0/3/5)</div></div>
  </div>

  <div><span class="status">${esc(statusLabel)}</span></div>
  ${deltaBlock}

  <h2>Priority next steps</h2>
  <ul>${actions}</ul>

  <div class="foot">
    Readiness reflects human-verified evidence only. Generated by alka<b>tera</b> on ${esc(d.generatedAt)}. Not a B Lab certification decision.
  </div>
</body></html>`;
}
