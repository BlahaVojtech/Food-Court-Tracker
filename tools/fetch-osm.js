/* ============================================================
   tools/fetch-osm.js — stáhne reálné okolí z OpenStreetMap
   (Overpass API) do tools/osm.json
   ============================================================ */
const fs = require('fs');
const path = require('path');
const https = require('https');

const S = 49.8258, W = 18.2778, N = 49.8368, E = 18.2932;
const BBOX = `${S},${W},${N},${E}`;

const Q = `[out:json][timeout:90];
(
  way["building"](${BBOX});
  relation["building"](${BBOX});
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|residential|unclassified|living_street|service|footway|pedestrian)$"](${BBOX});
  way["railway"~"^(rail|tram|light_rail)$"](${BBOX});
  way["natural"="water"](${BBOX});
  way["waterway"="riverbank"](${BBOX});
  relation["natural"="water"](${BBOX});
  way["leisure"~"^(park|garden|pitch)$"](${BBOX});
  way["landuse"~"^(grass|forest|meadow|recreation_ground)$"](${BBOX});
  way["amenity"="parking"](${BBOX});
);
out geom;`;

const body = 'data=' + encodeURIComponent(Q);
const ENDPOINTS = [
  'overpass-api.de', 'overpass.kumi.systems', 'overpass.openstreetmap.ru',
];

function tryHost(i) {
  if (i >= ENDPOINTS.length) { console.error('Všechny Overpass servery selhaly.'); process.exit(1); }
  const host = ENDPOINTS[i];
  console.log('→ ' + host);
  const req = https.request({
    host, path: '/api/interpreter', method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body),
      'User-Agent': 'karolina-foodcourt/1.0 (offline map build)',
    },
  }, res => {
    if (res.statusCode !== 200) {
      console.error('  HTTP ' + res.statusCode);
      res.resume(); return tryHost(i + 1);
    }
    let d = '';
    res.setEncoding('utf8');
    res.on('data', c => d += c);
    res.on('end', () => {
      try {
        const j = JSON.parse(d);
        fs.writeFileSync(path.join(__dirname, 'osm.json'), d, 'utf8');
        console.log('  prvků: ' + j.elements.length + ' → tools/osm.json (' +
                    (d.length / 1024 / 1024).toFixed(1) + ' MB)');
      } catch (e) { console.error('  parse: ' + e.message); tryHost(i + 1); }
    });
  });
  req.on('error', e => { console.error('  ' + e.message); tryHost(i + 1); });
  req.write(body);
  req.end();
}
tryHost(0);
