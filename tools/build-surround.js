/* ============================================================
   tools/build-surround.js — vygeneruje surround.js
   (skutečné okolí centra z OpenStreetMap)

   Vstup:   tools/osm.json  (viz tools/fetch-osm.js)
   Výstup:  surround.js     (stejný souřadnicový rámec jako plan.js)
   ============================================================ */
const fs = require('fs');
const path = require('path');
const { FRAME, geoToWorld } = require('./frame.js');

const ROOT = path.join(__dirname, '..');
const osm = JSON.parse(fs.readFileSync(path.join(__dirname, 'osm.json'), 'utf8'));

const MALL_WAY = 98290906;          // Forum Nová Karolina — kreslíme jako podklad pod jednotky
const S = FRAME.size;
const MARGIN = S * 0.06;            // kousek za okrajem rámce kvůli ořezu
const SIMPLIFY = 1.6;               // tolerance zjednodušení (≈ 40 cm)

/* ---------- pomocné ---------- */
const inFrame = p => p.x > -MARGIN && p.x < S + MARGIN && p.y > -MARGIN && p.y < S + MARGIN;

/* Douglas–Peucker — výrazně zmenší počet bodů bez viditelné změny tvaru */
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const sq = tol * tol;
  const segDist = (p, a, b) => {
    let x = a.x, y = a.y, dx = b.x - x, dy = b.y - y;
    if (dx || dy) {
      const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);
      if (t > 1) { x = b.x; y = b.y; } else if (t > 0) { x += dx * t; y += dy * t; }
    }
    return (p.x - x) ** 2 + (p.y - y) ** 2;
  };
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [i, j] = stack.pop();
    let max = 0, idx = -1;
    for (let k = i + 1; k < j; k++) {
      const d = segDist(pts[k], pts[i], pts[j]);
      if (d > max) { max = d; idx = k; }
    }
    if (max > sq && idx > 0) { keep[idx] = 1; stack.push([i, idx], [idx, j]); }
  }
  return pts.filter((_, i) => keep[i]);
}

function toPath(geom, close, tol = SIMPLIFY) {
  let pts = geom.map(g => geoToWorld(g.lat, g.lon));
  if (!pts.some(inFrame)) return null;
  pts = simplify(pts, tol);
  if (pts.length < 2) return null;
  const d = pts.map((p, i) => (i ? 'L' : 'M') + Math.round(p.x) + ' ' + Math.round(p.y)).join('');
  return { d: d + (close ? 'Z' : ''), pts };
}

function bbox(pts) {
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x: +x.toFixed(1), y: +y.toFixed(1),
           w: +(Math.max(...xs) - x).toFixed(1), h: +(Math.max(...ys) - y).toFixed(1) };
}

/* těžiště plochy pro umístění popisku */
function centroid(pts) {
  let A = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const f = a.x * b.y - b.x * a.y;
    A += f; cx += (a.x + b.x) * f; cy += (a.y + b.y) * f;
  }
  if (Math.abs(A) < 1e-6) return { x: pts[0].x, y: pts[0].y, a: 0 };
  return { x: cx / (3 * A), y: cy / (3 * A), a: Math.abs(A) / 2 };
}

/* ---------- klasifikace ---------- */
const ROAD_W = {
  motorway: 26, trunk: 24, primary: 22, secondary: 19, tertiary: 16,
  residential: 12, unclassified: 12, living_street: 10, service: 7,
  pedestrian: 10, footway: 4,
};
function buildingKind(t) {
  const b = t.building || '';
  if (/^(retail|mall|commercial|office|industrial|warehouse)$/.test(b) || t.shop || t.office) return 'com';
  if (/^(apartments|residential|house|dormitory|terrace)$/.test(b)) return 'res';
  if (/^(church|cathedral|chapel|civic|university|school|hospital|public|government)$/.test(b) || t.amenity === 'place_of_worship') return 'civ';
  if (/^(garage|garages|parking|carport|roof|shed|hut|service|construction)$/.test(b)) return 'aux';
  return 'gen';
}

/* ---------- sběr ---------- */
const buildings = [], roads = [], rails = [], water = [], green = [], parking = [];
let mall = null;

for (const e of osm.elements) {
  const t = e.tags || {};

  if (e.type === 'way' && e.id === MALL_WAY) {
    const p = toPath(e.geometry, true, 0.8);
    if (p) mall = { d: p.d, ...bbox(p.pts) };
    continue;
  }

  if (e.type === 'relation' && t.building) {
    // multipolygon — vezmeme vnější okruhy
    for (const m of e.members || []) {
      if (m.role !== 'outer' || !m.geometry) continue;
      const p = toPath(m.geometry, true); if (!p) continue;
      const c = centroid(p.pts);
      buildings.push({ d: p.d, k: buildingKind(t), n: t.name || '', a: Math.round(c.a),
                       lx: +c.x.toFixed(1), ly: +c.y.toFixed(1), ...bbox(p.pts) });
    }
    continue;
  }
  if (e.type !== 'way' || !e.geometry) continue;

  if (t.building && e.id !== MALL_WAY) {
    const p = toPath(e.geometry, true); if (!p) continue;
    const c = centroid(p.pts);
    buildings.push({ d: p.d, k: buildingKind(t), n: t.name || '', a: Math.round(c.a),
                     lx: +c.x.toFixed(1), ly: +c.y.toFixed(1), ...bbox(p.pts) });
  } else if (t.highway && ROAD_W[t.highway]) {
    const p = toPath(e.geometry, false); if (!p) continue;
    roads.push({ d: p.d, w: ROAD_W[t.highway], n: t.name || '',
                 f: /^(footway|pedestrian)$/.test(t.highway) ? 1 : 0 });
  } else if (t.railway) {
    const p = toPath(e.geometry, false); if (!p) continue;
    rails.push({ d: p.d, t: t.railway === 'tram' ? 'tram' : 'rail' });
  } else if (t.natural === 'water' || t.waterway === 'riverbank') {
    const p = toPath(e.geometry, true); if (!p) continue;
    water.push({ d: p.d, n: t.name || '' });
  } else if (t.leisure || t.landuse) {
    const p = toPath(e.geometry, true); if (!p) continue;
    const c = centroid(p.pts);
    green.push({ d: p.d, n: t.name || '', a: Math.round(c.a), lx: +c.x.toFixed(1), ly: +c.y.toFixed(1) });
  } else if (t.amenity === 'parking') {
    const p = toPath(e.geometry, true); if (!p) continue;
    parking.push({ d: p.d });
  }
}

/* popisky ulic — jen pojmenované a dostatečně dlouhé, bez duplicit */
const streetSeen = new Set();
const streets = [];
for (const e of osm.elements) {
  const t = e.tags || {};
  if (e.type !== 'way' || !t.highway || !t.name || !e.geometry) continue;
  if (streetSeen.has(t.name)) continue;
  const p = toPath(e.geometry, false); if (!p) continue;
  const mid = p.pts[Math.floor(p.pts.length / 2)];
  const prev = p.pts[Math.max(0, Math.floor(p.pts.length / 2) - 1)];
  if (!inFrame(mid)) continue;
  let ang = Math.atan2(mid.y - prev.y, mid.x - prev.x) * 180 / Math.PI;
  if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
  streetSeen.add(t.name);
  streets.push({ n: t.name, x: +mid.x.toFixed(1), y: +mid.y.toFixed(1), r: +ang.toFixed(1) });
}

/* jen dostatečně velké budovy dostanou popisek */
buildings.sort((a, b) => b.a - a.a);

const out =
`/* ============================================================
   surround.js — AUTOMATICKY GENEROVÁNO, needituj ručně.
   Vygeneruj znovu:  node tools/fetch-osm.js && node tools/build-surround.js

   Skutečné okolí Fora Nová Karolina z OpenStreetMap
   (© přispěvatelé OpenStreetMap, ODbL). Souřadnice jsou ve stejném
   rámci jako plan.js — sever nahoře, 1 jednotka = 0,25 m.
   ============================================================ */
const SURROUND = ${JSON.stringify({ frame: FRAME, mall, buildings, roads, rails, water, green, parking, streets })};
`;

fs.writeFileSync(path.join(ROOT, 'surround.js'), out, 'utf8');
console.log(`budovy ${buildings.length} · silnice ${roads.length} · koleje ${rails.length} · ` +
            `voda ${water.length} · zeleň ${green.length} · parkoviště ${parking.length} · ulice ${streets.length}` +
            ` · silueta centra: ${mall ? 'ano' : 'NE'}`);
console.log('→ surround.js (' + (out.length / 1024).toFixed(0) + ' kB)');
