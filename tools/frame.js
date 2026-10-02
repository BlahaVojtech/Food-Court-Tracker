/* ============================================================
   tools/frame.js — společný souřadnicový rámec

   Všechna data (půdorys centra i okolí z OpenStreetMap) se převádějí
   do jednoho světového rámce, který je orientovaný na SEVER
   (x roste na východ, y roste na jih — stejně jako u běžné mapy).

   1 světová jednotka = 0,25 m  (stejné měřítko jako originální dataset)
   ============================================================ */
const path = require('path');
const map = require(path.join(__dirname, 'vgmap.json'));
const { makePixelToUtm, utmForward, utmInverse, UTM_ZONE } = require('./geo.js');

/* pixel → UTM 34N; znaménko rotace i překlopení osy Y ověřeno měřením
   překryvu s footprintem „Forum Nová Karolina" (OSM way 98290906):
     bez překlopení  IoU 0,448
     s překlopením   IoU 0,616   ← správně
   Zdrojové souřadnice jsou v SVG prostoru (y dolů), geoinformace
   počítá s y na sever, proto y → svgHeight − y. */
const pixToUtmRaw = makePixelToUtm(map.geoinformation, 1);
const pixToUtm = (x, y) => pixToUtmRaw(x, map.svgHeight - y);

/* bbox celého centra (všechna patra) v UTM */
let e0 = Infinity, n0 = Infinity, e1 = -Infinity, n1 = -Infinity;
for (const p of map.pois.polygons) {
  for (const pair of p.points.trim().split(',')) {
    const [x, y] = pair.trim().split(/\s+/).map(Number);
    const u = pixToUtm(x, y);
    if (u.e < e0) e0 = u.e; if (u.e > e1) e1 = u.e;
    if (u.n < n0) n0 = u.n; if (u.n > n1) n1 = u.n;
  }
}

const SCALE = 4;              // světových jednotek na metr (1 j. = 0,25 m)
const HALF = 205;             // poloměr výřezu okolí v metrech
const cE = (e0 + e1) / 2, cN = (n0 + n1) / 2;

const FRAME = {
  originE: cE - HALF,
  originN: cN + HALF,         // sever nahoře → y měříme dolů od severního okraje
  sizeM: HALF * 2,
  size: Math.round(HALF * 2 * SCALE),
  scale: SCALE,
  centerLatLon: utmInverse(cE, cN, UTM_ZONE),
};

/* UTM → světové souřadnice (sever nahoře) */
const utmToWorld = (e, n) => ({
  x: (e - FRAME.originE) * SCALE,
  y: (FRAME.originN - n) * SCALE,
});
const pixToWorld = (x, y) => { const u = pixToUtm(x, y); return utmToWorld(u.e, u.n); };
const geoToWorld = (lat, lon) => { const u = utmForward(lat, lon, UTM_ZONE); return utmToWorld(u.e, u.n); };

module.exports = { FRAME, pixToUtm, utmToWorld, pixToWorld, geoToWorld };
