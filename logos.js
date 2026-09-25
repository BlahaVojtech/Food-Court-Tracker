/* ============================================================
   logos.js — AUTOMATICKY GENEROVÁNO, needituj ručně.
   Loga podniků pocházejí z oficiální navigace centra
   (navigace-v-centru.cz/karolina/js/data_core.min.js) a jsou
   rasterizována do logos/<id>.webp (delší strana 128 px, průhledné pozadí).
   Díky tomu se nenačítá stovky kB inline SVG v JavaScriptu.
   Hodnota = [šířka, výška] v px → odznak na mapě drží poměr stran loga.
   ============================================================ */
const LOGO_DIR = 'logos/';
const LOGOS = {"fruitisimo":[128,40],"ugosalaterie":[128,59],"wafwaf":[128,54],"pizzahut":[128,120],"loscapolitos":[128,27],"coloseum":[128,67],"kfc":[128,128],"tuktuk":[128,28],"spaghetti":[128,128],"bageterie":[128,66],"wokfood":[128,11],"burgerking":[116,128],"goldenbird":[128,112],"lunchtime":[128,111],"guty":[121,128],"pandada":[126,128],"popeyes":[128,21],"hoian":[128,15],"mcdonalds":[128,112],"kaskada":[128,38],"natoccino":[128,32],"shirokiya":[128,71],"marlenka":[128,37],"starbucks":[128,33],"costa":[128,15],"tchibo":[128,76],"cokoladovysen":[128,21],"ugofreshbar":[128,59],"asijske":[128,27],"minit":[128,55],"kohut":[128,86],"amart":[128,45],"cheesemarket":[128,94],"medoo":[128,37]};
const logoUrl = id => (id in LOGOS) ? LOGO_DIR + id + '.webp' : null;
const logoAspect = id => (id in LOGOS) ? LOGOS[id][0] / LOGOS[id][1] : 1;
