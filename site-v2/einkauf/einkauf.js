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
  const HASH = { list: '#liste', cal: '#kalender', stats: '#statistik' };
  let view = { '#liste': 'list', '#kalender': 'cal', '#statistik': 'stats', '#verlauf': 'stats' }[location.hash] || 'need';
  let pin = store.get('tb-ek-pin') || '';
  let me = store.get('tb-ek-name') || '';
  // Geräte-Kennung: damit man nicht über die eigenen Einträge benachrichtigt wird
  let dev = store.get('tb-ek-dev');
  if (!dev) { dev = Math.random().toString(36).slice(2) + Date.now().toString(36); store.set('tb-ek-dev', dev); }
  const thisMonth = () => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; };
  let calMonth = thisMonth(), statMonth = thisMonth();
  let selDay = null;            // im Kalender gewählter Tag, sonst morgen
  let planDate = null;          // „Einplanen für …“: Artikel antippen plant für diesen Tag
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
    cal: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
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

  // Kalendertage als "2026-11-13" (Ortszeit des Handys = Wien)
  const pad = n => String(n).padStart(2, '0');
  const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fromKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const addD = (k, n) => { const d = fromKey(k); d.setDate(d.getDate() + n); return dkey(d); };
  const todayKey = () => dkey(new Date());
  const fmtDate = (k, o = { weekday: 'short', day: 'numeric', month: 'numeric' }) => new Intl.DateTimeFormat(LOCALE[lang], o).format(fromKey(k));
  // für Sätze wie „Für morgen einplanen“ (klein, wo die Sprache das will)
  const dayName = k => (k === todayKey() ? t('todayMid') : k === addD(todayKey(), 1) ? t('tomorrowMid') : fmtDate(k));
  const monthLabel = mo => new Intl.DateTimeFormat(LOCALE[lang], { month: 'long', year: 'numeric' }).format(new Date(mo.y, mo.m, 1));
  const plansOn = k => (S.plans || []).filter(p => p.date === k && itemById(p.item));
  const planFor = (item, k) => (S.plans || []).find(p => p.item === item && p.date === k);
  const planHour = () => (S && Number.isFinite(S.planHour) ? S.planHour : 5);

  // Was fehlt wahrscheinlich an Tag k? (Vorhersage vom Server, ohne was schon drauf/eingeplant ist)
  function expectedOn(k) {
    const tk = todayKey(), end = fromKey(addD(k, 1)).getTime(), open = openMap();
    const planned = new Set((S.plans || []).filter(p => p.date >= tk).map(p => p.item));   // schon irgendwann eingeplant
    return (S.forecast || []).filter(f => itemById(f.item) && !open.has(f.item) && !planned.has(f.item)
      && (k <= addD(tk, 1) ? f.next < end : dkey(new Date(f.next)) === k));
  }

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
    if (view === 'cal') renderCal();
    if (view === 'stats') renderStats();
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
    $('#view-cal').hidden = view !== 'cal';
    $('#view-stats').hidden = view !== 'stats';
    renderBell();
    const n = openRequests().length;
    const badge = $('#badge');
    badge.hidden = n === 0; badge.textContent = n;
    const nt = plansOn(addD(todayKey(), 1)).length;
    const bc = $('#badge-cal');
    bc.hidden = nt === 0; bc.textContent = nt;
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
    if (planDate && planDate <= todayKey()) planDate = null;
    const bar = $('#plan-bar');
    bar.hidden = !planDate;
    if (planDate) {
      const n = plansOn(planDate).length;
      bar.replaceChildren(
        h('span', { class: 'plan-bar-ico', html: ICON.cal }),
        h('span', { class: 'plan-bar-txt' }, h('b', null, t('planningFor', { day: dayName(planDate) })),
          h('small', null, n ? t('plannedN', { n }) : t('planHint'))),
        h('button', { type: 'button', class: 'btn primary', onclick: () => { selDay = planDate; planDate = null; setView('cal'); } }, t('planDone')));
    }

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
    // im Planungsmodus zeigt die Karte die eingeplante Menge statt der offenen
    if (planDate) r = planFor(it.id, planDate) || null;
    return h('button', {
      type: 'button', class: 'card' + (r ? ' on' : '') + (planDate && r ? ' planned' : '') + (!planDate && r?.urgent ? ' urgent' : '') + (it.hidden ? ' is-hidden' : ''), 'data-cat': it.cat,
      'aria-label': nameOf(it) + (r ? ` · ${planDate ? t('plannedH') : t('already')}: ${qtyText(r)}${r.urgent ? ` · ${t('urgent')}` : ''}` : ''),
      onclick: () => openItem(it.id, planDate ? { date: planDate } : {}),
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
    const tomorrowPlans = plansOn(addD(todayKey(), 1));
    $('#share').hidden = !open.length && !tomorrowPlans.length;
    $('#print').hidden = !open.length;
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
    // Hinweis auf morgen, damit niemand doppelt einkauft
    if (tomorrowPlans.length) {
      list.append(h('button', { type: 'button', class: 'plan-link', onclick: () => { selDay = addD(todayKey(), 1); setView('cal'); } },
        h('span', { class: 'opt-ico', html: ICON.cal }),
        h('span', null, h('b', null, t('plannedTomorrow')),
          h('small', null, tomorrowPlans.slice(0, 4).map(p => nameOf(itemById(p.item))).join(', ') + (tomorrowPlans.length > 4 ? ' …' : ''))),
        h('span', { class: 'opt-go', html: ICON.chev })));
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
          h('span', { class: 'row-meta' }, [r.by, when(r.upd || r.at), r.plan ? t('fromPlan') : ''].filter(Boolean).join(' · '))),
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
        render();
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
    if (!openRequests().length) lines.push('', t('empty'));
    const planned = plansOn(addD(todayKey(), 1));
    if (planned.length) {
      lines.push('', bold(`📅 ${t('plannedTomorrow')}`));
      planned.forEach(p => lines.push(`• ${nameOf(itemById(p.item))}: ${qtyText(p)}${p.note ? ` · ${p.note}` : ''}`));
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
      h('p', { class: 's-lead' }, openRequests().length ? t(openRequests().length === 1 ? 'count1' : 'countN', { n: openRequests().length }) : t('onlyPlanned')),
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

  // o.date: für diesen Tag einplanen statt jetzt auf die Liste
  // o.qty / o.unit / o.note: vorausgefüllt (Vorhersage oder beim Umschalten von „Wann?“)
  function openItem(id, o = {}) {
    const it = itemById(id); if (!it) return;
    const tk = todayKey(), tomorrow = addD(tk, 1);
    const date = o.date && o.date > tk ? o.date : null;   // null = jetzt
    const r = date ? null : openMap().get(id);
    const p = date ? planFor(id, date) : null;
    const base = date ? p : r;
    let unit = o.unit || base?.unit || it.unit;
    let qty = o.qty ?? base?.qty ?? 1;

    // Wann? Jetzt | Morgen | anderer Tag
    const again = d => openItem(id, { date: d, qty: parseQty() || undefined, unit, note: note.value });
    const dateIn = h('input', { type: 'date', class: 'seg-date', min: tomorrow, max: addD(tk, 120), value: date || '', 'aria-label': t('pickDate'),
      onchange: () => { if (dateIn.value && dateIn.value > tk) again(dateIn.value); } });
    const other = date && date !== tomorrow;
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': t('whenTitle') },
      h('button', { type: 'button', 'aria-pressed': String(!date), onclick: () => { if (date) again(null); } }, t('now')),
      h('button', { type: 'button', 'aria-pressed': String(date === tomorrow), onclick: () => { if (date !== tomorrow) again(tomorrow); } }, t('tomorrow')),
      h('label', { class: 'seg-pick', 'aria-pressed': String(!!other), onclick: () => { try { dateIn.showPicker(); } catch { /* Handy öffnet selbst */ } } },
        h('span', { html: ICON.cal }), h('span', null, other ? fmtDate(date) : t('otherDay')), dateIn));

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
    const note = h('input', { class: 'field', id: 'f-note', maxlength: 200, placeholder: t('notePh'), value: o.note ?? base?.note ?? '' });
    const err = h('p', { class: 'err', role: 'alert' });
    let urgent = !!r?.urgent;
    const urgentBtn = h('button', { type: 'button', class: 'urgent-btn', 'aria-pressed': String(urgent),
      onclick: () => { urgent = !urgent; urgentBtn.setAttribute('aria-pressed', String(urgent)); } },
    h('span', { html: ICON.alert }), t('urgentMark'));

    async function save() {
      const v = parseQty();
      if (!(v > 0)) { err.textContent = t('badQty'); qtyIn.classList.remove('shake'); void qtyIn.offsetWidth; qtyIn.classList.add('shake'); qtyIn.focus(); return; }
      takeName();
      if (date) {
        try {
          await post('/plan', { item: id, qty: v, unit, note: note.value, by: me, dev, date });
          closeSheet();
          toast(t('plannedToast', { name: nameOf(it), day: dayName(date) }));
        } catch (e) { if (e.message !== 'pin') err.textContent = t('error'); }
        return;
      }
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
    async function unplan() {
      try {
        await post('/unplan', { id: p.id }); closeSheet();
        toast(t('unplannedToast', { name: nameOf(it) }), t('undo'),
          () => post('/plan', { item: id, qty: p.qty, unit: p.unit, note: p.note, by: p.by, dev, date }).catch(() => toast(t('error'))));
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
      h('span', { class: 'lbl' }, t('whenTitle')), seg,
      date ? h('p', { class: 'help' }, t('planInfo', { day: dayName(date), h: planHour() })) : null,
      p ? h('p', { class: 'already plan-note' }, `${t('plannedH')}: `, h('b', null, qtyText(p)), [p.by].filter(Boolean).map(x => ` · ${x}`).join('')) : null,
      h('label', { class: 'lbl', for: 'f-qty' }, t('howMuch')),
      h('div', { class: 'stepper' },
        h('button', { type: 'button', class: 'step', 'aria-label': '−', html: ICON.minus, onclick: () => setQty(Math.max(stepOf(unit), parseQty() - stepOf(unit))) }),
        h('div', { class: 'qty-box' }, qtyIn, unitSel),
        h('button', { type: 'button', class: 'step', 'aria-label': '+', html: ICON.plus, onclick: () => setQty(parseQty() + stepOf(unit)) })),
      quick,
      date ? null : urgentBtn,
      h('label', { class: 'lbl', for: 'f-note' }, t('note')), note,
      nameField(),
      err,
      h('div', { class: 'actions' },
        h('button', { type: 'button', class: 'btn primary', onclick: save },
          date ? (p ? t('updatePlan') : t('planBtn', { day: dayName(date) })) : r ? t('update') : t('add')),
        p ? h('button', { type: 'button', class: 'btn ghost full danger', onclick: unplan }, t('removePlan')) : null,
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

  // ---------------------------------------------------------- Monatsdaten (gekauft)
  const monthKey = mo => `${mo.y}-${pad(mo.m + 1)}`;
  const prevMonth = mo => (mo.m ? { y: mo.y, m: mo.m - 1 } : { y: mo.y - 1, m: 11 });
  const nextMonth = mo => (mo.m < 11 ? { y: mo.y, m: mo.m + 1 } : { y: mo.y + 1, m: 0 });
  const monthOf = k => { const d = fromKey(k); return { y: d.getFullYear(), m: d.getMonth() }; };
  async function loadMonth(mo) {
    const start = new Date(mo.y, mo.m, 1), end = new Date(mo.y, mo.m + 1, 1), now = new Date();
    if (start > now) return [];
    const key = monthKey(mo);
    let data = histCache.get(key);
    // laufender Monat: neu holen, sobald sich die Liste geändert hat
    if (!data || (end > now && data.v !== S.v)) {
      const res = await call('GET', `/history?from=${start.getTime()}&to=${end.getTime()}`);
      data = { v: S.v, requests: res.requests };
      histCache.set(key, data);
    }
    return data.requests.filter(r => itemById(r.item));
  }
  const byDay = reqs => {
    const m = new Map();
    for (const r of reqs) { const k = dkey(new Date(r.doneAt)); (m.get(k) || m.set(k, []).get(k)).push(r); }
    return m;
  };
  const sumPrice = rows => rows.reduce((s, r) => s + (r.price || 0), 0);
  const moneyShort = p => new Intl.NumberFormat(LOCALE[lang], { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(p);
  // Wochentagsnamen ab Montag (1. Jan. 2024 war ein Montag)
  const weekdays = (style = 'narrow') => [...Array(7)].map((_, i) => new Intl.DateTimeFormat(LOCALE[lang], { weekday: style }).format(new Date(2024, 0, 1 + i)));

  // ---------------------------------------------------------- Kalender
  let calToken = 0;
  async function renderCal() {
    const mo = calMonth, tk = todayKey();
    if (!selDay) selDay = addD(tk, 1);
    $('#c-label').textContent = monthLabel(mo);
    const now = new Date();
    $('#c-next').disabled = new Date(mo.y, mo.m + 1, 1) >= new Date(now.getFullYear(), now.getMonth() + 4, 1);
    $('#cal-lead').textContent = t('calLead', { h: planHour() });
    const my = ++calToken;
    let reqs = [], selReqs = [];
    try {
      reqs = await loadMonth(mo);
      const sm = monthOf(selDay);
      selReqs = monthKey(sm) === monthKey(mo) ? reqs : await loadMonth(sm);
    } catch { /* offline: Eingeplantes geht trotzdem */ }
    if (my !== calToken) return;
    $('#cal').replaceChildren(calGrid(mo, byDay(reqs)), dayPanel(selDay, selReqs));
  }

  function calGrid(mo, bought) {
    const tk = todayKey();
    const first = new Date(mo.y, mo.m, 1);
    const lead = (first.getDay() + 6) % 7;
    const days = new Date(mo.y, mo.m + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push(h('span', { class: 'cal-d empty', 'aria-hidden': 'true' }));
    for (let d = 1; d <= days; d++) {
      const k = dkey(new Date(mo.y, mo.m, d));
      const b = bought.get(k) || [], spend = sumPrice(b), np = plansOn(k).length;
      const ne = k > tk ? expectedOn(k).length : 0;
      const mark = spend ? moneyShort(spend) : b.length ? `${num(b.length)}×` : '';
      const label = [fmtDate(k, { weekday: 'long', day: 'numeric', month: 'long' }),
        b.length ? t(b.length === 1 ? 'buys1' : 'buysN', { n: b.length }) : '', spend ? money(spend) : '',
        np ? t('plannedN', { n: np }) : '', ne ? t('expectedN', { n: ne }) : ''].filter(Boolean).join(' · ');
      cells.push(h('button', {
        type: 'button', 'aria-label': label, 'aria-pressed': String(k === selDay),
        class: 'cal-d' + (k === tk ? ' today' : '') + (k < tk ? ' past' : '') + (np ? ' has-plan' : ''),
        onclick: () => { selDay = k; renderCal().then(() => $('#day-panel')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })); },
      },
      h('span', { class: 'n' }, num(d)),
      h('span', { class: 'm' }, mark),
      np ? h('i', { class: 'pl' }, num(np)) : ne ? h('i', { class: 'ex', 'aria-hidden': 'true' }) : null));
    }
    return h('div', { class: 'cal-box' },
      h('div', { class: 'cal-wk', 'aria-hidden': 'true' }, weekdays().map(w => h('span', null, w))),
      h('div', { class: 'cal-grid' }, cells),
      h('p', { class: 'cal-key' },
        h('span', null, h('i', { class: 'pl' }, '2'), t('keyPlanned')),
        h('span', null, h('i', { class: 'ex' }), t('keyExpected')),
        h('span', null, h('b', null, '€'), t('keyBought'))));
  }

  // Alles, was zu Tag k gehört: eingeplant für k, an k auf die Liste gekommen,
  // an k gekauft – und heute zusätzlich alles, was noch offen ist.
  // Gekauftes bleibt sichtbar (durchgestrichen), Offenes bleibt normal.
  function dayRequests(k, monthReqs) {
    const tk = todayKey(), all = new Map();
    for (const r of monthReqs) all.set(r.id, r);
    for (const r of S.requests) all.set(r.id, r);               // neuester Stand gewinnt
    const belongs = r => (r.plan ? r.plan === k : dkey(new Date(r.at)) === k);
    const list = [...all.values()].filter(r => itemById(r.item) && (belongs(r)
      || (r.st === 'done' && dkey(new Date(r.doneAt)) === k) || (k === tk && r.st === 'open')));
    return {
      open: list.filter(r => r.st === 'open').sort(byUrgent),
      done: list.filter(r => r.st === 'done').sort((a, b) => a.doneAt - b.doneAt),
    };
  }

  async function buyFromCal(r, it) {
    try {
      await post('/done', { id: r.id, by: me });
      histCache.clear(); render();
      toast(t('boughtToast', { name: nameOf(it) }), t('addPrice'), () => openPrice({ ...r, st: 'done' }, it),
        t('undo'), () => post('/reopen', { id: r.id, by: me }).then(() => { histCache.clear(); render(); }).catch(() => toast(t('error'))));
    } catch { toast(t('error')); }
  }
  async function buyPlan(p, it) {
    try {
      const s = await post('/plandone', { id: p.id, by: me });
      histCache.clear(); render();
      const d = s.requests.filter(r => r.item === p.item && r.st === 'done' && r.plan === p.date).sort((a, b) => b.doneAt - a.doneAt)[0];
      toast(t('boughtToast', { name: nameOf(it) }), t('undo'),
        () => d && post('/undoplan', { id: d.id }).then(() => { histCache.clear(); render(); }).catch(() => toast(t('error'))));
    } catch { toast(t('error')); }
  }

  function dayPanel(k, monthReqs) {
    const tk = todayKey(), past = k < tk, isToday = k === tk;
    const { open, done } = dayRequests(k, monthReqs);
    const plans = plansOn(k);
    const exp = past ? [] : expectedOn(k);
    const sum = sumPrice(done.filter(r => dkey(new Date(r.doneAt)) === k));
    const total = plans.length + open.length + done.length;
    const box = h('section', { class: 'day-panel', id: 'day-panel', 'aria-labelledby': 'day-h' },
      h('h2', { class: 'day-h', id: 'day-h' },
        h('span', null, (isToday ? `${t('today')} · ` : k === addD(tk, 1) ? `${t('tomorrow')} · ` : '')
          + fmtDate(k, { weekday: 'long', day: 'numeric', month: 'long' })),
        sum ? h('b', null, money(sum)) : null));

    if (total) {
      const pct = Math.round(done.length / total * 100);
      const bar = h('i'); bar.style.width = `${pct}%`;
      box.append(h('div', { class: 'day-progress' },
        h('span', { class: 'day-progress-t' }, bar),
        h('small', null, t('doneOf', { d: num(done.length), n: num(total) }))));
    }

    // noch zu kaufen: Eingeplantes (noch nicht auf der Liste) + Offenes
    const tick = (label, fn) => h('button', { type: 'button', class: 'tick', 'aria-label': label, html: ICON.check, onclick: fn });
    const rows = [
      ...plans.map(p => {
        const it = itemById(p.item);
        return h('div', { class: 'done-row plan-row' },
          h('button', { type: 'button', class: 'plan-open', onclick: () => openItem(p.item, { date: k }) }, pic(it),
            h('span', null, h('b', null, nameOf(it)),
              h('span', null, [t('plannedH'), p.note, p.by].filter(Boolean).join(' · ')))),
          h('strong', { class: 'qty' }, qtyText(p)),
          tick(`${t('markBought')}: ${nameOf(it)}`, () => buyPlan(p, it)));
      }),
      ...open.map(r => {
        const it = itemById(r.item);
        return h('div', { class: 'done-row plan-row' + (r.urgent ? ' urgent' : '') },
          h('button', { type: 'button', class: 'plan-open', onclick: () => openItem(r.item) }, pic(it),
            h('span', null, h('b', null, nameOf(it)),
              h('span', null, [r.urgent ? t('urgent') : t('onList'), r.nf ? t('nfTag') : '', r.by].filter(Boolean).join(' · ')))),
          h('strong', { class: 'qty' }, qtyText(r)),
          tick(`${t('markBought')}: ${nameOf(it)}`, () => buyFromCal(r, it)));
      }),
    ];
    if (rows.length) {
      box.append(h('h3', { class: 'sub-h' }, past ? t('stillOpen') : t('toBuyH'), h('small', null, num(rows.length))),
        h('div', { class: 'done-list' }, rows));
    }

    if (done.length) {
      box.append(h('h3', { class: 'sub-h' }, t('boughtH'), h('small', null, num(done.length))),
        h('div', { class: 'done-list' }, done.map(r => {
          const it = itemById(r.item);
          const dd = dkey(new Date(r.doneAt));
          const time = new Intl.DateTimeFormat(LOCALE[lang], { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(r.doneAt));
          return h('div', { class: 'done-row bought-row' },
            h('span', { class: 'done-ico', html: ICON.check }),
            h('div', null, h('b', null, nameOf(it), ' · ', qtyText(r)),
              h('span', null, [r.doneBy ? t('boughtBy', { n: r.doneBy }) : t('bought'), dd === k ? time : fmtDate(dd)].join(' · '))),
            priceBtn(r, it));
        })));
    }

    if (exp.length) {
      const planAll = async () => {
        try {
          for (const f of exp) await post('/plan', { item: f.item, qty: f.qty, unit: f.unit, by: me, dev, date: k });
          toast(t('plannedAllToast', { n: exp.length, day: dayName(k) }));
        } catch { toast(t('error')); }
      };
      box.append(h('h3', { class: 'sub-h' }, t('expectedH'), h('small', null, num(exp.length))),
        h('p', { class: 'help sub-lead' }, t('expectedLead')),
        h('div', { class: 'done-list' }, exp.map(f => {
          const it = itemById(f.item);
          return h('div', { class: 'done-row exp-row' }, pic(it),
            h('div', null, h('b', null, nameOf(it)),
              h('span', null, [t('everyN', { n: num(Math.max(1, Math.round(f.every))) }), `${num(f.qty)} ${unitOf(f.unit)}`].join(' · '))),
            h('button', { type: 'button', class: 'add-plan',
              onclick: () => openItem(f.item, { date: isToday ? null : k, qty: f.qty, unit: f.unit }) },
            h('span', { html: ICON.plus }), isToday ? t('addNow') : t('planIt')));
        })),
        !isToday && exp.length > 1 ? h('button', { type: 'button', class: 'btn ghost full plan-all', onclick: planAll }, t('planAll', { n: exp.length })) : null);
    }

    if (!total && !exp.length) box.append(h('p', { class: 'none day-empty' }, past ? t('dayEmptyPast') : t('dayEmpty')));
    if (!past) {
      box.append(h('button', { type: 'button', class: 'btn primary full plan-cta',
        onclick: () => { if (isToday) { setView('need'); return; } planDate = k; query = ''; $('#q').value = ''; setView('need'); } },
      h('span', { html: isToday ? ICON.plus : ICON.cal }), isToday ? t('addToListToday') : t('planForDay', { day: dayName(k) })));
    }
    return box;
  }

  // ---------------------------------------------------------- Statistik
  let statToken = 0;
  async function renderStats() {
    const mo = statMonth;
    $('#s-label').textContent = monthLabel(mo);
    const now = new Date();
    $('#s-next').disabled = mo.y > now.getFullYear() || (mo.y === now.getFullYear() && mo.m >= now.getMonth());
    const my = ++statToken;
    let reqs, prev;
    try { [reqs, prev] = await Promise.all([loadMonth(mo), loadMonth(prevMonth(mo))]); } catch { return; }
    if (my !== statToken) return;
    drawStats(reqs, prev, mo);
  }

  const delta = (a, b) => (b > 0 ? Math.round((a - b) / b * 100) : null);
  const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  function fmtDur(ms) {
    const min = ms / 6e4;
    if (min < 90) return t('durMin', { n: num(Math.max(1, Math.round(min))) });
    const hrs = min / 60;
    if (hrs < 48) return t('durH', { n: num(Math.round(hrs)) });
    return t('durD', { n: num(Math.round(hrs / 24)) });
  }

  // Einfaches Säulendiagramm aus HTML: eine Farbe, Antippen zeigt den Wert
  function columns(rows, fmtMax, defaultIdx) {
    const max = Math.max(0, ...rows.map(r => r.v));
    const cap = h('p', { class: 'chart-cap', 'aria-live': 'polite' });
    const btns = rows.map((r, i) => {
      const bar = h('i');
      bar.style.height = max && r.v ? `${Math.max(3, r.v / max * 100)}%` : '0';
      return h('button', { type: 'button', class: 'col' + (r.cur ? ' cur' : ''), 'aria-label': `${r.label}: ${r.text}`,
        onpointerenter: () => show(i), onfocus: () => show(i), onclick: () => show(i) }, bar);
    });
    function show(i) {
      btns.forEach((b, j) => b.classList.toggle('on', i === j));
      cap.replaceChildren(h('b', null, rows[i].label), ' ', rows[i].text);
    }
    const el = h('div', { class: 'chart' },
      h('div', { class: 'plot' }, h('span', { class: 'plot-max' }, max ? fmtMax(max) : ''), h('div', { class: 'cols' }, btns)),
      h('div', { class: 'cols-x', 'aria-hidden': 'true' }, rows.map(r => h('span', null, r.tick || ''))),
      cap);
    show(defaultIdx >= 0 ? defaultIdx : rows.reduce((bi, r, i) => (r.v > rows[bi].v ? i : bi), 0));
    return el;
  }

  function drawStats(reqs, prev, mo) {
    const box = $('#stats'); box.replaceChildren();
    if (!reqs.length) { box.append(h('p', { class: 'none hist-empty' }, t('noHistory'))); return; }
    const pm = new Intl.DateTimeFormat(LOCALE[lang], { month: 'short' }).format(new Date(prevMonth(mo).y, prevMonth(mo).m, 1));
    // laufender Monat: nur mit denselben Tagen des Vormonats vergleichen (1. bis heute)
    const nowD = new Date(), running = mo.y === nowD.getFullYear() && mo.m === nowD.getMonth();
    if (running) prev = prev.filter(r => new Date(r.doneAt).getDate() <= nowD.getDate());
    const vs = running ? t('vsPrevPart', { m: pm, d: num(nowD.getDate()) }) : t('vsPrev', { m: pm });
    const total = sumPrice(reqs), prevTotal = sumPrice(prev);
    const priced = total > 0;
    const noPrice = reqs.filter(r => r.price == null).length;
    const urgentN = reqs.filter(r => r.urgent).length;
    const wait = median(reqs.filter(r => r.doneAt > r.at).map(r => r.doneAt - r.at));
    const prevWait = median(prev.filter(r => r.doneAt > r.at).map(r => r.doneAt - r.at));
    const dEl = (d, upWord) => (d == null ? h('small', { class: 'delta' }, t('noCompare')) :
      h('small', { class: 'delta' }, `${d > 0 ? '▲' : d < 0 ? '▼' : '='} ${num(Math.abs(d))} % ${vs}`));
    const tile = (label, value, sub, main) => h('div', { class: 'tile-s' + (main ? ' main' : '') }, h('span', null, label), h('b', null, value), sub);

    box.append(h('div', { class: 'tiles' },
      tile(t('spent'), money(total), priced ? dEl(delta(total, prevTotal)) : h('small', { class: 'delta' }, t('noPricesYet')), true),
      tile(t('purchases'), num(reqs.length), dEl(delta(reqs.length, prev.length))),
      tile(t('timeToBuy'), wait ? fmtDur(wait) : '–', prevWait ? h('small', { class: 'delta' }, `${vs}: ${fmtDur(prevWait)}`) : null),
      tile(t('urgent'), num(urgentN), h('small', { class: 'delta' }, t('urgentShare', { p: num(Math.round(urgentN / reqs.length * 100)) })))));
    if (noPrice && priced) box.append(h('p', { class: 'hint' }, t('noPrice', { n: noPrice })));

    // Pro Tag
    const days = new Date(mo.y, mo.m + 1, 0).getDate();
    const per = byDay(reqs), tk = todayKey();
    const dayRows = [...Array(days)].map((_, i) => {
      const k = dkey(new Date(mo.y, mo.m, i + 1)), rows = per.get(k) || [], s = sumPrice(rows);
      const v = priced ? s : rows.length;
      return { v, cur: k === tk, label: fmtDate(k), tick: (i + 1) % 5 === 0 || i === 0 ? num(i + 1) : '',
        text: rows.length ? [priced ? money(s) : '', t(rows.length === 1 ? 'buys1' : 'buysN', { n: rows.length })].filter(Boolean).join(' · ') : t('nothingBought') };
    });
    box.append(h('h2', { class: 'h-sec' }, priced ? t('chartSpendDay') : t('chartBuysDay')),
      columns(dayRows, priced ? moneyShort : num, dayRows.findIndex(r => r.cur && r.v)));

    // Wochentag, an dem etwas auf die Liste kam
    const wd = [0, 0, 0, 0, 0, 0, 0];
    for (const r of reqs) wd[(new Date(r.at).getDay() + 6) % 7] += 1;
    const names = weekdays('long'), short = weekdays('short');
    box.append(h('h2', { class: 'h-sec' }, t('chartWeekday')), h('p', { class: 'help sub-lead' }, t('chartWeekdayLead')),
      columns(wd.map((v, i) => ({ v, label: names[i], tick: short[i], text: t(v === 1 ? 'entries1' : 'entriesN', { n: v }) })), num, -1));

    // Kategorien
    const cats = S.cats.map(c => {
      const rows = reqs.filter(r => itemById(r.item)?.cat === c.id);
      return { name: c.name[lang] || c.name.de, n: rows.length, s: sumPrice(rows) };
    }).filter(c => c.n).sort((a, b) => (priced ? b.s - a.s : 0) || b.n - a.n);
    const cmax = Math.max(...cats.map(c => (priced ? c.s : c.n)));
    box.append(h('h2', { class: 'h-sec' }, t('chartCat')),
      h('div', { class: 'hbars' }, cats.map(c => {
        const bar = h('i');
        bar.style.width = `${Math.max(2, (priced ? c.s : c.n) / cmax * 100)}%`;
        return h('div', { class: 'hbar' }, h('span', { class: 'hbar-l' }, c.name),
          h('span', { class: 'hbar-t' }, bar), h('b', null, priced ? money(c.s) : num(c.n)),
          h('small', null, t(c.n === 1 ? 'buys1' : 'buysN', { n: c.n })));
      })));

    // Ranglisten
    const perItem = new Map();
    for (const r of reqs) {
      const p = perItem.get(r.item) || { item: r.item, n: 0, spent: 0, qty: 0, units: new Set(), times: [] };
      p.n += 1; p.spent += r.price || 0; p.qty += r.qty; p.units.add(r.unit); p.times.push(r.doneAt);
      perItem.set(r.item, p);
    }
    const stats = [...perItem.values()];
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
      h('div', { class: 'stat-list' }, stats.sort((a, b) => b.n - a.n || b.spent - a.spent).slice(0, 10).map(p => statRow(p, `${num(p.n)}×`))));
    const costly = stats.filter(p => p.spent > 0).sort((a, b) => b.spent - a.spent).slice(0, 10);
    if (costly.length) box.append(h('h2', { class: 'h-sec' }, t('reportCost')),
      h('div', { class: 'stat-list' }, costly.map(p => statRow(p, money(p.spent)))));
    box.append(h('button', { type: 'button', class: 'plan-link', onclick: () => { calMonth = { ...mo }; setView('cal'); } },
      h('span', { class: 'opt-ico', html: ICON.cal }), h('span', null, h('b', null, t('archiveHint')), h('small', null, monthLabel(mo))),
      h('span', { class: 'opt-go', html: ICON.chev })));
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
  $('#c-prev').addEventListener('click', () => { calMonth = prevMonth(calMonth); renderCal(); });
  $('#c-next').addEventListener('click', () => { calMonth = nextMonth(calMonth); renderCal(); });
  $('#s-prev').addEventListener('click', () => { statMonth = prevMonth(statMonth); renderStats(); });
  $('#s-next').addEventListener('click', () => { statMonth = nextMonth(statMonth); renderStats(); });
  $('#bell').addEventListener('click', async () => { await loadPushKey(); openNotif(); });
  initPush();
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => { planDate = null; setView(b.dataset.view); }));
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
