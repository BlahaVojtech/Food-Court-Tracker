/* ============================================================
   Food Court Tracker — Forum Nová Karolina Ostrava
   Mapový engine (SVG pan/zoom), seznam, detail, ukládání.
   ============================================================ */
(() => {
'use strict';

const LS_KEY = 'fnk-foodcourt-v1';
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const SVGNS = 'http://www.w3.org/2000/svg';

function setStorageStatus(shared) {
  const el = $('#storageStatus');
  if (!el) return;
  el.textContent = shared ? 'Synchronizováno se serverem' : 'Uloženo v prohlížeči';
}

/* ---------- STAV & SYNCHRONIZACE ---------- */
let state = load();
let ui = { floor: 'p2', filter: 'all', cats: new Set(), q: '', sel: null };

function load() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    return (raw && typeof raw === 'object' && raw.venues) ? raw : { venues: {} };
  } catch { return { venues: {} }; }
}

function save(venueIdToSync = null) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    toast('Chyba při ukládání', true);
  }

  if (venueIdToSync) {
    syncVenueToServer(venueIdToSync);
  }
}

async function syncVenueToServer(id) {
  const r = state.venues[id];
  if (!r) return;
  try {
    const res = await fetch('api.php', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: id,
        visited: r.visited ? 1 : 0,
        rating: r.rating || 0,
        note: r.note || '',
        date: r.date || null
      })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    console.warn('Lokální režim ukládání:', err);
  }
}

async function syncAllFromServer() {
  try {
    const res = await fetch('api.php', { cache: 'no-store' });
    if (!res.ok) {
      setStorageStatus(false);
      return;
    }
    const data = await res.json();
    if (data && data.venues) {
      state.venues = data.venues;
      localStorage.setItem(LS_KEY, JSON.stringify(state));
      renderAll();
      setStorageStatus(true);
    }
  } catch (err) {
    setStorageStatus(false);
  }
}

const rec = id => state.venues[id] || (state.venues[id] = { visited: false, rating: 0, note: '', date: null });
const isVisited = id => !!(state.venues[id] && state.venues[id].visited);

/* ---------- KATEGORIE ---------- */
const CATS = {
  fastfood:  { label: 'Fast food' },
  restaurant:{ label: 'Restaurace' },
  asian:     { label: 'Asijská' },
  pizza:     { label: 'Pizza' },
  cafe:      { label: 'Kavárna' },
  bakery:    { label: 'Pekárna' },
  sweet:     { label: 'Sladké' },
  drinks:    { label: 'Nápoje' },
  healthy:   { label: 'Zdravé' },
};
const cat = c => CATS[c] || { label: c };

/* Barvy neevidovaných jednotek půdorysu */
const KIND_FILL = { shop: '#e6e1d8', service: '#ece8e1', vert: '#d9d2c6', area: '#eae6df' };
const FC_FILL = '#efe0c6';

/* Stav podniku: červená = zatím ne, zelená = navštíveno */
const NOPE = '#c0453a', YES = '#3b8559';

const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m]));
const logoMarkup = (v, cls = '') => {
  const url = typeof logoUrl === 'function' ? logoUrl(v.id) : null;
  return url
    ? `<img src="${esc(url)}" alt="${esc(v.name)}" class="${cls} venue-logo logo-${esc(v.id)}" loading="lazy">`
    : `<span class="${cls} brand-word">${esc(v.id === 'frankiespub' ? "FRANKIE'S" : v.name.slice(0, 2).toUpperCase())}</span>`;
};

/* Podniky v okolí centra (extra.js) */
const OUT_ID = 'out';
if (typeof EXTRA !== 'undefined') {
  FLOORS.push(EXTRA.floor);
  VENUES.push(...EXTRA.venues);
}
const isOutside = f => !!(f && f.outside);

const VEN_BY_ID = new Map(VENUES.map(v => [v.id, v]));
const FLOOR_BY_ID = new Map(FLOORS.map(f => [f.id, f]));
const venue = id => VEN_BY_ID.get(id) || null;
const floorOf = id => FLOOR_BY_ID.get(id);

const GEO = {};
FLOORS.forEach(f => f.units.forEach(u => { if (u.v) GEO[u.v] = u; }));
VENUES.forEach(v => { v.geo = GEO[v.id]; });

function toast(msg, bad) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 text-sm text-paper ' + (bad ? 'bg-no' : 'bg-ink');
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), 2200);
}

/* ============================================================
   PAN / ZOOM ENGINE
   ============================================================ */
const FR = typeof SURROUND !== 'undefined' ? SURROUND.frame : { size: 1640, scale: 4 };
const ctxBox = () => ({ x: 0, y: 0, w: FR.size, h: FR.size });

const view = { x: 0, y: 0, k: 1, min: 0.2, max: 12 };
const svg = $('#map'), vp = $('#viewport'), wrap = $('#mapWrap');

let lodRaf = 0, lastScaleK = -1;
function applyView() {
  vp.setAttribute('transform', `translate(${view.x} ${view.y}) scale(${view.k})`);
  if (view.k !== lastScaleK) {
    lastScaleK = view.k;
    updateScale();
    if (!lodRaf) lodRaf = requestAnimationFrame(() => { lodRaf = 0; updateLOD(); });
  }
}

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

/* Ukazatel (myš + dotyk) */
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

wrap.addEventListener('pointerup', e => {
  if (moved > 6) return;
  const t = document.elementFromPoint(e.clientX, e.clientY);
  if (!t || !t.closest('#map')) return;
  const info = hitInfo(t);
  if (info && info.v) select(info.v.id, 'keep');
  else select(null);
});

wrap.addEventListener('wheel', e => {
  e.preventDefault();
  const r = wrap.getBoundingClientRect();
  zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016)));
}, { passive: false });

wrap.addEventListener('dblclick', e => {
  const info = hitInfo(document.elementFromPoint(e.clientX, e.clientY));
  if (info && info.v) { toggle(info.v.id); return; }
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
   VYKRESLENÍ PŮDORYSU A OKOLÍ
   ============================================================ */
function el(name, attrs = {}, parent) {
  const n = document.createElementNS(SVGNS, name);
  for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

let labelNodes = [], markNodes = [], trackedNodes = [], ctxLabels = [];
const UNIT_INFO = new WeakMap();

function fitBox(f) {
  const m = Math.max(f.bw, f.bh) * 0.11;
  return { x: f.bx - m, y: f.by - m, w: f.bw + 2 * m, h: f.bh + 2 * m };
}

const BLD_FILL = { com: '#e0dacf', res: '#e6e1d8', civ: '#dcd5c9', aux: '#ebe7df', gen: '#e0dacf' };

function drawOrganica(parent) {
  if (typeof ORGANICA === 'undefined') return;
  const O = ORGANICA;
  const g = el('g', {}, parent);
  el('path', { d: O.base, fill: '#f6f3ee' }, g);
  const zones = el('g', { fill: '#d9c9b9' }, g);
  O.zones.forEach(z => el('path', { d: z.d }, zones));
  el('path', { d: O.outline, fill: 'none', stroke: '#8c7a66', 'stroke-width': 2.4, 'stroke-linejoin': 'round' }, g);

  const lab = (n, x, y, cls) => {
    const t = el('text', { class: 'ctx-lab org ' + cls, x, y, 'text-anchor': 'middle' }, g);
    t.textContent = n;
    return t;
  };
  const title = lab('Organica', O.center[0], O.center[1] + 5, 'big');
  ctxLabels.push({ node: title, minK: 0.5 });
  const tracked = new Set(['kanteen', 'cokafe']);
  O.zones.filter(z => !tracked.has(z.id)).forEach(z => ctxLabels.push({ node: lab(z.n, z.lx, z.ly, ''), minK: 1.3 }));
  O.notes.forEach(o => ctxLabels.push({ node: lab(o.n, o.lx, o.ly, ''), minK: 1.6 }));
}

function drawContext(parent) {
  if (typeof SURROUND === 'undefined') return;
  const g = el('g', { class: 'ctx' }, parent);
  const S = SURROUND;

  const gg = el('g', { fill: '#dde4cf' }, g);
  S.green.forEach(o => el('path', { d: o.d }, gg));

  const gw = el('g', { fill: '#d2dde2' }, g);
  S.water.forEach(o => el('path', { d: o.d }, gw));

  const gp = el('g', { fill: '#e9e5dd', stroke: '#dcd6cb', 'stroke-width': 1.5 }, g);
  S.parking.forEach(o => el('path', { d: o.d }, gp));

  const cas = el('g', { fill: 'none', stroke: '#d6cfc3', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
  S.roads.filter(r => !r.f).forEach(r => el('path', { d: r.d, 'stroke-width': r.w + 4 }, cas));
  const rd = el('g', { fill: 'none', stroke: '#fff', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, g);
  S.roads.filter(r => !r.f).forEach(r => el('path', { d: r.d, 'stroke-width': r.w }, rd));

  const fw = el('g', { fill: 'none', stroke: '#c9c1b3', 'stroke-width': 3, 'stroke-dasharray': '9 7', 'stroke-linecap': 'round' }, g);
  S.roads.filter(r => r.f).forEach(r => el('path', { d: r.d }, fw));

  const rlBase = el('g', { fill: 'none', stroke: '#d6cfc3', 'stroke-width': 14, 'stroke-linecap': 'round' }, g);
  const rlTie = el('g', { fill: 'none', stroke: '#bfb7a9', 'stroke-width': 11, 'stroke-dasharray': '3 9' }, g);
  const rlTop = el('g', { fill: 'none', stroke: '#8f887c', 'stroke-width': 2 }, g);
  S.rails.forEach(r => {
    el('path', { d: r.d }, rlBase);
    el('path', { d: r.d }, rlTie);
    el('path', { d: r.d, 'stroke-dasharray': r.t === 'tram' ? '14 10' : null }, rlTop);
  });

  const gb = el('g', { stroke: '#c9c1b3', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, g);
  S.buildings.forEach(b => {
    if (b.n === 'Organica') return;
    el('path', { d: b.d, fill: BLD_FILL[b.k] || BLD_FILL.gen }, gb);
  });
  drawOrganica(g);

  S.streets.forEach(s => {
    const t = el('text', { class: 'ctx-lab', x: s.x, y: s.y, 'text-anchor': 'middle', transform: `rotate(${s.r} ${s.x} ${s.y})` }, g);
    t.textContent = s.n;
    ctxLabels.push({ node: t, minK: 0.55 });
  });

  S.buildings.forEach(b => {
    if (!b.n || b.a < 2600 || b.n === 'Organica') return;
    const t = el('text', { class: 'ctx-lab big', x: b.lx, y: b.ly, 'text-anchor': 'middle' }, g);
    t.textContent = b.n.length > 28 ? b.n.slice(0, 27) + '…' : b.n;
    ctxLabels.push({ node: t, minK: Math.min(2.4, Math.max(0.5, (b.n.length * 6.5) / Math.max(b.w, 30))) });
  });
}

let staticLayer = null;
function buildStatic() {
  if (staticLayer) return staticLayer;
  const g = el('g', { class: 'layer-static' });
  drawContext(g);

  const mall = typeof SURROUND !== 'undefined' && SURROUND.mall;
  if (mall) {
    el('path', { d: mall.d, fill: '#fbfaf7', stroke: '#a39b8e', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, g);
  }
  staticLayer = g;
  return g;
}

const floorCache = new Map();

function buildFloorLayer(f) {
  const cached = floorCache.get(f.id);
  if (cached) return cached;

  const g = el('g', { class: 'layer-floor' + (isOutside(f) ? ' layer-out' : '') });
  const labels = [], marks = [], tracked = [];

  const hasMall = typeof SURROUND !== 'undefined' && !!SURROUND.mall;
  if (isOutside(f)) {
    const pad = el('g', { fill: '#e6e1d8', stroke: '#a39b8e', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, g);
    f.units.filter(u => !u.org).forEach(u => el('path', { d: u.d }, pad));
  } else {
    if (!hasMall) {
      const edge = el('g', { fill: '#cfc8bc', stroke: '#cfc8bc', 'stroke-width': 31, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g);
      f.units.forEach(u => el('path', { d: u.d }, edge));
    }
    const slab = el('g', { fill: '#fbfaf7', stroke: '#fbfaf7', 'stroke-width': hasMall ? 14 : 26, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, g);
    f.units.forEach(u => el('path', { d: u.d }, slab));
  }

  const fcu = f.units.filter(u => u.fc);
  if (fcu.length) {
    let cx = 0, cy = 0;
    for (const u of fcu) { cx += u.lx; cy += u.ly; }
    const t = el('text', { class: 'fc-title', x: cx / fcu.length, y: cy / fcu.length, 'text-anchor': 'middle', 'letter-spacing': 7 }, g);
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
  const sh = el('path', { class: 'u-shape', d: u.d, fill: v ? NOPE : (u.fc ? FC_FILL : KIND_FILL[u.k] || KIND_FILL.shop) }, g);
  UNIT_INFO.set(g, { u, v });
  if (v) tracked.push({ node: g, shape: sh, v });
}

const MAP_LOGO_SCALE = {
  mcdonalds: .64,
  ugosalaterie: .72,
  coloseum: .72
};

function drawLabel(u, parent, labels, marks) {
  const v = u.v ? venue(u.v) : null;
  if (!u.n && !v) return;

  const g = el('g', { class: 'lab', transform: `translate(${u.lx} ${u.ly})` }, parent);
  const minK = v
    ? Math.min(3, Math.max(0.5, (v.name.length * 5.6) / Math.max(u.w, 24)))
    : Math.min(3.2, Math.max(0.7, Math.sqrt(9000 / Math.max(u.a, 40))));
  let base = 4;

  if (v) {
    const url = typeof logoUrl === 'function' ? logoUrl(v.id) : null;
    const ar = url ? Math.max(.45, Math.min(4.2, logoAspect(v.id))) : 1;
    const rotate = ar > 1.7 && u.h > u.w * 1.15;
    // Calculate the badge in the logo's natural orientation, then rotate it
    // inside portrait-shaped units so it follows the unit's long axis.
    const unitW = rotate ? u.h : u.w;
    const unitH = rotate ? u.w : u.h;
    const logoScale = MAP_LOGO_SCALE[v.id] || 1;
    const maxW = Math.max(4, unitW * .92 * logoScale);
    const maxH = Math.max(4, unitH * .84 * logoScale);
    const bw = Math.min(maxW, maxH * ar);
    const bh = Math.min(maxH, bw / ar);
    const hw = bw / 2, hh = bh / 2, pad = Math.min(3.5, bw * .12, bh * .12);

    const mk = el('g', { class: 'mark' }, g);
    const bg = el('rect', { class: 'm-bg', x: -hw, y: -hh, width: bw, height: bh, rx: Math.min(4, hh), fill: '#fff', stroke: NOPE, 'stroke-width': 3 }, mk);
    if (url) {
      el('image', { class: `m-logo logo-${v.id}`, href: url, x: -hw + pad, y: -hh + pad, width: Math.max(1, bw - 2 * pad), height: Math.max(1, bh - 2 * pad), preserveAspectRatio: 'xMidYMid meet', decoding: 'async' }, mk);
    } else {
      const word = v.id === 'frankiespub' ? "FRANKIE'S" : v.name.slice(0, 2).toUpperCase();
      const ic = el('text', { class: 'm-ic m-word', y: 4, 'text-anchor': 'middle', 'font-size': 8, fill: '#26231f' }, mk);
      ic.textContent = word;
    }
    const ck = el('g', { class: 'm-ck', display: 'none' }, mk);
    el('circle', { r: 7.4, cx: hw - 1, cy: -hh + 1, fill: YES, stroke: '#fff', 'stroke-width': 1.8 }, ck);
    el('path', { d: `M${hw - 4.4} ${-hh + 0.8} L${hw - 1.9} ${-hh + 3.4} L${hw + 2.6} ${-hh - 2.2}`, fill: 'none', stroke: '#fff', 'stroke-width': 2.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, ck);

    const maxS = 1;
    marks.push({ node: mk, wrap: g, bg, ck, v, maxS, rotate, last: -1 });
    UNIT_INFO.set(mk, { u, v });
    base = hh + 13;
  }

  if (!v) {
    const t = el('text', { class: 'u-label', y: base, 'text-anchor': 'middle' }, g);
    const name = u.n;
    t.textContent = name.length > 26 ? name.slice(0, 25) + '…' : name;
    labels.push({ node: g, lab: t, minK, base, shown: null, last: -1 });
  }
}

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
    const sc = +Math.min(1, m.maxS).toFixed(3);
    const transform = `${m.rotate ? 'rotate(90) ' : ''}scale(${sc})`;
    if (transform !== m.last) { m.node.setAttribute('transform', transform); m.last = transform; }
  }
  for (const l of labelNodes) {
    const show = k >= l.minK || l.node.classList.contains('force');
    if (show !== l.shown) { l.lab.style.display = show ? '' : 'none'; l.shown = show; }
    if (!show) continue;
    const y = +(l.base / k).toFixed(1);
    if (y !== l.last) { l.lab.setAttribute('y', y); l.last = y; }
  }
  if (k !== lastCtxLOD) {
    for (const c of ctxLabels) {
      const show = k >= c.minK;
      if (show !== c.shown) { c.node.style.display = show ? '' : 'none'; c.shown = show; }
    }
    lastCtxLOD = k;
  }
  lastLOD = k;
}

/* Tooltip */
function showTip(e, u, v) {
  const t = $('#tip');
  if (v) {
    const r = rec(v.id), c = cat(v.cat);
    t.innerHTML = `<div class="font-medium flex items-center gap-2"><span class="w-2 h-2 shrink-0 ${r.visited ? 'bg-yes' : 'bg-no'}"></span>${esc(v.name)}</div>` +
      `<div class="text-[11px] opacity-70 mt-0.5">${esc(c.label)}${v.desc ? ' · ' + esc(v.desc.length > 90 ? v.desc.slice(0, 89) + '…' : v.desc) : ''}</div>`;
  } else {
    if (!u.n) return;
    t.innerHTML = esc(u.n) +
      (u.k === 'vert' ? ' <span class="opacity-60">· schody / výtah</span>' :
       u.k === 'service' ? ' <span class="opacity-60">· služby</span>' : '');
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

const HIT = '.unit, .mark';
const hitInfo = t => {
  const n = t && t.closest ? t.closest(HIT) : null;
  return n ? UNIT_INFO.get(n) : null;
};

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
   FILTROVÁNÍ & SYNCHRONIZACE MAPY
   ============================================================ */
function matches(v) {
  if (ui.filter === 'visited' && !isVisited(v.id)) return false;
  if (ui.filter === 'todo' && isVisited(v.id)) return false;
  if (ui.cats.size && !ui.cats.has(v.cat)) return false;
  if (ui.q) {
    const q = ui.q.toLowerCase();
    if (!(v.name + ' ' + (v.desc || '') + ' ' + (v.tags || []).join(' ') + ' ' + cat(v.cat).label).toLowerCase().includes(q)) return false;
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
   SEZNAM A DETAILNÍ PANEL (CAD UI)
   ============================================================ */
function renderChips() {
  const used = [...new Set(VENUES.map(v => v.cat))];
  $('#catChips').innerHTML = used.map(c => {
    const o = cat(c), n = VENUES.filter(v => v.cat === c).length;
    return `<button class="chip ${ui.cats.has(c) ? 'on' : ''}" data-cat="${c}">${esc(o.label)} <small>${n}</small></button>`;
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

  let html = items.length ? '' : `<div class="px-4 py-10 text-sm text-ink2">Nic nenalezeno.${filterActive() ? ' Zkuste změnit filtr nebo hledání.' : ''}</div>`;

  FLOORS.forEach(f => {
    const arr = byFloor[f.id];
    if (!arr) return;
    const done = arr.filter(v => isVisited(v.id)).length;
    html += `<div class="list-head"><span>${esc(f.name)}</span><span>${done} / ${arr.length}</span></div>`;

    html += arr.map(v => {
      const r = rec(v.id), on = r.visited;
      return `<div class="row ${ui.sel === v.id ? 'sel' : ''}" data-go="${v.id}">
          <button data-tog="${v.id}" class="check ${on ? 'on' : ''}" aria-pressed="${on}" aria-label="${on ? 'Zrušit označení' : 'Označit jako navštívené'}: ${esc(v.name)}">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="square" d="m5 13 4 4L19 7"/></svg>
          </button>
          <span class="logo-box w-9 h-9 p-1">${logoMarkup(v)}</span>
          <div class="min-w-0 flex-1">
            <div class="row-name truncate">${esc(v.name)}</div>
            <div class="row-sub truncate">${esc(cat(v.cat).label)}${v.fc ? ' · food court' : ''}</div>
          </div>
          ${r.rating ? `<span class="text-xs text-[#c98a1e] shrink-0 tabular-nums">${r.rating} ★</span>` : ''}
        </div>`;
    }).join('');
  });

  $('#list').innerHTML = html;
  $$('#list [data-tog]').forEach(b => b.onclick = e => { e.stopPropagation(); toggle(b.dataset.tog); });
  $$('#list [data-go]').forEach(d => d.onclick = () => {
    const v = venue(d.dataset.go);
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
    return `<button data-f="${f.id}" class="floor-tab ${ui.floor === f.id ? 'active' : ''}">
      ${esc(f.short.replace(/^[^\p{L}\p{N}−-]+/u, ''))}${arr.length ? `<small>${done}/${arr.length}</small>` : ''}</button>`;
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
    <div class="px-5 pt-5 pb-4 border-b border-line flex items-start gap-3">
      <div class="logo-box w-14 h-14 p-2">${logoMarkup(v)}</div>
      <div class="min-w-0 flex-1">
        <h2 class="d-title">${esc(v.name)}</h2>
        <p class="text-xs text-ink2 mt-1">${esc(c.label)} · ${esc(f.name)}</p>
      </div>
      <button id="dClose" class="btn-icon -mt-1 -mr-2 border-transparent" aria-label="Zavřít">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path stroke-linecap="square" d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto px-5 py-4 space-y-5 scroll-thin text-sm">
      ${v.desc ? `<p class="text-ink2 leading-relaxed">${esc(v.desc)}</p>` : ''}
      ${v.open ? `<p class="text-xs text-ink2">${esc(v.open)}${v.web ? ` · <a href="${esc(v.web)}" target="_blank" rel="noopener" class="underline underline-offset-2 hover:text-ink">web</a>` : ''}</p>` : ''}
      ${v.tags?.length ? `<div class="flex flex-wrap gap-1.5">${v.tags.map(t => `<span class="chip static">${esc(t)}</span>`).join('')}</div>` : ''}

      <div class="space-y-2.5">
        <div class="status ${r.visited ? 'is-done' : ''}"><i></i>${r.visited ? 'Navštíveno' : 'Zatím nenavštíveno'}</div>
        <button id="dTog" class="btn-primary ${r.visited ? 'is-done' : ''}">${r.visited ? 'Zrušit návštěvu' : 'Označit jako navštívené'}</button>
      </div>

      <div class="${r.visited ? '' : 'opacity-40 pointer-events-none'} space-y-4 border-t border-line pt-5">
        <div>
          <span class="d-label">Hodnocení</span>
          <div id="stars" class="flex items-center gap-1" role="group" aria-label="Hodnocení od jedné do pěti hvězd">
            ${[1,2,3,4,5].map(i => `<button type="button" data-s="${i}" aria-label="${i} z 5" class="star ${i <= r.rating ? 'on' : ''}">★</button>`).join('')}
            ${r.rating ? `<button type="button" data-s="0" class="ml-2 text-xs text-ink3 hover:text-no underline underline-offset-2">Smazat</button>` : ''}
          </div>
        </div>
        <div>
          <label class="d-label" for="dDate">Datum návštěvy</label>
          <input id="dDate" type="date" value="${r.date || ''}" class="field">
        </div>
        <div>
          <label class="d-label" for="dNote">Poznámka</label>
          <textarea id="dNote" rows="3" placeholder="Co jste si dali, jak chutnalo…" class="field resize-none">${esc(r.note)}</textarea>
        </div>
      </div>
    </div>

    <div class="px-5 py-3 border-t border-line">
      <button id="dFocus" class="btn-ghost">Zaměřit na mapě</button>
    </div>`;

  $('#dClose').onclick = () => select(null);
  $('#dTog').onclick = () => toggle(v.id);
  $('#dFocus').onclick = () => focusOn(v, 5);
  $$('#stars [data-s]').forEach(b => b.onclick = () => { rec(v.id).rating = +b.dataset.s; save(v.id); renderDetail(); renderList(); });
  $('#dDate').onchange = e => { rec(v.id).date = e.target.value || null; save(v.id); };
  let nt;
  $('#dNote').oninput = e => { clearTimeout(nt); nt = setTimeout(() => { rec(v.id).note = e.target.value; save(v.id); }, 300); };
}

function toggle(id) {
  const r = rec(id);
  r.visited = !r.visited;
  if (r.visited && !r.date) r.date = new Date().toISOString().slice(0, 10);
  if (!r.visited) r.rating = 0;
  save(id);
  const v = venue(id);
  if (r.visited) {
    const done = VENUES.filter(x => isVisited(x.id)).length;
    toast(`${v.name} — navštíveno (${done}/${VENUES.length})`);
  }
  renderAll();
}

/* ============================================================
   MODÁLY (DATA & EXPORT)
   ============================================================ */
const closeModal = () => $('#modal').classList.add('hidden');
function openModal(html) {
  $('#modalBox').innerHTML = html;
  const m = $('#modal');   m.classList.remove('hidden'); m.classList.add('flex');   m.onclick = e => { if (e.target === m) closeModal(); };   $$('#modalBox [data-close]').forEach(b => b.onclick = closeModal);
}

const modalHead = title => `
  <div class="flex items-center justify-between px-5 h-14 border-b border-line">
    <h2 class="d-title !text-xl uppercase tracking-wider">${title}</h2>
    <button data-close class="btn-icon border-transparent -mr-2" aria-label="Zavřít">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="1.6" viewBox="0 0 24 24"><path stroke-linecap="square" d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
  </div>`;

$('#btnStats').onclick = () => {
  const done = VENUES.filter(v => isVisited(v.id));
  const rated = done.filter(v => rec(v.id).rating);
  const avg = rated.length ? (rated.reduce((s, v) => s + rec(v.id).rating, 0) / rated.length).toFixed(1) : '–';
  const byCat = {};
  VENUES.forEach(v => { byCat[v.cat] ||= { t: 0, d: 0 }; byCat[v.cat].t++; if (isVisited(v.id)) byCat[v.cat].d++; });
  const fcAll = VENUES.filter(v => v.fc), fcDone = fcAll.filter(v => isVisited(v.id)).length;
  const stat = (n, l) => `<div><div class="font-display text-3xl font-semibold leading-none tabular-nums">${n}</div><div class="text-xs text-ink2 mt-1.5">${l}</div></div>`;

  openModal(`${modalHead('Přehled')}
    <div class="p-5 space-y-6">
      <div class="grid grid-cols-3 gap-4">
        ${stat(done.length, 'Navštíveno')}
        ${stat(VENUES.length - done.length, 'Zbývá')}
        ${stat(avg, 'Průměrné hodnocení')}
      </div>
      <p class="text-sm text-ink2">Food court: <b class="text-ink font-semibold">${fcDone}</b> z ${fcAll.length} podniků</p>
      <div class="space-y-2.5 border-t border-line pt-5">
        ${Object.entries(byCat).sort((a, b) => b[1].t - a[1].t).map(([c, o]) => {
          const p = Math.round(o.d / o.t * 100);
          return `<div class="flex items-center gap-3 text-sm">
            <span class="w-24 shrink-0 truncate text-ink2">${esc(cat(c).label)}</span>
            <div class="flex-1 h-[3px] bg-line"><div class="h-full bg-yes" style="width:${p}%"></div></div>
            <span class="w-9 text-right text-xs text-ink2 tabular-nums">${o.d}/${o.t}</span>
          </div>`;
        }).join('')}
      </div>
    </div>`);
};

$('#btnMenu').onclick = () => openModal(`${modalHead('Data')}
  <div class="p-5 space-y-3">
    <p class="text-sm text-ink2">Záznamy jsou uložené v tomto prohlížeči. Export vytvoří zálohu, kterou můžete načíst jinde.</p>
    <div class="grid grid-cols-2 gap-3">
      <button id="mExport" class="btn-ghost">Exportovat</button>
      <button id="mImport" class="btn-ghost">Importovat</button>
    </div>
    <div class="grid grid-cols-2 gap-3 pt-2 border-t border-line">
      <button id="mAll" class="btn-ghost">Označit vše</button>
      <button id="mClear" class="btn-ghost hover:!border-no hover:!text-no">Smazat vše</button>
    </div>
    <p class="text-xs text-ink3 pt-2">Kolečko = zoom · tažení = posun · klik = detail · dvojklik = změna stavu</p>
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
    toast('Exportováno');
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
          state = d; save(); renderAll(); closeModal(); toast('Importováno');
          Object.keys(state.venues).forEach(id => syncVenueToServer(id));
        } catch { toast('Neplatný soubor', true); }
      };
      rd.readAsText(f);
    };
    i.click();
  }
  if (t.id === 'mAll') {
    if (!confirm('Opravdu označit všech ' + VENUES.length + ' podniků jako navštívené?')) return;
    VENUES.forEach(v => {
      const r = rec(v.id);
      r.visited = true;
      r.date ||= new Date().toISOString().slice(0, 10);
      syncVenueToServer(v.id);
    });
    save(); renderAll(); closeModal();
  }
  if (t.id === 'mClear' || t.id === 'btnReset') {
    if (!confirm('Opravdu vymazat celý postup?')) return;
    const oldKeys = Object.keys(state.venues);
    state = { venues: {} };
    save(); ui.sel = null; renderAll(); closeModal(); toast('Vymazáno');
    oldKeys.forEach(id => syncVenueToServer(id));
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
$('#scrim').onclick = closeSidebar;  /* ============================================================    START    ============================================================ */ function renderAll() {   $$('.flt').forEach(b => b.classList.toggle('on', b.dataset.filter === ui.filter));
  renderChips(); renderList(); renderProgress(); renderFloors(); refreshMap(); renderDetail();
}

renderFloors();
drawFloor();
renderAll();
fit(false);
syncAllFromServer();
window.addEventListener('focus', syncAllFromServer);

})();