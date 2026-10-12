/* ============================================================
   tools/build-organica-logos.js — loga Kanteen a Cokafe (WebP)

   SVG loga jsou z organicaostrava.cz/retail (tools/organica/*.svg).
   Rasterizuje je stejně jako ostatní loga (delší strana 128 px,
   průhledné pozadí) do logos/<id>.webp a doplní je do logos.js.

   Spuštění:  node tools/build-organica-logos.js   (po build-plan.js)
   ============================================================ */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const PX = 128;
const IDS = ['kanteen', 'cokafe'];

(async () => {
  const dims = {};
  for (const id of IDS) {
    const svg = path.join(__dirname, 'organica', id + '.svg');
    // logo Cokafe je na webu bílé na fotce; na světlé mapě ho přebarvíme
    const raw = fs.readFileSync(svg, 'utf8');
    const src = id === 'cokafe' ? raw.replace(/fill="#fff(fff)?"/gi, 'fill="#2b2b2b"') : raw;
    const buf = await sharp(Buffer.from(src), { density: 600 })
      .trim()
      .resize(PX, PX, { fit: 'inside' })
      .webp({ quality: 88, alphaQuality: 100 })
      .toBuffer({ resolveWithObject: true });
    fs.writeFileSync(path.join(ROOT, 'logos', id + '.webp'), buf.data);
    dims[id] = [buf.info.width, buf.info.height];
    console.log(`logos/${id}.webp ${buf.info.width}×${buf.info.height} (${(buf.data.length / 1024).toFixed(1)} kB)`);
  }

  const file = path.join(ROOT, 'logos.js');
  let js = fs.readFileSync(file, 'utf8');
  js = js.replace(/const LOGOS = (\{.*?\});/, (_, json) => `const LOGOS = ${JSON.stringify({ ...JSON.parse(json), ...dims })};`);
  js = js.replace(/const LOGO_EXT = .*\n/, '')
         .replace(/const logoUrl = .*\n/, "const logoUrl = id => (id in LOGOS) ? LOGO_DIR + id + '.webp' : null;\n");
  fs.writeFileSync(file, js, 'utf8');
  console.log('logos.js aktualizován');
})();
