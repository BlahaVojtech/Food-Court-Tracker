/* ============================================================
   tools/build-plan.js
   Vygeneruje plan.js — skutečný půdorys Fora Nová Karolina.

   Vstupy (stažené z veřejných zdrojů centra):
     tools/vgmap.json  … mapserver.visioglobe.com/<venue>/map.json
                          (odkazováno z forumnovakarolina.cz/mapa-centra/
                           přes navigace-v-centru.cz/karolina)
     tools/dc.js       … navigace-v-centru.cz/karolina/js/data_core.min.js
                          (názvy a kategorie jednotek)

   Spuštění:  node tools/build-plan.js
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const map = JSON.parse(fs.readFileSync(path.join(__dirname, 'vgmap.json'), 'utf8'));

/* ---------- 1. názvy a kategorie jednotek z data_core ---------- */
const dc = fs.readFileSync(path.join(__dirname, 'dc.js'), 'utf8');
const META = {};
for (const m of dc.matchAll(/\{id:"((?:[^"\\]|\\.)*)",display:"((?:[^"\\]|\\.)*)",type:"([^"]*)",category:"([^"]*)"/g)) {
  META[m[1]] = {
    name: m[2].replace(/\\(.)/g, '$1').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
    type: m[3], cat: m[4]
  };
}
console.log('data_core: ' + Object.keys(META).length + ' jednotek');

/* ---------- 1b. loga jednotek (inline SVG z data_core) ---------- */
const LOGO_SRC = {};
for (const m of dc.matchAll(/\{id:"((?:[^"\\]|\\.)*)",display:"(?:[^"\\]|\\.)*",type:"[^"]*",category:"[^"]*",svg:'([\s\S]*?)'\}/g)) {
  LOGO_SRC[m[1].replace(/\\(.)/g, '$1')] = m[2].replace(/\\(.)/g, '$1');
}
console.log('loga: ' + Object.keys(LOGO_SRC).length);

/* ---------- 2. geometrie ---------- */
const POLY = new Map(map.pois.polygons.map(p => [p.poiID, p.points]));
const PT = new Map(map.pois.points.map(p => [p.poiID, p]));
const FLOOR_OF = new Map(map.pois.places.map(p => [p.poiID, p.floor]));

/* Souřadnice se georeferencují (UTM 34N, geoinformation z map.json)
   a převádějí do společného rámce orientovaného na SEVER — viz tools/frame.js */
const { FRAME, pixToWorld } = require('./frame.js');
const parse = s => s.trim().split(',').map(pair => {
  const [x, y] = pair.trim().split(/\s+/).map(Number);
  return pixToWorld(x, y);
});

/* ---------- 3. patra ---------- */
const FLOOR_DEF = [
  { vg: 'B1-P2',  id: 'p2',  name: '2. patro — Food Court',  short: '🍔 2. patro · Food Court' },
  { vg: 'B1-P1',  id: 'p1',  name: '1. patro',               short: '👗 1. patro' },
  { vg: 'B1-P0',  id: 'p0',  name: 'Přízemí',                short: '☕ Přízemí' },
  { vg: 'B1-P-1', id: 'm1',  name: '−1. patro',              short: '🅿️ −1. patro' },
  { vg: 'B1-P-2', id: 'm2',  name: '−2. patro — Albert',     short: '🛒 −2. patro' },
];

/* ---------- 4. klasifikace jednotek ---------- */
const VERT = /^(hlavnischody|bocnischody|hlavnivytah|bocnivytah|eskalator|travelator)/;
const SERVICE = /^(toalety|bezbarierove|detske prebalovny|cistic bot|horizont|platba parkovneho|dobijeni|masazni kresla|sprava centra|bankomat|raiffeisen bank bankomat|air bank bankomat|informace|sluzby centra|darkove karty|cash point|bankomaty)/;
const AREA = /^(jidelni zona|detske hriste|karolinska divocina|form factory ladies zona)/;

function kindOf(poi) {
  if (VERT.test(poi)) return 'vert';
  if (SERVICE.test(poi)) return 'service';
  if (AREA.test(poi)) return 'area';
  return 'shop';
}

const LABEL_CZ = {
  'jidelni zona2': 'Jídelní zóna', 'detske hriste2': 'Dětské hřiště',
  'karolinska divocina': 'Karolínská divočina', 'toalety2': 'Toalety',
  'toalety2b': 'Toalety', 'toalety1': 'Toalety', 'toalety-2': 'Toalety',
  'bezbarierove toalety2': 'Bezbariérové WC', 'bezbarierove toalety-2': 'Bezbariérové WC',
  'detske prebalovny2': 'Přebalovna', 'detske prebalovny2b': 'Přebalovna',
  'detske prebalovny1': 'Přebalovna', 'sprava centra': 'Správa centra',
  'detsky koutek pokojik': 'Dětský koutek Pokojík', 'informace': 'Infostánek',
  'sluzby centra': 'Služby centra', 'albert hypermarket': 'Hypermarket Albert',
};

/* ---------- 5. sestavení pater ---------- */
const floors = [];
for (const F of FLOOR_DEF) {
  const ids = map.pois.places.filter(p => p.floor === F.vg).map(p => p.poiID);
  const raw = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const poi of ids) {
    const pts = POLY.get(poi);
    if (!pts) continue;
    const arr = parse(pts);
    if (arr.length < 3) continue;
    for (const p of arr) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    raw.push({ poi, arr });
  }

  const PAD = 30;
  const ox = 0, oy = 0;                       // společný rámec — žádný posun
  const w = FRAME.size, h = FRAME.size;
  const bx0 = Math.round(minX - PAD), by0 = Math.round(minY - PAD);
  const bw = Math.round(maxX - minX + PAD * 2), bh = Math.round(maxY - minY + PAD * 2);

  const units = raw.map(({ poi, arr }) => {
    const d = arr.map((p, i) => (i ? 'L' : 'M') + Math.round(p.x - ox) + ' ' + Math.round(p.y - oy)).join('') + 'Z';
    // těžiště plochy pro umístění popisku
    let A = 0, cx = 0, cy = 0;
    for (let i = 0; i < arr.length - 1; i++) {
      const a = arr[i], b = arr[i + 1];
      const f = a.x * b.y - b.x * a.y;
      A += f; cx += (a.x + b.x) * f; cy += (a.y + b.y) * f;
    }
    let lx, ly;
    if (Math.abs(A) > 1e-6) { lx = cx / (3 * A) - ox; ly = cy / (3 * A) - oy; }
    else { const p = PT.get(poi); const r = p ? pixToWorld(p.x, p.y) : arr[0]; lx = r.x - ox; ly = r.y - oy; }

    const meta = META[poi] || {};
    const bx = arr.map(p => p.x), by = arr.map(p => p.y);
    const x0 = Math.min(...bx) - ox, y0 = Math.min(...by) - oy;
    return {
      poi,
      d,
      k: kindOf(poi),
      n: LABEL_CZ[poi] || meta.name || '',
      lx: +lx.toFixed(1), ly: +ly.toFixed(1),
      x: +x0.toFixed(1), y: +y0.toFixed(1),
      w: +(Math.max(...bx) - Math.min(...bx)).toFixed(1),
      h: +(Math.max(...by) - Math.min(...by)).toFixed(1),
      a: Math.round(Math.abs(A) / 2),
    };
  }).sort((a, b) => b.a - a.a); // velké plochy vespod

  floors.push({ id: F.id, vg: F.vg, name: F.name, short: F.short, w, h,
                bx: bx0, by: by0, bw, bh, units });
  console.log(`${F.id.padEnd(3)} ${F.vg.padEnd(7)} ${String(units.length).padStart(3)} jednotek  ${bw}×${bh} @ ${bx0},${by0}`);
}

/* ---------- 6. sledované gastro podniky ---------- */
const V = (id, poi, cat, name, desc, tags, extra = {}) => ({ id, poi, cat, name, desc, tags, ...extra });

const VENUES = [
  /* --- 2. patro: hlavní galerie food courtu --- */
  V('fruitisimo', 'fruitisimo', 'drinks', 'Fruitisimo fresh bar',
    'Čerstvé džusy, smoothie a ovocné poháry.', ['smoothie', 'džusy', 'ovoce'], { fc: 1 }),
  V('ugosalaterie', 'ugo salaterie', 'healthy', 'UGO Salaterie',
    'Čerstvé saláty a domácí polévky, sezónní menu.', ['saláty', 'polévky', 'zdravé'], { fc: 1 }),
  V('wafwaf', 'waf waf', 'sweet', 'WAF-WAF',
    'Sladké i slané vafle, palačinky a lívance.', ['vafle', 'palačinky', 'dezert'], { fc: 1 }),
  V('pizzahut', 'pizza hut', 'pizza', 'Pizza Hut',
    'Pizza a těstoviny světového řetězce.', ['pizza', 'pasta'], { fc: 1 }),
  V('loscapolitos', 'los capolitos', 'fastfood', 'LOS CAPOLITOS',
    'Mexická kuchyně — burrito, tacos, připravováno na místě.', ['mexická', 'burrito', 'tacos'], { fc: 1 }),
  V('coloseum', 'pizza coloseum', 'pizza', 'Pizza Coloseum',
    'Pizza, domácí těstoviny, grilované steaky, ryby a mořské plody.', ['pizza', 'italská', 'steaky'], { fc: 1 }),
  V('kfc', 'kfc', 'fastfood', 'KFC',
    'Smažené kuře podle receptury Colonela Sanderse, sendviče a burgery.', ['kuřecí', 'burger', 'bucket'], { fc: 1 }),
  V('tuktuk', 'tuk tuk', 'asian', 'TUK TUK',
    'Thajská kuchyně — pikantní, lehká a pestrá.', ['thajská', 'street food'], { fc: 1 }),
  V('spaghetti', 'spaghetti parmigiano', 'restaurant', 'SPAGHETTI PARMIGIANO',
    'Čerstvě připravené těstoviny dokončované přímo v kole sýra Parmigiano Reggiano.', ['italská', 'pasta', 'show cooking'], { fc: 1 }),
  V('bageterie', 'bageterie boulevard', 'fastfood', 'Bageterie Boulevard',
    'Čerstvé bagety ve francouzském stylu, česká síť.', ['bagety', 'rychlé'], { fc: 1 }),
  V('wokfood', 'wok food', 'asian', 'Wok Food',
    'Čínské speciality z woku včetně příloh, kávy a čaje.', ['wok', 'čínská', 'nudle'], { fc: 1 }),
  V('burgerking', 'burger king', 'fastfood', 'Burger King',
    'Burgery z hovězího i kuřecího masa grilované na otevřeném ohni.', ['burger', 'Whopper', 'gril'], { fc: 1 }),

  /* --- 2. patro: nový blok kiosků (otevřen 12/2025) --- */
  V('goldenbird', 'golden bird', 'asian', 'Golden Bird',
    'Indická kuchyně — klasická indická jídla a curry.', ['indická', 'curry', 'kiosek'], { fc: 1 }),
  V('lunchtime', 'lunch time', 'restaurant', 'LUNCH TIME',
    'Otevřený bufet — české klasiky, těstoviny, grilované a smažené speciality, skládáte si sami.', ['bufet', 'česká', 'denní menu'], { fc: 1 }),
  V('guty', 'guty', 'fastfood', 'Guty',
    'Otevřená kuchyně s grilem — kuchaři vaří přímo před vámi, prémiové suroviny.', ['gril', 'open kitchen'], { fc: 1 }),
  V('pandada', 'pandada', 'drinks', 'PANDADA',
    'Barevné bubble tea nápoje plné kuliček. Stánek v nově otevřeném food courtu.', ['bubble tea', 'boba', 'kiosek'], { fc: 1 }),
  V('popeyes', 'popeyes', 'fastfood', 'POPEYES',
    'Louisianské smažené kuře marinované 12 hodin v cajunském koření. První pobočka v Ostravě (otevřeno 12/2025).', ['kuřecí', 'cajun', 'novinka'], { fc: 1 }),
  V('hoian', 'asia buffet', 'asian', 'HOI AN',
    'Autentická vietnamská kuchyně — phở a čerstvé suroviny, vaří se denně. V navigaci centra je jednotka stále vedena jako Asia Buffet.', ['vietnamská', 'phở', 'novinka'], { fc: 1 }),

  /* --- 2. patro: mimo jádro food courtu --- */
  V('mcdonalds', 'mcdonalds', 'fastfood', "McDonald's",
    'Burgery, hranolky a McCafé. Leží v obchodní části 2. patra, kousek od food courtu.', ['burger', 'McCafé', 'snídaně']),
  V('kaskada', 'kaskada restaurant', 'restaurant', 'Kaskáda Restaurant',
    'Tradiční česká gastronomie rychle a za nízké ceny, večer i posezení. U kina Cinema City.', ['česká', 'obsluha', 'u kina']),
  V('natoccino', 'natoccino cafe', 'cafe', 'NATOCCINO CAFÉ',
    'Italské espresso a pravá italská zmrzlina gelato od „Mr. Gelata“ Diega Vincensoniho.', ['káva', 'gelato', 'u kina']),

  /* --- 1. patro --- */
  V('shirokiya', 'running sushi shirokiya', 'asian', 'RUNNING SUSHI SHIROKIYA',
    'Running sushi na pásu — 1,5 hodiny neomezené konzumace asijských specialit.', ['sushi', 'all you can eat']),
  V('marlenka', 'marlenka', 'sweet', 'MARLENKA Café & Shop',
    'Medové dorty, kuličky a prémiové ručně vyráběné zákusky.', ['medovník', 'dorty']),

  /* --- Přízemí --- */
  V('starbucks', 'starbucks', 'cafe', 'Starbucks',
    'Světový kávový řetězec — frappuccino, latte a sezónní nápoje.', ['káva']),
  V('costa', 'costa coffee', 'cafe', 'Costa Coffee',
    'Kavárenský řetězec s kávou v italském stylu a dezerty.', ['káva']),
  V('tchibo', 'tchibo', 'cafe', 'Tchibo',
    'Kávový bar s posezením uvnitř prodejny Tchibo.', ['káva', 'obchod']),
  V('cokoladovysen', 'cokoladovy sen', 'sweet', 'ČOKOLÁDOVÝ SEN',
    'Prémiová čokoláda a pralinky, kavárna s dětským koutkem.', ['čokoláda', 'pralinky']),
  V('ugofreshbar', 'ugo freshbar', 'drinks', 'UGO Freshbar',
    'Čerstvé šťávy, smoothie, snídaně a lehká jídla.', ['smoothie', 'snídaně']),
  V('asijske', 'asijske speciality', 'asian', 'ASIJSKÉ SPECIALITY S SEBOU',
    'Asijské jídlo s sebou vedle infostánku — skládáte si ze šesti jídel.', ['take away', 'asijská']),

  /* --- −1. patro --- */
  V('minit', 'minit fornetti premium', 'bakery', 'Minit & RUDOVA PEKÁRNA',
    'Přes 40 druhů pečiva pečeného přímo na místě — vanilkové, pizzové, čokoládové, nugátové, tvarohové, se šunkou i sýrem.', ['pekárna', 'pečivo']),
  V('kohut', 'pekarstvi reznictvi kohut', 'bakery', 'Pekařství a Řeznictví Kohut',
    'Pekárna a řeznictví — čerstvé pečivo a masné výrobky.', ['pekárna', 'řeznictví']),

  /* --- −2. patro --- */
  V('amart', 'amart', 'healthy', 'AMART',
    'Asijské potraviny — koření, omáčky, nudle a rýže.', ['asijské potraviny']),
  V('cheesemarket', 'cheese market', 'healthy', 'CHEESE MARKET',
    'Evropské sýry — holandské, francouzské, italské, španělské i slovenské — a vína.', ['sýry', 'víno']),
  V('medoo', 'medoo medomat', 'sweet', 'MEDOO Medomat',
    'Automat s medem a medovými produkty z vlastního včelařství v Šilheřovicích.', ['med', 'automat']),
];

/* zóny, které se zvýrazní jako součást food courtu */
const FC_AREAS = ['jidelni zona2', 'detske hriste2', 'karolinska divocina'];

/* ---------- 7. kontrola a provázání ---------- */
const vgToApp = Object.fromEntries(FLOOR_DEF.map(f => [f.vg, f.id]));
let missing = 0;
for (const v of VENUES) {
  const vg = FLOOR_OF.get(v.poi);
  if (!vg) { console.error('  ⚠️  poiID nenalezeno: ' + v.poi + ' (' + v.name + ')'); missing++; continue; }
  v.floor = vgToApp[vg];
}
// označíme jednotky v půdorysu
const byPoi = {};
VENUES.forEach(v => byPoi[v.poi] = v);
for (const f of floors) {
  for (const u of f.units) {
    if (byPoi[u.poi]) { u.v = byPoi[u.poi].id; u.n = byPoi[u.poi].name; }
    if (f.id === 'p2' && (FC_AREAS.includes(u.poi) || (byPoi[u.poi] && byPoi[u.poi].fc))) u.fc = 1;
  }
}
console.log(`podniky: ${VENUES.length}, nespárováno: ${missing}`);

/* ---------- 8. zápis ---------- */
const out =
`/* ============================================================
   plan.js — AUTOMATICKY GENEROVÁNO, needituj ručně.
   Vygeneruj znovu:  node tools/build-plan.js

   Půdorys pochází z oficiální interaktivní mapy centra
   (forumnovakarolina.cz/mapa-centra → navigace-v-centru.cz/karolina,
   mapová data VisioGlobe). Obrysy jednotek, jejich rozmístění
   a patra jsou tedy skutečné, ne schematické.
   ============================================================ */

/* patra: w/h = rozměr celého rámce (shodný pro všechna patra, sever nahoře)
   bx,by,bw,bh = bbox samotného patra · units[] = jednotky
   u.poi = id v mapě centra · u.d = SVG path · u.k = druh jednotky
   u.n = popisek · u.lx,u.ly = kotva popisku · u.x,u.y,u.w,u.h = bbox
   u.a = plocha · u.v = id sledovaného podniku · u.fc = součást food courtu */
const FLOORS = ${JSON.stringify(floors)};

/* rámec mapy — 1 jednotka = 0,25 m, sever je nahoře */
const FRAME = ${JSON.stringify(FRAME)};

/* sledované gastro podniky */
const VENUES = ${JSON.stringify(VENUES.map(v => ({
  id: v.id, poi: v.poi, floor: v.floor, name: v.name,
  cat: v.cat, desc: v.desc, tags: v.tags, fc: v.fc || 0
})))};
`;

fs.writeFileSync(path.join(ROOT, 'plan.js'), out, 'utf8');
console.log('→ plan.js (' + (out.length / 1024).toFixed(0) + ' kB)');

/* ---------- 9. loga sledovaných podniků → WebP ---------- */
const sharp = require('sharp');
const LOGO_DIR = path.join(ROOT, 'logos');
const LOGO_PX = 128;            // 4× velikost odznaku na obrazovce, stačí i na retinu

fs.rmSync(LOGO_DIR, { recursive: true, force: true });
fs.mkdirSync(LOGO_DIR, { recursive: true });

const noLogo = [];
const jobs = [];
for (const v of VENUES) {
  const raw = LOGO_SRC[v.poi];
  if (!raw) { noLogo.push(v.id); continue; }
  const vb = (raw.match(/viewBox="([^"]+)"/) || [])[1] || '0 0 100 100';
  const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
                   .replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').trim();
  const [, , vw, vh] = vb.split(/[\s,]+/).map(Number);
  const k = (LOGO_PX * 4) / Math.max(vw || 1, vh || 1);   // vykreslíme 4× a pak zmenšíme
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" ` +
              `width="${Math.round((vw || 1) * k)}" height="${Math.round((vh || 1) * k)}">${inner}</svg>`;
  jobs.push(
    sharp(Buffer.from(svg))
      .trim({ threshold: 1 })                             // ořízneme průhledný okraj
      // bez čtvercového rámování — zachováme poměr stran, odznak se mu přizpůsobí
      .resize(LOGO_PX, LOGO_PX, { fit: 'inside', withoutEnlargement: false })
      .webp({ quality: 88, alphaQuality: 90, effort: 6 })
      .toFile(path.join(LOGO_DIR, v.id + '.webp'))
      .then(info => [v.id, info.width, info.height])
  );
}

Promise.all(jobs).then(res => {
  const LOGOS = {};
  res.forEach(([id, w, h]) => { LOGOS[id] = [w, h]; });
  const lout =
`/* ============================================================
   logos.js — AUTOMATICKY GENEROVÁNO, needituj ručně.
   Loga podniků pocházejí z oficiální navigace centra
   (navigace-v-centru.cz/karolina/js/data_core.min.js) a jsou
   rasterizována do logos/<id>.webp (delší strana ${LOGO_PX} px, průhledné pozadí).
   Díky tomu se nenačítá stovky kB inline SVG v JavaScriptu.
   Hodnota = [šířka, výška] v px → odznak na mapě drží poměr stran loga.
   ============================================================ */
const LOGO_DIR = 'logos/';
const LOGOS = ${JSON.stringify(LOGOS)};
const logoUrl = id => (id in LOGOS) ? LOGO_DIR + id + '.webp' : null;
const logoAspect = id => (id in LOGOS) ? LOGOS[id][0] / LOGOS[id][1] : 1;
`;
  fs.writeFileSync(path.join(ROOT, 'logos.js'), lout, 'utf8');
  const bytes = res.reduce((s, [id]) => s + fs.statSync(path.join(LOGO_DIR, id + '.webp')).size, 0);
  console.log(`→ logos/ ${res.length}× webp (celkem ${(bytes / 1024).toFixed(0)} kB) ` +
              `+ logos.js (${(lout.length / 1024).toFixed(1)} kB), bez loga: ` +
              (noLogo.length ? noLogo.join(', ') : '—'));
}).catch(e => { console.error('chyba při rasterizaci log:', e.message); process.exit(1); });
