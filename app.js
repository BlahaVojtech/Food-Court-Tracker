/* ============================================================
   Food Court Tracker — Forum Nová Karolina Ostrava
   Půdorys z oficiální mapy centra (viz plan.js).
   Vanilla JS + SVG, ukládání pouze v localStorage.
   ============================================================ */
(() => {
'use strict';

const LS_KEY = 'fnk-foodcourt-v1';
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const SVGNS = 'http://www.w3.org/2000/svg';

/* ---------- STAV ---------- */
let state = load();
let ui = { floor: 'p2', filter: 'all', cats: new Set(), q: '', sel: null };

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    return (raw && typeof raw === 'object' && raw.venues) ? raw : { venues: {} };
  } catch { return { venues: {} }; }
}
function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); }
  catch { toast('Nepodařilo se uložit ⚠️', true); }
}
const rec = id => state.venues[id] || (state.venues[id] = { visited: false, rating: 0, note: '', date: null });
const isVisited = id => !!(state.venues[id] && state.venues[id].visited);

/* ---------- KATEGORIE ---------- */
const CATS = {
  fastfood:  { label: 'Fast food',  icon: '🍔', color: '#f97316' },
  restaurant:{ label: 'Restaurace', icon: '🍽️', color: '#ef4444' },
  asian:     { label: 'Asijská',    icon: '🍜', color: '#e11d48' },
  pizza:     { label: 'Pizza',      icon: '🍕', color: '#eab308' },
  cafe:      { label: 'Kavárna',    icon: '☕', color: '#b45309' },
  bakery:    { label: 'Pekárna',    icon: '🥐', color: '#d97706' },
  sweet:     { label: 'Sladké',     icon: '🍦', color: '#ec4899' },
  drinks:    { label: 'Nápoje',     icon: '🧋', color: '#8b5cf6' },
  healthy:   { label: 'Zdravé',     icon: '🥗', color: '#22c55e' },
};
const cat = c => CATS[c] || { label: c, icon: '📍', color: '#64748b' };

/* barvy neevidovaných jednotek půdorysu */
const KIND_FILL = { shop: '#232f52', service: '#1b2440', vert: '#2f3d68', area: '#1e2a49' };

/* stav podniku: červená = nenavštíveno, zelená = navštíveno */
const NOPE = '#ef4444', YES = '#10b981';

const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));

/* podniky v okolí centra (extra.js) — vlastní „patro", které je vidět vždy */
const OUT_ID = 'out';
if (typeof EXTRA !== 'undefined') {
  FLOORS.push(EXTRA.floor);
  VENUES.push(...EXTRA.venues);
}
const isOutside = f => !!(f && f.outside);

/* vyhledávací mapy — rychlejší než opakované .find() v cyklech */
const VEN_BY_ID = new Map(VENUES.map(v => [v.id, v]));
const FLOOR_BY_ID = new Map(FLOORS.map(f => [f.id, f]));
const venue = id => VEN_BY_ID.get(id) || null;
const floorOf = id => FLOOR_BY_ID.get(id);

/* geometrie sledovaných podniků: id → jednotka v půdorysu */
const GEO = {};
FLOORS.forEach(f => f.units.forEach(u => { if (u.v) GEO[u.v] = u; }));
VENUES.forEach(v => { v.geo = GEO[v.id]; });

function toast(msg, bad) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl font-semibold text-sm shadow-2xl animate-slideup ' +
    (bad ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-slate-900');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), 2200);
}

/* ============================================================
   PAN / ZOOM
   ============================================================ */
/* rámec mapy (sever nahoře) — 1 jednotka = 0,25 m */
const FR = typeof SURROUND !== 'undefined' ? SURROUND.frame : { size: 1640, scale: 4 };
const ctxBox = () => ({ x: 0, y: 0, w: FR.size, h: FR.size });

const view = { x: 0, y: 0, k: 1, min: 0.2, max: 12 };
const svg = $('#map'), vp = $('#viewport'), wrap = $('#mapWrap');

let lodRaf = 0, lastScaleK = -1;
function applyView() {
  vp.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`);
  if (view.k !== lastScaleK) {
    lastScaleK = view.k;
    $('#zoomLabel').textContent = Math.round(view.k * 100) + ' %';
    updateScale();
    if (!lodRaf) lodRaf = requestAnimationFrame(() => { lodRaf = 0; updateLOD(); });
  }
}

/* grafické měřítko — 1 světová jednotka = 0,25 m */
const NICE = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];
function updateScale() {
  const bar = $('#scaleBar'); if (!bar) return;
  const pxPerM = view.k * (FR.scale || 4);
  const target = 90;
  const m = NICE.find(v => v * pxPerM >= 45) || NICE[NICE.length - 1];
  bar.style.width = Math.round(Math.min(target * 1.6, m * pxPerM)) + 'px';
  $('#scaleLabel').textContent = m >= 1000 ? (m / 1000) + ' km' : m + ' m';
}

function zoomAt(cx, cy, factor) {
  const k2 = Math.min(view.max, Math.max(view.min, view.k * factor));
  if (k2 === view.k) return;
  view.x = cx - (cx - view.x) * (k2 / view.k);
  view.y = cy - (cy - view.y) * (k2 / view.k);
  view.k = k2;
  applyView();
}
function fit(animate = true) {
  const f = floorOf(ui.floor), r = wrap.getBoundingClientRect();
  const b = fitBox(f);
  const pad = r.width < 640 ? 10 : 20;
  let k = Math.min((r.width - pad * 2) / b.w, (r.height - pad * 2) / b.h);
  k = Math.min(view.max, Math.max(view.min, k));
  animateTo((r.width - b.w * k) / 2 - b.x * k, (r.height - b.h * k) / 2 - b.y * k, k, animate);
}
function focusOn(v, mult = 3.2) {
  const g = v.geo; if (!g) return;
  const r = wrap.getBoundingClientRect();
  const k = Math.min(view.max, Math.max(view.k, Math.min(
    (r.width * 0.45) / Math.max(g.w, 1), (r.height * 0.45) / Math.max(g.h, 1), mult)));
  animateTo(r.width / 2 - (g.x + g.w / 2) * k, r.height / 2 - (g.y + g.h / 2) * k, k, true);
}
function ensureVisible(v, pad = 60) {
  const g = v.geo; if (!g) return;
  const r = wrap.getBoundingClientRect();
  const x1 = view.x + g.x * view.k, y1 = view.y + g.y * view.k;
  const x2 = x1 + g.w * view.k, y2 = y1 + g.h * view.k;
  let dx = 0, dy = 0;
  if (x1 < pad) dx = pad - x1; else if (x2 > r.width - pad) dx = (r.width - pad) - x2;
  if (y1 < pad) dy = pad - y1; else if (y2 > r.height - pad) dy = (r.height - pad) - y2;
  if (dx || dy) animateTo(view.x + dx, view.y + dy, view.k, true);
}
function animateTo(x, y, k, animate) {
  if (!animate) { view.x = x; view.y = y; view.k = k; return applyView(); }
  const s = { ...view }, t0 = performance.now(), D = 420;
  cancelAnimationFrame(animateTo._r);
  const ease = p => p < .5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
  (function step(now) {
    const p = Math.min(1, (now - t0) / D), e = ease(p);
    view.x = s.x + (x - s.x) * e; view.y = s.y + (y - s.y) * e; view.k = s.k + (k - s.k) * e;
    applyView();
    if (p < 1) animateTo._r = requestAnimationFrame(step);
  })(t0);
}

/* --- ukazatel (myš + dotyk) --- */
let drag = null, moved = 0;
wrap.addEventListener('pointerdown', e => {
  if (e.button !== 0 && e.pointerType === 'mouse') return;
  drag = { px: e.clientX, py: e.clientY, ox: view.x, oy: view.y, id: e.pointerId };
  moved = 0;
  wrap.setPointerCapture(e.pointerId);
});
wrap.addEventListener('pointermove', e => {
  if (!drag || drag.id !== e.pointerId) return;
  const dx = e.clientX - drag.px, dy = e.clientY - drag.py;
  moved = Math.max(moved, Math.abs(dx) + Math.abs(dy));
  view.x = drag.ox + dx; view.y = drag.oy + dy;
  applyView();
});
const endDrag = e => { if (drag && drag.id === e.pointerId) drag = null; };
wrap.addEventListener('pointerup', endDrag);
wrap.addEventListener('pointercancel', endDrag);

/* Výběr řešíme na pointerup, ne na click: po setPointerCapture Chrome
   přesměruje click na #mapWrap, takže by se k podniku nikdy nedostal. */
wrap.addEventListener('pointerup', e => {
  if (moved > 6) return;
  const t = document.elementFromPoint(e.clientX, e.clientY);
  if (!t || !t.closest('#map')) return;   // ovládací prvky nad mapou výběr neruší
  const info = hitInfo(t);
  if (info && info.v) select(info.v.id, 'keep');   // stejný detail jako klik v seznamu, bez přiblížení
  else select(null);
});

wrap.addEventListener('wheel', e => {
  e.preventDefault();
  const r = wrap.getBoundingClientRect();
  zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016)));
}, { passive: false });

wrap.addEventListener('dblclick', e => {
  const info = hitInfo(document.elementFromPoint(e.clientX, e.clientY));
  if (info && info.v) { toggle(info.v.id); return; }   // dvojklik = odškrtnutí
  const r = wrap.getBoundingClientRect();
  zoomAt(e.clientX - r.left, e.clientY - r.top, 1.8);
});

let pinch = null;
wrap.addEventListener('touchstart', e => {
  if (e.touches.length === 2) {
    drag = null;
    const [a, b] = e.touches;
    pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), k: view.k,
              cx: (a.clientX + b.clientX) / 2, cy: (a.clientY + b.clientY) / 2, x: view.x, y: view.y };
  }
}, { passive: true });
wrap.addEventListener('touchmove', e => {
  if (e.touches.length === 2 && pinch) {
    e.preventDefault();
    const [a, b] = e.touches;
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const r = wrap.getBoundingClientRect();
    const k2 = Math.min(view.max, Math.max(view.min, pinch.k * (d / pinch.d)));
    const cx = pinch.cx - r.left, cy = pinch.cy - r.top;
    view.x = cx - (cx - pinch.x) * (k2 / pinch.k);
    view.y = cy - (cy - pinch.y) * (k2 / pinch.k);
    view.k = k2;
    applyView();
  }
}, { passive: false });
wrap.addEventListener('touchend', e => { if (e.touches.length < 2) pinch = null; }, { passive: true });

$('#zIn').onclick  = () => { const r = wrap.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1.4); };
$('#zOut').onclick = () => { const r = wrap.getBoundingClientRect(); zoomAt(r.width / 2, r.height / 2, 1 / 1.4); };
$('#zFit').onclick = () => fit();

addEventListener('keydown', e => {
  if (/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) { if (e.key === 'Escape') e.target.blur(); return; }
  const step = 70;
  if (e.key === '+' || e.key === '=') $('#zIn').click();
  else if (e.key === '-') $('#zOut').click();
  else if (e.key === '0') fit();
  else if (e.key === 'ArrowLeft')  { view.x += step; applyView(); }
  else if (e.key === 'ArrowRight') { view.x -= step; applyView(); }
  else if (e.key === 'ArrowUp')    { view.y += step; applyView(); }
  else if (e.key === 'ArrowDown')  { view.y -= step; applyView(); }
  else if (e.key === 'Escape')     { closeModal(); select(null); }
  else if (e.key === '/') { e.preventDefault(); $('#search').focus(); }
});

let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => fit(false), 150); });

/* ============================================================
   VYKRESLENÍ PŮDORYSU
   ============================================================ */
function el(name, attrs = {}, parent) {
  const n = document.createElementNS(SVGNS, name);
  for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

/* uzly aktuálně zobrazeného patra */
let labelNodes = [], markNodes = [], trackedNodes = [], ctxLabels = [];
/* jednotka → { u, v } pro delegované události */
const UNIT_INFO = new WeakMap();

/* ============================================================
   OKOLÍ — skutečná geometrie z OpenStreetMap (surround.js)
   ============================================================ */

/* výchozí výřez — patro plus kus okolí */
function fitBox(f) {
  const m = Math.max(f.bw, f.bh) * 0.11;
  return { x: f.bx - m, y: f.by - m, w: f.bw + 2 * m, h: f.bh + 2 * m };
}

const BLD_FILL = { com: '#1a2038', res: '#171d33', civ: '#1c2240', aux: '#12172a', gen: '#171d33' };

function drawContext(parent) {
  if (typeof SURROUND === 'undefined') return;
  const g = el('g', { class: 'ctx' }, parent);
  const S = SURROUND;

  // zeleň
  const gg = el('g', { fill: '#13291b', stroke: '#1b3d27', 'stroke-width': 2 }, g);
  S.green.forEach(o => el('path', { d: o.d }, gg));

  // vodní plochy
  const gw = el('g', { fill: '#10273f', stroke: '#1b3d61', 'stroke-width': 2 }, g);
  S.water.forEach(o => el('path', { d: o.d }, gw));

  // parkoviště
  const gp = el('g', { fill: '#151c32', stroke: '#222b4c', 'stroke-width': 2 }, g);
  S.parking.forEach(o => el('path', { d: o.d }, gp));

  // silnice — nejdřív tmavé obruby, pak výplň
  const cas = el('g', { fill: 'none', stroke: '#0e1428', 'stroke-linecap': 'round',
                        'stroke-linejoin': 'round' }, g);
  S.roads.filter(r => !r.f).forEach(r =>
    el('path', { d: r.d, 'stroke-width': r.w + 5 }, cas));
  const rd = el('g', { fill: 'none', stroke: '#222b4e', 'stroke-linecap': 'round',
                       'stroke-linejoin': 'round' }, g);
  S.roads.filter(r => !r.f).forEach(r => el('path', { d: r.d, 'stroke-width': r.w }, rd));
  // chodníky a pěší zóny
  const fw = el('g', { fill: 'none', stroke: '#1b2440', 'stroke-width': 4,
                       'stroke-dasharray': '10 7', 'stroke-linecap': 'round' }, g);
  S.roads.filter(r => r.f).forEach(r => el('path', { d: r.d }, fw));

  // koleje — podklad, pražce, kolejnice
  const rlBase = el('g', { fill: 'none', stroke: '#101830', 'stroke-width': 16,
                           'stroke-linecap': 'round' }, g);
  const rlTie = el('g', { fill: 'none', stroke: '#333f6b', 'stroke-width': 13,
                          'stroke-dasharray': '3 9' }, g);
  const rlTop = el('g', { fill: 'none', stroke: '#5b6c98', 'stroke-width': 2.2 }, g);
  S.rails.forEach(r => {
    el('path', { d: r.d }, rlBase);
    el('path', { d: r.d }, rlTie);
    el('path', { d: r.d, 'stroke-dasharray': r.t === 'tram' ? '14 10' : null }, rlTop);
  });

  // budovy
  const gb = el('g', { stroke: '#2c3555', 'stroke-width': 2, 'stroke-linejoin': 'round' }, g);
  S.buildings.forEach(b => el('path', { d: b.d, fill: BLD_FILL[b.k] || BLD_FILL.gen }, gb));

  // popisky ulic
  S.streets.forEach(s => {
    const t = el('text', { class: 'ctx-lab', x: s.x, y: s.y, 'text-anchor': 'middle',
                           transform: `rotate(${s.r} ${s.x} ${s.y})` }, g);
    t.textContent = s.n;
    ctxLabels.push({ node: t, minK: 0.55 });
  });

  // popisky významných budov
  S.buildings.forEach(b => {
    if (!b.n || b.a < 2600) return;
    const t = el('text', { class: 'ctx-lab big', x: b.lx, y: b.ly, 'text-anchor': 'middle' }, g);
    t.textContent = b.n.length > 28 ? b.n.slice(0, 27) + '…' : b.n;
    ctxLabels.push({ node: t, minK: Math.min(2.4, Math.max(0.5, (b.n.length * 6.5) / Math.max(b.w, 30))) });
  });
}

/* statická vrstva (mřížka + okolí) se kreslí jen jednou za celou relaci */
let staticLayer = null;
function buildStatic() {
  if (staticLayer) return staticLayer;
  const g = el('g', { class: 'layer-static' });
  const cb = ctxBox();
  el('rect', { x: cb.x - 200, y: cb.y - 200, width: cb.w + 400, height: cb.h + 400, fill: 'url(#grid)' }, g);
  drawContext(g);

  // silueta centra podle OpenStreetMap — společná pro všechna patra
  const mall = typeof SURROUND !== 'undefined' && SURROUND.mall;
  if (mall) {
    el('path', { d: mall.d, fill: '#212f5e', stroke: '#4f66ad', 'stroke-width': 3,
                 'stroke-linejoin': 'round' }, g);
  }
  staticLayer = g;
  return g;
}

/* vrstvy pater se staví jen při prvním zobrazení a pak se jen přepínají */
const floorCache = new Map();

function buildFloorLayer(f) {
  const cached = floorCache.get(f.id);
  if (cached) return cached;

  const g = el('g', { class: 'layer-floor' + (isOutside(f) ? ' layer-out' : '') });
  const labels = [], marks = [], tracked = [];

  // podstava patra — jednotky spojené do jednoho tvaru
  const hasMall = typeof SURROUND !== 'undefined' && !!SURROUND.mall;
  if (isOutside(f)) {
    // samostatné budovy v okolí — vlastní podstava, ať vystoupí z pozadí
    const pad = el('g', { fill: '#2b3a6b', stroke: '#5e76c4', 'stroke-width': 9,
                          'stroke-linejoin': 'round' }, g);
    f.units.forEach(u => el('path', { d: u.d }, pad));
  } else {
    if (!hasMall) {
      const edge = el('g', { fill: '#4f66ad', stroke: '#4f66ad', 'stroke-width': 31,
                             'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g);
      f.units.forEach(u => el('path', { d: u.d }, edge));
    }
    const slab = el('g', { fill: '#212f5e', stroke: '#212f5e', 'stroke-width': hasMall ? 14 : 26,
                           'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g);
    f.units.forEach(u => el('path', { d: u.d }, slab));
  }

  // zóna food courtu — jen nadpis
  const fcu = f.units.filter(u => u.fc);
  if (fcu.length) {
    let cx = 0, cy = 0;
    for (const u of fcu) { cx += u.lx; cy += u.ly; }
    const t = el('text', { class: 'fc-title', x: cx / fcu.length, y: cy / fcu.length,
                           'text-anchor': 'middle', fill: 'rgba(255,180,58,.34)', 'letter-spacing': 7 }, g);
    t.textContent = 'FOOD COURT';
  }

  const gUnits = el('g', {}, g);
  f.units.forEach(u => drawUnit(u, gUnits, tracked));
  const gLab = el('g', {}, g);
  f.units.forEach(u => drawLabel(u, gLab, labels, marks));

  const entry = { g, labels, marks, tracked };
  floorCache.set(f.id, entry);
  return entry;
}

function drawFloor() {
  const f = floorOf(ui.floor);
  if (!vp.firstChild) vp.appendChild(buildStatic());

  const entry = buildFloorLayer(f);
  if (!entry.g.parentNode) vp.appendChild(entry.g);

  // podniky v okolí jsou nad centrem vidět pořád, nezávisle na patře
  const outF = floorOf(OUT_ID);
  const out = outF ? buildFloorLayer(outF) : null;
  if (out && !out.g.parentNode) vp.appendChild(out.g);

  for (const [id, e] of floorCache) e.g.style.display = (id === f.id || id === OUT_ID) ? '' : 'none';

  labelNodes = out ? entry.labels.concat(out.labels) : entry.labels;
  markNodes  = out ? entry.marks.concat(out.marks)   : entry.marks;
  trackedNodes = out ? entry.tracked.concat(out.tracked) : entry.tracked;

  refreshMap();
  updateLOD(true);
}

function drawUnit(u, parent, tracked) {
  const v = u.v ? venue(u.v) : null;
  const g = el('g', { class: 'unit' + (v ? ' tracked' : ''), 'data-poi': u.poi, 'data-v': u.v || null }, parent);
  const sh = el('path', { class: 'u-shape', d: u.d,
                          fill: v ? NOPE : (u.fc ? '#31302a' : KIND_FILL[u.k] || KIND_FILL.shop) }, g);
  UNIT_INFO.set(g, { u, v });
  if (v) tracked.push({ node: g, shape: sh, v });
}

/* odznak s logem — výrazně větší než dřívější kolečko a v poměru stran loga */
const BADGE_H = 32;        // výška odznaku ve světových jednotkách (8 m)
const BADGE_AR_MAX = 3.4;  // velmi široká loga se doplní průhlednými okraji

function drawLabel(u, parent, labels, marks) {
  const v = u.v ? venue(u.v) : null;
  if (!u.n && !v) return;

  const g = el('g', { class: 'lab', transform: `translate(${u.lx} ${u.ly})` }, parent);
  // prahová hodnota přiblížení — popisek se objeví, až se vejde do jednotky
  const minK = v
    ? Math.min(3, Math.max(0.5, (v.name.length * 5.6) / Math.max(u.w, 24)))
    : Math.min(3.2, Math.max(0.7, Math.sqrt(9000 / Math.max(u.a, 40))));
  let base = 4;

  if (v) {
    const url = typeof logoUrl === 'function' ? logoUrl(v.id) : null;
    const ar = url ? Math.min(BADGE_AR_MAX, Math.max(1, logoAspect(v.id))) : 1;
    const bh = BADGE_H, bw = Math.round(bh * ar);
    const hw = bw / 2, hh = bh / 2, pad = 3.5;

    const mk = el('g', { class: 'mark' }, g);
    const bg = el('rect', { class: 'm-bg', x: -hw, y: -hh, width: bw, height: bh,
                            rx: Math.min(9, hh), fill: '#fff', stroke: NOPE, 'stroke-width': 3 }, mk);
    if (url) {
      el('image', { class: 'm-logo', href: url, x: -hw + pad, y: -hh + pad,
                    width: bw - 2 * pad, height: bh - 2 * pad,
                    preserveAspectRatio: 'xMidYMid meet', decoding: 'async' }, mk);
    } else {
      const ic = el('text', { class: 'm-ic', y: 5, 'text-anchor': 'middle', 'font-size': 15 }, mk);
      ic.textContent = cat(v.cat).icon;
    }
    const ck = el('g', { class: 'm-ck', display: 'none' }, mk);
    el('circle', { r: 7.4, cx: hw - 1, cy: -hh + 1, fill: YES, stroke: '#fff', 'stroke-width': 1.8 }, ck);
    el('path', { d: `M${hw - 4.4} ${-hh + 0.8} L${hw - 1.9} ${-hh + 3.4} L${hw + 2.6} ${-hh - 2.2}`,
                 fill: 'none', stroke: '#fff', 'stroke-width': 2.2,
                 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, ck);

    // odznak nikdy nemá výrazně přerůst svou jednotku
    const maxS = Math.max(0.55, Math.min(u.w * 0.95 / bw, u.h * 0.95 / bh));
    marks.push({ node: mk, wrap: g, bg, ck, v, maxS, last: -1 });
    UNIT_INFO.set(mk, { u, v });
    base = hh + 13;
  }

  const t = el('text', { class: 'u-label' + (v ? ' is-v' : ''), y: base, 'text-anchor': 'middle',
                         fill: v ? '#f8fafc' : '#9fb0d0' }, g);
  const name = v ? v.name : u.n;
  t.textContent = name.length > 26 ? name.slice(0, 25) + '…' : name;

  labels.push({ node: g, lab: t, minK, base, shown: null, last: -1 });
}

/* velikost popisků a odznaků držíme konstantní vůči obrazovce */
let lastLOD = -1, lastCtxLOD = -1;
function updateLOD(force) {
  const k = view.k;
  if (!force && k === lastLOD) return;

  const s = vp.style;
  s.setProperty('--fs', (10.5 / k).toFixed(2) + 'px');
  s.setProperty('--fs-big', (26 / k).toFixed(2) + 'px');
  s.setProperty('--fs-ctx', (11 / k).toFixed(2) + 'px');
  s.setProperty('--fs-ctx-big', (15 / k).toFixed(2) + 'px');
  s.setProperty('--sw', (1.1 / k).toFixed(3));

  for (const m of markNodes) {
    const sc = +Math.min(1 / k, m.maxS).toFixed(3);
    if (sc !== m.last) { m.node.setAttribute('transform', `scale(${sc})`); m.last = sc; }
  }
  for (const l of labelNodes) {
    const show = k >= l.minK || l.node.classList.contains('force');
    if (show !== l.shown) { l.lab.style.display = show ? '' : 'none'; l.shown = show; }
    if (!show) continue;
    const y = +(l.base / k).toFixed(1);
    if (y !== l.last) { l.lab.setAttribute('y', y); l.last = y; }
  }
  // popisky okolí patří statické vrstvě — stačí je přepočítat při změně zoomu
  if (k !== lastCtxLOD) {
    for (const c of ctxLabels) {
      const show = k >= c.minK;
      if (show !== c.shown) { c.node.style.display = show ? '' : 'none'; c.shown = show; }
    }
    lastCtxLOD = k;
  }
  lastLOD = k;
}

/* ---------- tooltip ---------- */
function showTip(e, u, v) {
  const t = $('#tip');
  if (v) {
    const r = rec(v.id), c = cat(v.cat);
    t.innerHTML = `<b>${esc(v.name)}</b> <span class="text-slate-400">· ${c.icon} ${c.label}</span>` +
      (r.visited ? ` <span class="text-emerald-400">✓</span>` : '') +
      `<br><span class="text-slate-400">${esc(v.desc)}</span>`;
  } else {
    if (!u.n) return;
    t.innerHTML = `<span class="text-slate-300">${esc(u.n)}</span>` +
      (u.k === 'vert' ? ' <span class="text-slate-500">· schody / výtah</span>' :
       u.k === 'service' ? ' <span class="text-slate-500">· služby centra</span>' : '');
  }
  t.classList.remove('hidden');
  moveTip(e);
}
function moveTip(e) {
  const t = $('#tip'), r = wrap.getBoundingClientRect();
  let x = e.clientX - r.left + 14, y = e.clientY - r.top + 14;
  const b = t.getBoundingClientRect();
  if (x + b.width > r.width - 8) x = e.clientX - r.left - b.width - 14;
  if (y + b.height > r.height - 8) y = e.clientY - r.top - b.height - 14;
  t.style.left = x + 'px'; t.style.top = y + 'px';
}
const hideTip = () => $('#tip').classList.add('hidden');

/* klikatelné cíle na mapě: obrys jednotky i odznak s logem */
const HIT = '.unit, .mark';
const hitInfo = t => {
  const n = t && t.closest ? t.closest(HIT) : null;
  return n ? UNIT_INFO.get(n) : null;
};

/* delegované události — jeden posluchač místo stovek */
let hoverUnit = null;
vp.addEventListener('pointerover', e => {
  const g = e.target.closest ? e.target.closest(HIT) : null;
  if (g === hoverUnit) return;
  hoverUnit = g;
  if (!g) return hideTip();
  const info = UNIT_INFO.get(g);
  if (info) showTip(e, info.u, info.v); else hideTip();
});
vp.addEventListener('pointerout', e => {
  const to = e.relatedTarget;
  if (to && to.closest && to.closest(HIT) === hoverUnit) return;
  hoverUnit = null; hideTip();
});
vp.addEventListener('pointermove', e => { if (hoverUnit) moveTip(e); });



/* ============================================================
   FILTRY
   ============================================================ */
function matches(v) {
  if (ui.filter === 'visited' && !isVisited(v.id)) return false;
  if (ui.filter === 'todo' && isVisited(v.id)) return false;
  if (ui.cats.size && !ui.cats.has(v.cat)) return false;
  if (ui.q) {
    const q = ui.q.toLowerCase();
    if (!(v.name + ' ' + v.desc + ' ' + (v.tags || []).join(' ') + ' ' + cat(v.cat).label).toLowerCase().includes(q)) return false;
  }
  return true;
}
const filterActive = () => ui.filter !== 'all' || ui.cats.size > 0 || !!ui.q;

function refreshMap() {
  const active = filterActive();
  for (const t of trackedNodes) {
    const vis = isVisited(t.v.id), ok = !active || matches(t.v);
    const cl = t.node.classList;
    cl.toggle('visited', vis);
    cl.toggle('sel', ui.sel === t.v.id);
    cl.toggle('dim', active && !ok);
    const fill = vis ? YES : NOPE;
    if (t.fill !== fill) { t.shape.setAttribute('fill', fill); t.fill = fill; }
  }
  for (const m of markNodes) {
    const vis = isVisited(m.v.id), ok = !active || matches(m.v);
    if (m.vis !== vis) {
      m.bg.setAttribute('stroke', vis ? YES : NOPE);
      m.ck.setAttribute('display', vis ? '' : 'none');
      m.vis = vis;
    }
    const cl = m.wrap.classList;
    cl.toggle('dim', active && !ok);
    cl.toggle('sel', ui.sel === m.v.id);
    cl.toggle('force', ui.sel === m.v.id || (active && ok));
  }
  updateLOD(true);
}

/* ============================================================
   SEZNAM
   ============================================================ */
function renderChips() {
  const used = [...new Set(VENUES.map(v => v.cat))];
  $('#catChips').innerHTML = used.map(c => {
    const o = cat(c), n = VENUES.filter(v => v.cat === c).length;
    return `<button class="chip ${ui.cats.has(c) ? 'on' : ''}" data-cat="${c}">${o.icon} ${esc(o.label)} <span class="opacity-50">${n}</span></button>`;
  }).join('');
  $$('#catChips .chip').forEach(b => b.onclick = () => {
    const c = b.dataset.cat;
    ui.cats.has(c) ? ui.cats.delete(c) : ui.cats.add(c);
    renderAll();
  });
}

function renderList() {
  const items = VENUES.filter(matches);
  const byFloor = {};
  items.forEach(v => (byFloor[v.floor] ||= []).push(v));

  let html = items.length ? '' : `<div class="text-center text-slate-500 text-sm py-10">Nic nenalezeno 🤷</div>`;

  FLOORS.forEach(f => {
    const arr = byFloor[f.id];
    if (!arr) return;
    const done = arr.filter(v => isVisited(v.id)).length;
    html += `<div class="px-1.5 pt-2 pb-1 flex items-center justify-between sticky top-0 bg-ink-800 z-10">
        <span class="text-[11px] uppercase tracking-wider text-slate-400 font-bold">${esc(f.name)}</span>
        <span class="text-[11px] text-slate-500">${done}/${arr.length}</span></div>`;
    html += arr.map(v => {
      const r = rec(v.id), c = cat(v.cat), on = r.visited;
      return `<div class="row-card group flex items-center gap-2.5 p-2 rounded-xl border cursor-pointer
                  ${ui.sel === v.id ? 'bg-brand-500/15 border-brand-500/60' : on ? 'bg-emerald-500/10 border-emerald-500/25 hover:bg-emerald-500/15' : 'bg-white/[.03] border-white/10 hover:bg-white/[.07]'}"
                  data-go="${v.id}">
          <button data-tog="${v.id}" title="Označit jako navštívené"
            class="shrink-0 w-6 h-6 rounded-lg grid place-items-center border-2 transition
            ${on ? 'bg-emerald-500 border-emerald-500 text-slate-900' : 'border-white/25 text-transparent hover:border-brand-400'}">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="3.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="m5 13 4 4L19 7"/></svg>
          </button>
          <span class="text-base shrink-0">${c.icon}</span>
          <div class="min-w-0 flex-1">
            <div class="text-[13px] font-semibold truncate ${on ? 'text-emerald-300' : ''}">${esc(v.name)}${v.fc ? ' <span class="text-brand-400 text-[10px] align-middle">FC</span>' : ''}</div>
            <div class="text-[11px] text-slate-400 truncate">${esc(v.desc)}</div>
          </div>
          ${r.rating ? `<span class="text-[11px] text-amber-400 shrink-0">${'★'.repeat(r.rating)}</span>` : ''}
        </div>`;
    }).join('');
  });

  $('#list').innerHTML = html;
  $$('#list [data-tog]').forEach(b => b.onclick = e => { e.stopPropagation(); toggle(b.dataset.tog); });
  $$('#list [data-go]').forEach(d => d.onclick = () => {
    const v = venue(d.dataset.go);
    // podniky v okolí jsou viditelné nad každým patrem, patro se tedy nepřepíná
    if (v.floor !== ui.floor && v.floor !== OUT_ID) { ui.floor = v.floor; drawFloor(); renderFloors(); }
    select(v.id, true);
  });
}

function renderProgress() {
  const tot = VENUES.length, done = VENUES.filter(v => isVisited(v.id)).length;
  const pct = tot ? Math.round(done / tot * 100) : 0;
  $('#progCount').textContent = done;
  $('#progTotal').textContent = tot;
  $('#progBar').style.width = pct + '%';
  $('#progPct').textContent = pct + ' %';
}

function renderFloors() {
  $('#floorBar').innerHTML = FLOORS.filter(f => !isOutside(f)).map(f => {
    const arr = VENUES.filter(v => v.floor === f.id);
    const done = arr.filter(v => isVisited(v.id)).length;
    return `<button data-f="${f.id}" class="px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap shrink-0
      ${ui.floor === f.id ? 'bg-gradient-to-r from-brand-400 to-brand-600 text-slate-900' : 'text-slate-300 hover:bg-white/10'}">
      ${esc(f.short)}${arr.length ? ` <span class="opacity-60 font-normal">${done}/${arr.length}</span>` : ''}</button>`;
  }).join('');
  $$('#floorBar [data-f]').forEach(b => b.onclick = () => {
    if (ui.floor === b.dataset.f) return;
    ui.floor = b.dataset.f; ui.sel = null;
    drawFloor(); renderFloors(); renderDetail(); fit();
  });
}

/* ============================================================
   DETAIL
   ============================================================ */
/* focus === true → přiblížit (seznam), 'keep' → jen otevřít detail bez zoomu (mapa) */
function select(id, focus) {
  ui.sel = (ui.sel === id && !focus) ? null : id;
  refreshMap(); renderList(); renderDetail();
  if (!ui.sel) return;
  const v = venue(ui.sel);
  if (!v) return;
  if (focus === true) focusOn(v);
  else requestAnimationFrame(() => ensureVisible(v));
}

function renderDetail() {
  const p = $('#detail');
  if (!ui.sel) { p.classList.add('hidden'); p.classList.remove('flex'); return; }
  const v = venue(ui.sel);
  const r = rec(v.id), c = cat(v.cat), f = floorOf(v.floor);

  p.classList.remove('hidden');
  p.classList.add('flex');
  if (innerWidth < 1024) closeSidebar();

  p.innerHTML = `
    <div class="p-4 border-b border-white/10 flex items-start gap-3">
      <div class="w-11 h-11 rounded-xl grid place-items-center text-xl shrink-0" style="background:${c.color}33;border:1px solid ${c.color}66">${c.icon}</div>
      <div class="min-w-0 flex-1">
        <h2 class="font-extrabold text-[17px] leading-tight break-words">${esc(v.name)}</h2>
        <p class="text-xs text-slate-400 mt-0.5">${esc(c.label)} · ${esc(f.name)}${v.fc ? ' · <span class="text-brand-400 font-semibold">food court</span>' : ''}</p>
      </div>
      <button id="dClose" class="p-1.5 rounded-lg hover:bg-white/10 shrink-0">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto p-4 space-y-4 scroll-thin">
      <p class="text-sm text-slate-300 leading-relaxed">${esc(v.desc)}</p>
      ${v.tags?.length ? `<div class="flex flex-wrap gap-1.5">${v.tags.map(t => `<span class="chip cursor-default">${esc(t)}</span>`).join('')}</div>` : ''}

      <button id="dTog" class="w-full py-3 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2
        ${r.visited ? 'bg-emerald-500 text-slate-900 hover:bg-emerald-400' : 'bg-white/10 hover:bg-white/20 border border-white/15'}">
        ${r.visited ? '✓ Navštíveno' : 'Označit jako navštívené'}
      </button>

      <div class="${r.visited ? '' : 'opacity-40 pointer-events-none'} space-y-4">
        <div>
          <label class="text-xs text-slate-400 font-semibold">Hodnocení</label>
          <div id="stars" class="flex gap-1 mt-1.5 text-2xl leading-none">
            ${[1,2,3,4,5].map(i => `<button data-s="${i}" class="transition hover:scale-125 ${i <= r.rating ? 'text-amber-400' : 'text-slate-600 hover:text-amber-300'}">★</button>`).join('')}
            ${r.rating ? `<button data-s="0" class="ml-1.5 text-xs text-slate-500 hover:text-rose-400 self-center">zrušit</button>` : ''}
          </div>
        </div>
        <div>
          <label class="text-xs text-slate-400 font-semibold">Datum návštěvy</label>
          <input id="dDate" type="date" value="${r.date || ''}"
            class="mt-1.5 w-full bg-ink-900 border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/60">
        </div>
        <div>
          <label class="text-xs text-slate-400 font-semibold">Poznámka</label>
          <textarea id="dNote" rows="4" placeholder="Co jsem si dal, jaké to bylo…"
            class="mt-1.5 w-full bg-ink-900 border border-white/10 rounded-xl px-3 py-2 text-sm resize-none placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-brand-500/60">${esc(r.note)}</textarea>
        </div>
      </div>
      <p class="text-[11px] text-slate-500 pt-1">Jednotka <code class="text-slate-400">${esc(v.poi)}</code> podle oficiální navigace centra.</p>
    </div>

    <div class="p-3 border-t border-white/10">
      <button id="dFocus" class="w-full py-2 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 transition">🔍 Přiblížit na mapě</button>
    </div>`;

  $('#dClose').onclick = () => select(null);
  $('#dTog').onclick = () => toggle(v.id);
  $('#dFocus').onclick = () => focusOn(v, 5);
  $$('#stars [data-s]').forEach(b => b.onclick = () => { rec(v.id).rating = +b.dataset.s; save(); renderDetail(); renderList(); });
  $('#dDate').onchange = e => { rec(v.id).date = e.target.value || null; save(); };
  let nt; $('#dNote').oninput = e => { clearTimeout(nt); nt = setTimeout(() => { rec(v.id).note = e.target.value; save(); }, 350); };
}

function toggle(id) {
  const r = rec(id);
  r.visited = !r.visited;
  if (r.visited && !r.date) r.date = new Date().toISOString().slice(0, 10);
  if (!r.visited) r.rating = 0;
  save();
  const v = venue(id);
  if (r.visited) {
    const done = VENUES.filter(x => isVisited(x.id)).length;
    toast(done === VENUES.length ? '🏆 Všechno hotovo! Gratuluju!' : `✓ ${v.name} — hotovo! (${done}/${VENUES.length})`);
  }
  renderAll();
}

/* ============================================================
   MODÁLY
   ============================================================ */
const closeModal = () => $('#modal').classList.add('hidden');
function openModal(html) {
  $('#modalBox').innerHTML = html;
  const m = $('#modal');
  m.classList.remove('hidden'); m.classList.add('flex');
  m.onclick = e => { if (e.target === m) closeModal(); };
  $$('#modalBox [data-close]').forEach(b => b.onclick = closeModal);
}

$('#btnStats').onclick = () => {
  const done = VENUES.filter(v => isVisited(v.id));
  const rated = done.filter(v => rec(v.id).rating);
  const avg = rated.length ? (rated.reduce((s, v) => s + rec(v.id).rating, 0) / rated.length).toFixed(1) : '–';
  const byCat = {};
  VENUES.forEach(v => { byCat[v.cat] ||= { t: 0, d: 0 }; byCat[v.cat].t++; if (isVisited(v.id)) byCat[v.cat].d++; });
  const fcAll = VENUES.filter(v => v.fc), fcDone = fcAll.filter(v => isVisited(v.id)).length;
  const top = [...rated].sort((a, b) => rec(b.id).rating - rec(a.id).rating).slice(0, 5);

  openModal(`
    <div class="p-5 space-y-4">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-extrabold">📊 Statistiky</h2>
        <button data-close class="p-1.5 rounded-lg hover:bg-white/10">✕</button>
      </div>
      <div class="grid grid-cols-3 gap-2 text-center">
        <div class="bg-white/5 rounded-xl p-3"><div class="text-2xl font-extrabold text-emerald-400">${done.length}</div><div class="text-[11px] text-slate-400">navštíveno</div></div>
        <div class="bg-white/5 rounded-xl p-3"><div class="text-2xl font-extrabold text-slate-300">${VENUES.length - done.length}</div><div class="text-[11px] text-slate-400">zbývá</div></div>
        <div class="bg-white/5 rounded-xl p-3"><div class="text-2xl font-extrabold text-amber-400">${avg}</div><div class="text-[11px] text-slate-400">prům. hodnocení</div></div>
      </div>
      <div class="bg-brand-500/10 border border-brand-500/30 rounded-xl p-3 flex items-center justify-between">
        <span class="text-sm font-semibold text-brand-400">🍔 Samotný food court</span>
        <span class="text-sm tabular-nums"><b>${fcDone}</b><span class="text-slate-400">/${fcAll.length}</span></span>
      </div>
      <div>
        <h3 class="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">Podle kategorie</h3>
        <div class="space-y-1.5">
          ${Object.entries(byCat).sort((a, b) => b[1].t - a[1].t).map(([c, o]) => {
            const k = cat(c), p = Math.round(o.d / o.t * 100);
            return `<div class="flex items-center gap-2 text-xs">
              <span class="w-32 shrink-0 truncate">${k.icon} ${esc(k.label)}</span>
              <div class="flex-1 h-2 rounded-full bg-white/10 overflow-hidden"><div class="h-full rounded-full" style="width:${p}%;background:${k.color}"></div></div>
              <span class="w-11 text-right tabular-nums text-slate-400">${o.d}/${o.t}</span></div>`;
          }).join('')}
        </div>
      </div>
      ${top.length ? `<div>
        <h3 class="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">Nejlépe hodnocené</h3>
        <div class="space-y-1">${top.map(v => `<div class="flex justify-between text-xs bg-white/5 rounded-lg px-2.5 py-1.5">
          <span>${cat(v.cat).icon} ${esc(v.name)}</span><span class="text-amber-400">${'★'.repeat(rec(v.id).rating)}</span></div>`).join('')}</div>
      </div>` : ''}
    </div>`);
};

$('#btnMenu').onclick = () => openModal(`
  <div class="p-5 space-y-3">
    <div class="flex items-center justify-between">
      <h2 class="text-lg font-extrabold">Nastavení a data</h2>
      <button data-close class="p-1.5 rounded-lg hover:bg-white/10">✕</button>
    </div>
    <p class="text-xs text-slate-400">Veškerý postup je uložen <b>pouze ve tvém prohlížeči</b> (localStorage). Nic se nikam neodesílá. Zálohu si udělej exportem.</p>
    <div class="grid grid-cols-2 gap-2">
      <button id="mExport" class="py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold border border-white/10">⬇️ Export JSON</button>
      <button id="mImport" class="py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-semibold border border-white/10">⬆️ Import JSON</button>
    </div>
    <button id="mAll" class="w-full py-2.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-sm font-semibold border border-emerald-500/30">✓ Označit vše jako navštívené</button>
    <button id="mClear" class="w-full py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-sm font-semibold border border-rose-500/30">🗑️ Vymazat veškerý postup</button>
    <div class="pt-2 border-t border-white/10 text-[11px] text-slate-500 space-y-1">
      <p><b class="text-slate-400">Ovládání mapy:</b> kolečko = zoom · tažení = posun · dvojklik na mapu = přiblížit · dvojklik na podnik = odškrtnout</p>
      <p><b class="text-slate-400">Klávesy:</b> + − 0 · šipky · / hledat · Esc zavřít</p>
      <p class="pt-1">Půdorys, obrysy jednotek i patra pocházejí z <b class="text-slate-400">oficiální interaktivní mapy centra</b> (forumnovakarolina.cz/mapa-centra). Gastro podniky jsou zvýrazněny barevně, zóna food courtu oranžovou plochou.</p>
    </div>
  </div>`);

document.addEventListener('click', e => {
  const t = e.target.closest('#mExport,#mImport,#mAll,#mClear,#btnReset');
  if (!t) return;
  if (t.id === 'mExport') {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `foodcourt-karolina-${new Date().toISOString().slice(0, 10)}.json`;
    a.click(); URL.revokeObjectURL(a.href);
    toast('Exportováno ⬇️');
  }
  if (t.id === 'mImport') {
    const i = document.createElement('input');
    i.type = 'file'; i.accept = 'application/json';
    i.onchange = () => {
      const f = i.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          const d = JSON.parse(rd.result);
          if (!d || typeof d !== 'object' || !d.venues) throw 0;
          state = d; save(); renderAll(); closeModal(); toast('Importováno ✓');
        } catch { toast('Neplatný soubor', true); }
      };
      rd.readAsText(f);
    };
    i.click();
  }
  if (t.id === 'mAll') {
    if (!confirm('Opravdu označit všech ' + VENUES.length + ' podniků jako navštívené?')) return;
    VENUES.forEach(v => { const r = rec(v.id); r.visited = true; r.date ||= new Date().toISOString().slice(0, 10); });
    save(); renderAll(); closeModal();
  }
  if (t.id === 'mClear' || t.id === 'btnReset') {
    if (!confirm('Opravdu vymazat celý postup? Tuto akci nelze vrátit.')) return;
    state = { venues: {} }; save(); ui.sel = null; renderAll(); closeModal(); toast('Vymazáno');
  }
});

/* ============================================================
   FILTRY UI + SIDEBAR
   ============================================================ */
$$('.flt').forEach(b => b.onclick = () => { ui.filter = b.dataset.filter; renderAll(); });
let st; $('#search').oninput = e => { clearTimeout(st); st = setTimeout(() => { ui.q = e.target.value.trim(); renderAll(); }, 160); };

const openSidebar  = () => { $('#sidebar').classList.remove('-translate-x-full'); $('#scrim').classList.remove('hidden'); };
const closeSidebar = () => { $('#sidebar').classList.add('-translate-x-full'); $('#scrim').classList.add('hidden'); };
$('#btnSidebar').onclick = () => $('#sidebar').classList.contains('-translate-x-full') ? openSidebar() : closeSidebar();
$('#scrim').onclick = closeSidebar;

/* ============================================================
   START
   ============================================================ */
function renderAll() {
  $$('.flt').forEach(b => b.classList.toggle('on', b.dataset.filter === ui.filter));
  renderChips(); renderList(); renderProgress(); renderFloors(); refreshMap(); renderDetail();
}

renderFloors();
drawFloor();
renderAll();
fit(false);
console.log(`🍽️ Food Court Tracker · ${VENUES.length} podniků · ${FLOORS.length} pater · ${FLOORS.reduce((s, f) => s + f.units.length, 0)} jednotek půdorysu`);
})();

