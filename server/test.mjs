// Schnelltest:  node --test server/test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'einkauf-'));
const PORT = 18000 + Math.floor(Math.random() * 1000);
const BASE = `http://127.0.0.1:${PORT}`;
const PIN = '4711';
let proc;

const api = (p, { method = 'GET', body, pin = PIN, raw, type } = {}) => fetch(BASE + '/api/einkauf' + p, {
  method,
  headers: { ...(pin ? { 'x-team-pin': pin } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}), ...(type ? { 'Content-Type': type } : {}) },
  body: raw ?? (body ? JSON.stringify(body) : undefined),
});

before(async () => {
  proc = spawn(process.execPath, [path.join(here, 'server.mjs')], { env: { ...process.env, PORT, DATA_DIR: DATA, TEAM_PIN: PIN }, stdio: 'pipe' });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(BASE + '/api/einkauf/ping')).ok) return; } catch { /* startet noch */ }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('server did not start');
});
after(() => { proc.kill(); fs.rmSync(DATA, { recursive: true, force: true }); });

test('website still served', async () => {
  const r = await fetch(BASE + '/');
  assert.equal(r.status, 200);
  assert.match(await r.text(), /THE BAKERY/);
  assert.equal((await fetch(BASE + '/assets/css/style.css')).headers.get('content-type'), 'text/css; charset=utf-8');
  const e = await fetch(BASE + '/einkauf', { redirect: 'manual' });
  assert.equal(e.status, 301);
  const page = await fetch(BASE + '/einkauf/');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(page.headers.get('x-robots-tag'), 'noindex, nofollow');
});

test('no path traversal or dotfiles', async () => {
  for (const p of ['/../server/server.mjs', '/%2e%2e/server/server.mjs', '/..%2fserver%2fserver.mjs', '/.git/config']) {
    const r = await fetch(BASE + p);
    assert.notEqual(r.status, 200, p);
  }
});

test('PIN required', async () => {
  assert.equal((await api('/state', { pin: '' })).status, 401);
  assert.equal((await api('/state', { pin: '0000' })).status, 401);
  assert.equal((await api('/state')).status, 200);
});

test('need → list → done → reopen → remove', async () => {
  let s = await (await api('/state')).json();
  assert.ok(s.items.length >= 40);
  assert.ok(s.items.find(i => i.id === 'tomaten'));

  s = await (await api('/need', { method: 'POST', body: { item: 'tomaten', qty: '2,5', unit: 'kg', by: 'Sara', note: 'reif' } })).json();
  let open = s.requests.filter(r => r.st === 'open');
  assert.equal(open.length, 1);
  assert.equal(open[0].qty, 2.5);

  // nochmal = Menge ändern, nicht doppelt
  s = await (await api('/need', { method: 'POST', body: { item: 'tomaten', qty: 4, unit: 'kg', by: 'Ali' } })).json();
  open = s.requests.filter(r => r.st === 'open');
  assert.equal(open.length, 1);
  assert.equal(open[0].qty, 4);
  assert.equal(open[0].by, 'Ali');

  const id = open[0].id;
  s = await (await api('/done', { method: 'POST', body: { id, by: 'Chef' } })).json();
  assert.equal(s.requests.find(r => r.id === id).st, 'done');
  assert.equal(s.requests.find(r => r.id === id).doneBy, 'Chef');

  s = await (await api('/reopen', { method: 'POST', body: { id } })).json();
  assert.equal(s.requests.find(r => r.id === id).st, 'open');

  s = await (await api('/remove', { method: 'POST', body: { id } })).json();
  assert.equal(s.requests.filter(r => r.st === 'open').length, 0);

  // unveränderte Version → kurze Antwort
  const v = s.v;
  const same = await (await api('/state?v=' + v)).json();
  assert.deepEqual(same, { v, same: true });
});

test('bad input rejected', async () => {
  assert.equal((await api('/need', { method: 'POST', body: { item: 'nope', qty: 1, unit: 'kg' } })).status, 400);
  assert.equal((await api('/need', { method: 'POST', body: { item: 'eier', qty: 0, unit: 'stk' } })).status, 400);
  assert.equal((await api('/need', { method: 'POST', body: { item: 'eier', qty: 1, unit: 'tons' } })).status, 400);
  assert.equal((await api('/need', { method: 'POST', raw: 'item=eier', type: 'application/x-www-form-urlencoded' })).status, 415);
});

test('custom item, edit, photo', async () => {
  let s = await (await api('/item', { method: 'POST', body: { name: 'Hafermilch', cat: 'drinks', unit: 'l', lang: 'de' } })).json();
  const it = s.items.find(i => i.id === s.id);
  assert.equal(it.name.de, 'Hafermilch');
  assert.equal(it.unit, 'l');

  s = await (await api('/edit', { method: 'POST', body: { id: 'gouda', hidden: true, unit: 'kg' } })).json();
  const g = s.items.find(i => i.id === 'gouda');
  assert.equal(g.hidden, true); assert.equal(g.unit, 'kg');

  assert.equal((await api('/photo/gouda', { method: 'PUT', raw: Buffer.from('not a jpeg at all'.repeat(10)), type: 'image/jpeg' })).status, 400);
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(200)]);
  s = await (await api('/photo/gouda', { method: 'PUT', raw: jpeg, type: 'image/jpeg' })).json();
  const photo = s.items.find(i => i.id === 'gouda').photo;
  assert.match(photo, /^\/api\/einkauf\/photo\/gouda-[a-f0-9]+\.jpg$/);
  const img = await fetch(BASE + photo);
  assert.equal(img.status, 200);
  assert.equal(img.headers.get('content-type'), 'image/jpeg');
});

test('data survives restart', async () => {
  await api('/need', { method: 'POST', body: { item: 'eier', qty: 3, unit: 'karton', by: 'Sara' } });
  proc.kill('SIGTERM');
  await new Promise(r => proc.once('exit', r));
  proc = spawn(process.execPath, [path.join(here, 'server.mjs')], { env: { ...process.env, PORT, DATA_DIR: DATA, TEAM_PIN: PIN }, stdio: 'pipe' });
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(BASE + '/api/einkauf/ping')).ok) break; } catch { /* startet noch */ }
    await new Promise(r => setTimeout(r, 100));
  }
  const s = await (await api('/state')).json();
  assert.ok(s.requests.find(r => r.item === 'eier' && r.st === 'open' && r.qty === 3));
  assert.ok(s.items.find(i => i.name.de === 'Hafermilch'));
});

test('urgent, not found, price, history, most ordered', async () => {
  const post = (p, body) => api(p, { method: 'POST', body }).then(r => r.json());
  let s = await post('/need', { item: 'reis', qty: 5, unit: 'kg', by: 'Ali', urgent: true, dev: 'phone-a' });
  let r = s.requests.find(x => x.item === 'reis' && x.st === 'open');
  assert.equal(r.urgent, true);
  assert.equal(r.dev, undefined, 'device id stays on the server');

  s = await post('/notfound', { id: r.id, by: 'Chef' });
  assert.equal(s.requests.find(x => x.id === r.id).nf.by, 'Chef');
  s = await post('/notfound', { id: r.id, on: false });
  assert.equal(s.requests.find(x => x.id === r.id).nf, undefined);

  assert.equal((await api('/price', { method: 'POST', body: { id: r.id, price: 3 } })).status, 404, 'price only after buying');
  await post('/done', { id: r.id, by: 'Chef' });
  s = await post('/price', { id: r.id, price: '12,40' });
  assert.equal(s.requests.find(x => x.id === r.id).price, 12.4);
  assert.equal((await api('/price', { method: 'POST', body: { id: r.id, price: -1 } })).status, 400);

  const now = Date.now();
  const h = await (await api(`/history?from=${now - 864e5}&to=${now + 1000}`)).json();
  assert.ok(h.requests.find(x => x.id === r.id && x.price === 12.4));
  assert.equal((await api(`/history?from=0&to=${now}`)).status, 400, 'range too long');

  // zweimal eingetragen → taucht bei „Am häufigsten“ auf
  s = await post('/need', { item: 'reis', qty: 2, unit: 'kg' });
  assert.ok(s.top.includes('reis'));
});

test('push: subscribe only to real push services', async () => {
  const key = await (await api('/push/key')).json();
  assert.equal(Buffer.from(key.key, 'base64url').length, 65);
  const keys = { p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 1)]).toString('base64url'), auth: Buffer.alloc(16, 2).toString('base64url') };
  for (const endpoint of ['http://127.0.0.1:1/x', 'https://evil.example/push', 'https://fcm.googleapis.com.evil.example/x'])
    assert.equal((await api('/subscribe', { method: 'POST', body: { sub: { endpoint, keys } } })).status, 400, endpoint);
  assert.equal((await api('/subscribe', { method: 'POST', body: { sub: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys }, lang: 'ar', daily: true } })).status, 200);
  assert.equal((await api('/unsubscribe', { method: 'POST', body: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc' } })).status, 200);
});

test('push encryption matches RFC 8291 example', async () => {
  const crypto = await import('node:crypto');
  const { encrypt } = await import('./push.mjs');
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.setPrivateKey(Buffer.from('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw', 'base64url'));
  const out = encrypt('When I grow up, I want to be a watermelon',
    'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', 'BTBZMqHH6r4Tts7J_aSIgg',
    { salt: Buffer.from('DGv6ra1nlYgDCS1FRnbzlw', 'base64url'), ecdh });
  assert.equal(out.toString('base64url'), 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN');
});

test('PIN brute force is slowed down', async () => {
  let last;
  for (let i = 0; i < 10; i++) last = (await api('/state', { pin: 'x' + i })).status;
  assert.equal(last, 429);
});
