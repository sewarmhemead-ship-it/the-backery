/* ============================================================
   THE BAKERY · Nachschub
   Das Team tippt an, was fehlt und wie viel. Die Liste liegt auf dem
   Server (/api/einkauf), alle Handys holen sie alle paar Sekunden neu.
   Wer einkauft, hakt ab. Keine Bibliotheken, kein Build.
   ============================================================ */
(() => {
  'use strict';
  const T = window.EINKAUF_I18N;
  const $ = (s, el = document) => el.querySelector(s);
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* privat */ } },
  };
  const LOCALE = { de: 'de-AT', en: 'en-GB', it: 'it-IT', ar: 'ar-u-nu-latn' };
  const POLL_MS = 8000;

  let S = null;                 // Zustand vom Server
  let lang = pickLang();
  let view = location.hash === '#liste' ? 'list' : 'need';
  let pin = store.get('tb-ek-pin') || '';
  let me = store.get('tb-ek-name') || '';
  let query = '';
  let showHidden = false;
  let pinShown = false;
  let lastFocus = null;

  // ---------------------------------------------------------- Helfer
  function t(key, vars) {
    let s = T[lang]?.[key] ?? T.de[key] ?? key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
    return s;
  }
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;          // nur für feste Icons
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat(3)) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
    return el;
  }
  const ICON = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    cam: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
    eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    eyeOff: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.2M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
    user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  };

  function pickLang() {
    const q = new URLSearchParams(location.search).get('lang');
    const nav = (navigator.language || 'de').slice(0, 2).toLowerCase();
    return [q, store.get('tb-ek-lang'), nav].find(l => l && T[l]) || 'de';
  }
  const nameOf = (it, l = lang) => it.name[l] || it.name.de || Object.values(it.name)[0] || '?';
  const deName = it => (lang !== 'de' && it.name.de && it.name.de !== nameOf(it) ? it.name.de : '');
  const imgOf = it => it.photo || `img/${it.img}.webp`;
  const unitOf = u => S.units[u]?.[lang] || u;
  const num = q => new Intl.NumberFormat(LOCALE[lang], { maximumFractionDigits: 2, useGrouping: false }).format(q);
  // akzeptiert 1,5 / 1.5 / ١٫٥ (arabische Ziffern auf dem Handy)
  const parseNum = s => Number(String(s).replace(/\s/g, '')
    .replace(/[٠-٩]/g, d => d.charCodeAt(0) - 0x660).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 0x6F0)
    .replace(/[,٫]/g, '.'));
  const qtyText = r => `${num(r.qty)} ${unitOf(r.unit)}`;
  const stepOf = u => (u === 'kg' || u === 'l' ? 0.5 : 1);
  const itemById = id => S.items.find(i => i.id === id);
  const openRequests = () => S.requests.filter(r => r.st === 'open');
  const openMap = () => new Map(openRequests().map(r => [r.item, r]));
  const plain = s => String(s).replace(/­/g, '');      // Trennstellen raus
  const norm = s => plain(s).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/ß/g, 'ss');

  function when(ts) {
    const d = new Date(ts), now = new Date();
    const time = new Intl.DateTimeFormat(LOCALE[lang], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
    if (d.toDateString() === now.toDateString()) return time;
    const y = new Date(now); y.setDate(now.getDate() - 1);
    if (d.toDateString() === y.toDateString()) return `${t('yesterday')} ${time}`;
    return new Intl.DateTimeFormat(LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'numeric' }).format(d) + ` ${time}`;
  }

  function pic(it, cls = 'pic') {
    return h('span', { class: cls, 'data-cat': it.cat },
      h('img', { src: imgOf(it), alt: '', loading: 'lazy', decoding: 'async', class: it.photo ? 'photo' : null }));
  }

  // ---------------------------------------------------------- Server
  async function call(method, url, body, raw) {
    const headers = {};
    if (pin) headers['x-team-pin'] = pin;
    let payload;
    if (raw) { headers['Content-Type'] = 'image/jpeg'; payload = body; }
    else if (body) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    let r;
    try { r = await fetch('/api/einkauf' + url, { method, headers, body: payload, cache: 'no-store' }); }
    catch (e) { setOnline(false); throw e; }
    setOnline(true);
    if (r.status === 401) { showPin(Boolean(pin)); throw new Error('pin'); }
    if (r.status === 429) { showPin(false, t('pinWait')); throw new Error('wait'); }
    if (!r.ok) throw new Error('http ' + r.status);
    const data = await r.json();
    if (data.items) { S = data; render(); }
    return data;
  }
  const post = (url, body) => call('POST', url, body);

  async function refresh() {
    if (pinShown) return;
    try { await call('GET', '/state?v=' + (S ? S.v : 0)); } catch { /* Banner zeigt es */ }
  }
  function setOnline(ok) { $('#offline').hidden = ok; }

  // ---------------------------------------------------------- Rendern
  function render() {
    if (!S) return;
    renderStatic();
    renderNeed();
    renderList();
  }

  function renderStatic() {
    const root = document.documentElement;
    root.lang = lang; root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = t('pageTitle');
    document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
    document.querySelectorAll('[data-tp]').forEach(el => { el.placeholder = t(el.dataset.tp); });
    document.querySelectorAll('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    document.querySelectorAll('.tabs button').forEach(b => {
      if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    $('#view-need').hidden = view !== 'need';
    $('#view-list').hidden = view !== 'list';
    const n = openRequests().length;
    const badge = $('#badge');
    badge.hidden = n === 0; badge.textContent = n;
    const who = $('#who');
    who.replaceChildren(h('span', { html: ICON.user }), me ? t('hello', { n: me }) : t('whoAreYou'), ' ', h('u', null, me ? t('change') : t('setName')));
  }

  function renderNeed() {
    const open = openMap();
    const q = norm(query.trim());
    const visible = S.items.filter(i => showHidden || !i.hidden);
    const match = i => !q || Object.values(i.name).some(n => norm(n).includes(q));
    const chips = $('#chips'); chips.replaceChildren();
    const cats = $('#cats'); cats.replaceChildren();
    let shown = 0;

    for (const c of S.cats) {
      const list = visible.filter(i => i.cat === c.id && match(i));
      if (!list.length) continue;
      shown += list.length;
      chips.append(h('button', {
        type: 'button', class: 'chip', 'data-cat': c.id,
        onclick: () => document.getElementById('cat-' + c.id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }),
      }, h('i'), c.name[lang] || c.name.de));
      cats.append(h('section', { class: 'cat', id: 'cat-' + c.id, 'data-cat': c.id },
        h('h2', { class: 'cat-h' }, h('i'), c.name[lang] || c.name.de),
        h('div', { class: 'grid' }, list.map(i => card(i, open.get(i.id))))));
    }

    const hiddenN = S.items.filter(i => i.hidden).length;
    cats.append(h('div', { class: 'after' },
      !shown && q ? h('p', { class: 'none' }, t('notFound')) : null,
      h('button', { type: 'button', class: 'add-btn', onclick: () => openNew(query.trim()) },
        h('b', { 'aria-hidden': 'true' }, '+'), !shown && q ? t('createNamed', { q: query.trim() }) : t('newItem')),
      hiddenN ? h('button', { type: 'button', class: 'link-btn', onclick: () => { showHidden = !showHidden; renderNeed(); } },
        showHidden ? t('hideHidden') : t('showHidden', { n: hiddenN })) : null));
  }

  function card(it, r) {
    // „Brot (verschiedene Sorten)“ → groß „Brot“, klein „verschiedene Sorten“
    // „Stangenbohnen / Weiße Bohnen“ → groß „Stangenbohnen“, klein „/ Weiße Bohnen“
    const full = nameOf(it);
    const m = full.match(/^(.+?)\s*\((.+)\)\s*$/) || full.match(/^(.+?)\s+(\/\s.+)$/);
    return h('button', {
      type: 'button', class: 'card' + (r ? ' on' : '') + (it.hidden ? ' is-hidden' : ''), 'data-cat': it.cat,
      'aria-label': nameOf(it) + (r ? ` · ${t('already')}: ${qtyText(r)}` : ''),
      onclick: () => openItem(it.id),
    },
    pic(it),
    h('span', { class: 'nm', 'data-hidden': it.hidden ? t('hiddenTag') : null }, m ? m[1] : full),
    m ? h('span', { class: 'sub' }, m[2]) : null,
    r ? h('span', { class: 'pill', 'aria-hidden': 'true' }, qtyText(r)) : null);
  }

  function renderList() {
    const open = openRequests();
    $('#list-count').textContent = open.length === 1 ? t('count1') : open.length ? t('countN', { n: open.length }) : '';
    $('#share').hidden = $('#print').hidden = !open.length;
    const list = $('#list'); list.replaceChildren();

    if (!open.length) {
      list.append(h('div', { class: 'empty' },
        h('img', { src: '../assets/img/logo.webp', alt: '', width: 130, height: 237 }),
        h('h2', null, t('empty')), h('p', null, t('emptyLead'))));
    } else {
      list.append(h('p', { class: 'lead list-hint' }, t('listHint')));
      for (const c of S.cats) {
        const rows = open.filter(r => itemById(r.item)?.cat === c.id).sort((a, b) => a.at - b.at);
        if (!rows.length) continue;
        list.append(h('section', { class: 'group', 'data-cat': c.id },
          h('h2', { class: 'group-h' }, h('i'), c.name[lang] || c.name.de),
          h('div', { class: 'rows' }, rows.map(r => listRow(r, itemById(r.item))))));
      }
    }

    const since = Date.now() - 3 * 864e5;
    const done = S.requests.filter(r => r.st === 'done' && r.doneAt > since && itemById(r.item))
      .sort((a, b) => b.doneAt - a.doneAt).slice(0, 25);
    const bought = $('#bought'); bought.replaceChildren();
    if (done.length) {
      bought.append(h('h2', null, t('lastBought')), ...done.map(r => {
        const it = itemById(r.item);
        return h('div', { class: 'done-row' }, pic(it),
          h('div', null, h('b', null, nameOf(it), ' · ', qtyText(r)),
            h('span', null, [r.doneBy ? t('boughtBy', { n: r.doneBy }) : t('bought'), when(r.doneAt)].join(' · '))),
          h('button', { type: 'button', onclick: () => reopen(r, it) }, t('backOnList')));
      }));
    }
  }

  function listRow(r, it) {
    const row = h('div', { class: 'row', 'data-cat': it.cat });
    row.append(
      h('button', { type: 'button', class: 'row-main', onclick: () => openItem(it.id) },
        pic(it),
        h('span', { class: 'row-txt' },
          h('span', { class: 'row-nm' }, nameOf(it)),
          deName(it) ? h('span', { class: 'row-de' }, deName(it)) : null,
          r.note ? h('span', { class: 'row-note' }, r.note) : null,
          h('span', { class: 'row-meta' }, [r.by, when(r.upd || r.at)].filter(Boolean).join(' · '))),
        h('span', { class: 'row-qty' }, h('b', null, num(r.qty)), h('span', null, unitOf(r.unit)))),
      h('button', { type: 'button', class: 'tick', 'aria-label': `${t('markBought')}: ${nameOf(it)}`, html: ICON.check, onclick: () => markDone(r, it, row) }));
    return row;
  }

  // ---------------------------------------------------------- Aktionen
  async function markDone(r, it, row) {
    row.classList.add('leaving');
    try {
      await post('/done', { id: r.id, by: me });
      toast(t('boughtToast', { name: nameOf(it) }), t('undo'), () => post('/reopen', { id: r.id, by: me }).catch(() => toast(t('error'))));
    } catch { row.classList.remove('leaving'); toast(t('error')); }
  }
  async function reopen(r, it) {
    try { await post('/reopen', { id: r.id, by: me }); toast(t('addedToast', { name: nameOf(it) })); } catch { toast(t('error')); }
  }

  function shareText() {
    const d = new Intl.DateTimeFormat(LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'numeric' }).format(new Date());
    const lines = [`THE BAKERY · ${t('shareTitle')} · ${d}`];
    for (const c of S.cats) {
      const rows = openRequests().filter(r => itemById(r.item)?.cat === c.id);
      if (!rows.length) continue;
      lines.push('', (c.name[lang] || c.name.de).toUpperCase());
      for (const r of rows) {
        const it = itemById(r.item);
        const de = deName(it) ? ` (${deName(it)})` : '';
        lines.push(`• ${nameOf(it)}${de}: ${qtyText(r)}${r.note ? ` · ${r.note}` : ''}`);
      }
    }
    return plain(lines.join('\n'));
  }
  async function share() {
    const text = shareText();
    if (navigator.share) {
      try { await navigator.share({ title: t('shareTitle'), text }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(text); toast(t('copied')); }
    catch { window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank', 'noopener'); }
  }

  // ---------------------------------------------------------- Unterblatt
  const sheetWrap = $('#sheet'), sheet = $('.sheet', sheetWrap);
  function openSheet(...content) {
    lastFocus = document.activeElement;
    sheet.replaceChildren(h('div', { class: 'grab', 'aria-hidden': 'true' }),
      h('button', { type: 'button', class: 'x', 'aria-label': t('close'), html: ICON.x, onclick: closeSheet }),
      ...content.flat(3).filter(c => c != null && c !== false));
    sheetWrap.hidden = false;
    document.documentElement.classList.add('no-scroll');
    requestAnimationFrame(() => requestAnimationFrame(() => sheetWrap.classList.add('open')));
    sheet.scrollTop = 0;
    setTimeout(() => sheet.focus({ preventScroll: true }), 30);
  }
  function closeSheet() {
    if (sheetWrap.hidden) return;
    sheetWrap.classList.remove('open');
    document.documentElement.classList.remove('no-scroll');
    setTimeout(() => { sheetWrap.hidden = true; sheet.replaceChildren(); }, 260);
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus({ preventScroll: true });
  }
  sheetWrap.addEventListener('click', e => { if (e.target.hasAttribute('data-close')) closeSheet(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !sheetWrap.hidden) closeSheet();
    if (e.key === 'Tab' && !sheetWrap.hidden) {            // Fokus im Blatt halten
      const f = [...sheet.querySelectorAll('button, input, select, textarea')].filter(x => !x.disabled && x.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  function nameField() {
    if (me) return null;
    return [h('label', { class: 'lbl', for: 'f-me' }, t('yourName')),
      h('input', { class: 'field', id: 'f-me', autocomplete: 'given-name', maxlength: 40, placeholder: t('namePh') })];
  }
  function takeName() {
    const f = $('#f-me', sheet);
    if (f && f.value.trim()) { me = f.value.trim().slice(0, 40); store.set('tb-ek-name', me); }
  }

  function openItem(id) {
    const it = itemById(id); if (!it) return;
    const r = openMap().get(id);
    let unit = r ? r.unit : it.unit;
    let qty = r ? r.qty : 1;

    const qtyIn = h('input', { class: 'qty-in', id: 'f-qty', type: 'text', inputmode: 'decimal', autocomplete: 'off', value: num(qty), 'aria-label': t('howMuch') });
    const parseQty = () => { const v = parseNum(qtyIn.value); return Number.isFinite(v) ? v : 0; };
    const setQty = v => { qty = Math.max(0, Math.round(v * 100) / 100); qtyIn.value = num(qty); markQuick(); };
    const unitSel = h('select', { class: 'unit-sel', 'aria-label': t('unit'), onchange: () => { unit = unitSel.value; } },
      Object.keys(S.units).map(u => h('option', { value: u, selected: u === unit }, S.units[u][lang] || u)));
    const quickVals = [1, 2, 3, 5, 10];
    const quick = h('div', { class: 'quick' }, quickVals.map(v => h('button', { type: 'button', 'data-v': v, onclick: () => setQty(v) }, num(v))));
    const markQuick = () => quick.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.v) === parseQty())));
    qtyIn.addEventListener('input', markQuick);
    qtyIn.addEventListener('focus', () => qtyIn.select());
    const note = h('input', { class: 'field', id: 'f-note', maxlength: 200, placeholder: t('notePh'), value: r?.note || '' });
    const err = h('p', { class: 'err', role: 'alert' });

    async function save() {
      const v = parseQty();
      if (!(v > 0)) { err.textContent = t('badQty'); qtyIn.classList.remove('shake'); void qtyIn.offsetWidth; qtyIn.classList.add('shake'); qtyIn.focus(); return; }
      takeName();
      try {
        await post('/need', { item: id, qty: v, unit, note: note.value, by: me });
        closeSheet();
        toast(t(r ? 'updatedToast' : 'addedToast', { name: nameOf(it) }));
      } catch (e) { if (e.message !== 'pin') err.textContent = t('error'); }
    }
    async function remove() {
      try { await post('/remove', { id: r.id, by: me }); closeSheet(); toast(t('removedToast', { name: nameOf(it) }), t('undo'), () => post('/need', { item: id, qty: r.qty, unit: r.unit, note: r.note, by: r.by }).catch(() => toast(t('error')))); }
      catch { err.textContent = t('error'); }
    }

    openSheet(
      h('div', { class: 's-head' }, pic(it), h('div', null,
        h('h2', { id: 'sheet-h' }, nameOf(it)), deName(it) ? h('p', null, deName(it)) : null)),
      r ? h('p', { class: 'already' }, `${t('already')}: `, h('b', null, qtyText(r)), [r.by, when(r.upd || r.at)].filter(Boolean).map(x => ` · ${x}`).join('')) : null,
      h('label', { class: 'lbl', for: 'f-qty' }, t('howMuch')),
      h('div', { class: 'stepper' },
        h('button', { type: 'button', class: 'step', 'aria-label': '−', html: ICON.minus, onclick: () => setQty(Math.max(stepOf(unit), parseQty() - stepOf(unit))) }),
        h('div', { class: 'qty-box' }, qtyIn, unitSel),
        h('button', { type: 'button', class: 'step', 'aria-label': '+', html: ICON.plus, onclick: () => setQty(parseQty() + stepOf(unit)) })),
      quick,
      h('label', { class: 'lbl', for: 'f-note' }, t('note')), note,
      nameField(),
      err,
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn primary', onclick: save }, r ? t('update') : t('add')),
        r ? h('button', { type: 'button', class: 'btn ghost full', onclick: remove }, t('removeFromList')) : null),
      h('div', { class: 'admin' },
        h('button', { type: 'button', onclick: () => pickPhoto(it) }, h('span', { html: ICON.cam }), t('takePhoto')),
        it.photo ? h('button', { type: 'button', onclick: () => editItem(it, { resetPhoto: true }) }, h('span', { html: ICON.undo }), t('resetPhoto')) : null,
        h('button', { type: 'button', onclick: () => editItem(it, { hidden: !it.hidden }, true) },
          h('span', { html: it.hidden ? ICON.eye : ICON.eyeOff }), it.hidden ? t('unhide') : t('hide'))));
    markQuick();
    note.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
    qtyIn.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  }

  async function editItem(it, change, close) {
    try {
      await post('/edit', { id: it.id, ...change });
      if (close) closeSheet(); else openItem(it.id);
      toast(t('saved'));
    } catch { toast(t('error')); }
  }

  function pickPhoto(it) {
    const inp = h('input', { type: 'file', accept: 'image/*' });
    inp.addEventListener('change', async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      toast(t('uploading'));
      try {
        const blob = await shrink(f);
        await call('PUT', '/photo/' + it.id, blob, true);
        toast(t('saved'));
        openItem(it.id);
      } catch { toast(t('error')); }
    });
    inp.click();
  }
  function shrink(file, max = 900) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(b => (b ? resolve(b) : reject(new Error('blob'))), 'image/jpeg', 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img')); };
      img.src = url;
    });
  }

  function openNew(prefill = '') {
    let cat = S.cats[0].id;
    const nameIn = h('input', { class: 'field', id: 'f-name', maxlength: 60, value: prefill, placeholder: t('name') });
    const catBox = h('div', { class: 'cat-pick', role: 'group', 'aria-label': t('category') });
    const drawCats = () => catBox.replaceChildren(...S.cats.map(c => h('button', {
      type: 'button', class: 'chip', 'data-cat': c.id, 'aria-pressed': String(c.id === cat), onclick: () => { cat = c.id; drawCats(); },
    }, h('i'), c.name[lang] || c.name.de)));
    drawCats();
    const unitSel = h('select', { class: 'unit-sel', id: 'f-unit' },
      Object.keys(S.units).map(u => h('option', { value: u }, S.units[u][lang] || u)));
    const err = h('p', { class: 'err', role: 'alert' });

    async function create() {
      const name = nameIn.value.trim();
      if (!name) { err.textContent = t('badName'); nameIn.focus(); return; }
      try {
        const res = await post('/item', { name, cat, unit: unitSel.value, lang });
        query = ''; $('#q').value = '';
        render();
        openItem(res.id);
      } catch (e) { if (e.message !== 'pin') err.textContent = t('error'); }
    }
    openSheet(
      h('h2', { class: 's-title', id: 'sheet-h' }, t('newItem')),
      h('p', { class: 's-lead' }, t('newItemLead')),
      h('label', { class: 'lbl', for: 'f-name' }, t('name')), nameIn,
      h('span', { class: 'lbl' }, t('category')), catBox,
      h('label', { class: 'lbl', for: 'f-unit' }, t('unit')), unitSel,
      err,
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn primary', onclick: create }, t('create'))));
    nameIn.addEventListener('keydown', e => { if (e.key === 'Enter') create(); });
  }

  function openWho() {
    const inp = h('input', { class: 'field', id: 'f-who', maxlength: 40, value: me, placeholder: t('namePh'), autocomplete: 'given-name' });
    const save = () => { me = inp.value.trim().slice(0, 40); store.set('tb-ek-name', me); closeSheet(); renderStatic(); };
    openSheet(
      h('h2', { class: 's-title', id: 'sheet-h' }, t('whoAreYou')),
      h('label', { class: 'lbl', for: 'f-who' }, t('yourName')), inp,
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn primary', onclick: save }, t('save'))));
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  }

  // ---------------------------------------------------------- PIN
  function showPin(wrong, msg) {
    if (pinShown) { const e = $('#pin .err'); if (e) e.textContent = msg || (wrong ? t('pinWrong') : ''); return; }
    pinShown = true;
    const box = $('#pin');
    const inp = h('input', { type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: 32, 'aria-label': t('pinTitle') });
    const err = h('p', { class: 'err', role: 'alert' }, msg || (wrong ? t('pinWrong') : ''));
    box.replaceChildren(
      h('img', { src: '../assets/img/logo.webp', alt: '', width: 120, height: 219 }),
      h('span', { class: 'wordmark', 'aria-hidden': 'true' }),
      h('h1', null, t('pinTitle')), h('p', null, t('pinLead')),
      h('form', { onsubmit: async e => {
        e.preventDefault();
        pin = inp.value.trim(); store.set('tb-ek-pin', pin);
        pinShown = false; box.hidden = true;
        await refresh();
      } }, inp, err, h('button', { type: 'submit', class: 'btn primary' }, t('go'))));
    box.hidden = false;
    setTimeout(() => inp.focus(), 50);
  }

  // ---------------------------------------------------------- Hinweis
  let toastTimer;
  function toast(msg, actionLabel, action) {
    const el = $('#toast');
    clearTimeout(toastTimer);
    el.replaceChildren(h('span', null, msg));
    if (actionLabel) el.append(h('button', { type: 'button', onclick: () => { el.hidden = true; action(); } }, actionLabel));
    el.hidden = false;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    toastTimer = setTimeout(() => { el.hidden = true; }, actionLabel ? 6000 : 2600);
  }

  // ---------------------------------------------------------- Start
  function setView(v) {
    view = v;
    history.replaceState(null, '', v === 'list' ? '#liste' : location.pathname + location.search);
    render();
    window.scrollTo({ top: 0 });
  }
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  document.querySelectorAll('.lang button').forEach(b => b.addEventListener('click', () => {
    lang = b.dataset.lang; store.set('tb-ek-lang', lang); render();
  }));
  $('#q').addEventListener('input', e => { query = e.target.value; renderNeed(); });
  $('#who').addEventListener('click', openWho);
  $('#share').addEventListener('click', share);
  $('#print').addEventListener('click', () => window.print());

  renderStaticBeforeData();
  function renderStaticBeforeData() {
    document.documentElement.lang = lang; document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-t]').forEach(el => { el.textContent = t(el.dataset.t); });
    document.querySelectorAll('[data-tp]').forEach(el => { el.placeholder = t(el.dataset.tp); });
  }
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, POLL_MS);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('online', refresh);
})();
