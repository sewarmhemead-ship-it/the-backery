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
  const HASH = { list: '#liste', history: '#verlauf' };
  let view = location.hash === '#liste' ? 'list' : location.hash === '#verlauf' ? 'history' : 'need';
  let pin = store.get('tb-ek-pin') || '';
  let me = store.get('tb-ek-name') || '';
  // Geräte-Kennung: damit man nicht über die eigenen Einträge benachrichtigt wird
  let dev = store.get('tb-ek-dev');
  if (!dev) { dev = Math.random().toString(36).slice(2) + Date.now().toString(36); store.set('tb-ek-dev', dev); }
  let month = (() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })();
  const histCache = new Map();  // "2026-10" → { v, requests }
  let pushKey = null, pushSub = null;
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
    bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/></svg>',
    alert: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5M8 8.5l5 5M13 8.5l-5 5"/></svg>',
    euro: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 6.5A7 7 0 1 0 17 17.5M4 10h9M4 14h9"/></svg>',
    send: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 3 10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5z"/></svg>',
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20.5l1.4-4.3A8.5 8.5 0 1 1 8.2 19z"/><path d="M9 10.5h6M9 13.5h4"/></svg>',
    mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3.5 7.5 8.5 6 8.5-6"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>',
    chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>',
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
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
  const plain = s => String(s).replace(/­/g, '');   // Trennstellen raus
  const money = p => new Intl.NumberFormat(LOCALE[lang], { style: 'currency', currency: 'EUR' }).format(p);
  const byUrgent = (a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0) || a.at - b.at;
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
    if (view === 'history') renderHistory();
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
    $('#view-history').hidden = view !== 'history';
    renderBell();
    const n = openRequests().length;
    const badge = $('#badge');
    badge.hidden = n === 0; badge.textContent = n;
    const who = $('#who');
    who.replaceChildren(h('span', { class: 'ico', html: ICON.user }), h('span', { class: 'txt' }, me || t('setName')));
    who.setAttribute('aria-label', me ? `${t('hello', { n: me })} · ${t('change')}` : t('whoAreYou'));
  }

  function renderNeed() {
    const open = openMap();
    const q = norm(query.trim());
    const visible = S.items.filter(i => showHidden || !i.hidden);
    const match = i => !q || Object.values(i.name).some(n => norm(n).includes(q));
    const chips = $('#chips'); chips.replaceChildren();
    const cats = $('#cats'); cats.replaceChildren();
    let shown = 0;

    // „Am häufigsten“ oben, solange nicht gesucht wird
    const top = (S.top || []).map(itemById).filter(i => i && !i.hidden);
    if (!q && top.length) {
      chips.append(h('button', { type: 'button', class: 'chip', 'data-cat': 'top',
        onclick: () => document.getElementById('cat-top')?.scrollIntoView({ behavior: 'smooth' }) },
      h('span', { class: 'chip-ico', html: ICON.star }), t('topTitle')));
      cats.append(h('section', { class: 'cat top-items', id: 'cat-top', 'data-cat': 'top' },
        h('h2', { class: 'cat-h' }, h('span', { class: 'chip-ico', html: ICON.star }), t('topTitle')),
        h('div', { class: 'grid' }, top.map(i => card(i, open.get(i.id))))));
    }

    for (const c of S.cats) {
      const list = visible.filter(i => i.cat === c.id && match(i));
      if (!list.length) continue;
      shown += list.length;
      chips.append(h('button', {
        type: 'button', class: 'chip', 'data-cat': c.id,
        onclick: () => document.getElementById('cat-' + c.id)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }),
      }, h('i'), c.name[lang] || c.name.de));
      cats.append(h('section', { class: 'cat', id: 'cat-' + c.id, 'data-cat': c.id },
        h('h2', { class: 'cat-h' }, c.name[lang] || c.name.de, h('small', null, num(list.length))),
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
      type: 'button', class: 'card' + (r ? ' on' : '') + (r?.urgent ? ' urgent' : '') + (it.hidden ? ' is-hidden' : ''), 'data-cat': it.cat,
      'aria-label': nameOf(it) + (r ? ` · ${t('already')}: ${qtyText(r)}${r.urgent ? ` · ${t('urgent')}` : ''}` : ''),
      onclick: () => openItem(it.id),
    },
    pic(it),
    h('span', { class: 'card-txt' },
      h('span', { class: 'nm', 'data-hidden': it.hidden ? t('hiddenTag') : null }, m ? m[1] : full),
      m ? h('span', { class: 'sub' }, m[2].replace(/^\/\s*/, '')) : null),
    r ? h('span', { class: 'pill', 'aria-hidden': 'true' }, qtyText(r)) : h('span', { class: 'add', 'aria-hidden': 'true', html: ICON.plus }));
  }

  function renderList() {
    const open = openRequests();
    $('#list-count').textContent = open.length === 1 ? t('count1') : open.length ? t('countN', { n: open.length }) : '';
    $('#share').hidden = $('#print').hidden = !open.length;
    const list = $('#list'); list.replaceChildren();

    if (!open.length) {
      list.append(h('div', { class: 'empty' },
        h('span', { class: 'empty-ico', html: ICON.check }),
        h('h2', null, t('empty')), h('p', null, t('emptyLead'))));
    } else {
      list.append(h('p', { class: 'lead list-hint' }, t('listHint')));
      // Dringendes ganz oben, eigene Gruppe in Rot
      const urgent = open.filter(r => r.urgent && itemById(r.item)).sort((a, b) => a.at - b.at);
      if (urgent.length) {
        list.append(h('section', { class: 'group urgent-group' },
          h('h2', { class: 'group-h' }, h('span', { class: 'chip-ico', html: ICON.alert }), t('urgent')),
          h('div', { class: 'rows' }, urgent.map(r => listRow(r, itemById(r.item))))));
      }
      for (const c of S.cats) {
        // „nicht gefunden“ ans Ende der Gruppe
        const rows = open.filter(r => !r.urgent && itemById(r.item)?.cat === c.id).sort((a, b) => (a.nf ? 1 : 0) - (b.nf ? 1 : 0) || a.at - b.at);
        if (!rows.length) continue;
        list.append(h('section', { class: 'group', 'data-cat': c.id },
          h('h2', { class: 'group-h' }, c.name[lang] || c.name.de, h('small', null, num(rows.length))),
          h('div', { class: 'rows' }, rows.map(r => listRow(r, itemById(r.item))))));
      }
    }

    const since = Date.now() - 3 * 864e5;
    const done = S.requests.filter(r => r.st === 'done' && r.doneAt > since && itemById(r.item))
      .sort((a, b) => b.doneAt - a.doneAt).slice(0, 25);
    const bought = $('#bought'); bought.replaceChildren();
    if (done.length) {
      bought.append(h('h2', null, t('lastBought')), h('div', { class: 'done-list' }, done.map(r => {
        const it = itemById(r.item);
        return h('div', { class: 'done-row' }, pic(it),
          h('div', null, h('b', null, nameOf(it), ' · ', qtyText(r)),
            h('span', null, [r.doneBy ? t('boughtBy', { n: r.doneBy }) : t('bought'), when(r.doneAt)].join(' · '))),
          h('div', { class: 'done-btns' },
            priceBtn(r, it),
            h('button', { type: 'button', onclick: () => reopen(r, it) }, t('backOnList'))));
      })));
    }
  }

  function priceBtn(r, it) {
    return h('button', { type: 'button', class: 'price-btn' + (r.price != null ? ' has' : ''), onclick: () => openPrice(r, it) },
      r.price != null ? money(r.price) : t('addPrice'));
  }

  function listRow(r, it) {
    const row = h('div', { class: 'row' + (r.urgent ? ' urgent' : '') + (r.nf ? ' nf' : ''), 'data-cat': it.cat });
    row.append(
      h('button', { type: 'button', class: 'row-main', onclick: () => openItem(it.id) },
        pic(it),
        h('span', { class: 'row-txt' },
          h('span', { class: 'row-nm' }, nameOf(it)),
          deName(it) ? h('span', { class: 'row-de' }, deName(it)) : null,
          r.nf ? h('span', { class: 'row-nf' }, h('span', { html: ICON.search }), [t('nfTag'), r.nf.by, when(r.nf.at)].filter(Boolean).join(' · ')) : null,
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
      toast(t('boughtToast', { name: nameOf(it) }),
        t('addPrice'), () => openPrice({ ...r, st: 'done' }, it),
        t('undo'), () => post('/reopen', { id: r.id, by: me }).catch(() => toast(t('error'))));
    } catch { row.classList.remove('leaving'); toast(t('error')); }
  }

  // Preis nachtragen (Gesamtbetrag dieses Einkaufs)
  function openPrice(r, it) {
    const inp = h('input', { class: 'qty-in price-in', id: 'f-price', type: 'text', inputmode: 'decimal', autocomplete: 'off',
      value: r.price != null ? num(r.price) : '', placeholder: '0,00', 'aria-label': t('priceTitle') });
    const err = h('p', { class: 'err', role: 'alert' });
    async function save(clear) {
      const v = clear ? null : parseNum(inp.value);
      if (!clear && !(v >= 0)) { err.textContent = t('error'); inp.focus(); return; }
      try {
        await post('/price', { id: r.id, price: v });
        histCache.clear();
        closeSheet(); toast(t('saved'));
        if (view === 'history') renderHistory(true);
      } catch { err.textContent = t('error'); }
    }
    openSheet(
      h('div', { class: 's-head' }, pic(it), h('div', null, h('h2', { id: 'sheet-h' }, nameOf(it)), h('p', null, qtyText(r)))),
      h('label', { class: 'lbl', for: 'f-price' }, t('priceTitle')),
      h('div', { class: 'price-box' }, inp, h('b', { 'aria-hidden': 'true' }, '€')),
      h('p', { class: 's-lead' }, t('priceLead', { qty: qtyText(r) })),
      err,
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn primary', onclick: () => save(false) }, t('save')),
        r.price != null ? h('button', { type: 'button', class: 'btn ghost full', onclick: () => save(true) }, t('removePrice')) : null));
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') save(false); });
    setTimeout(() => inp.focus(), 320);
  }
  async function reopen(r, it) {
    try { await post('/reopen', { id: r.id, by: me }); toast(t('addedToast', { name: nameOf(it) })); } catch { toast(t('error')); }
  }

  function shareText(wa = true) {
    const bold = s => (wa ? `*${s}*` : s);
    const d = new Intl.DateTimeFormat(LOCALE[lang], { weekday: 'short', day: 'numeric', month: 'numeric' }).format(new Date());
    // WhatsApp: *fett* für Überschriften, _kursiv_ für den deutschen Namen
    const lines = [bold(`THE BAKERY · ${t('shareTitle')}`), d];
    const line = r => {
      const it = itemById(r.item);
      lines.push(`• ${nameOf(it)}: ${qtyText(r)}${r.note ? ` · ${r.note}` : ''}${r.nf ? ` (${t('nfTag')})` : ''}`);
      if (deName(it)) lines.push(wa ? `   _${deName(it)}_` : `   (${deName(it)})`);
    };
    const urgent = openRequests().filter(r => r.urgent && itemById(r.item));
    if (urgent.length) { lines.push('', bold(`❗ ${t('urgent')}`)); urgent.forEach(line); }
    for (const c of S.cats) {
      const rows = openRequests().filter(r => !r.urgent && itemById(r.item)?.cat === c.id);
      if (!rows.length) continue;
      lines.push('', bold(c.name[lang] || c.name.de));
      rows.forEach(line);
    }
    lines.push('', `${t('shareOpen')}: ${location.origin}/einkauf/#liste`);
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

  // Liste an den Chef / die Chefin: WhatsApp, E-Mail oder eine andere App
  const ltr = s => '\u2066' + s + '\u2069';
  function openSend() {
    const b = S.boss || {};
    const err = h('p', { class: 'err', role: 'alert' });
    const opt = (icon, title, sub, fn) => h('button', { type: 'button', class: 'opt', onclick: fn },
      h('span', { class: 'opt-ico', html: icon }), h('span', null, h('b', null, title), h('small', null, sub)),
      h('span', { class: 'opt-go', html: ICON.chev }));
    const viaWa = () => {
      window.open('https://wa.me/' + (b.wa || '') + '?text=' + encodeURIComponent(shareText()), '_blank', 'noopener');
      closeSheet();
    };
    const viaMail = async () => {
      if (!b.email) { openBoss(); return; }
      if (S.mail) {
        try { await post('/send/email', {}); closeSheet(); toast(t('mailSent', { to: b.email })); }
        catch (e) { if (e.message !== 'pin') err.textContent = t('mailFail'); }
        return;
      }
      location.href = 'mailto:' + b.email + '?subject=' + encodeURIComponent('THE BAKERY · ' + t('shareTitle'))
        + '&body=' + encodeURIComponent(shareText(false));
      closeSheet();
    };
    const who = [b.name, b.wa ? ltr('+' + b.wa) : '', b.email ? ltr(b.email) : ''].filter(Boolean);
    openSheet(
      h('h2', { class: 's-title', id: 'sheet-h' }, t('sendTitle')),
      h('p', { class: 's-lead' }, t(openRequests().length === 1 ? 'count1' : 'countN', { n: openRequests().length })),
      h('div', { class: 'opts' },
        opt(ICON.chat, 'WhatsApp', b.wa ? [b.name, ltr('+' + b.wa)].filter(Boolean).join(' · ') : t('waPick'), viaWa),
        opt(ICON.mail, t('mailTitle'), b.email ? ltr(b.email) : t('mailAdd'), viaMail),
        opt(ICON.share, t('otherTitle'), t('otherSub'), () => { closeSheet(); share(); })),
      err,
      h('p', { class: 'to-line' },
        h('span', null, who.length ? [t('sendTo'), ': ', h('b', null, who[0])] : t('noRecipient')),
        h('button', { type: 'button', onclick: openBoss }, who.length ? t('changeRecipient') : t('setRecipient'))));
  }

  function openBoss() {
    const b = S.boss || {};
    let auto = !!b.auto;
    const nameIn = h('input', { class: 'field', id: 'f-bn', maxlength: 40, value: b.name || '', placeholder: t('recNamePh'), autocomplete: 'off' });
    const waIn = h('input', { class: 'field', id: 'f-bw', type: 'tel', dir: 'ltr', inputmode: 'tel', maxlength: 24, value: b.wa ? '+' + b.wa : '', placeholder: '+43 664 1234567', autocomplete: 'off' });
    const mailIn = h('input', { class: 'field', id: 'f-bm', type: 'email', dir: 'ltr', inputmode: 'email', maxlength: 120, value: b.email || '', placeholder: 'name@beispiel.at', autocomplete: 'off', autocapitalize: 'off' });
    const err = h('p', { class: 'err', role: 'alert' });
    const sw = h('button', { type: 'button', class: 'switch', role: 'switch', 'aria-checked': String(auto && S.mail), disabled: !S.mail,
      onclick: () => { auto = !auto; sw.setAttribute('aria-checked', String(auto)); } }, h('i'), h('span', null, t('autoMail')));
    async function save() {
      const wa = parseNumDigits(waIn.value);
      const email = mailIn.value.trim();
      if (wa && !/^[1-9]\d{6,14}$/.test(wa)) { err.textContent = t('badWa'); waIn.focus(); return; }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { err.textContent = t('badMail'); mailIn.focus(); return; }
      try {
        await post('/boss', { name: nameIn.value, wa, email, auto: auto && !!email, lang });
        toast(t('saved')); openSend();
      } catch (e) { if (e.message !== 'pin') err.textContent = t('error'); }
    }
    openSheet(
      h('h2', { class: 's-title', id: 'sheet-h' }, t('recTitle')),
      h('p', { class: 's-lead' }, t('recLead')),
      h('label', { class: 'lbl', for: 'f-bn' }, t('name')), nameIn,
      h('label', { class: 'lbl', for: 'f-bw' }, t('recWa')), waIn, h('p', { class: 'help' }, t('recWaHelp')),
      h('label', { class: 'lbl', for: 'f-bm' }, t('mailTitle')), mailIn,
      h('div', { class: 'switches' }, sw),
      S.mail ? null : h('p', { class: 'help' }, t('autoNeedsSetup')),
      err,
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn primary', onclick: save }, t('save'))));
  }
  // +43 (0) 664 … / 0043 … / ٠٦٦٤ → nur Ziffern, ohne führendes + oder 00
  const parseNumDigits = s => String(s)
    .replace(/[٠-٩]/g, d => d.charCodeAt(0) - 0x660).replace(/[۰-۹]/g, d => d.charCodeAt(0) - 0x6F0)
    .replace(/\(0\)/g, '').replace(/[^\d+]/g, '').replace(/^\+/, '').replace(/^00/, '');

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
    let urgent = !!r?.urgent;
    const urgentBtn = h('button', { type: 'button', class: 'urgent-btn', 'aria-pressed': String(urgent),
      onclick: () => { urgent = !urgent; urgentBtn.setAttribute('aria-pressed', String(urgent)); } },
    h('span', { html: ICON.alert }), t('urgentMark'));

    async function save() {
      const v = parseQty();
      if (!(v > 0)) { err.textContent = t('badQty'); qtyIn.classList.remove('shake'); void qtyIn.offsetWidth; qtyIn.classList.add('shake'); qtyIn.focus(); return; }
      takeName();
      try {
        await post('/need', { item: id, qty: v, unit, note: note.value, by: me, urgent, dev });
        closeSheet();
        toast(t(urgent && !r?.urgent ? 'urgentToast' : r ? 'updatedToast' : 'addedToast', { name: nameOf(it) }));
      } catch (e) { if (e.message !== 'pin') err.textContent = t('error'); }
    }
    async function notFound() {
      try {
        await post('/notfound', { id: r.id, by: me, on: !r.nf });
        closeSheet();
        toast(r.nf ? t('saved') : t('nfToast', { name: nameOf(it) }));
      } catch { err.textContent = t('error'); }
    }
    async function remove() {
      try { await post('/remove', { id: r.id, by: me }); closeSheet(); toast(t('removedToast', { name: nameOf(it) }), t('undo'), () => post('/need', { item: id, qty: r.qty, unit: r.unit, note: r.note, by: r.by, urgent: r.urgent, dev }).catch(() => toast(t('error')))); }
      catch { err.textContent = t('error'); }
    }

    openSheet(
      h('div', { class: 's-head' }, pic(it), h('div', null,
        h('h2', { id: 'sheet-h' }, nameOf(it)), deName(it) ? h('p', null, deName(it)) : null)),
      r ? h('p', { class: 'already' }, `${t('already')}: `, h('b', null, qtyText(r)), [r.by, when(r.upd || r.at)].filter(Boolean).map(x => ` · ${x}`).join('')) : null,
      r?.nf ? h('p', { class: 'already nf-note' }, h('span', { html: ICON.search }), [t('nfTag'), r.nf.by, when(r.nf.at)].filter(Boolean).join(' · ')) : null,
      h('label', { class: 'lbl', for: 'f-qty' }, t('howMuch')),
      h('div', { class: 'stepper' },
        h('button', { type: 'button', class: 'step', 'aria-label': '−', html: ICON.minus, onclick: () => setQty(Math.max(stepOf(unit), parseQty() - stepOf(unit))) }),
        h('div', { class: 'qty-box' }, qtyIn, unitSel),
        h('button', { type: 'button', class: 'step', 'aria-label': '+', html: ICON.plus, onclick: () => setQty(parseQty() + stepOf(unit)) })),
      quick,
      urgentBtn,
      h('label', { class: 'lbl', for: 'f-note' }, t('note')), note,
      nameField(),
      err,
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn primary', onclick: save }, r ? t('update') : t('add')),
        r ? h('button', { type: 'button', class: 'btn ghost full nf-btn', onclick: notFound },
          h('span', { html: ICON.search }), r.nf ? t('notFoundUndo') : t('notFoundBtn')) : null,
        r ? h('button', { type: 'button', class: 'btn ghost full danger', onclick: remove }, t('removeFromList')) : null),
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
  // toast(text, [Knopf1, Aktion1, Knopf2, Aktion2 …])
  function toast(msg, ...acts) {
    const el = $('#toast');
    clearTimeout(toastTimer);
    el.replaceChildren(h('span', null, msg));
    for (let i = 0; i + 1 < acts.length; i += 2) {
      const fn = acts[i + 1];
      el.append(h('button', { type: 'button', onclick: () => { el.hidden = true; fn(); } }, acts[i]));
    }
    el.hidden = false;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    toastTimer = setTimeout(() => { el.hidden = true; }, acts.length ? 7000 : 2600);
  }

  // ---------------------------------------------------------- Verlauf
  const monthKey = () => `${month.y}-${String(month.m + 1).padStart(2, '0')}`;
  async function renderHistory(force) {
    const label = new Intl.DateTimeFormat(LOCALE[lang], { month: 'long', year: 'numeric' }).format(new Date(month.y, month.m, 1));
    $('#m-label').textContent = label;
    const now = new Date();
    $('#m-next').disabled = month.y > now.getFullYear() || (month.y === now.getFullYear() && month.m >= now.getMonth());
    const key = monthKey();
    let data = histCache.get(key);
    // Laufender Monat: neu laden, wenn sich die Liste geändert hat
    if (force || !data || (data.v !== S.v && $('#m-next').disabled)) {
      try {
        const from = new Date(month.y, month.m, 1).getTime(), to = new Date(month.y, month.m + 1, 1).getTime();
        const res = await call('GET', `/history?from=${from}&to=${to}`);
        data = { v: S.v, requests: res.requests };
        histCache.set(key, data);
      } catch { return; }
      if (monthKey() !== key) return;                 // inzwischen weitergeblättert
    }
    drawHistory(data.requests.filter(r => itemById(r.item)));
  }

  function drawHistory(reqs) {
    const box = $('#history'); box.replaceChildren();
    if (!reqs.length) { box.append(h('p', { class: 'none hist-empty' }, t('noHistory'))); return; }

    const total = reqs.reduce((s, r) => s + (r.price || 0), 0);
    const noPrice = reqs.filter(r => r.price == null).length;
    const per = new Map();
    for (const r of reqs) {
      const p = per.get(r.item) || { item: r.item, n: 0, spent: 0, qty: 0, units: new Set(), times: [] };
      p.n += 1; p.spent += r.price || 0; p.qty += r.qty; p.units.add(r.unit); p.times.push(r.doneAt);
      per.set(r.item, p);
    }
    const stats = [...per.values()];

    box.append(h('div', { class: 'tiles' },
      h('div', { class: 'tile-s' }, h('span', null, t('spent')), h('b', null, money(total))),
      h('div', { class: 'tile-s' }, h('span', null, t('purchases')), h('b', null, num(reqs.length))),
      h('div', { class: 'tile-s' }, h('span', null, t('itemsN')), h('b', null, num(per.size)))));
    if (noPrice) box.append(h('p', { class: 'hint' }, t('noPrice', { n: noPrice })));

    const statRow = (p, right) => {
      const it = itemById(p.item);
      const ts = p.times.sort((a, b) => a - b);
      const every = ts.length > 1 ? Math.round((ts[ts.length - 1] - ts[0]) / 864e5 / (ts.length - 1)) : 0;
      const sum = p.units.size === 1 ? `${num(p.qty)} ${unitOf([...p.units][0])}` : '';
      return h('div', { class: 'stat-row' }, pic(it),
        h('div', null, h('b', null, nameOf(it)),
          h('span', null, [t(p.n === 1 ? 'timesN1' : p.n === 2 ? 'timesN2' : 'timesN', { n: p.n }), sum, every >= 1 ? t('everyDays', { n: every }) : ''].filter(Boolean).join(' · '))),
        h('strong', null, right));
    };
    box.append(h('h2', { class: 'h-sec' }, t('reportTop')),
      h('div', { class: 'stat-list' }, stats.sort((a, b) => b.n - a.n || b.spent - a.spent).slice(0, 10)
        .map(p => statRow(p, `${num(p.n)}×`))));
    const costly = stats.filter(p => p.spent > 0).sort((a, b) => b.spent - a.spent).slice(0, 10);
    if (costly.length) box.append(h('h2', { class: 'h-sec' }, t('reportCost')),
      h('div', { class: 'stat-list' }, costly.map(p => statRow(p, money(p.spent)))));

    // Archiv: Tag für Tag, neueste zuerst
    box.append(h('h2', { class: 'h-sec' }, t('archive')));
    const days = new Map();
    for (const r of [...reqs].sort((a, b) => b.doneAt - a.doneAt)) {
      const d = new Date(r.doneAt); const k = d.toDateString();
      if (!days.has(k)) days.set(k, { d, rows: [] });
      days.get(k).rows.push(r);
    }
    for (const { d, rows } of days.values()) {
      const sum = rows.reduce((s, r) => s + (r.price || 0), 0);
      box.append(h('section', { class: 'day' },
        h('h3', null, new Intl.DateTimeFormat(LOCALE[lang], { weekday: 'long', day: 'numeric', month: 'long' }).format(d),
          sum ? h('span', null, money(sum)) : null),
        h('div', { class: 'done-list' }, rows.map(r => {
          const it = itemById(r.item);
          const time = new Intl.DateTimeFormat(LOCALE[lang], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(r.doneAt));
          return h('div', { class: 'done-row arch' }, pic(it),
            h('div', null, h('b', null, nameOf(it), ' · ', qtyText(r)),
              h('span', null, [r.doneBy ? t('boughtBy', { n: r.doneBy }) : t('bought'), time].join(' · '))),
            priceBtn(r, it));
        }))));
    }
  }

  // ---------------------------------------------------------- Benachrichtigungen
  const pushOk = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const isIos = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  let swReg = null;
  async function initPush() {
    if (!pushOk()) return;
    try {
      swReg = await navigator.serviceWorker.register('sw.js', { scope: './' });
      pushSub = await swReg.pushManager.getSubscription();
      navigator.serviceWorker.addEventListener('message', e => { if (e.data?.open === 'list') setView('list'); });
    } catch { /* ohne Benachrichtigungen weiter */ }
    renderBell();
  }
  async function loadPushKey() {
    if (pushKey || !pushOk() || !S) return;
    try { pushKey = (await call('GET', '/push/key')).key; } catch { /* später nochmal */ }
  }
  function renderBell() {
    const b = $('#bell');
    b.hidden = !(pushOk() || isIos);
    b.classList.toggle('on', !!pushSub);
    b.replaceChildren(h('span', { class: 'ico', html: ICON.bell }));
    b.setAttribute('aria-label', t('notif') + (pushSub ? ` · ${t('notifOnTag')}` : ''));
  }
  const keyBytes = k => { const s = atob(k.replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(s, c => c.charCodeAt(0)); };
  const prefs = () => { try { return JSON.parse(store.get('tb-ek-push') || '{}'); } catch { return {}; } };

  function openNotif() {
    if (!pushOk()) {
      openSheet(h('h2', { class: 's-title', id: 'sheet-h' }, t('notif')),
        h('p', { class: 's-lead' }, isIos && !standalone ? t('notifIos') : t('notifUnsupported')));
      return;
    }
    const p = prefs();
    let each = p.each !== false, daily = !!p.daily;
    const err = h('p', { class: 'err', role: 'alert' });
    const sw = (label, get, set) => {
      const b = h('button', { type: 'button', class: 'switch', role: 'switch', 'aria-checked': String(get()),
        onclick: () => { set(!get()); b.setAttribute('aria-checked', String(get())); } }, h('i'), h('span', null, label));
      return b;
    };
    async function enable() {
      err.textContent = '';
      // Erlaubnis zuerst fragen, solange der Tipp noch „frisch“ ist (Safari)
      const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      if (perm !== 'granted') { err.textContent = t('notifDenied'); return; }
      try {
        if (!swReg) swReg = await navigator.serviceWorker.register('sw.js', { scope: './' });
        await navigator.serviceWorker.ready;
        if (!pushKey) await loadPushKey();
        pushSub = await swReg.pushManager.getSubscription()
          || await swReg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(pushKey) });
        await post('/subscribe', { sub: pushSub.toJSON(), lang, each, daily, dev, name: me });
        store.set('tb-ek-push', JSON.stringify({ each, daily }));
        closeSheet(); toast(t('saved')); renderBell();
      } catch (e) { if (e.message !== 'pin') err.textContent = t('error'); }
    }
    async function disable() {
      try {
        if (pushSub) { await post('/unsubscribe', { endpoint: pushSub.endpoint, dev }); await pushSub.unsubscribe(); }
        pushSub = null; closeSheet(); toast(t('saved')); renderBell();
      } catch { err.textContent = t('error'); }
    }
    async function test() {
      try { await post('/push/test', { endpoint: pushSub.endpoint }); toast(t('testSent')); } catch { err.textContent = t('error'); }
    }
    openSheet(
      h('h2', { class: 's-title', id: 'sheet-h' }, t('notif')),
      h('p', { class: 's-lead' }, t('notifLead')),
      h('div', { class: 'switches' }, sw(t('notifEach'), () => each, v => { each = v; }), sw(t('notifDaily'), () => daily, v => { daily = v; })),
      Notification.permission === 'denied' ? h('p', { class: 'err' }, t('notifDenied')) : null,
      err,
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn primary', onclick: enable }, pushSub ? t('save') : t('notifEnable')),
        pushSub ? h('button', { type: 'button', class: 'btn ghost full', onclick: test }, t('notifTest')) : null,
        pushSub ? h('button', { type: 'button', class: 'btn ghost full', onclick: disable }, t('notifOff')) : null));
  }

  // ---------------------------------------------------------- Start
  function setView(v) {
    view = v;
    history.replaceState(null, '', HASH[v] || location.pathname + location.search);
    render();
    window.scrollTo({ top: 0 });
  }
  $('#m-prev').addEventListener('click', () => { month = month.m ? { y: month.y, m: month.m - 1 } : { y: month.y - 1, m: 11 }; renderHistory(); });
  $('#m-next').addEventListener('click', () => { month = month.m < 11 ? { y: month.y, m: month.m + 1 } : { y: month.y + 1, m: 0 }; renderHistory(); });
  $('#bell').addEventListener('click', async () => { await loadPushKey(); openNotif(); });
  initPush();
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  document.querySelectorAll('.lang button').forEach(b => b.addEventListener('click', () => {
    lang = b.dataset.lang; store.set('tb-ek-lang', lang); render();
  }));
  $('#q').addEventListener('input', e => { query = e.target.value; renderNeed(); });
  $('#who').addEventListener('click', openWho);
  $('#share').addEventListener('click', openSend);
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
