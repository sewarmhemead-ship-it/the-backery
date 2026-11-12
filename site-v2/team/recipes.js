const sandwichRecipes = [
  {id:'gouda-croissant',image:'assets/gouda-croissant.jpg',name:['كروسون جودا','Gouda-Croissant','Gouda croissant','Gouda kruvasan','Κρουασάν με γκούντα']},
  {id:'kornspitz',image:'assets/kornspitz-gouda.jpg',name:['كورن شبيتس','Kornspitz','Kornspitz','Kornspitz','Kornspitz']}
];
const sandwichLabels={
  ar:{title:'الصندويشات',intro:'الصورة مرجع للشكل. اتبع المكونات وترتيب التحضير المكتوب لكل صنف.',ingredients:'المكونات',method:'ترتيب التحضير',filling:['فريش كيزه (جبنة كريمية)','روكولا','3 قطع جبنة جودا','قطعة طماطم','قطعة فليفلة'],steps:['ادهن الخبز بالفريش كيزه.','ضع الروكولا.','أضف 3 قطع جبنة جودا.','أضف قطعة طماطم.','أضف قطعة فليفلة.']},
  de:{title:'Sandwiches',intro:'Das Foto zeigt das fertige Sandwich. Für jede Sorte die angegebenen Zutaten und die Reihenfolge beachten.',ingredients:'Zutaten',method:'Zubereitung in Reihenfolge',filling:['Frischkäse','Rucola','3 Scheiben Gouda','1 Scheibe Tomate','1 Stück Paprika'],steps:['Das Brot mit Frischkäse bestreichen.','Rucola darauflegen.','3 Scheiben Gouda hinzufügen.','1 Scheibe Tomate hinzufügen.','1 Stück Paprika hinzufügen.']},
  en:{title:'Sandwiches',intro:'Use the photo as a visual reference. Follow the listed ingredients and assembly order for each sandwich.',ingredients:'Ingredients',method:'Assembly order',filling:['Cream cheese','Rocket (arugula)','3 slices of Gouda','1 slice of tomato','1 piece of bell pepper'],steps:['Spread cream cheese on the bread.','Add rocket.','Add 3 slices of Gouda.','Add 1 slice of tomato.','Add 1 piece of bell pepper.']},
  tr:{title:'Sandviçler',intro:'Fotoğrafı görünüm için referans al. Her çeşit için yazılı malzemeleri ve hazırlama sırasını takip et.',ingredients:'Malzemeler',method:'Hazırlama sırası',filling:['Krem peynir','Roka','3 dilim Gouda peyniri','1 dilim domates','1 parça dolmalık biber'],steps:['Ekmeğe krem peynir sür.','Rokayı koy.','3 dilim Gouda peyniri ekle.','1 dilim domates ekle.','1 parça dolmalık biber ekle.']},
  el:{title:'Σάντουιτς',intro:'Η φωτογραφία δείχνει την τελική εμφάνιση. Ακολούθησε τα υλικά και τη σειρά παρασκευής για κάθε είδος.',ingredients:'Υλικά',method:'Σειρά παρασκευής',filling:['Τυρί κρέμα','Ρόκα','3 φέτες γκούντα','1 φέτα ντομάτας','1 κομμάτι πιπεριάς'],steps:['Άλειψε το ψωμί με τυρί κρέμα.','Βάλε τη ρόκα.','Πρόσθεσε 3 φέτες γκούντα.','Πρόσθεσε 1 φέτα ντομάτας.','Πρόσθεσε 1 κομμάτι πιπεριάς.']}
};
sandwichRecipes.push(
  {id:'tomato-mozzarella',image:'assets/tomato-mozzarella.jpg',name:['صندويشة الطماطم والموتزريلا','Tomate-Mozzarella-Sandwich','Tomato & mozzarella sandwich','Domates ve mozzarella sandviçi','Σάντουιτς ντομάτας και μοτσαρέλας'],details:{
    ar:{filling:['دهن فليفلة (Paprika-Aufstrich)','روكولا','3 قطع موتزريلا','طماطم'],steps:['ادهن الخبز بدهن الفليفلة.','ضع الروكولا.','أضف 3 قطع موتزريلا.','أضف الطماطم.']},
    de:{filling:['Paprika-Aufstrich','Rucola','3 Scheiben Mozzarella','Tomate'],steps:['Das Brot mit Paprika-Aufstrich bestreichen.','Rucola darauflegen.','3 Scheiben Mozzarella hinzufügen.','Tomate hinzufügen.']},
    en:{filling:['Bell pepper spread (Paprika-Aufstrich)','Rocket (arugula)','3 slices of mozzarella','Tomato'],steps:['Spread bell pepper spread on the bread.','Add rocket.','Add 3 slices of mozzarella.','Add tomato.']},
    tr:{filling:['Biber ezmesi (Paprika-Aufstrich)','Roka','3 dilim mozzarella','Domates'],steps:['Ekmeğe biber ezmesi sür.','Rokayı koy.','3 dilim mozzarella ekle.','Domates ekle.']},
    el:{filling:['Άλειμμα πιπεριάς (Paprika-Aufstrich)','Ρόκα','3 φέτες μοτσαρέλας','Ντομάτα'],steps:['Άλειψε το ψωμί με άλειμμα πιπεριάς.','Βάλε τη ρόκα.','Πρόσθεσε 3 φέτες μοτσαρέλας.','Πρόσθεσε ντομάτα.']}
  }},
  {id:'egg-avocado',image:'assets/egg-avocado.jpg',name:['صندويشة البيض والأفوكادو','Ei-Avocado-Sandwich','Egg & avocado sandwich','Yumurta ve avokado sandviçi','Σάντουιτς αυγού και αβοκάντο'],details:{
    ar:{filling:['كريمة أفوكادو','سلطة','بيض مقلي','فليفلة'],steps:['ادهن الخبز بكريمة الأفوكادو.','ضع السلطة.','أضف البيض المقلي.','أضف الفليفلة.']},
    de:{filling:['Avocadocreme','Salat','Gebratenes Ei','Paprika'],steps:['Das Brot mit Avocadocreme bestreichen.','Salat darauflegen.','Gebratenes Ei hinzufügen.','Paprika hinzufügen.']},
    en:{filling:['Avocado cream','Salad leaves','Fried egg','Bell pepper'],steps:['Spread avocado cream on the bread.','Add salad leaves.','Add the fried egg.','Add bell pepper.']},
    tr:{filling:['Avokado kreması','Salata yaprakları','Tavada pişmiş yumurta','Dolmalık biber'],steps:['Ekmeğe avokado kreması sür.','Salata yapraklarını koy.','Tavada pişmiş yumurtayı ekle.','Biberi ekle.']},
    el:{filling:['Κρέμα αβοκάντο','Πράσινη σαλάτα','Τηγανητό αυγό','Πιπεριά'],steps:['Άλειψε το ψωμί με κρέμα αβοκάντο.','Βάλε την πράσινη σαλάτα.','Πρόσθεσε το τηγανητό αυγό.','Πρόσθεσε πιπεριά.']}
  }}
);
sandwichRecipes.push(
  {id:'brie-red-pickle',image:'assets/brie-red-pickle.jpg',name:['صندويشة البري والمخلل الأحمر','Brie-Sandwich mit rotem Pickles-Gemüse','Brie & red pickle sandwich','Brie ve kırmızı turşulu sandviç','Σάντουιτς μπρι με κόκκινο τουρσί'],details:{
    ar:{filling:['كركوم كيزه','روكولا','جبنة بري','مخلل أحمر'],steps:['ضع كركوم كيزه على الخبز.','ضع الروكولا.','أضف جبنة البري.','أضف المخلل الأحمر.']},
    de:{filling:['Kurkuma-Käse','Rucola','Brie','Rotes Pickles-Gemüse'],steps:['Kurkuma-Käse auf das Brot geben.','Rucola darauflegen.','Brie hinzufügen.','Rotes Pickles-Gemüse hinzufügen.']},
    en:{filling:['Turmeric cheese (Kurkuma-Käse)','Rocket (arugula)','Brie cheese','Red pickled vegetables'],steps:['Put turmeric cheese on the bread.','Add rocket.','Add Brie cheese.','Add the red pickled vegetables.']},
    tr:{filling:['Zerdeçallı peynir (Kurkuma-Käse)','Roka','Brie peyniri','Kırmızı turşu'],steps:['Ekmeğe zerdeçallı peynir koy.','Rokayı koy.','Brie peynirini ekle.','Kırmızı turşuyu ekle.']},
    el:{filling:['Τυρί με κουρκουμά (Kurkuma-Käse)','Ρόκα','Τυρί μπρι','Κόκκινο τουρσί'],steps:['Βάλε τυρί με κουρκουμά στο ψωμί.','Βάλε τη ρόκα.','Πρόσθεσε το τυρί μπρι.','Πρόσθεσε το κόκκινο τουρσί.']}
  }},
  {id:'ham-gouda',image:'assets/ham-gouda.jpg',name:['صندويشة الشنكن والجودا','Schinken-Gouda-Sandwich','Ham & Gouda sandwich','Jambon ve Gouda sandviçi','Σάντουιτς ζαμπόν και γκούντα'],details:{
    ar:{filling:['مايونيز','جبنة جودا','شنكن','فليفلة','بندورة'],steps:['ادهن الخبز بالمايونيز.','ضع جبنة الجودا.','أضف الشنكن.','أضف الفليفلة.','أضف البندورة.']},
    de:{filling:['Mayonnaise','Gouda','Schinken','Paprika','Tomate'],steps:['Das Brot mit Mayonnaise bestreichen.','Gouda darauflegen.','Schinken hinzufügen.','Paprika hinzufügen.','Tomate hinzufügen.']},
    en:{filling:['Mayonnaise','Gouda cheese','Ham','Bell pepper','Tomato'],steps:['Spread mayonnaise on the bread.','Add Gouda cheese.','Add ham.','Add bell pepper.','Add tomato.']},
    tr:{filling:['Mayonez','Gouda peyniri','Jambon','Dolmalık biber','Domates'],steps:['Ekmeğe mayonez sür.','Gouda peynirini koy.','Jambonu ekle.','Biberi ekle.','Domatesi ekle.']},
    el:{filling:['Μαγιονέζα','Τυρί γκούντα','Ζαμπόν','Πιπεριά','Ντομάτα'],steps:['Άλειψε το ψωμί με μαγιονέζα.','Βάλε το τυρί γκούντα.','Πρόσθεσε το ζαμπόν.','Πρόσθεσε πιπεριά.','Πρόσθεσε ντομάτα.']}
  }}
);
sandwichRecipes.push({
  id:'gouda-red-coleslaw',image:'assets/gouda-red-coleslaw.jpg',
  name:['صندويشة الجودا والكول سلو الأحمر','Gouda-Sandwich mit Rotkohl-Coleslaw','Gouda & red coleslaw sandwich','Gouda ve kırmızı coleslaw sandviçi','Σάντουιτς γκούντα και κόκκινης coleslaw'],
  details:{
    ar:{filling:['فريش كيزه (جبنة كريمية)','روكولا','3 قطع جبنة جودا','كول سلو أحمر'],steps:['ادهن الخبز بالفريش كيزه.','ضع الروكولا.','أضف 3 قطع جبنة جودا.','أضف الكول سلو الأحمر.']},
    de:{filling:['Frischkäse','Rucola','3 Scheiben Gouda','Rotkohl-Coleslaw'],steps:['Das Brot mit Frischkäse bestreichen.','Rucola darauflegen.','3 Scheiben Gouda hinzufügen.','Rotkohl-Coleslaw hinzufügen.']},
    en:{filling:['Cream cheese','Rocket (arugula)','3 slices of Gouda','Red coleslaw'],steps:['Spread cream cheese on the bread.','Add rocket.','Add 3 slices of Gouda.','Add red coleslaw.']},
    tr:{filling:['Krem peynir','Roka','3 dilim Gouda peyniri','Kırmızı coleslaw'],steps:['Ekmeğe krem peynir sür.','Rokayı koy.','3 dilim Gouda peyniri ekle.','Kırmızı coleslaw ekle.']},
    el:{filling:['Τυρί κρέμα','Ρόκα','3 φέτες γκούντα','Κόκκινη σαλάτα coleslaw'],steps:['Άλειψε το ψωμί με τυρί κρέμα.','Βάλε τη ρόκα.','Πρόσθεσε 3 φέτες γκούντα.','Πρόσθεσε την κόκκινη σαλάτα coleslaw.']}
  }
});
function renderSandwiches(language){
  const labels=sandwichLabels[language];const index=languages.indexOf(language);
  return `<div class="recipe-heading"><h2>${labels.title}</h2><p class="small">${labels.intro}</p></div><div class="recipe-grid">${sandwichRecipes.map(recipe=>`<article class="recipe-card"><a class="recipe-image-link" href="${recipe.image}" target="_blank" rel="noopener"><img class="recipe-image" src="${recipe.image}" alt="${recipe.name[index]}" loading="lazy"></a><div class="recipe-body"><p class="eyebrow">THE BAKERY · SANDWICHES</p><h3>${recipe.name[index]}</h3><h4>${labels.ingredients}</h4><ul class="ingredients">${(recipe.details?.[language]||labels).filling.map(ingredient=>`<li>${ingredient}</li>`).join('')}</ul><h4>${labels.method}</h4><ol class="assembly">${(recipe.details?.[language]||labels).steps.map(step=>`<li>${step}</li>`).join('')}</ol></div></article>`).join('')}</div>`;
}
