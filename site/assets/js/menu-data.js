/* ============================================================
   the.bakery — بيانات المنيو
   ============================================================

   هاد الملف الوحيد اللي بتحتاج تفتحه لما تبدّل المنيو.
   ما في داعي تفهم برمجة، بس اتبع الشكل الموجود.

   لإضافة صنف جديد، انسخ بلوك كامل من { لـ } وبدّل القيم:

     {
       id: "اسم-بالانجليزي-بدون-مسافات",
       name: "الاسم اللي بيظهر للزبون",
       price: 4.20,                      // بالنقطة مش الفاصلة
       tags: ["veggie"],                 // اختياري، شوف القائمة تحت
       desc: {
         de: "الوصف بالألماني",
         en: "الوصف بالانجليزي",
         ar: "الوصف بالعربي"
       }
     },

   ملاحظات مهمة:
   - price: null  يعني السعر لسا مش جاهز، والموقع بيخفي السعر بدون ما يبيّن خربان.
   - أسماء الأصناف بتضل زي ما هي بكل اللغات لأنها أسماء ماركة.
   - الأوصاف بتنترجم، عبّي الثلاث لغات.
   - إذا قسم كامل فاضي (items فاضية) الموقع بيخفيه لحاله.

   الوسوم (tags) المتاحة:
     "veggie"  نباتي        "vegan"  فيغن
     "fish"    سمك          "spicy"  حار
     "new"     جديد         "star"   الأكثر طلباً

   *** مهم: أي صنف بتحطلو  tags: ["new"]  بيطلع تلقائياً
   بقسم «الجديد عنا» فوق بالموقع. ما بدك تعمل إشي زيادة. ***

   الصورة اختيارية:  image: "assets/img/tuna.webp"
   إذا حطيت صورة بتطير جنب الصنف لما الزبون يمرّ عليه.

   ألوان الأقسام (ground) المتاحة:
     "sky"  سماوي   "blush" زهري   "gold" ذهبي
     "cream" كريمي  "ink"  كحلي    "burgundy" نبيذي
   ============================================================ */

const MENU = [

  /* ---------- البولز ---------- */
  {
    id: "bowls",
    ground: "sky",
    title: { de: "Poke Bowls", en: "Poke Bowls", ar: "بوكي بولز" },
    note: {
      de: "Täglich von 11 bis 17 Uhr. Alle Bowls mit Toppings und Greens nach Wahl.",
      en: "Daily from 11am to 5pm. Every bowl comes with toppings and greens of your choice.",
      ar: "يومياً من ١١ صباحاً حتى ٥ مساءً. كل بول مع الإضافات والخضار حسب اختيارك."
    },
    items: [
      {
        id: "oriental-bowl",
        name: "Oriental Bowl",
        price: 12.90,
        image: "assets/img/falafel.webp",
        tags: ["veggie"],
        desc: {
          de: "Jasminreis, Quinoa, Salat, Kichererbsen, Edamame, knusprige Falafel",
          en: "Jasmine rice, quinoa, salad, chickpeas, edamame, crispy falafel",
          ar: "أرز ياسمين، كينوا، سلطة، حمص، إدامامي، فلافل مقرمشة"
        }
      },
      {
        id: "caesar-chicken-bowl",
        name: "Caesar Chicken Bowl",
        price: 13.90,
        image: "assets/img/corn.webp",
        tags: [],
        desc: {
          de: "Jasminreis, Quinoa, Salat, Hühnchen, Mais, Rote Bete",
          en: "Jasmine rice, quinoa, salad, chicken, sweetcorn, red beet",
          ar: "أرز ياسمين، كينوا، سلطة، دجاج، ذرة، شمندر"
        }
      },
      {
        id: "tuna-bowl",
        name: "The Tuna Bowl",
        price: 14.90,
        image: "assets/img/tuna.webp",
        tags: ["fish", "star"],
        desc: {
          de: "Jasminreis, Quinoa, Salat, Thunfisch, Avocado Cream, Ingwer",
          en: "Jasmine rice, quinoa, salad, tuna, avocado cream, ginger",
          ar: "أرز ياسمين، كينوا، سلطة، تونا، كريمة أفوكادو، زنجبيل"
        }
      },
      {
        id: "signature-bowl",
        name: "Your Signature Bowl",
        price: 14.90,
        image: "assets/img/bowl-black.webp",
        tags: ["new"],
        desc: {
          de: "Stell dir deine Bowl aus den Specials selbst zusammen",
          en: "Build your own bowl from the specials",
          ar: "ركّب البول تبعك بنفسك من الأصناف المتوفرة"
        }
      }
    ]
  },

  /* ---------- القهوة ----------
     الأسماء مؤكدة من صاحب المحل، الأسعار لسا ناقصة.
     بدّل  price: null  لسعر حقيقي مثل  price: 3.20  لما تجهز. */
  {
    id: "coffee",
    ground: "blush",
    title: { de: "Kaffee", en: "Coffee", ar: "قهوة" },
    note: {
      de: "Alle Kaffees auch mit Hafer-, Soja- oder Mandelmilch.",
      en: "Every coffee is also available with oat, soy or almond milk.",
      ar: "كل أنواع القهوة متوفرة بحليب الشوفان أو الصويا أو اللوز."
    },
    items: [
      {
        id: "espresso",
        name: "Espresso",
        price: null,
        tags: [],
        desc: {
          de: "Einfach oder doppelt",
          en: "Single or double",
          ar: "مفرد أو مزدوج"
        }
      },
      {
        id: "espresso-macchiato",
        name: "Espresso Macchiato",
        price: null,
        tags: [],
        desc: {
          de: "Espresso mit einem Löffel Milchschaum",
          en: "Espresso marked with a spoon of milk foam",
          ar: "إسبريسو مع ملعقة رغوة حليب"
        }
      },
      {
        id: "verlaengerter",
        name: "Verlängerter",
        price: null,
        tags: [],
        desc: {
          de: "Der österreichische Klassiker, Espresso mit heißem Wasser gestreckt",
          en: "The Austrian classic, espresso lengthened with hot water",
          ar: "الكلاسيكية النمساوية، إسبريسو مطوّل بالماء الساخن"
        }
      },
      {
        id: "cappuccino-klein",
        name: "Cappuccino klein",
        price: null,
        tags: [],
        desc: {
          de: "Espresso, heiße Milch, dichter Schaum",
          en: "Espresso, hot milk, dense foam",
          ar: "إسبريسو، حليب ساخن، رغوة كثيفة"
        }
      },
      {
        id: "cappuccino-gross",
        name: "Cappuccino groß",
        price: null,
        tags: [],
        desc: {
          de: "Die große Tasse für den langen Bummel",
          en: "The big cup for a long stroll",
          ar: "الفنجان الكبير للتسوّق الطويل"
        }
      },
      {
        id: "flat-white",
        name: "Flat White",
        price: null,
        tags: [],
        desc: {
          de: "Doppelter Espresso, samtige Milch, wenig Schaum",
          en: "Double espresso, velvet milk, barely any foam",
          ar: "إسبريسو مزدوج، حليب مخملي، رغوة قليلة"
        }
      },
      {
        id: "latte-macchiato",
        name: "Latte Macchiato",
        price: null,
        tags: [],
        desc: {
          de: "Drei Schichten im Glas, Milch, Espresso, Schaum",
          en: "Three layers in the glass, milk, espresso, foam",
          ar: "ثلاث طبقات بالكاسة: حليب، إسبريسو، رغوة"
        }
      },
      {
        id: "matcha-latte",
        name: "Matcha Latte",
        price: null,
        tags: ["veggie"],
        desc: {
          de: "Zeremonieller Matcha mit Milch deiner Wahl",
          en: "Ceremonial matcha with the milk of your choice",
          ar: "ماتشا مع الحليب اللي بتحبه"
        }
      },
      {
        id: "strawberry-matcha",
        name: "Strawberry Matcha",
        price: null,
        tags: ["star", "new"],
        desc: {
          de: "Erdbeere unten, Matcha oben, der Liebling für die Kamera",
          en: "Strawberry below, matcha above, the one everyone photographs",
          ar: "فراولة تحت وماتشا فوق، الأحلى بالصور"
        }
      }
    ]
  },

  /* ---------- الساندويتشات ----------
     لسا فاضية. ضيف الأصناف جوّا items وبيظهر القسم لحاله.
     مثال جاهز للنسخ:

       {
         id: "caprese",
         name: "Caprese",
         price: 6.90,
         tags: ["veggie"],
         desc: {
           de: "Mozzarella, Tomate, Basilikum",
           en: "Mozzarella, tomato, basil",
           ar: "موزاريلا، بندورة، ريحان"
         }
       }
  */
  {
    id: "sandwiches",
    ground: "gold",
    title: { de: "Sandwiches", en: "Sandwiches", ar: "ساندويتشات" },
    note: {
      de: "Von klassisch bis kreativ, jeden Morgen frisch belegt.",
      en: "From classic to creative, filled fresh every morning.",
      ar: "من الكلاسيكي للمبتكر، بتتحضّر طازة كل صباح."
    },
    items: []
  },

  /* ---------- المخبوزات ----------
     لسا فاضية. نفس طريقة الساندويتشات. */
  {
    id: "bakery",
    ground: "cream",
    title: { de: "Aus dem Ofen", en: "From the Oven", ar: "من الفرن" },
    note: {
      de: "Croissant, Babka, Bagel, Baguette.",
      en: "Croissant, babka, bagel, baguette.",
      ar: "كرواسون، بابكا، بيغل، باغيت."
    },
    items: []
  }

];
