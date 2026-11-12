const bowlGroups=[
 {name:['الأساس','Basis','Bases','Tabanlar','Βάσεις'],items:[
 ['rice',['رز','Reis','Rice','Pirinç','Ρύζι']],['quinoa',['كينوا','Quinoa','Quinoa','Kinoa','Κινόα']]]},
 {name:['الأطباق الساخنة','Warme Gerichte','Hot dishes','Sıcak yemekler','Ζεστά πιάτα'],items:[
 ['butter-chicken',['باتر تشكن','Butter Chicken','Butter chicken','Butter chicken','Butter chicken']],
 ['chicken-curry',['كاري تشكن','Chicken Curry','Chicken curry','Tavuk köri','Κοτόπουλο κάρι']],
 ['lentils',['عدس بالطريقة الشرقية','Orientalische Linsen','Oriental-style lentils','Doğu usulü mercimek','Ανατολίτικες φακές']]]},
 {name:['الدجاج والفلافل','Chicken & Falafel','Chicken & falafel','Tavuk ve falafel','Κοτόπουλο και φαλάφελ'],items:[
 ['caesar-chicken',['سيزر تشكن','Caesar Chicken','Caesar chicken','Caesar tavuk','Κοτόπουλο Caesar']],
 ['falafel',['فلافل','Falafel','Falafel','Falafel','Φαλάφελ']]]},
 {name:['الخضار والإضافات','Gemüse & Toppings','Vegetables & toppings','Sebzeler ve ek malzemeler','Λαχανικά και toppings'],items:[
 ['salad',['سلطة مشكلة','Gemischter Salat','Mixed salad','Karışık salata','Ανάμεικτη σαλάτα']],
 ['cucumber',['خيار','Gurke','Cucumber','Salatalık','Αγγούρι']],
 ['tomato',['طماطم','Tomaten','Tomatoes','Domates','Ντομάτες']],
 ['pepper',['فليفلة صفراء','Gelbe Paprika','Yellow bell pepper','Sarı biber','Κίτρινη πιπεριά']],
 ['corn',['ذرة','Mais','Sweetcorn','Mısır','Καλαμπόκι']],
 ['chickpeas',['حمص','Kichererbsen','Chickpeas','Nohut','Ρεβίθια']],
 ['edamame',['إدامامي','Edamame','Edamame','Edamame','Ενταμάμε']],
 ['olives',['زيتون','Oliven','Olives','Zeytin','Ελιές']],
 ['beetroot',['شمندر','Rote Bete','Beetroot','Pancar','Παντζάρι']],
 ['zuckerbohnen',['سكر بونن (Zuckerbohnen)','Zuckerbohnen','Zuckerbohnen','Zuckerbohnen','Zuckerbohnen']],
 ['pumpkin',['قرع','Kürbis','Pumpkin','Bal kabağı','Κολοκύθα']],
 ['slaw-white',['كول سلو أبيض','Weißer Coleslaw','White coleslaw','Beyaz coleslaw','Λευκή σαλάτα coleslaw']],
 ['slaw-pink',['كول سلو وردي','Rosa Coleslaw','Pink coleslaw','Pembe coleslaw','Ροζ σαλάτα coleslaw']]]}
];
const bowlText={
 ar:{intro:'شيّك على كل صنف: موجود وجاهز؟ علّم عليه OK. البرطمانات مش ضمن هالقائمة.',count:'صنف جاهز',reference:'صور مرجعية للبول ستيشن',cold:'الخضار والإضافات',protein:'الدجاج والفلافل',hot:'الأطباق الساخنة'},
 de:{intro:'Jeden Artikel prüfen: vorhanden und bereit? Dann mit OK abhaken. Die Gläser gehören nicht zu dieser Liste.',count:'Artikel bereit',reference:'Referenzfotos der Bowl-Station',cold:'Gemüse & Toppings',protein:'Chicken & Falafel',hot:'Warme Gerichte'},
 en:{intro:'Check each item: available and ready? Tick it OK. The jars are not part of this checklist.',count:'items ready',reference:'Bowl-station reference photos',cold:'Vegetables & toppings',protein:'Chicken & falafel',hot:'Hot dishes'},
 tr:{intro:'Her ürünü kontrol et: mevcut ve hazır mı? O zaman OK olarak işaretle. Kavanozlar bu listeye dahil değil.',count:'ürün hazır',reference:'Bowl istasyonu referans fotoğrafları',cold:'Sebzeler ve ek malzemeler',protein:'Tavuk ve falafel',hot:'Sıcak yemekler'},
 el:{intro:'Έλεγξε κάθε είδος: υπάρχει και είναι έτοιμο; Σημείωσέ το με OK. Τα βάζα δεν περιλαμβάνονται στη λίστα.',count:'είδη έτοιμα',reference:'Φωτογραφίες αναφοράς σταθμού bowl',cold:'Λαχανικά και toppings',protein:'Κοτόπουλο και φαλάφελ',hot:'Ζεστά πιάτα'}
};
function bowlProgress(language,state){const items=bowlGroups.flatMap(group=>group.items);return `${items.filter(item=>state['bowl:'+item[0]]===true).length} / ${items.length} ${bowlText[language].count}`;}
function renderBowlChecklist(language,state){const i=['ar','de','en','tr','el'].indexOf(language);const labels=bowlText[language];return `<div class="bowl-station"><p>${labels.intro}</p><strong id="bowl-progress" class="bowl-progress">${bowlProgress(language,state)}</strong>${bowlGroups.map(group=>`<fieldset class="bowl-group"><legend>${group.name[i]}</legend>${group.items.map(([id,name])=>`<label class="bowl-row"><input type="checkbox" class="check bowl-check" data-bowl="${id}" aria-label="${name[i]}" ${state['bowl:'+id]===true?'checked':''}><span>${name[i]}</span><strong class="bowl-ok" aria-hidden="true">OK</strong></label>`).join('')}</fieldset>`).join('')}<details class="bowl-reference"><summary>${labels.reference}<span aria-hidden="true">+</span></summary><div class="photo-grid">${[['bowl-vegetables.jpg','cold'],['bowl-proteins.jpg','protein'],['bowl-hot.jpg','hot']].map(([file,key])=>`<figure class="guide-photo"><a href="assets/${file}" target="_blank" rel="noopener"><img src="assets/${file}" alt="${labels[key]}" loading="lazy"></a><figcaption>${labels[key]}</figcaption></figure>`).join('')}</div></details></div>`;}
