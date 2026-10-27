/* ============================================================
   Instagram: آخر 6 بوستات جوّا الموقع
   ============================================================

   إنستغرام ما بيسمح لموقع يجيب البوستات بدون ربط بالحساب،
   فمنستعمل خدمة مجانية اسمها Behold (behold.so):

   1. افتح behold.so وسجّل دخول بحساب إنستغرام تبع المحل
   2. اعمل Feed جديد واختار "JSON"
   3. انسخ رقم الـ Feed (بيكون متل: AbCdEf123456) وحطه تحت بين ' '
   4. ارفع الموقع من جديد. خلص، البوستات بتتحدّث لحالها

   طول ما الرقم فاضي، القسم بيعرض صور المحل الموجودة وبيوصّل لصفحة الإنستغرام.
   ============================================================ */
const BEHOLD_FEED_ID = '';

(() => {
  if (!BEHOLD_FEED_ID) return;
  const grid = document.getElementById('insta-grid');
  fetch(`https://feeds.behold.so/${BEHOLD_FEED_ID}`)
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(data => {
      const posts = (Array.isArray(data) ? data : data.posts || []).slice(0, 6);
      if (!posts.length) return;
      grid.innerHTML = posts.map(p => {
        const src = (p.sizes && p.sizes.medium && p.sizes.medium.mediaUrl) || p.thumbnailUrl || p.mediaUrl;
        const alt = (p.prunedCaption || p.caption || 'Instagram').slice(0, 90).replace(/"/g, '&quot;');
        return `<a class="tile" href="${p.permalink}" target="_blank" rel="noopener"><img src="${src}" alt="${alt}" loading="lazy"></a>`;
      }).join('');
    })
    .catch(() => { /* بيضل يعرض الصور الاحتياطية */ });
})();
