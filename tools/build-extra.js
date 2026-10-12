/* ============================================================
   tools/build-extra.js — podniky v bezprostředním okolí centra

   Nejsou součástí půdorysu Forum Nová Karolina (VisioGlobe).
   · Frankie's Pub: poloha z OpenStreetMap, promítnutá do rámce mapy.
   · Kanteen a Cokafe: zóny z oficiálního plánu Organiky
     (organicaostrava.cz/retail), viz tools/organica.js.

   Spuštění:  node tools/build-extra.js   →   extra.js + organica.js
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { FRAME, geoToWorld } = require('./frame.js');
const organica = require('./organica.js').build();

const S = FRAME.scale;                 // světových jednotek na metr

/* wM/hM = odhadnutý půdorys provozovny v metrech. */
const PUB = {
  id: 'frankiespub', osm: 'node/2859829408',
  name: "Frankie's Pub", cat: 'restaurant',
  lat: 49.8300943, lon: 18.2869892, wM: 15, hM: 9,
  desc: 'Samostatný pavilon u centra — pivnice s širokým výčepem a jídlem po celý den.',
  tags: ['pivnice', 'pivo', 'samostatná budova'],
  open: 'Po–Ne 11:00–21:00', web: 'https://frankiespub.cz',
};

/* Podniky v Organice: zóna z plánu + rozměr odznaku loga na mapě. */
const ORG = [
  {
    id: 'kanteen', osm: 'node/11275613670', zone: 'kanteen', badge: [140, 56],
    name: 'Kanteen', cat: 'restaurant',
    desc: 'Moderní kantýna v jihozápadním křídle Organiky: designový interiér s výhledem, zdravá „organic fresh“ jídla, česká kuchyně a tematické týdny.',
    tags: ['kantýna', 'denní menu', 'Organica'],
    open: 'Po–Pá 7:30–15:00', web: 'https://www.kanteen.cz',
  },
  {
    id: 'cokafe', osm: 'node/11275613669', zone: 'cokafe', badge: [84, 30],
    name: 'Cokafe', cat: 'cafe',
    desc: 'Prosvětlená kavárna s oblými tvary ve východním křídle u vstupu. Objednávky QR kódem od stolu, pražená výběrová káva.',
    tags: ['káva', 'Organica', 'QR objednávka'],
    open: 'Po–Pá 7:30–19:00 · So–Ne 8:30–19:00', web: null,
  },
];

const units = [];
const venues = [];

{
  const c = geoToWorld(PUB.lat, PUB.lon);
  const w = PUB.wM * S, h = PUB.hM * S;
  const x = Math.round(c.x - w / 2), y = Math.round(c.y - h / 2);
  units.push({
    poi: PUB.osm, d: `M${x} ${y}H${x + w}V${y + h}H${x}Z`, k: 'shop', n: PUB.name,
    lx: Math.round(c.x), ly: Math.round(c.y), x, y, w, h, a: w * h, v: PUB.id, fc: 0,
  });
}

for (const o of ORG) {
  const z = organica.zones.find(q => q.id === o.zone);
  const b = organica.zoneBox[o.zone];
  units.push({
    poi: o.osm, d: z.d, k: 'shop', n: o.name, org: 1,
    lx: z.lx, ly: z.ly, x: b.x, y: b.y, w: o.badge[0], h: o.badge[1], a: b.w * b.h, v: o.id, fc: 0,
  });
}

for (const s of [PUB, ...ORG]) {
  venues.push({
    id: s.id, poi: s.osm, floor: 'out', name: s.name, cat: s.cat,
    desc: s.desc, tags: s.tags, fc: 0, open: s.open, web: s.web, osm: s.osm,
  });
}

const header = (name, what) => `/* ============================================================
   ${name} — AUTOMATICKY GENEROVÁNO, needituj ručně.
   Vygeneruj znovu:  node tools/build-extra.js

   ${what}
   ============================================================ */
`;

const extra = header('extra.js', `Podniky v bezprostředním okolí centra, které nejsou v oficiálním
   půdorysu Forum Nová Karolina (sever nahoře, 1 jednotka = 0,25 m).
   Tato vrstva je viditelná nad všemi patry.`) + `const EXTRA = {
  floor: { id: 'out', name: 'V okolí centra', short: 'Okolí', outside: true,
           units: ${JSON.stringify(units)} },
  venues: ${JSON.stringify(venues)}
};
`;

const { zoneBox, ...orgData } = organica;
const org = header('organica.js', `Půdorys přízemí budovy Organica podle oficiálního plánu
   (organicaostrava.cz/retail), usazený na stopu budovy z OpenStreetMap.`) +
  `const ORGANICA = ${JSON.stringify(orgData)};\n`;

const root = path.join(__dirname, '..');
fs.writeFileSync(path.join(root, 'extra.js'), extra, 'utf8');
fs.writeFileSync(path.join(root, 'organica.js'), org, 'utf8');
console.log(`okolní podniky: ${venues.length} → extra.js (${(extra.length / 1024).toFixed(1)} kB), organica.js (${(org.length / 1024).toFixed(1)} kB)`);
units.forEach(u => {
  const inFrame = u.lx >= 0 && u.ly >= 0 && u.lx <= FRAME.size && u.ly <= FRAME.size;
  console.log(`  ${u.n.padEnd(16)} x=${u.lx} y=${u.ly} ${inFrame ? '✓ v rámci' : '✗ MIMO RÁMEC'}`);
});
