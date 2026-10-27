/* ============================================================
   the.bakery — المحرّك
   ما بتحتاج تعدّل هون إشي.
   المنيو بـ menu-data.js والنصوص بـ i18n.js
   ============================================================ */

(function () {
  "use strict";

  var STORE = "bakery-lang";
  var DEFAULT_LANG = "de";
  var lang = DEFAULT_LANG;

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ألوان الغرف، لازم تطابق اللي بالـ CSS
  var ROOM = {
    ink:      { bg:"#000045", fg:"#BFE4ED" },
    sky:      { bg:"#BFE4ED", fg:"#000045" },
    blush:    { bg:"#F1C2CC", fg:"#000045" },
    gold:     { bg:"#C9762B", fg:"#000045" },
    cream:    { bg:"#F4EAD7", fg:"#000045" },
    burgundy: { bg:"#730E23", fg:"#F1C2CC" }
  };


  /* ==========================================================
     أدوات صغيرة
     ========================================================== */

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function money(v) { return v.toFixed(2).replace(".", ",") + " €"; }

  function pickLang() {
    var q = new URLSearchParams(location.search).get("lang");
    if (q && I18N[q]) return q;
    try { var s = localStorage.getItem(STORE); if (s && I18N[s]) return s; } catch (e) {}
    var n = (navigator.language || "").slice(0, 2).toLowerCase();
    return I18N[n] ? n : DEFAULT_LANG;
  }

  function findCourse(id) {
    for (var i = 0; i < MENU.length; i++) if (MENU[i].id === id) return MENU[i];
    return null;
  }
  function findDish(id) {
    for (var i = 0; i < MENU.length; i++) {
      var it = MENU[i].items || [];
      for (var j = 0; j < it.length; j++) if (it[j].id === id) return it[j];
    }
    return null;
  }
  function liveCourses() {
    return MENU.filter(function (c) { return c.items && c.items.length; });
  }


  /* ==========================================================
     بناء الصفحة
     ========================================================== */

  function buildPrice(item, cls) {
    var p = el("span");
    if (item.price == null) {
      p.className = cls + " " + cls + "--soon";
      p.setAttribute("data-i18n", "priceSoon");
    } else {
      p.className = cls;
      p.textContent = money(item.price);
    }
    return p;
  }

  function buildMenu() {
    var host = document.getElementById("menu");
    host.innerHTML = "";

    liveCourses().forEach(function (course, i) {
      var sec = el("section", "course room");
      sec.id = course.id;
      sec.setAttribute("data-room", course.ground);

      var k = el("span", "kicker");
      k.setAttribute("data-i18n", "menuKicker");

      var h = el("h2", "course__head");
      h.setAttribute("data-course-title", course.id);

      var note = el("p", "course__note");
      note.setAttribute("data-course-note", course.id);

      var ul = el("ul", "dishes");
      course.items.forEach(function (item) { ul.appendChild(buildDish(item)); });

      sec.appendChild(k); sec.appendChild(h); sec.appendChild(note); sec.appendChild(ul);

      // حبات الرز بالقسم الأول بس، حتى ما تزحم
      if (i === 0) {
        var g = el("img", "course__grains");
        g.src = "assets/img/grains.webp"; g.alt = ""; g.loading = "lazy";
        g.setAttribute("aria-hidden", "true");
        sec.appendChild(g);
      }

      host.appendChild(sec);
    });
  }

  function buildDish(item) {
    var li = el("li", "dish");

    var name = el("h3", "dish__name", item.name);
    var desc = el("p", "dish__desc");
    desc.setAttribute("data-dish-desc", item.id);

    li.appendChild(name);
    li.appendChild(buildPrice(item, "dish__price"));
    li.appendChild(desc);

    if (item.tags && item.tags.length) {
      var wrap = el("div", "dish__tags");
      item.tags.forEach(function (t) {
        var s = el("span", "tag tag--" + t);
        s.setAttribute("data-i18n", "tag" + t.charAt(0).toUpperCase() + t.slice(1));
        wrap.appendChild(s);
      });
      li.appendChild(wrap);
    }

    if (item.image) {
      var pop = el("img", "dish__pop");
      pop.src = item.image; pop.alt = ""; pop.loading = "lazy";
      pop.setAttribute("aria-hidden", "true");
      li.appendChild(pop);
    }

    return li;
  }

  /* الجديد: أي صنف موسوم new بينسحب تلقائياً */
  function buildRail() {
    var rail = document.getElementById("rail");
    var drops = document.getElementById("drops");
    var fresh = [];

    MENU.forEach(function (c) {
      (c.items || []).forEach(function (it) {
        if (it.tags && it.tags.indexOf("new") > -1) fresh.push({ item: it, course: c });
      });
    });

    if (!fresh.length) { drops.remove(); return; }

    rail.innerHTML = "";
    fresh.forEach(function (row) {
      var a = el("a", "drop");
      a.href = "#" + row.course.id;

      if (row.item.image) {
        var img = el("img", "drop__img");
        img.src = row.item.image; img.alt = ""; img.loading = "lazy";
        a.appendChild(img);
      }

      a.appendChild(el("h3", "drop__name", row.item.name));
      a.appendChild(buildPrice(row.item, "drop__price"));
      rail.appendChild(a);
    });
  }

  function buildTabs() {
    var host = document.getElementById("tabsScroll");
    host.innerHTML = "";

    liveCourses().forEach(function (c) {
      var b = el("button", "tab");
      b.type = "button";
      b.setAttribute("data-tab", c.id);
      b.addEventListener("click", function () {
        var target = document.getElementById(c.id);
        if (target) target.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" });
      });
      host.appendChild(b);
    });
  }

  function buildMarquee() {
    var track = document.getElementById("marquee");
    track.innerHTML = "";
    // بنكرّر النص كفاية حتى يغطي أعرض شاشة مرتين
    for (var i = 0; i < 12; i++) {
      var s = el("span");
      s.innerHTML = 'bakes <b>^</b> bowls <b>^</b> brews <b>^</b>';
      track.appendChild(s);
    }
  }


  /* ==========================================================
     اللغة
     ========================================================== */

  function applyLang(next) {
    lang = I18N[next] ? next : DEFAULT_LANG;
    var t = I18N[lang];

    document.documentElement.lang = lang;
    document.documentElement.dir = t.dir;

    document.querySelectorAll("[data-i18n]").forEach(function (n) {
      var key = n.getAttribute("data-i18n");
      if (!(key in t)) return;
      if (key === "visitAddress") n.innerHTML = t[key];
      else n.textContent = t[key];
    });

    document.querySelectorAll("[data-course-title]").forEach(function (n) {
      var c = findCourse(n.getAttribute("data-course-title"));
      if (c) n.textContent = c.title[lang];
    });
    document.querySelectorAll("[data-course-note]").forEach(function (n) {
      var c = findCourse(n.getAttribute("data-course-note"));
      if (c) n.textContent = c.note[lang];
    });
    document.querySelectorAll("[data-dish-desc]").forEach(function (n) {
      var d = findDish(n.getAttribute("data-dish-desc"));
      if (d) n.textContent = d.desc[lang];
    });

    document.querySelectorAll(".tab").forEach(function (b) {
      var c = findCourse(b.getAttribute("data-tab"));
      if (c) b.textContent = c.title[lang];
    });

    document.querySelectorAll(".lang button").forEach(function (b) {
      b.setAttribute("aria-current", b.getAttribute("data-lang") === lang ? "true" : "false");
    });

    try { localStorage.setItem(STORE, lang); } catch (e) {}
    if (window.ScrollTrigger) ScrollTrigger.refresh();
  }


  /* ==========================================================
     شاشة التحميل
     ========================================================== */

  function runBoot(done) {
    var boot = document.getElementById("boot");
    var fill = document.getElementById("bootFill");
    var num  = document.getElementById("bootNum");
    var pct  = 0;
    var loaded = false;

    window.addEventListener("load", function () { loaded = true; });

    // العدّاد بيمشي لحاله، وبيسرّع لما الصفحة تخلص تحميل
    var tick = setInterval(function () {
      var ceiling = loaded ? 100 : 88;
      var step = loaded ? 9 : Math.max(1, (ceiling - pct) * 0.12);
      pct = Math.min(ceiling, pct + step);
      num.textContent = Math.round(pct);
      fill.style.width = pct + "%";

      if (pct >= 100) { clearInterval(tick); setTimeout(exit, 180); }
    }, 55);

    // شبكة أمان لو صورة علقت
    setTimeout(function () { loaded = true; }, 3500);

    var finished = false;
    function finish(cb) {
      if (finished) return;
      finished = true;
      boot.style.display = "none";
      if (cb) cb();
    }

    function exit() {
      document.body.classList.remove("is-booting");
      boot.classList.add("is-gone");

      // لو التبويبة بالخلفية، المتصفح بيوقف الأنيميشن. هاي شبكة أمان.
      setTimeout(function () { finish(done); }, 1600);

      if (REDUCED || !window.gsap) {
        finish(done);
        return;
      }

      var panels = boot.querySelectorAll(".boot__panels i");
      gsap.timeline({ onComplete: function () { finish(done); } })
        .to([".boot__walk", ".boot__meta", ".boot__bar", ".boot__road"], {
          opacity: 0, duration: .25, ease: "power2.in"
        })
        .to(panels, {
          yPercent: 0, duration: .55, ease: "expo.inOut", stagger: .055
        }, "-=.1")
        .to(boot, { opacity: 0, duration: .3, ease: "power2.out" }, "+=.05");
    }
  }


  /* ==========================================================
     الحركة
     ========================================================== */

  function initMotion() {
    if (!window.gsap) return;
    gsap.registerPlugin(ScrollTrigger);

    /* ---- تمرير ناعم، مربوط بساعة GSAP ---- */
    if (!REDUCED && window.Lenis) {
      var lenis = new Lenis({ duration: 1.05, smoothWheel: true, touchMultiplier: 1.6 });
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    }

    /* ---- دخول الهيرو ---- */
    var heroLines = document.querySelectorAll(".hero__head .line > span");
    if (!REDUCED) {
      gsap.timeline({ delay: .12 })
        .from(".hero__tag", { yPercent: 120, opacity: 0, duration: .5, ease: "expo.out" })
        .from(heroLines, { yPercent: 108, duration: .8, ease: "expo.out", stagger: .09 }, "-=.28")
        .from(".hero__sub", { y: 18, opacity: 0, duration: .5, ease: "power2.out" }, "-=.42")
        .from(".cta-jump", { y: 18, opacity: 0, duration: .45, ease: "power2.out" }, "-=.34")
        .from(".hero__bowl", { yPercent: 22, opacity: 0, duration: .9, ease: "expo.out" }, "-=.8")
        .from(".fly", { scale: .3, opacity: 0, duration: .7, ease: "back.out(1.7)", stagger: .07 }, "-=.7");
    }

    /* ---- المكوّنات بتطفو وبتتحرك مع السكرول ---- */
    if (!REDUCED) {
      gsap.utils.toArray(".fly").forEach(function (n, i) {
        gsap.to(n, {
          y: "+=22", rotation: i % 2 ? 9 : -9,
          duration: 3 + i * .45, ease: "sine.inOut",
          yoyo: true, repeat: -1
        });
        gsap.to(n, {
          yPercent: (i % 2 ? -40 : -78), ease: "none",
          scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1 }
        });
      });

      gsap.to(".hero__bowl", {
        yPercent: -18, rotation: 5, ease: "none",
        scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 1 }
      });
    }

    /* ---- الشريط المتحرك ---- */
    var track = document.getElementById("marquee");
    if (track && !REDUCED) {
      var half = track.scrollWidth / 2;
      gsap.to(track, {
        x: -half, duration: 22, ease: "none", repeat: -1,
        modifiers: { x: function (x) { return (parseFloat(x) % half) + "px"; } }
      });
    }

    /* ---- ظهور محتوى كل غرفة ----
       إزاحة فقط، بدون opacity. لو GSAP ما حمّل أو المستخدم فتح الصفحة
       بطريقة ما بتشغّل ScrollTrigger، المحتوى بيضل ظاهر. المنيو لازم
       يُقرأ دايماً حتى لو الحركة وقعت. */
    if (!REDUCED) {
      gsap.utils.toArray(".course, .drops, .visit").forEach(function (sec) {
        var bits = sec.querySelectorAll(".kicker, h2, .course__note, .drops__note, .dish, .drop, .visit__grid > *");
        if (!bits.length) return;
        gsap.from(bits, {
          y: 30,
          duration: .6,
          ease: "power3.out",
          stagger: .05,
          scrollTrigger: { trigger: sec, start: "top 85%", once: true }
        });
      });
    }

    /* ---- الشريط العلوي والتبويبات بياخدوا لون الغرفة اللي تحتهم ----
       القياس من تحت التبويبات، لأنها هي اللي ملاصقة للمحتوى */
    var bar = document.getElementById("bar");
    var tabsBar = document.getElementById("tabs");
    var offset = function () { return bar.offsetHeight + tabsBar.offsetHeight + 2; };
    var themeMeta = document.querySelector('meta[name="theme-color"]');

    gsap.utils.toArray(".room").forEach(function (sec) {
      var c = ROOM[sec.getAttribute("data-room")];
      if (!c) return;
      ScrollTrigger.create({
        trigger: sec,
        start: function () { return "top " + offset() + "px"; },
        end: function () { return "bottom " + offset() + "px"; },
        onToggle: function (self) {
          if (!self.isActive) return;
          gsap.to([bar, tabsBar], { backgroundColor: c.bg, color: c.fg, duration: .35, ease: "power2.out" });
          bar.style.setProperty("--bar-bg", c.bg);
          bar.style.setProperty("--bar-fg", c.fg);
          if (themeMeta) themeMeta.setAttribute("content", c.bg);
        }
      });
    });

    /* ---- التبويبة النشطة تتبع السكرول ---- */

    liveCourses().forEach(function (c) {
      var sec = document.getElementById(c.id);
      var tab = document.querySelector('.tab[data-tab="' + c.id + '"]');
      if (!sec || !tab) return;

      ScrollTrigger.create({
        trigger: sec,
        start: function () { return "top " + offset() + "px"; },
        end: function () { return "bottom " + offset() + "px"; },
        onToggle: function (self) {
          if (!self.isActive) return;
          document.querySelectorAll(".tab").forEach(function (t) { t.classList.remove("is-on"); });
          tab.classList.add("is-on");
          // التبويبة النشطة تفضل ظاهرة بالشريط الأفقي
          tab.scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", inline: "center", block: "nearest" });
        }
      });
    });

    ScrollTrigger.refresh();
  }


  /* ==========================================================
     تشغيل
     ========================================================== */

  function markToday() {
    var d = new Date().getDay();
    var key = d === 0 ? "sun" : d === 6 ? "sat" : "week";
    var row = document.querySelector('.hours__row[data-day="' + key + '"]');
    if (row) row.classList.add("is-today");
  }

  function start() {
    buildMenu();
    buildRail();
    buildTabs();
    buildMarquee();
    applyLang(pickLang());
    markToday();

    document.getElementById("year").textContent = new Date().getFullYear();

    document.querySelectorAll(".lang button").forEach(function (b) {
      b.setAttribute("data-label", b.textContent);
      b.addEventListener("click", function () { applyLang(b.getAttribute("data-lang")); });
    });

    runBoot(initMotion);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }

})();
