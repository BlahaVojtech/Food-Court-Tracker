/* ============================================================
   tools/geo.js — převody souřadnic (bez závislostí)

   VisioGlobe „pixel" souřadnice  →  UTM 34N  →  WGS84 lat/lon
   ============================================================ */

/* ---------- UTM (WGS84) ---------- */
const A = 6378137.0, F = 1 / 298.257223563;
const E2 = F * (2 - F), EP2 = E2 / (1 - E2), K0 = 0.9996;

function utmForward(lat, lon, zone) {
  const φ = lat * Math.PI / 180, λ = lon * Math.PI / 180;
  const λ0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
  const N = A / Math.sqrt(1 - E2 * Math.sin(φ) ** 2);
  const T = Math.tan(φ) ** 2;
  const C = EP2 * Math.cos(φ) ** 2;
  const Adl = Math.cos(φ) * (λ - λ0);
  const M = A * ((1 - E2 / 4 - 3 * E2 ** 2 / 64 - 5 * E2 ** 3 / 256) * φ
    - (3 * E2 / 8 + 3 * E2 ** 2 / 32 + 45 * E2 ** 3 / 1024) * Math.sin(2 * φ)
    + (15 * E2 ** 2 / 256 + 45 * E2 ** 3 / 1024) * Math.sin(4 * φ)
    - (35 * E2 ** 3 / 3072) * Math.sin(6 * φ));
  const x = K0 * N * (Adl + (1 - T + C) * Adl ** 3 / 6
    + (5 - 18 * T + T ** 2 + 72 * C - 58 * EP2) * Adl ** 5 / 120) + 500000;
  const y = K0 * (M + N * Math.tan(φ) * (Adl ** 2 / 2 + (5 - T + 9 * C + 4 * C ** 2) * Adl ** 4 / 24
    + (61 - 58 * T + T ** 2 + 600 * C - 330 * EP2) * Adl ** 6 / 720));
  return { e: x, n: y };
}

function utmInverse(e, n, zone) {
  const x = e - 500000, y = n;
  const λ0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const M = y / K0;
  const μ = M / (A * (1 - E2 / 4 - 3 * E2 ** 2 / 64 - 5 * E2 ** 3 / 256));
  const φ1 = μ + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * μ)
    + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * μ)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * μ);
  const C1 = EP2 * Math.cos(φ1) ** 2, T1 = Math.tan(φ1) ** 2;
  const N1 = A / Math.sqrt(1 - E2 * Math.sin(φ1) ** 2);
  const R1 = A * (1 - E2) / (1 - E2 * Math.sin(φ1) ** 2) ** 1.5;
  const D = x / (N1 * K0);
  const lat = φ1 - (N1 * Math.tan(φ1) / R1) * (D ** 2 / 2
    - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * EP2) * D ** 4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * EP2 - 3 * C1 ** 2) * D ** 6 / 720);
  const lon = λ0 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6
    + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * EP2 + 24 * T1 ** 2) * D ** 5 / 120) / Math.cos(φ1);
  return { lat: lat * 180 / Math.PI, lon: lon * 180 / Math.PI };
}

/* ---------- VisioGlobe pixel → UTM ---------- */
/* geoinformation: { rotation_angle_in_degrees, meters_per_pixel, geo_xref, geo_yref,
                     pixel_xref, pixel_yref, proj: 'utm --zone 34 --north' } */
function makePixelToUtm(gi, sign = 1) {
  const θ = sign * gi.rotation_angle_in_degrees * Math.PI / 180;
  const c = Math.cos(θ), s = Math.sin(θ), m = gi.meters_per_pixel;
  return (px, py) => {
    const dx = (px - gi.pixel_xref) * m, dy = (py - gi.pixel_yref) * m;
    return { e: gi.geo_xref + dx * c - dy * s, n: gi.geo_yref + dx * s + dy * c };
  };
}

module.exports = { utmForward, utmInverse, makePixelToUtm, UTM_ZONE: 34 };
