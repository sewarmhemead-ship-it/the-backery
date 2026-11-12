// ============================================================
// Einkaufsliste als E-Mail. Railway lässt kein SMTP nach draußen,
// deshalb über die HTTP-Schnittstelle von Resend (resend.com):
//   RESEND_API_KEY  Schlüssel aus dem Resend-Konto
//   MAIL_FROM       Absender, z. B. "THE BAKERY <liste@deine-domain.at>"
//                   (ohne eigene Domain: onboarding@resend.dev, das stellt
//                   nur an die Adresse des Resend-Kontos zu)
// ============================================================
import { MAIL_TEXT, UNITS, CATEGORIES } from './catalog.mjs';

const API_URL = process.env.MAIL_API_URL || 'https://api.resend.com/emails';
export const mailReady = () => Boolean(process.env.RESEND_API_KEY);
export const validEmail = s => /^[^\s@<>"',;]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(s) && s.length <= 120;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const plain = s => String(s).replace(/­/g, '');

// open: offene Einträge, items: alle Artikel (mit Namen in allen Sprachen)
export function buildList(open, items, lang, origin, planned = []) {
  const L = MAIL_TEXT[lang] || MAIL_TEXT.de;
  const byId = new Map(items.map(i => [i.id, i]));
  const name = (it, l) => plain(it.name[l] || it.name.de || Object.values(it.name)[0] || '?');
  const qty = r => `${String(r.qty).replace('.', lang === 'en' ? '.' : ',')} ${UNITS[r.unit]?.[lang] || r.unit}`;
  const rows = open.filter(r => byId.has(r.item)).map(r => {
    const it = byId.get(r.item);
    const de = lang !== 'de' && it.name.de && name(it, 'de') !== name(it, lang) ? name(it, 'de') : '';
    return { r, it, name: name(it, lang), de, qty: qty(r) };
  });
  const groups = [];
  const urgent = rows.filter(x => x.r.urgent);
  if (urgent.length) groups.push({ title: L.urgent, urgent: true, rows: urgent });
  for (const c of CATEGORIES) {
    const g = rows.filter(x => !x.r.urgent && x.it.cat === c.id);
    if (g.length) groups.push({ title: c.name[lang] || c.name.de, rows: g });
  }
  const plan = planned.filter(p => byId.has(p.item)).map(p => ({ r: p, it: byId.get(p.item), name: name(byId.get(p.item), lang), de: '', qty: qty(p) }));
  if (plan.length) groups.push({ title: L.tomorrow, rows: plan, later: true });
  const n = rows.length;
  const link = origin ? `${origin}/einkauf/#liste` : '';
  const date = new Intl.DateTimeFormat({ de: 'de-AT', en: 'en-GB', it: 'it-IT', ar: 'ar-u-nu-latn' }[lang] || 'de-AT',
    { timeZone: 'Europe/Vienna', weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const subject = `THE BAKERY · ${L.title} (${n})`;

  const text = [`THE BAKERY · ${L.title}`, date];
  for (const g of groups) {
    text.push('', g.title.toUpperCase());
    for (const x of g.rows) {
      text.push(`- ${x.name}: ${x.qty}${x.r.note ? ` (${plain(x.r.note)})` : ''}${x.r.nf ? ` [${L.nf}]` : ''}${x.de ? `  / ${x.de}` : ''}`);
    }
  }
  if (link) text.push('', `${L.open}: ${link}`);
  if (!rows.length && plan.length) text.splice(2, 0, '', L.nothingNow);

  const dir = lang === 'ar' ? 'rtl' : 'ltr', end = lang === 'ar' ? 'left' : 'right', start = lang === 'ar' ? 'right' : 'left';
  const html = `<!doctype html><html lang="${lang}" dir="${dir}"><body style="margin:0;padding:24px 12px;background:#EEF4F6;font-family:Arial,Helvetica,sans-serif;color:#2A1218">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #D9E3E6;border-radius:10px">
<tr><td style="padding:20px 22px 14px;border-bottom:3px solid #730F23">
<div style="font-size:13px;font-weight:bold;letter-spacing:1px;color:#730F23">THE BAKERY</div>
<div style="font-size:22px;font-weight:bold;margin-top:2px">${esc(L.title)}</div>
<div style="font-size:14px;color:#6B5A5E;margin-top:2px">${esc(date)} · ${esc(L.count.replace('{n}', n))}</div></td></tr>
${groups.map(g => `<tr><td style="padding:16px 22px 0">
<div style="font-size:13px;font-weight:bold;color:${g.urgent ? '#B3122E' : '#730F23'};padding-bottom:4px">${esc(g.title)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${g.rows.map(x => `<tr>
<td style="padding:8px 0;border-top:1px solid #E6ECEE;font-size:16px;text-align:${start}">${esc(x.name)}${x.de ? `<div style="font-size:13px;color:#6B5A5E" dir="ltr">${esc(x.de)}</div>` : ''}${x.r.note ? `<div style="font-size:13px;color:#6B5A5E">${esc(plain(x.r.note))}</div>` : ''}${x.r.nf ? `<div style="font-size:13px;color:#B3122E">${esc(L.nf)}</div>` : ''}</td>
<td style="padding:8px 0;border-top:1px solid #E6ECEE;font-size:16px;font-weight:bold;white-space:nowrap;vertical-align:top;text-align:${end}">${esc(x.qty)}</td></tr>`).join('')}</table></td></tr>`).join('\n')}
<tr><td style="padding:22px">${link ? `<a href="${esc(link)}" style="display:inline-block;background:#730F23;color:#fff;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 18px;border-radius:8px">${esc(L.open)}</a>` : ''}</td></tr>
</table></body></html>`;
  return { subject, text: text.join('\n'), html, count: n };
}

export async function sendMail(to, { subject, text, html }) {
  if (!mailReady()) throw new Error('mail not configured');
  const r = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM || 'THE BAKERY <onboarding@resend.dev>', to: [to], subject, text, html }),
    signal: AbortSignal.timeout(15e3),
  });
  if (!r.ok) throw new Error(`mail ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`);
  return true;
}
