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
import { CATEGORIES, UNITS, DEFAULT_ITEMS } from './catalog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATIC_DIR = path.resolve(process.env.STATIC_DIR || path.join(ROOT, 'site-v2'));
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const PHOTO_DIR = path.join(DATA_DIR, 'photos');
const DB_FILE = path.join(DATA_DIR, 'einkauf.json');
const PORT = Number(process.env.PORT) || 8080;
const TEAM_PIN = String(process.env.TEAM_PIN || '').trim();

const KEEP_DONE_DAYS = 30;
const MAX_REQUESTS = 3000;
const MAX_CUSTOM_ITEMS = 300;
const MAX_JSON = 16 * 1024;
const MAX_PHOTO = 3 * 1024 * 1024;

const CAT_IDS = new Set(CATEGORIES.map(c => c.id));
const DEFAULT_IDS = new Set(DEFAULT_ITEMS.map(i => i.id));

// ---------------------------------------------------------------- Daten
fs.mkdirSync(PHOTO_DIR, { recursive: true });

function emptyDb() { return { v: 1, custom: [], edits: {}, requests: [] }; }

function loadDb() {
  try {
    const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return {
      v: Number.isInteger(raw.v) ? raw.v : 1,
      custom: Array.isArray(raw.custom) ? raw.custom : [],
      edits: raw.edits && typeof raw.edits === 'object' ? raw.edits : {},
      requests: Array.isArray(raw.requests) ? raw.requests : [],
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

function state() {
  return { v: db.v, items: allItems(), requests: db.requests, cats: CATEGORIES, units: UNITS };
}

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
    const note = clean(b.note, 200), by = clean(b.by, 40), now = Date.now();
    const open = db.requests.find(r => r.st === 'open' && r.item === item);
    if (open) Object.assign(open, { qty, unit, note, by, upd: now });
    else db.requests.push({ id: newId('r'), item, qty, unit, note, by, at: now, upd: now, st: 'open' });
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
  },
  reopen(b) {
    const r = db.requests.find(x => x.id === b.id);
    if (!r) throw new Bad('not found', 404);
    if (r.st === 'open') return;
    // steht derselbe Artikel schon wieder offen drauf, nichts doppelt anlegen
    if (db.requests.some(x => x.st === 'open' && x.item === r.item)) { db.requests = db.requests.filter(x => x !== r); return; }
    r.st = 'open'; r.upd = Date.now(); delete r.doneAt; delete r.doneBy;
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

  const am = p.match(/^\/(need|remove|done|reopen|item|edit)$/);
  if (am && req.method === 'POST') {
    if (!String(req.headers['content-type'] || '').includes('application/json')) throw new Bad('json only', 415);
    let body;
    try { body = JSON.parse((await readBody(req, MAX_JSON)).toString('utf8') || '{}'); } catch (e) { if (e instanceof Bad) throw e; throw new Bad('bad json'); }
    if (!body || typeof body !== 'object') throw new Bad('bad json');
    const extra = actions[am[1]](body);
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
