/* ============================================================
   tools/organica.js — půdorys přízemí budovy Organica (Ostrava)
   Geometrie pochází z oficiálního plánu na organicaostrava.cz/retail
   (tools/organica/plan.json, viz extract-organica.js) a je usazena
   do georeferencovaného rámce mapy na místo stopy budovy z OSM.
   ============================================================ */
const plan = require('./organica/plan.json');

/* Plán v souřadnicích původního SVG → rámec mapy (1 jednotka = 0,25 m). */
const SRC = { cx: 547.5, cy: 471.5, size: 785 };            // obrys plánu
const DST = { cx: 796.9, cy: 1267.5, size: 362 };           // stopa budovy z OSM
const K = DST.size / SRC.size;

const px = x => +(DST.cx + (x - SRC.cx) * K).toFixed(1);
const py = y => +(DST.cy + (y - SRC.cy) * K).toFixed(1);

/* Plán používá jen absolutní příkazy M, L, H, V, C, Z. */
function transformPath(d) {
  const tok = d.match(/[MLHVCZ]|-?\d*\.?\d+(?:e-?\d+)?/g);
  let i = 0, cmd = '', cx = 0, cy = 0;
  const out = [], pts = [];
  const num = () => parseFloat(tok[i++]);
  while (i < tok.length) {
    if (/[A-Z]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'Z') { out.push('Z'); continue; }
    if (cmd === 'M' || cmd === 'L') {
      cx = num(); cy = num();
      out.push((cmd === 'M' ? 'M' : 'L') + px(cx) + ' ' + py(cy)); pts.push([px(cx), py(cy)]);
      if (cmd === 'M') cmd = 'L';
    } else if (cmd === 'H') {
      cx = num(); out.push('L' + px(cx) + ' ' + py(cy)); pts.push([px(cx), py(cy)]);
    } else if (cmd === 'V') {
      cy = num(); out.push('L' + px(cx) + ' ' + py(cy)); pts.push([px(cx), py(cy)]);
    } else if (cmd === 'C') {
      const a = [num(), num(), num(), num(), num(), num()];
      out.push('C' + [px(a[0]), py(a[1]), px(a[2]), py(a[3]), px(a[4]), py(a[5])].join(' '));
      cx = a[4]; cy = a[5]; pts.push([px(cx), py(cy)]);
    } else throw new Error('Nepodporovaný příkaz ' + cmd);
  }
  return { d: out.join(''), pts };
}

const bbox = pts => {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x: Math.round(x), y: Math.round(y), w: Math.round(Math.max(...xs) - x), h: Math.round(Math.max(...ys) - y) };
};

/* Popisky: pozice v souřadnicích původního SVG (z vykresleného plánu). */
const ZONES = {
  fitness: { n: 'Individual.fitness', at: [277, 154] },
  fashion: { n: 'Fashion',            at: [844, 168] },
  cokafe:  { n: 'Cokafe',             at: [782, 387] },
  kanteen: { n: 'Kanteen',            at: [260, 788] },
  rent:    { n: 'Pronájem',           at: [859, 766] },
};
const NOTES = [
  { n: 'Kanceláře', at: [317, 575] },
  { n: 'Recepce',   at: [704, 618] },
  { n: 'Vstup',     at: [783, 472] },
];

function build() {
  const base = transformPath(plan.base);
  const outline = transformPath(plan.outline);
  const zones = Object.entries(plan.zones).map(([id, d]) => {
    const t = transformPath(d), z = ZONES[id];
    return { id, n: z.n, d: t.d, lx: Math.round(px(z.at[0])), ly: Math.round(py(z.at[1])), box: bbox(t.pts) };
  });
  const notes = NOTES.map(o => ({ n: o.n, lx: Math.round(px(o.at[0])), ly: Math.round(py(o.at[1])) }));
  return {
    base: base.d,
    outline: outline.d,
    zones: zones.map(({ box, ...z }) => z),
    notes,
    zoneBox: Object.fromEntries(zones.map(z => [z.id, z.box])),
    center: [DST.cx, DST.cy],
  };
}

module.exports = { build };
