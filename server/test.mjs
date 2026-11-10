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

test('PIN brute force is slowed down', async () => {
  let last;
  for (let i = 0; i < 10; i++) last = (await api('/state', { pin: 'x' + i })).status;
  assert.equal(last, 429);
});
