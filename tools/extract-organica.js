/* Jednorázová extrakce geometrie půdorysu přízemí Organiky z oficiálního SVG
   (organicaostrava.cz/retail) → tools/organica/plan.json.
   Spuštění:  node tools/extract-organica.js <cesta-k-Retail_CZ.svg> */
const fs = require('fs');
const path = require('path');

const src = process.argv[2];
if (!src) { console.error('Použití: node tools/extract-organica.js <Retail_CZ.svg>'); process.exit(1); }

const svg = fs.readFileSync(src, 'utf8');
const ds = [...svg.matchAll(/<path\b[^>]*?\sd="([^"]+)"/g)].map(m => m[1]);

/* Indexy cest v původním SVG (určeno podle výplně a ohraničení). */
const PICK = {
  base: 4,        // celá silueta budovy včetně atria (světlá výplň)
  outline: 72,    // vnější obrys
  zones: { fitness: 143, fashion: 99, cokafe: 125, kanteen: 194, rent: 479 },
};

const out = {
  base: ds[PICK.base],
  outline: ds[PICK.outline],
  zones: Object.fromEntries(Object.entries(PICK.zones).map(([k, i]) => [k, ds[i]])),
};
const dest = path.join(__dirname, 'organica', 'plan.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(out));
console.log('→', dest, (fs.statSync(dest).size / 1024).toFixed(0) + ' kB');
