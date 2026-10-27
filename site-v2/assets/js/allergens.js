/* بيحط حروف الحساسية جنب كل طبق من allergen-data.js، وبيبني الشرح بلغة الصفحة */
(() => {
  const NAMES = {
    de: { A: 'Gluten', B: 'Krebstiere', C: 'Ei', D: 'Fisch', E: 'Erdnuss', F: 'Soja', G: 'Milch / Laktose', H: 'Schalenfrüchte', L: 'Sellerie', M: 'Senf', N: 'Sesam', O: 'Sulfite', P: 'Lupinen', R: 'Weichtiere' },
    en: { A: 'Gluten', B: 'Crustaceans', C: 'Egg', D: 'Fish', E: 'Peanut', F: 'Soy', G: 'Milk / lactose', H: 'Tree nuts', L: 'Celery', M: 'Mustard', N: 'Sesame', O: 'Sulphites', P: 'Lupin', R: 'Molluscs' },
    ar: { A: 'غلوتين', B: 'قشريات', C: 'بيض', D: 'سمك', E: 'فول سوداني', F: 'صويا', G: 'حليب ولاكتوز', H: 'مكسّرات', L: 'كرفس', M: 'خردل', N: 'سمسم', O: 'كبريتيت', P: 'ترمس', R: 'رخويات' },
  };
  function render() {
    const names = NAMES[document.documentElement.lang] || NAMES.de;
    document.querySelectorAll('[data-dish]').forEach(el => {
      const codes = (ALLERGENS[el.dataset.dish] || '').trim().split(/\s+/).filter(Boolean);
      el.querySelector('.alg').innerHTML = codes.map(c => `<abbr title="${names[c] || c}">${c}</abbr>`).join('');
    });
    document.getElementById('alg-legend').innerHTML =
      Object.entries(names).map(([c, n]) => `<li><b>${c}</b> ${n}</li>`).join('');
  }
  render();
  // nach Sprachwechsel neu
  document.querySelectorAll('.lang button').forEach(b => b.addEventListener('click', () => setTimeout(render)));
})();
