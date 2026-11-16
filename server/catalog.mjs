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
  // Stationen zuerst (so wie im Laden), danach der Rest
  { id: 'bowl', name: { de: 'Bowl-Station', en: 'Bowl station', it: 'Postazione bowl', ar: 'منصة البول' } },
  { id: 'ready', name: { de: 'Saucen', en: 'Sauces', it: 'Salse', ar: 'قسم الصوصات' } },
  { id: 'pizzastation', name: { de: 'Pizza-Station', en: 'Pizza station', it: 'Postazione pizza', ar: 'منصة البيتزا' } },
  { id: 'bakery', name: { de: 'Brot-Station', en: 'Bread station', it: 'Postazione pane', ar: 'منصة الخبز' } },
  { id: 'veg', name: { de: 'Gemüse & Kräuter', en: 'Veg & herbs', it: 'Verdura ed erbe', ar: 'خضار وأعشاب' } },
  { id: 'dairy', name: { de: 'Milch, Käse & Eier', en: 'Milk, cheese & eggs', it: 'Latte, formaggi e uova', ar: 'حليب وأجبان وبيض' } },
  { id: 'meat', name: { de: 'Fleisch & Fisch', en: 'Meat & fish', it: 'Carne e pesce', ar: 'لحوم وسمك' } },
  { id: 'frozen', name: { de: 'Tiefkühl', en: 'Frozen', it: 'Surgelati', ar: 'مجمّدات' } },
  { id: 'pantry', name: { de: 'Vorrat', en: 'Dry goods', it: 'Dispensa', ar: 'مؤونة' } },
  { id: 'drinks', name: { de: 'Getränke & Kaffee', en: 'Drinks & coffee', it: 'Bevande e caffè', ar: 'مشروبات وقهوة' } },
];

// Geschäfte, in denen eingekauft wird. Das Team kann sie in der App ändern;
// das hier ist nur die Startliste.
export const DEFAULT_SHOPS = [
  { id: 'metro', name: 'Metro' },
  { id: 'hofer', name: 'Hofer' },
  { id: 'billa', name: 'Billa' },
  { id: 'spar', name: 'Spar' },
  { id: 'lidl', name: 'Lidl' },
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
  de: { noShop: 'Ohne Geschäft', title: 'Einkaufsliste', count: '{n} Artikel fehlen', urgent: 'Dringend', nf: 'im Geschäft nicht gefunden', open: 'Liste öffnen und abhaken', tomorrow: 'Für morgen eingeplant', nothingNow: 'Gerade fehlt nichts.' },
  en: { noShop: 'No shop set', title: 'Shopping list', count: '{n} items missing', urgent: 'Urgent', nf: 'not found in the shop', open: 'Open the list and tick things off', tomorrow: 'Planned for tomorrow', nothingNow: 'Nothing is missing right now.' },
  it: { noShop: 'Senza negozio', title: 'Lista della spesa', count: 'Mancano {n} articoli', urgent: 'Urgente', nf: 'non trovato in negozio', open: 'Apri la lista e spunta', tomorrow: 'Previsto per domani', nothingNow: 'Al momento non manca nulla.' },
  ar: { noShop: 'بدون محل', title: 'قائمة الشراء', count: 'ناقص {n} أغراض', urgent: 'مستعجل', nf: 'ما انلقى بالمحل', open: 'افتح القائمة وعلّم عليها', tomorrow: 'مخطط لبكرا', nothingNow: 'هلأ ما في شي ناقص.' },
};

const I = (id, cat, unit, de, en, it, ar, img = id) => ({ id, cat, unit, img, name: { de, en, it, ar } });

export const DEFAULT_ITEMS = [
  // Brot & Gebäck
  I('brot', 'bakery', 'stk', 'Brot (verschiedene Sorten)', 'Bread (various kinds)', 'Pane (vari tipi)', 'خبز (أنواع مختلفة)'),
  I('croissant', 'bakery', 'stk', 'Croissants (verschiedene Sorten)', 'Croissants (various kinds)', 'Cornetti (vari tipi)', 'كرواسون (أنواع مختلفة)'),
  I('buttercroissant', 'bakery', 'stk', 'Butter\u00ADcroissant', 'Butter croissant', 'Cornetto al burro', 'كرواسون بالزبدة'),
  I('pistazien-croissant', 'bakery', 'stk', 'Pistazien­croissant', 'Pistachio croissant', 'Cornetto al pistacchio', 'كرواسون بالفستق', 'croissant'),
  I('schoko-croissant', 'bakery', 'stk', 'Schoko­croissant', 'Chocolate croissant', 'Cornetto al cioccolato', 'كرواسون بالشوكولا', 'buttercroissant'),
  I('brezel', 'bakery', 'stk', 'Brezel', 'Pretzel', 'Pretzel', 'بريتزل', '_neu'),
  I('schnecke', 'bakery', 'stk', 'Schnecke', 'Schnecke (sweet roll)', 'Lumaca (dolce)', 'شنيكا', '_neu'),
  I('nuss-schnecke', 'bakery', 'stk', 'Nuss­schnecke', 'Nut swirl', 'Lumaca alle noci', 'شنيكا بالجوز', '_neu'),
  I('zimt-schnecke', 'bakery', 'stk', 'Zimt­schnecke', 'Cinnamon swirl', 'Lumaca alla cannella', 'شنيكا بالقرفة', '_neu'),
  I('boerek', 'pizzastation', 'stk', 'Börek', 'Börek', 'Börek', 'بوريك', '_neu'),
  I('muffins', 'bakery', 'stk', 'Muffins', 'Muffins', 'Muffin', 'مافن', '_neu'),
  I('kekse', 'bakery', 'pkg', 'Kekse', 'Cookies', 'Biscotti', 'بسكويت', '_neu'),
  I('kuchen', 'bakery', 'stk', 'Kuchen', 'Cake', 'Torta', 'كيك'),

  // Gemüse & Kräuter
  I('salat', 'bowl', 'stk', 'Salat', 'Lettuce', 'Insalata', 'خس'),
  I('petersilie', 'veg', 'bund', 'Petersilie', 'Parsley', 'Prezzemolo', 'بقدونس', '_neu'),
  I('champignons', 'veg', 'pkg', 'Champignons (Pilze)', 'Mushrooms', 'Funghi', 'فطر', '_neu'),
  I('steckruebe', 'veg', 'kg', 'Steckrübe', 'Rutabaga', 'Rutabaga', 'لفت سويدي', '_neu'),
  I('gurke', 'bowl', 'stk', 'Gurke', 'Cucumber', 'Cetriolo', 'خيار', '_neu'),
  I('rucola', 'veg', 'pkg', 'Rucola', 'Rocket', 'Rucola', 'جرجير'),
  I('rucola-rot', 'veg', 'pkg', 'Roter Rucola', 'Red rocket', 'Rucola rossa', 'جرجير أحمر'),
  I('tomaten', 'bowl', 'kg', 'Tomaten', 'Tomatoes', 'Pomodori', 'بندورة'),
  I('strauchtomaten', 'veg', 'kg', 'Strauch\u00ADtomaten', 'Vine tomatoes', 'Pomodori a grappolo', 'بندورة عنقودية'),
  I('paprika', 'bowl', 'kg', 'Paprika', 'Peppers', 'Peperoni', 'فليفلة'),
  I('rote-bete', 'bowl', 'pkg', 'Rote Bete', 'Beetroot', 'Barba\u00ADbietola rossa', 'شمندر'),
  I('sellerie', 'veg', 'stk', 'Sellerie', 'Celery', 'Sedano', 'كرفس'),
  I('schnittlauch', 'veg', 'bund', 'Schnitt\u00ADlauch', 'Chives', 'Erba cipollina', 'ثوم معمّر'),
  I('basilikum', 'veg', 'stk', 'Basi\u00ADlikum', 'Basil', 'Basilico', 'حبق (ريحان)'),

  // Käse & Eier
  I('eier', 'dairy', 'karton', 'Eier', 'Eggs', 'Uova', 'بيض'),
  I('eier-mix', 'dairy', 'pkg', 'Eier\u00ADspeise / Eier-Mix', 'Scrambled egg mix', 'Mix per uova strapazzate', 'خليط بيض (عجة)'),
  I('mozzarella', 'pizzastation', 'pkg', 'Mozza\u00ADrella', 'Mozza\u00ADrella', 'Mozza\u00ADrella', 'موزاريلا'),
  I('pizzakaese', 'pizzastation', 'pkg', 'Pizza\u00ADkäse', 'Pizza cheese', 'Formaggio per pizza', 'جبنة بيتزا'),
  I('frischkaese', 'dairy', 'becher', 'Frisch\u00ADkäse', 'Cream cheese', 'Formaggio spalma\u00ADbile', 'جبنة كريمية'),
  I('gouda', 'dairy', 'pkg', 'Gouda', 'Gouda', 'Gouda', 'جبنة غودا'),
  I('cheddar', 'dairy', 'pkg', 'Cheddar', 'Cheddar', 'Cheddar', 'جبنة شيدر'),

  // Fleisch & Fisch
  I('caesar-chicken', 'bowl', 'kg', 'Caesar Chicken', 'Caesar chicken', 'Pollo Caesar', 'دجاج سيزر'),
  I('corn-chicken', 'meat', 'kg', 'Corn Chicken', 'Corn chicken', 'Corn chicken', 'كورن تشيكن', '_neu'),
  I('schinken', 'meat', 'pkg', 'Schinken', 'Ham', 'Prosciutto cotto', 'شنكن', '_neu'),
  I('pastrami', 'meat', 'pkg', 'Pastrami', 'Pastrami', 'Pastrami', 'بسترمة', '_neu'),
  I('schnitzel', 'meat', 'stk', 'Schnitzel', 'Schnitzel', 'Cotoletta', 'شنيتزل'),
  I('fleisch', 'meat', 'kg', 'Fleisch', 'Meat', 'Carne', 'لحمة'),
  I('thunfisch', 'bowl', 'kg', 'Thun\u00ADfisch (für Bowls)', 'Tuna (for bowls)', 'Tonno (per le bowl)', 'تونة (للبول)'),

  // Saucen & Salate
  I('caesar-sauce', 'ready', 'flasche', 'Caesar-Sauce', 'Caesar dressing', 'Salsa Caesar', 'صوص سيزر'),
  I('guacamole', 'ready', 'becher', 'Guaca\u00ADmole', 'Guaca\u00ADmole', 'Guaca\u00ADmole', 'غواكامولي'),
  I('coleslaw-weiss', 'bowl', 'kg', 'Coleslaw weiß', 'White coleslaw', 'Coleslaw bianco', 'كول سلو أبيض'),
  I('coleslaw-rot', 'bowl', 'kg', 'Coleslaw rot', 'Red coleslaw', 'Coleslaw rosso', 'كول سلو أحمر'),
  I('rote-zwiebeln', 'bowl', 'glas', 'Eingelegte rote Zwiebeln', 'Pickled red onions', 'Cipolle rosse sottaceto', 'بصل أحمر مخلل'),
  I('falafel', 'bowl', 'pkg', 'Falafel', 'Falafel', 'Falafel', 'فلافل'),

  // Tiefkühl
  I('tk-karotten', 'frozen', 'pkg', 'TK-Karotten', 'Frozen carrots', 'Carote surgelate', 'جزر مجمّد'),
  I('tk-kroketten', 'frozen', 'pkg', 'TK-Kroketten', 'Frozen croquettes', 'Crocchette surgelate', 'كروكيت مجمّد'),
  I('pizza', 'pizzastation', 'stk', 'Pizza', 'Pizza', 'Pizza', 'بيتزا', '_neu'),
  I('edamame', 'bowl', 'pkg', 'Edamame', 'Edamame', 'Edamame', 'إدامامي'),

  // Vorrat
  I('mais', 'bowl', 'dose', 'Mais', 'Sweetcorn', 'Mais', 'ذرة (علبة)', '_neu'),
  I('oliven', 'bowl', 'glas', 'Oliven', 'Olives', 'Olive', 'زيتون', '_neu'),
  I('pasta', 'pizzastation', 'pkg', 'Pasta', 'Pasta', 'Pasta', 'مكرونة (باستا)', '_neu'),
  I('lasagne', 'pantry', 'pkg', 'Lasagne', 'Lasagne', 'Lasagne', 'لازانيا', '_neu'),
  I('tortellini', 'pizzastation', 'pkg', 'Tortellini', 'Tortellini', 'Tortellini', 'تورتيليني', '_neu'),
  I('reis', 'bowl', 'kg', 'Reis', 'Rice', 'Riso', 'رز'),
  I('quinoa', 'bowl', 'kg', 'Quinoa', 'Quinoa', 'Quinoa', 'كينوا'),
  I('kichererbsen', 'bowl', 'dose', 'Kicher\u00ADerbsen', 'Chickpeas', 'Ceci', 'حمّص حب'),
  I('bohnen', 'pantry', 'dose', 'Stangen\u00ADbohnen / Weiße Bohnen', 'Green beans / white beans', 'Fagiolini / fagioli bianchi', 'فاصولياء خضراء / بيضاء'),
  I('schokolade', 'pantry', 'pkg', 'Schoko\u00ADlade', 'Chocolate', 'Cioccolato', 'شوكولا'),

  // Getränke & Kaffee
  I('mineralwasser', 'drinks', 'kiste', 'Mineral\u00ADwasser (prickelnd)', 'Sparkling water', 'Acqua frizzante', 'مي غازية'),
  I('fanta', 'drinks', 'dose', 'Fanta', 'Fanta', 'Fanta', 'فانتا', '_neu'),
  I('cola', 'drinks', 'dose', 'Cola', 'Cola', 'Cola', 'كولا', '_neu'),
  I('red-bull', 'drinks', 'dose', 'Red Bull', 'Red Bull', 'Red Bull', 'ريد بول', '_neu'),
  I('stilles-wasser', 'drinks', 'kiste', 'Stilles Wasser', 'Still water', 'Acqua naturale', 'مي بدون غاز'),
  I('kaffeekapseln', 'drinks', 'pkg', 'Kaffee\u00ADkapseln / Cappuccino-Pads', 'Coffee capsules / pads', 'Capsule / cialde di caffè', 'كبسولات قهوة'),
  // neu: Stationen
  I('kuerbis', 'bowl', 'kg', 'Kürbis', 'Pumpkin', 'Zucca', 'قرع', '_neu'),
  I('orient-linsen', 'bowl', 'kg', 'Orientalische Linsen', 'Oriental lentils', 'Lenticchie orientali', 'عدس أورينتال', '_neu'),
  I('butter-chicken', 'bowl', 'kg', 'Butter Chicken', 'Butter chicken', 'Butter chicken', 'باتر تشيكن', '_neu'),
  I('curry-chicken', 'bowl', 'kg', 'Curry Chicken', 'Curry chicken', 'Pollo al curry', 'كاري تشيكن', '_neu'),
  I('korean-chicken', 'bowl', 'kg', 'Korean Chicken', 'Korean chicken', 'Pollo coreano', 'كوريان تشيكن', '_neu'),
  I('roasted-sesame', 'ready', 'flasche', 'Roasted-Sesame-Sauce', 'Roasted sesame dressing', 'Salsa al sesamo tostato', 'صوص سمسم محمّص', '_neu'),
  I('korean-bbq', 'ready', 'flasche', 'Korean-BBQ-Sauce', 'Korean BBQ sauce', 'Salsa Korean BBQ', 'صوص كوريان باربكيو', '_neu'),
  I('truffle-mayo', 'ready', 'flasche', 'Trüffel-Mayo', 'Truffle mayo', 'Maionese al tartufo', 'ترفل مايو', '_neu'),
  I('sojasauce', 'ready', 'flasche', 'Sojasauce', 'Soy sauce', 'Salsa di soia', 'صويا صوص', '_neu'),
  I('fresh-lemon', 'ready', 'flasche', 'Fresh-Lemon-Dressing', 'Fresh lemon dressing', 'Condimento al limone', 'فريش ليمون', '_neu'),
  I('tomatensauce', 'pizzastation', 'dose', 'Tomaten­sauce', 'Tomato sauce', 'Passata di pomodoro', 'صوص طماطم', '_neu'),
  I('apfelkuchen', 'bakery', 'stk', 'Apfel­kuchen', 'Apple cake', 'Torta di mele', 'كيك تفاح (أبفل كوخن)', '_neu'),
];

// Reihenfolge an den Stationen wie im Laden (Liste vom Team); alles andere bleibt wie oben
const STATION_ORDER = [
  'reis', 'quinoa', 'coleslaw-weiss', 'coleslaw-rot', 'kuerbis', 'tomaten', 'edamame', 'paprika', 'gurke', 'oliven',
  'rote-zwiebeln', 'rote-bete', 'kichererbsen', 'mais', 'falafel', 'caesar-chicken', 'butter-chicken', 'curry-chicken',
  'orient-linsen', 'korean-chicken', 'salat', 'thunfisch',
  'roasted-sesame', 'korean-bbq', 'truffle-mayo', 'sojasauce', 'fresh-lemon', 'caesar-sauce', 'guacamole',
  'pizza', 'pizzakaese', 'mozzarella', 'tomatensauce', 'boerek', 'pasta', 'tortellini',
];
const rank = new Map(STATION_ORDER.map((id, i) => [id, i]));
DEFAULT_ITEMS.sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));
