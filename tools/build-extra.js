/* ============================================================
   tools/build-extra.js — podniky v bezprostředním okolí centra

   Nejsou součástí půdorysu Forum Nová Karolina (VisioGlobe), proto se
   berou z OpenStreetMap podle skutečných souřadnic a promítají se
   do stejného georeferencovaného rámce jako zbytek mapy.

   Spuštění:  node tools/build-extra.js   →   extra.js
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { FRAME, geoToWorld } = require('./frame.js');

const S = FRAME.scale;                 // světových jednotek na metr

/* Zdroj: OpenStreetMap (overpass-api.de), ověřeno 2026.
   wM/hM = odhadnutý půdorys provozovny v metrech. */
const SRC = [
  {
    id: 'frankiespub', osm: 'node/2859829408',
    name: "Frankie's Pub", cat: 'restaurant',
    lat: 49.8300943, lon: 18.2869892, wM: 15, hM: 9, rot: 0,
    desc: 'Samostatný pavilon u centra — pivnice s širokým výčepem a jídlem po celý den.',
    tags: ['pivnice', 'pivo', 'samostatná budova'],
    open: 'Po–Ne 11:00–21:00', web: 'https://frankiespub.cz',
  },
  {
    id: 'kanteen', osm: 'node/11275613670',
    name: 'Kanteen Organica', cat: 'restaurant',
    lat: 49.8292347, lon: 18.2856652, wM: 26, hM: 15, rot: 0,
    desc: 'Velkokapacitní jídelna v budově Organica — snídaně a denně 9 hlavních jídel.',
    tags: ['jídelna', 'denní menu', 'Organica'],
    open: 'Po–Pá 7:30–15:00', web: 'https://www.kanteen.cz',
  },
  {
    id: 'cokafe', osm: 'node/11275613669',
    name: 'Cokafe', cat: 'cafe',
    lat: 49.8295386, lon: 18.2857227, wM: 11, hM: 8, rot: 0,
    desc: 'Kavárna u Kanteenu v Organice, venkovní posezení a wi-fi.',
    tags: ['káva', 'Organica', 'terasa'],
    open: 'Po–Pá 7:30–19:00 · So–Ne 8:30–19:00', web: null,
  },
];

const units = [];
const venues = [];

for (const s of SRC) {
  const c = geoToWorld(s.lat, s.lon);
  const w = s.wM * S, h = s.hM * S;
  const x = Math.round(c.x - w / 2), y = Math.round(c.y - h / 2);
  const d = `M${x} ${y}H${x + w}V${y + h}H${x}Z`;

  units.push({
    poi: s.osm, d, k: 'shop', n: s.name,
    lx: Math.round(c.x), ly: Math.round(c.y),
    x, y, w, h, a: w * h, v: s.id, fc: 0,
  });
  venues.push({
    id: s.id, poi: s.osm, floor: 'out', name: s.name, cat: s.cat,
    desc: s.desc, tags: s.tags, fc: 0,
    open: s.open, web: s.web, osm: s.osm,
  });
}

const out = `/* ============================================================
   extra.js — AUTOMATICKY GENEROVÁNO, needituj ručně.
   Vygeneruj znovu:  node tools/build-extra.js

   Podniky v bezprostředním okolí centra, které nejsou v oficiálním
   půdorysu Forum Nová Karolina. Poloha podle OpenStreetMap,
   promítnuto do stejného rámce (sever nahoře, 1 jednotka = 0,25 m).
   Tato vrstva je viditelná nad všemi patry.
   ============================================================ */
const EXTRA = {
  floor: { id: 'out', name: 'V okolí centra', short: 'Okolí', outside: true,
           units: ${JSON.stringify(units)} },
  venues: ${JSON.stringify(venues)}
};
`;

const dest = path.join(__dirname, '..', 'extra.js');
fs.writeFileSync(dest, out, 'utf8');
console.log(`okolní podniky: ${venues.length} → extra.js (${Math.round(out.length / 1024)} kB)`);
venues.forEach((v, i) => {
  const u = units[i];
  const inFrame = u.lx >= 0 && u.ly >= 0 && u.lx <= FRAME.size && u.ly <= FRAME.size;
  console.log(`  ${v.name.padEnd(18)} x=${u.lx} y=${u.ly} ${inFrame ? '✓ v rámci' : '✗ MIMO RÁMEC'}`);
});
