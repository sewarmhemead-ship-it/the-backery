// ============================================================
// THE BAKERY: kleiner Server ohne Abhängigkeiten.
//  1. liefert die Website (site-v2) aus, wie vorher Caddy
//  2. /einkauf/  Nachschub-Liste fürs Team: was fehlt, wie viel,
//     wer hat's eingetragen, abhaken wenn gekauft
// Daten liegen in DATA_DIR/einkauf.json (+ Fotos in DATA_DIR/photos).
// Auf Railway muss dort ein Volume hängen, sonst ist die Liste nach
// jedem Deploy leer.  TEAM_PIN setzen = nur wer den PIN kennt, darf rein.
// ============================================================
import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, UNITS, DEFAULT_ITEMS, PUSH_TEXT, LANGS } from './catalog.mjs';
import { loadVapid, sendPush, pushAllowed } from './push.mjs';
import { buildList, sendMail, mailReady, validEmail } from './mail.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATIC_DIR = path.resolve(process.env.STATIC_DIR || path.join(ROOT, 'site-v2'));
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const PHOTO_DIR = path.join(DATA_DIR, 'photos');
const DB_FILE = path.join(DATA_DIR, 'einkauf.json');
const PORT = Number(process.env.PORT) || 8080;
const TEAM_PIN = String(process.env.TEAM_PIN || '').trim();

const KEEP_DONE_DAYS = 800;          // Archiv + Monatsbericht: gut 2 Jahre
const MAX_REQUESTS = 30000;
const RECENT_DONE_DAYS = 3;          // so viel Gekauftes schickt /state mit
const TOP_DAYS = 60, TOP_N = 8;      // „Am häufigsten“: die letzten 60 Tage
const DAILY_HOUR = 20;               // tägliche Zusammenfassung, Wiener Zeit
const MAX_SUBS = 200;
const MAX_CUSTOM_ITEMS = 300;
const MAX_JSON = 16 * 1024;
const MAX_PHOTO = 3 * 1024 * 1024;

const CAT_IDS = new Set(CATEGORIES.map(c => c.id));
const DEFAULT_IDS = new Set(DEFAULT_ITEMS.map(i => i.id));

// ---------------------------------------------------------------- Daten
fs.mkdirSync(PHOTO_DIR, { recursive: true });

function emptyDb() { return { v: 1, custom: [], edits: {}, requests: [], subs: [], lastDaily: '', origin: '', boss: null }; }

function loadDb() {
  try {
    const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return {
      v: Number.isInteger(raw.v) ? raw.v : 1,
      custom: Array.isArray(raw.custom) ? raw.custom : [],
      edits: raw.edits && typeof raw.edits === 'object' ? raw.edits : {},
      requests: Array.isArray(raw.requests) ? raw.requests : [],
      subs: Array.isArray(raw.subs) ? raw.subs : [],
      lastDaily: typeof raw.lastDaily === 'string' ? raw.lastDaily : '',
      origin: typeof raw.origin === 'string' ? raw.origin : '',
      boss: raw.boss && typeof raw.boss === 'object' ? raw.boss : null,
    };
  } catch (e) {
    if (e.code !== 'ENOENT') {
      // kaputte Datei nicht überschreiben, sondern zur Seite legen
      const aside = `${DB_FILE}.broken-${Date.now()}`;
      try { fs.renameSync(DB_FILE, aside); } catch { /* egal */ }
      console.error('einkauf.json unreadable, moved to', aside, e.message);
    }
    return emptyDb();
  }
}

let db = loadDb();
let lastBackup = 0;

function prune() {
  const cutoff = Date.now() - KEEP_DONE_DAYS * 864e5;
  db.requests = db.requests.filter(r => r.st === 'open' || (r.doneAt || 0) > cutoff);
  if (db.requests.length > MAX_REQUESTS) db.requests = db.requests.slice(-MAX_REQUESTS);
}

// sofort und atomar speichern (Datei ist klein, Änderungen sind selten)
function saveNow() {
  prune();
  const tmp = `${DB_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db));
  // alle 6 Stunden eine Sicherung der vorherigen Version
  if (Date.now() - lastBackup > 6 * 36e5 && fs.existsSync(DB_FILE)) {
    try { fs.copyFileSync(DB_FILE, path.join(DATA_DIR, 'einkauf.backup.json')); lastBackup = Date.now(); } catch { /* egal */ }
  }
  fs.renameSync(tmp, DB_FILE);
}
function changed() {
  db.v += 1;
  saveNow();
}

function allItems() {
  const merge = (it, def) => {
    const e = db.edits[it.id] || {};
    return {
      ...it,
      unit: UNITS[e.unit] ? e.unit : it.unit,
      cat: CAT_IDS.has(e.cat) ? e.cat : it.cat,
      photo: e.photo || null,
      hidden: !!e.hidden,
      def,
    };
  };
  return [...DEFAULT_ITEMS.map(i => merge(i, true)), ...db.custom.map(i => merge(i, false))];
}
const itemExists = id => DEFAULT_IDS.has(id) || db.custom.some(c => c.id === id);

// Was am häufigsten auf die Liste kommt (zählt jedes neue Eintragen)
function topItems() {
  const since = Date.now() - TOP_DAYS * 864e5, n = new Map();
  for (const r of db.requests) if (r.at > since) n.set(r.item, (n.get(r.item) || 0) + 1);
  return [...n].filter(([id, c]) => c >= 2 && itemExists(id)).sort((a, b) => b[1] - a[1]).slice(0, TOP_N).map(([id]) => id);
}

// /state schickt nur Offenes + die letzten Tage, das Archiv kommt über /history
function state() {
  const since = Date.now() - RECENT_DONE_DAYS * 864e5;
  return {
    v: db.v, items: allItems(), cats: CATEGORIES, units: UNITS, top: topItems(),
    requests: db.requests.filter(r => r.st === 'open' || r.doneAt > since).map(publicReq),
    boss: db.boss, mail: mailReady(),
  };
}
const publicReq = ({ dev, ...r }) => r;

// ---------------------------------------------------------------- Prüfen
const clean = (x, max) => String(x ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
function qtyOf(x) {
  const n = Math.round(Number(String(x).replace(',', '.')) * 100) / 100;
  return Number.isFinite(n) && n > 0 && n <= 9999 ? n : null;
}
const newId = (p = '') => p + crypto.randomBytes(6).toString('hex');
class Bad extends Error { constructor(msg, code = 400) { super(msg); this.code = code; } }

// ---------------------------------------------------------------- Aktionen
const actions = {
  need(b) {
    const item = clean(b.item, 40);
    if (!itemExists(item)) throw new Bad('unknown item');
    const qty = qtyOf(b.qty); if (!qty) throw new Bad('bad qty');
    const unit = UNITS[b.unit] ? b.unit : null; if (!unit) throw new Bad('bad unit');
    const note = clean(b.note, 200), by = clean(b.by, 40), dev = clean(b.dev, 40), now = Date.now();
    const urgent = !!b.urgent;
    const open = db.requests.find(r => r.st === 'open' && r.item === item);
    if (open) {
      const nowUrgent = urgent && !open.urgent;
      Object.assign(open, { qty, unit, note, by, upd: now, urgent, dev });
      if (nowUrgent) queueNotify(open, true);
    } else {
      const r = { id: newId('r'), item, qty, unit, note, by, at: now, upd: now, st: 'open', urgent, dev };
      db.requests.push(r);
      queueNotify(r, urgent);
    }
  },
  // „Nicht gefunden“: bleibt auf der Liste, nur markiert
  notfound(b) {
    const r = db.requests.find(x => x.id === b.id && x.st === 'open');
    if (!r) throw new Bad('not found', 404);
    if (b.on === false) delete r.nf;
    else r.nf = { at: Date.now(), by: clean(b.by, 40) };
  },
  // Preis eines Einkaufs (Gesamtbetrag dieser Zeile, Euro), auch nachträglich
  price(b) {
    const r = db.requests.find(x => x.id === b.id && x.st === 'done');
    if (!r) throw new Bad('not found', 404);
    if (b.price === null || b.price === '') { delete r.price; return; }
    const p = Math.round(Number(String(b.price).replace(',', '.')) * 100) / 100;
    if (!Number.isFinite(p) || p < 0 || p > 99999) throw new Bad('bad price');
    r.price = p;
  },
  remove(b) {
    const i = db.requests.findIndex(r => r.id === b.id && r.st === 'open');
    if (i < 0) throw new Bad('not found', 404);
    db.requests.splice(i, 1);
  },
  done(b) {
    const r = db.requests.find(x => x.id === b.id);
    if (!r) throw new Bad('not found', 404);
    if (r.st !== 'open') return;
    Object.assign(r, { st: 'done', doneAt: Date.now(), doneBy: clean(b.by, 40) });
    delete r.nf;
  },
  reopen(b) {
    const r = db.requests.find(x => x.id === b.id);
    if (!r) throw new Bad('not found', 404);
    if (r.st === 'open') return;
    // steht derselbe Artikel schon wieder offen drauf, nichts doppelt anlegen
    if (db.requests.some(x => x.st === 'open' && x.item === r.item)) { db.requests = db.requests.filter(x => x !== r); return; }
    r.st = 'open'; r.upd = Date.now(); delete r.doneAt; delete r.doneBy; delete r.price;
  },
  // Handy für Benachrichtigungen anmelden / Einstellungen ändern
  subscribe(b, req) {
    const s = b.sub || {};
    const endpoint = String(s.endpoint || '');
    if (endpoint.length > 1000 || !pushAllowed(endpoint)) throw new Bad('bad endpoint');
    const p256dh = clean(s.keys?.p256dh, 200), auth = clean(s.keys?.auth, 60);
    if (Buffer.from(p256dh, 'base64url').length !== 65 || Buffer.from(auth, 'base64url').length !== 16) throw new Bad('bad keys');
    const rec = {
      endpoint, keys: { p256dh, auth },
      lang: LANGS.includes(b.lang) ? b.lang : 'de', each: b.each !== false, daily: !!b.daily,
      dev: clean(b.dev, 40), name: clean(b.name, 40), at: Date.now(),
    };
    db.subs = db.subs.filter(x => x.endpoint !== endpoint && (!rec.dev || x.dev !== rec.dev));
    if (db.subs.length >= MAX_SUBS) db.subs.shift();
    db.subs.push(rec);
    rememberOrigin(req);
  },
  // Empfänger der Liste (Chef/Chefin): WhatsApp-Nummer und/oder E-Mail
  boss(b, req) {
    let wa = String(b.wa ?? '').replace(/[\s()./-]/g, '').replace(/^\+/, '').replace(/^00/, '');
    if (wa && !/^[1-9]\d{6,14}$/.test(wa)) throw new Bad('bad number');
    const email = clean(b.email, 120).toLowerCase();
    if (email && !validEmail(email)) throw new Bad('bad email');
    db.boss = {
      name: clean(b.name, 40), wa, email,
      lang: LANGS.includes(b.lang) ? b.lang : 'de', auto: !!b.auto && !!email,
    };
    rememberOrigin(req);
  },
  unsubscribe(b) {
    const endpoint = String(b.endpoint || ''), dev = clean(b.dev, 40);
    db.subs = db.subs.filter(x => x.endpoint !== endpoint && (!dev || x.dev !== dev));
  },
  item(b) {
    const name = clean(b.name, 60); if (!name) throw new Bad('name missing');
    const cat = CAT_IDS.has(b.cat) ? b.cat : null; if (!cat) throw new Bad('bad category');
    const unit = UNITS[b.unit] ? b.unit : 'stk';
    if (db.custom.length >= MAX_CUSTOM_ITEMS) throw new Bad('too many items');
    const lang = ['de', 'en', 'it', 'ar'].includes(b.lang) ? b.lang : 'de';
    const it = { id: newId('c-'), cat, unit, img: '_neu', name: { [lang]: name } };
    db.custom.push(it);
    return { id: it.id };
  },
  edit(b) {
    const id = clean(b.id, 40); if (!itemExists(id)) throw new Bad('unknown item');
    const e = db.edits[id] || (db.edits[id] = {});
    if (b.unit !== undefined) { if (!UNITS[b.unit]) throw new Bad('bad unit'); e.unit = b.unit; }
    if (b.cat !== undefined) { if (!CAT_IDS.has(b.cat)) throw new Bad('bad category'); e.cat = b.cat; }
    if (b.hidden !== undefined) e.hidden = !!b.hidden;
    if (b.resetPhoto) { dropPhoto(e.photo); delete e.photo; }
    if (b.name !== undefined && !DEFAULT_IDS.has(id)) {
      const name = clean(b.name, 60); if (!name) throw new Bad('name missing');
      const c = db.custom.find(x => x.id === id);
      const lang = ['de', 'en', 'it', 'ar'].includes(b.lang) ? b.lang : 'de';
      c.name = { ...c.name, [lang]: name };
    }
  },
};

function dropPhoto(url) {
  const f = url && /^[a-z0-9-]+\.jpg$/.test(path.basename(url)) ? path.join(PHOTO_DIR, path.basename(url)) : null;
  if (f) fsp.unlink(f).catch(() => {});
}

// ---------------------------------------------------------------- Benachrichtigungen
const vapid = loadVapid(DATA_DIR);
const pushSubject = () => process.env.VAPID_SUBJECT
  || (db.origin.startsWith('https://') ? db.origin : 'mailto:nachschub@the-bakery.at');
function rememberOrigin(req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || 'http';
  if (/^[a-z0-9.-]+(:\d+)?$/i.test(host)) db.origin = `${proto}://${host}`;
}

const nameFor = (id, lang) => {
  const it = allItems().find(i => i.id === id);
  const n = it ? (it.name[lang] || it.name.de || Object.values(it.name)[0]) : id;
  return String(n).replace(/­/g, '');
};
const lineFor = (r, lang) => {
  const q = String(r.qty).replace('.', lang === 'de' || lang === 'it' ? ',' : '.');
  return `${nameFor(r.item, lang)} ${q} ${UNITS[r.unit]?.[lang] || r.unit}`;
};

async function pushTo(sub, payload, urgency) {
  try {
    const status = await sendPush(vapid, pushSubject(), sub, payload, { urgency });
    if (status === 404 || status === 410) {           // Handy hat sich abgemeldet
      db.subs = db.subs.filter(s => s.endpoint !== sub.endpoint); changed();
    } else if (status >= 400) console.error('push failed', status, new URL(sub.endpoint).hostname);
    return status;
  } catch (e) { console.error('push error', e.message); return 0; }
}

// Neue Einträge kurz sammeln (45 s), dann eine Nachricht. Dringendes sofort.
let pending = [], pendingTimer = null;
function queueNotify(r, urgent) {
  pending.push({ id: r.id, urgent });
  if (urgent) setImmediate(flushNotify);
  else if (!pendingTimer) pendingTimer = setTimeout(flushNotify, Number(process.env.PUSH_DELAY_MS) || 45e3);
}
function flushNotify() {
  clearTimeout(pendingTimer); pendingTimer = null;
  const batch = pending; pending = [];
  const urgent = batch.some(b => b.urgent);
  const reqs = [...new Set(batch.map(b => b.id))].map(id => db.requests.find(r => r.id === id && r.st === 'open')).filter(Boolean);
  if (!reqs.length) return;
  for (const s of db.subs.filter(x => x.each)) {
    const mine = reqs.filter(r => !s.dev || r.dev !== s.dev);   // eigene Einträge nicht melden
    if (!mine.length) continue;
    const L = PUSH_TEXT[s.lang] || PUSH_TEXT.de;
    const body = (urgent ? L.urgent : L.added).replace('{names}', mine.map(r => lineFor(r, s.lang)).join(', '));
    pushTo(s, { title: L.title, body, url: '/einkauf/#liste', tag: 'einkauf-neu' }, urgent ? 'high' : 'normal');
  }
}

// Liste per E-Mail an den gespeicherten Empfänger
let lastMail = 0;
async function mailList() {
  const b = db.boss;
  if (!b?.email) throw new Bad('no recipient');
  if (!mailReady()) throw new Bad('mail not configured', 503);
  const open = db.requests.filter(r => r.st === 'open').sort((x, y) => x.at - y.at);
  if (!open.length) throw new Bad('list empty');
  await sendMail(b.email, buildList(open, allItems(), b.lang, db.origin));
  lastMail = Date.now();
}

// Tägliche Zusammenfassung um 20 Uhr Wiener Zeit
const viennaNow = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
};
function dailyCheck() {
  const { day, hour } = viennaNow();
  if (hour < DAILY_HOUR || db.lastDaily === day) return;
  db.lastDaily = day; changed();
  const open = db.requests.filter(r => r.st === 'open');
  if (!open.length) return;
  if (db.boss?.auto && db.boss.email && mailReady()) mailList().catch(e => console.error('daily mail failed', e.message));
  for (const s of db.subs.filter(x => x.daily)) {
    const L = PUSH_TEXT[s.lang] || PUSH_TEXT.de;
    const names = open.slice(0, 12).map(r => lineFor(r, s.lang)).join(', ') + (open.length > 12 ? ' …' : '');
    pushTo(s, { title: L.title, body: L.daily.replace('{n}', open.length).replace('{names}', names), url: '/einkauf/#liste', tag: 'einkauf-tag' });
  }
}
setInterval(dailyCheck, 60e3).unref();

// ---------------------------------------------------------------- HTTP-Helfer
const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};
function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SEC_HEADERS, ...headers });
  res.end(body);
}
function json(res, status, obj) {
  send(res, status, JSON.stringify(obj), {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow',
  });
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new Bad('too large', 413)); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// PIN: falsche Versuche pro IP bremsen
const fails = new Map();
const ipOf = req => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';
function pinOk(req) {
  if (!TEAM_PIN) return true;
  const ip = ipOf(req), now = Date.now();
  const f = fails.get(ip);
  if (f && now - f.t > 15 * 60e3) fails.delete(ip);
  if ((fails.get(ip)?.n || 0) >= 8) throw new Bad('too many tries', 429);
  const given = Buffer.from(String(req.headers['x-team-pin'] || ''));
  const want = Buffer.from(TEAM_PIN);
  const ok = given.length === want.length && crypto.timingSafeEqual(given, want);
  if (!ok) {
    const g = fails.get(ip) || { n: 0, t: now };
    g.n += 1; fails.set(ip, g);
  } else fails.delete(ip);
  return ok;
}

// ---------------------------------------------------------------- API
async function api(req, res, url) {
  const p = url.pathname.slice('/api/einkauf'.length);

  if (p === '/ping') return json(res, 200, { ok: true });

  // Fotos: Dateinamen sind zufällig, deshalb ohne PIN abrufbar (für <img>)
  const pm = p.match(/^\/photo\/([a-z0-9-]+\.jpg)$/);
  if (pm && (req.method === 'GET' || req.method === 'HEAD')) {
    const f = path.join(PHOTO_DIR, pm[1]);
    try {
      const buf = await fsp.readFile(f);
      return send(res, 200, req.method === 'HEAD' ? undefined : buf, {
        'Content-Type': 'image/jpeg', 'Content-Length': buf.length, 'Cache-Control': 'public, max-age=31536000, immutable',
      });
    } catch { return json(res, 404, { error: 'not found' }); }
  }

  if (!pinOk(req)) return json(res, 401, { error: 'pin' });

  if (p === '/state' && req.method === 'GET') {
    if (Number(url.searchParams.get('v')) === db.v) return json(res, 200, { v: db.v, same: true });
    return json(res, 200, state());
  }

  // Archiv / Monatsbericht: gekaufte Einträge in einem Zeitraum (max. 2 Monate)
  if (p === '/history' && req.method === 'GET') {
    const from = Number(url.searchParams.get('from')), to = Number(url.searchParams.get('to'));
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > 63 * 864e5) throw new Bad('bad range');
    return json(res, 200, { requests: db.requests.filter(r => r.st === 'done' && r.doneAt >= from && r.doneAt < to).map(publicReq) });
  }

  if (p === '/push/key' && req.method === 'GET') return json(res, 200, { key: vapid.publicKey });

  if (p === '/push/test' && req.method === 'POST') {
    let body;
    try { body = JSON.parse((await readBody(req, MAX_JSON)).toString('utf8') || '{}'); } catch { throw new Bad('bad json'); }
    const s = db.subs.find(x => x.endpoint === body?.endpoint);
    if (!s) throw new Bad('not subscribed', 404);
    const L = PUSH_TEXT[s.lang] || PUSH_TEXT.de;
    const status = await pushTo(s, { title: L.title, body: L.test, url: '/einkauf/', tag: 'einkauf-test' }, 'high');
    return json(res, 200, { status });
  }

  if (p === '/send/email' && req.method === 'POST') {
    if (Date.now() - lastMail < 30e3) throw new Bad('too fast', 429);
    rememberOrigin(req);
    try { await mailList(); } catch (e) {
      if (e instanceof Bad) throw e;
      console.error('mail failed', e.message);
      throw new Bad('mail failed', 502);
    }
    return json(res, 200, { ok: true, to: db.boss.email });
  }

  const um = p.match(/^\/photo\/([a-z0-9-]{1,40})$/);
  if (um && req.method === 'PUT') {
    const id = um[1];
    if (!itemExists(id)) throw new Bad('unknown item');
    const buf = await readBody(req, MAX_PHOTO);
    if (buf.length < 100 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) throw new Bad('jpeg only');
    const name = `${id}-${crypto.randomBytes(8).toString('hex')}.jpg`;
    await fsp.writeFile(path.join(PHOTO_DIR, name), buf);
    const e = db.edits[id] || (db.edits[id] = {});
    dropPhoto(e.photo);
    e.photo = `/api/einkauf/photo/${name}`;
    changed();
    return json(res, 200, state());
  }

  const am = p.match(/^\/(need|remove|done|reopen|item|edit|notfound|price|subscribe|unsubscribe|boss)$/);
  if (am && req.method === 'POST') {
    if (!String(req.headers['content-type'] || '').includes('application/json')) throw new Bad('json only', 415);
    let body;
    try { body = JSON.parse((await readBody(req, MAX_JSON)).toString('utf8') || '{}'); } catch (e) { if (e instanceof Bad) throw e; throw new Bad('bad json'); }
    if (!body || typeof body !== 'object') throw new Bad('bad json');
    const extra = actions[am[1]](body, req);
    changed();
    return json(res, 200, { ...state(), ...(extra || {}) });
  }

  return json(res, 404, { error: 'not found' });
}

// ---------------------------------------------------------------- Website
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8',
  '.mp4': 'video/mp4', '.pdf': 'application/pdf',
};
const COMPRESS = new Set(['.html', '.css', '.js', '.mjs', '.json', '.svg', '.webmanifest', '.txt', '.xml']);
const gzCache = new Map();

const EINKAUF_CSP = [
  "default-src 'self'", "img-src 'self' blob: data:", "style-src 'self' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com", "script-src 'self'", "connect-src 'self'", "manifest-src 'self'",
  "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'",
].join('; ');

async function serveStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', { Allow: 'GET, HEAD' });
  let rel;
  try { rel = decodeURIComponent(url.pathname); } catch { return send(res, 400, 'Bad request'); }
  if (rel.includes('\0') || rel.split('/').some(s => s.startsWith('.') && s.length > 0)) return notFound(res);
  let file = path.join(STATIC_DIR, path.normalize(rel));
  if (file !== STATIC_DIR && !file.startsWith(STATIC_DIR + path.sep)) return notFound(res);

  let st;
  try { st = await fsp.stat(file); } catch { return notFound(res); }
  if (st.isDirectory()) {
    if (!url.pathname.endsWith('/')) return send(res, 301, '', { Location: url.pathname + '/' + url.search });
    file = path.join(file, 'index.html');
    try { st = await fsp.stat(file); } catch { return notFound(res); }
  }
  if (!st.isFile()) return notFound(res);

  const ext = path.extname(file).toLowerCase();
  const etag = `W/"${st.size.toString(36)}-${Math.floor(st.mtimeMs).toString(36)}"`;
  const inEinkauf = rel.startsWith('/einkauf/');
  const headers = {
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Cache-Control': ext === '.html' || ext === '.webmanifest' || (inEinkauf && ext !== '.webp') ? 'no-cache' : 'public, max-age=3600',
    ETag: etag,
  };
  if (inEinkauf) headers['X-Robots-Tag'] = 'noindex, nofollow';
  if (inEinkauf && ext === '.html') { headers['Content-Security-Policy'] = EINKAUF_CSP; headers['X-Frame-Options'] = 'DENY'; }
  if (req.headers['if-none-match'] === etag) return send(res, 304, undefined, headers);

  let body = await fsp.readFile(file);
  if (COMPRESS.has(ext) && body.length > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    const key = file + etag;
    if (!gzCache.has(key)) gzCache.set(key, zlib.gzipSync(body, { level: 9 }));
    body = gzCache.get(key);
    headers['Content-Encoding'] = 'gzip';
    headers.Vary = 'Accept-Encoding';
  }
  headers['Content-Length'] = body.length;
  send(res, 200, req.method === 'HEAD' ? undefined : body, headers);
}
function notFound(res) { send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' }); }

// ---------------------------------------------------------------- Start
const server = http.createServer(async (req, res) => {
  let url;
  try { url = new URL(req.url, 'http://x'); } catch { return send(res, 400, 'Bad request'); }
  try {
    if (url.pathname === '/einkauf') return send(res, 301, '', { Location: '/einkauf/' + url.search });
    if (url.pathname.startsWith('/api/einkauf/') || url.pathname === '/api/einkauf') return await api(req, res, url);
    return await serveStatic(req, res, url);
  } catch (e) {
    if (res.headersSent) { res.destroy(); return; }
    if (e instanceof Bad) return json(res, e.code, { error: e.message });
    console.error(e);
    return json(res, 500, { error: 'server error' });
  }
});
server.requestTimeout = 30e3;

function shutdown() {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.listen(PORT, () => {
  console.log(`the.bakery on :${PORT}  static=${STATIC_DIR}  data=${DATA_DIR}  pin=${TEAM_PIN ? 'on' : 'off'}`);
});
