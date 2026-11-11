// ============================================================
// Einkaufsliste / Nachschub: Kategorien, Einheiten und die
// Artikel, die das Team normalerweise bestellt.
//
// Neuen Standard-Artikel hinzufügen: einen Block kopieren, eine neue
// eindeutige id geben (nur a-z, 0-9, -), Bild nach
// site-v2/einkauf/img/<id>.webp legen. Ohne Bild: img: '_neu'.
// \u00AD = unsichtbare Trennstelle, damit lange Wörter auf dem Handy
// sauber umbrechen (z. B. Mineral-wasser).
// Artikel, die das Team selbst in der App anlegt, landen nicht hier,
// sondern in data/einkauf.json.
// ============================================================

export const LANGS = ['de', 'en', 'it', 'ar'];

export const CATEGORIES = [
  { id: 'bakery', name: { de: 'Brot & Gebäck', en: 'Bread & pastry', it: 'Pane e dolci', ar: 'خبز ومعجنات' } },
  { id: 'veg', name: { de: 'Gemüse & Kräuter', en: 'Veg & herbs', it: 'Verdura ed erbe', ar: 'خضار وأعشاب' } },
  { id: 'dairy', name: { de: 'Milch, Käse & Eier', en: 'Milk, cheese & eggs', it: 'Latte, formaggi e uova', ar: 'حليب وأجبان وبيض' } },
  { id: 'meat', name: { de: 'Fleisch & Fisch', en: 'Meat & fish', it: 'Carne e pesce', ar: 'لحوم وسمك' } },
  { id: 'ready', name: { de: 'Saucen & Salate', en: 'Sauces & salads', it: 'Salse e insalate', ar: 'صوصات وسلطات' } },
  { id: 'frozen', name: { de: 'Tiefkühl', en: 'Frozen', it: 'Surgelati', ar: 'مجمّدات' } },
  { id: 'pantry', name: { de: 'Vorrat', en: 'Dry goods', it: 'Dispensa', ar: 'مؤونة' } },
  { id: 'drinks', name: { de: 'Getränke & Kaffee', en: 'Drinks & coffee', it: 'Bevande e caffè', ar: 'مشروبات وقهوة' } },
];

export const UNITS = {
  stk: { de: 'Stk', en: 'pcs', it: 'pz', ar: 'حبة' },
  kg: { de: 'kg', en: 'kg', it: 'kg', ar: 'كيلو' },
  l: { de: 'Liter', en: 'litres', it: 'litri', ar: 'لتر' },
  pkg: { de: 'Pkg', en: 'packs', it: 'conf.', ar: 'باكيت' },
  karton: { de: 'Karton', en: 'boxes', it: 'cartoni', ar: 'كرتونة' },
  kiste: { de: 'Kiste', en: 'crates', it: 'casse', ar: 'صندوق' },
  becher: { de: 'Becher', en: 'tubs', it: 'vaschette', ar: 'علبة' },
  glas: { de: 'Glas', en: 'jars', it: 'barattoli', ar: 'مرطبان' },
  dose: { de: 'Dose', en: 'cans', it: 'lattine', ar: 'علبة معدن' },
  flasche: { de: 'Flasche', en: 'bottles', it: 'bottiglie', ar: 'قنينة' },
  bund: { de: 'Bund', en: 'bunches', it: 'mazzi', ar: 'ربطة' },
  sack: { de: 'Sack', en: 'sacks', it: 'sacchi', ar: 'كيس' },
};

// Texte der Handy-Benachrichtigungen
export const PUSH_TEXT = {
  de: { title: 'THE BAKERY · Nachschub', added: 'Neu auf der Liste: {names}', urgent: 'Dringend: {names}', daily: '{n} Sachen fehlen: {names}', test: 'Benachrichtigungen funktionieren ✓' },
  en: { title: 'THE BAKERY · Restock', added: 'New on the list: {names}', urgent: 'Urgent: {names}', daily: '{n} things missing: {names}', test: 'Notifications are working ✓' },
  it: { title: 'THE BAKERY · Rifornimento', added: 'Nuovo in lista: {names}', urgent: 'Urgente: {names}', daily: 'Mancano {n} cose: {names}', test: 'Le notifiche funzionano ✓' },
  ar: { title: 'THE BAKERY · النواقص', added: 'انضاف للقائمة: {names}', urgent: 'مستعجل: {names}', daily: 'ناقص {n} أغراض: {names}', test: 'التنبيهات شغالة ✓' },
};

// Texte der E-Mail an den Chef / die Chefin
export const MAIL_TEXT = {
  de: { title: 'Einkaufsliste', count: '{n} Artikel fehlen', urgent: 'Dringend', nf: 'im Geschäft nicht gefunden', open: 'Liste öffnen und abhaken' },
  en: { title: 'Shopping list', count: '{n} items missing', urgent: 'Urgent', nf: 'not found in the shop', open: 'Open the list and tick things off' },
  it: { title: 'Lista della spesa', count: 'Mancano {n} articoli', urgent: 'Urgente', nf: 'non trovato in negozio', open: 'Apri la lista e spunta' },
  ar: { title: 'قائمة الشراء', count: 'ناقص {n} أغراض', urgent: 'مستعجل', nf: 'ما انلقى بالمحل', open: 'افتح القائمة وعلّم عليها' },
};

const I = (id, cat, unit, de, en, it, ar, img = id) => ({ id, cat, unit, img, name: { de, en, it, ar } });

export const DEFAULT_ITEMS = [
  // Brot & Gebäck
  I('brot', 'bakery', 'stk', 'Brot (verschiedene Sorten)', 'Bread (various kinds)', 'Pane (vari tipi)', 'خبز (أنواع مختلفة)'),
  I('croissant', 'bakery', 'stk', 'Croissants (verschiedene Sorten)', 'Croissants (various kinds)', 'Cornetti (vari tipi)', 'كرواسون (أنواع مختلفة)'),
  I('buttercroissant', 'bakery', 'stk', 'Butter\u00ADcroissant', 'Butter croissant', 'Cornetto al burro', 'كرواسون بالزبدة'),
  I('kuchen', 'bakery', 'stk', 'Kuchen', 'Cake', 'Torta', 'كيك'),

  // Gemüse & Kräuter
  I('salat', 'veg', 'stk', 'Salat', 'Lettuce', 'Insalata', 'خس'),
  I('rucola', 'veg', 'pkg', 'Rucola', 'Rocket', 'Rucola', 'جرجير'),
  I('rucola-rot', 'veg', 'pkg', 'Roter Rucola', 'Red rocket', 'Rucola rossa', 'جرجير أحمر'),
  I('tomaten', 'veg', 'kg', 'Tomaten', 'Tomatoes', 'Pomodori', 'بندورة'),
  I('strauchtomaten', 'veg', 'kg', 'Strauch\u00ADtomaten', 'Vine tomatoes', 'Pomodori a grappolo', 'بندورة عنقودية'),
  I('paprika', 'veg', 'kg', 'Paprika', 'Peppers', 'Peperoni', 'فليفلة'),
  I('rote-bete', 'veg', 'pkg', 'Rote Bete', 'Beetroot', 'Barba\u00ADbietola rossa', 'شمندر'),
  I('sellerie', 'veg', 'stk', 'Sellerie', 'Celery', 'Sedano', 'كرفس'),
  I('schnittlauch', 'veg', 'bund', 'Schnitt\u00ADlauch', 'Chives', 'Erba cipollina', 'ثوم معمّر'),
  I('basilikum', 'veg', 'stk', 'Basi\u00ADlikum', 'Basil', 'Basilico', 'حبق (ريحان)'),

  // Käse & Eier
  I('eier', 'dairy', 'karton', 'Eier', 'Eggs', 'Uova', 'بيض'),
  I('eier-mix', 'dairy', 'pkg', 'Eier\u00ADspeise / Eier-Mix', 'Scrambled egg mix', 'Mix per uova strapazzate', 'خليط بيض (عجة)'),
  I('mozzarella', 'dairy', 'pkg', 'Mozza\u00ADrella', 'Mozza\u00ADrella', 'Mozza\u00ADrella', 'موزاريلا'),
  I('pizzakaese', 'dairy', 'pkg', 'Pizza\u00ADkäse', 'Pizza cheese', 'Formaggio per pizza', 'جبنة بيتزا'),
  I('frischkaese', 'dairy', 'becher', 'Frisch\u00ADkäse', 'Cream cheese', 'Formaggio spalma\u00ADbile', 'جبنة كريمية'),
  I('gouda', 'dairy', 'pkg', 'Gouda', 'Gouda', 'Gouda', 'جبنة غودا'),
  I('cheddar', 'dairy', 'pkg', 'Cheddar', 'Cheddar', 'Cheddar', 'جبنة شيدر'),

  // Fleisch & Fisch
  I('caesar-chicken', 'meat', 'kg', 'Caesar Chicken', 'Caesar chicken', 'Pollo Caesar', 'دجاج سيزر'),
  I('schnitzel', 'meat', 'stk', 'Schnitzel', 'Schnitzel', 'Cotoletta', 'شنيتزل'),
  I('fleisch', 'meat', 'kg', 'Fleisch', 'Meat', 'Carne', 'لحمة'),
  I('thunfisch', 'meat', 'kg', 'Thun\u00ADfisch (für Bowls)', 'Tuna (for bowls)', 'Tonno (per le bowl)', 'تونة (للبول)'),

  // Saucen & Salate
  I('caesar-sauce', 'ready', 'flasche', 'Caesar-Sauce', 'Caesar dressing', 'Salsa Caesar', 'صوص سيزر'),
  I('guacamole', 'ready', 'becher', 'Guaca\u00ADmole', 'Guaca\u00ADmole', 'Guaca\u00ADmole', 'غواكامولي'),
  I('coleslaw-weiss', 'ready', 'kg', 'Coleslaw weiß', 'White coleslaw', 'Coleslaw bianco', 'كول سلو أبيض'),
  I('coleslaw-rot', 'ready', 'kg', 'Coleslaw rot', 'Red coleslaw', 'Coleslaw rosso', 'كول سلو أحمر'),
  I('rote-zwiebeln', 'ready', 'glas', 'Eingelegte rote Zwiebeln', 'Pickled red onions', 'Cipolle rosse sottaceto', 'بصل أحمر مخلل'),
  I('falafel', 'ready', 'pkg', 'Falafel', 'Falafel', 'Falafel', 'فلافل'),

  // Tiefkühl
  I('tk-karotten', 'frozen', 'pkg', 'TK-Karotten', 'Frozen carrots', 'Carote surgelate', 'جزر مجمّد'),
  I('tk-kroketten', 'frozen', 'pkg', 'TK-Kroketten', 'Frozen croquettes', 'Crocchette surgelate', 'كروكيت مجمّد'),
  I('edamame', 'frozen', 'pkg', 'Edamame', 'Edamame', 'Edamame', 'إدامامي'),

  // Vorrat
  I('reis', 'pantry', 'kg', 'Reis', 'Rice', 'Riso', 'رز'),
  I('quinoa', 'pantry', 'kg', 'Quinoa', 'Quinoa', 'Quinoa', 'كينوا'),
  I('kichererbsen', 'pantry', 'dose', 'Kicher\u00ADerbsen', 'Chickpeas', 'Ceci', 'حمّص حب'),
  I('bohnen', 'pantry', 'dose', 'Stangen\u00ADbohnen / Weiße Bohnen', 'Green beans / white beans', 'Fagiolini / fagioli bianchi', 'فاصولياء خضراء / بيضاء'),
  I('schokolade', 'pantry', 'pkg', 'Schoko\u00ADlade', 'Chocolate', 'Cioccolato', 'شوكولا'),

  // Getränke & Kaffee
  I('mineralwasser', 'drinks', 'kiste', 'Mineral\u00ADwasser (prickelnd)', 'Sparkling water', 'Acqua frizzante', 'مي غازية'),
  I('stilles-wasser', 'drinks', 'kiste', 'Stilles Wasser', 'Still water', 'Acqua naturale', 'مي بدون غاز'),
  I('kaffeekapseln', 'drinks', 'pkg', 'Kaffee\u00ADkapseln / Cappuccino-Pads', 'Coffee capsules / pads', 'Capsule / cialde di caffè', 'كبسولات قهوة'),
];
