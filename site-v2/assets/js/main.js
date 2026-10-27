/* ============================================================
   THE BAKERY — Website v2
   1. Sprache (DE / EN / AR mit RTL)
   2. Seitenfarbe folgt der Sektion in der Bildschirmmitte
   3. Scroll-Bewegungen: Teller drehen sich, Zutaten schweben, Ofen-Wörter gleiten
   4. Die Frau aus dem Logo: steht im Hero, schrumpft beim Scrollen nach unten
      und läuft dann am unteren Rand mit. Beine aus tools/rig-logo.py.
   ============================================================ */
(() => {
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = x => 1 - Math.pow(1 - x, 3);

  /* ---------- 1. Sprache ---------- */
  const store = {
    get() { try { return localStorage.getItem('tb-lang'); } catch (e) { return null; } },
    set(v) { try { localStorage.setItem('tb-lang', v); } catch (e) { /* privat */ } },
  };
  function setLang(lang) {
    if (!I18N[lang]) lang = 'de';
    root.lang = lang; root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const v = I18N[lang][el.dataset.i18n]; if (v != null) el.textContent = v;
    });
    document.querySelectorAll('.lang button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    store.set(lang);
  }
  document.querySelectorAll('.lang button').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
  setLang(new URLSearchParams(location.search).get('lang') || store.get() || 'de');

  /* ---------- 2. Farbe der Seite ---------- */
  const grounds = [...document.querySelectorAll('[data-ground]')];
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) root.dataset.ground = e.target.dataset.ground; });
  }, { rootMargin: '-50% 0px -50% 0px' });
  grounds.forEach(g => io.observe(g));
  root.dataset.ground = 'sky';

  /* ---------- 3. Scroll-Bewegungen ---------- */
  const nav = document.querySelector('.nav');
  const hero = document.querySelector('.hero');
  const spins = [...document.querySelectorAll('[data-spin]')];
  const floats = [...document.querySelectorAll('[data-float]')];
  const drifts = [...document.querySelectorAll('[data-drift]')];

  function motion(y, vh) {
    nav.classList.toggle('solid', y > hero.offsetHeight * .6);
    if (reduce) return;
    for (const el of spins) el.style.transform = `rotate(${y * +el.dataset.spin}deg)`;
    for (const el of floats) {
      const r = el.getBoundingClientRect(), off = (r.top + r.height / 2 - vh / 2) * +el.dataset.float;
      el.style.transform = `translateY(${off}px) rotate(${off * .15}deg)`;
    }
    for (const el of drifts) {
      const r = el.parentElement.getBoundingClientRect();
      el.style.transform = `translateX(${(r.top - vh / 2) * +el.dataset.drift}px)`;
    }
  }

  /* ---------- 4. Die Frau ---------- */
  const walker = document.getElementById('walker');
  const stage = document.querySelector('.hero-stage');
  const finish = document.querySelector('.finish');
  const cv = document.getElementById('puppet'), ctx = cv.getContext('2d');
  const img = src => { const i = new Image(); i.src = src; return i; };
  const BODY = img('assets/img/body.webp'), LEG_F = img('assets/img/leg-front.webp'), LEG_B = img('assets/img/leg-back.webp');
  const HIP_F = [125, 615], HIP_B = [320, 600];        // Drehpunkte im 438×800-Logo
  const HAIR = { x0: 335, x1: 438, y0: 50, y1: 215 };  // fliegende Haarspitze
  const AR = 800 / 438;

  let lastX = null, facing = 1, phase = 0, stride = 0, lastMove = 0;

  function drawPuppet(t) {
    const s = Math.sin(phase);
    const aF = (-4 + 13 * s) * stride, aB = (4 - 13 * s) * stride;
    ctx.clearRect(0, 0, 438, 800);
    for (const [im, [hx, hy], a] of [[LEG_B, HIP_B, aB], [LEG_F, HIP_F, aF]]) {
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(a * Math.PI / 180); ctx.translate(-hx, -hy); ctx.drawImage(im, 0, 0); ctx.restore();
    }
    ctx.save(); ctx.beginPath();
    ctx.rect(0, 0, 438, 800); ctx.rect(HAIR.x1, HAIR.y0, HAIR.x0 - HAIR.x1, HAIR.y1 - HAIR.y0);
    ctx.clip('evenodd'); ctx.drawImage(BODY, 0, 0); ctx.restore();
    const wave = 3 + 5 * stride;
    for (let x = HAIR.x0; x < HAIR.x1; x += 2) {
      const k = Math.pow((x - HAIR.x0) / (HAIR.x1 - HAIR.x0), 1.4);
      const dy = wave * k * Math.sin(t * 5 - x * .045);
      ctx.drawImage(BODY, x, HAIR.y0, 2, HAIR.y1 - HAIR.y0, x, HAIR.y0 + dy, 2, HAIR.y1 - HAIR.y0);
    }
  }

  function place(t, y, vw, vh) {
    const small = vw < 860;
    const dockW = small ? 58 : 92, margin = small ? 8 : 18;
    // Startpunkt: groß in der Mitte des Hero
    const sr = stage.getBoundingClientRect();
    const heroH = Math.min(sr.height * .95, small ? 300 : 380);
    const heroW = heroH / AR;
    const k = ease(clamp(y / (vh * .55)));
    // Laufweg: von rechts nach links über die ganze Seite, Ziel ist "Komm vorbei"
    const walkStart = vh * .55;
    const walkEnd = Math.max(walkStart + 1, finish.offsetTop - vh * .45);
    const p = clamp((y - walkStart) / (walkEnd - walkStart));
    const rtl = root.dir === 'rtl';
    const fromX = vw - dockW - margin, toX = vw / 2 - dockW / 2;
    const dockX = rtl ? lerp(margin, toX, p) : lerp(fromX, toX, p);
    const w = lerp(heroW, dockW, k);
    const x = lerp(sr.left + sr.width / 2 - heroW / 2, dockX, k);
    const yTop = lerp(sr.top + sr.height - heroH, vh - w * AR - margin, k);

    // Richtung und Schritt aus der echten Bewegung
    if (lastX !== null) {
      const dx = x - lastX;
      if (Math.abs(dx) > .3) {
        facing = dx < 0 ? 1 : -1;                 // das Logo schaut nach links
        phase += Math.abs(dx) * .045 / (w / 150);
        lastMove = t;
      }
    }
    lastX = x;
    const moving = t - lastMove < .18;
    stride = lerp(stride, moving && !reduce ? 1 : 0, .15);
    const bob = -Math.abs(Math.cos(phase)) * 5 * stride;
    walker.style.width = w + 'px';
    walker.style.transform = `translate(${x}px, ${yTop + bob}px)`;
    cv.style.transform = `scaleX(${facing})`;   // nur die Frau dreht sich um, die Sprechblase bleibt lesbar
    const fr = finish.getBoundingClientRect();
    walker.classList.toggle('talk', fr.top < vh * .8 && !moving);
    drawPuppet(t);
  }

  function frame(now) {
    const t = now / 1000, y = scrollY, vw = innerWidth, vh = innerHeight;
    motion(y, vh);
    place(t, y, vw, vh);
    requestAnimationFrame(frame);
  }
  const ready = [BODY, LEG_F, LEG_B].map(i => i.complete ? null : new Promise(r => { i.onload = r; i.onerror = r; }));
  Promise.all(ready).then(() => requestAnimationFrame(frame));
})();
