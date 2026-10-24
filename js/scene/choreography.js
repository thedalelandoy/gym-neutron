/* Scroll choreography. The page is read as a "cursor": section i spans
   cursor values i..i+1 while it passes the middle of the viewport, so a
   section is centred at i + 0.5. Each scene value has one keyframe per
   section and is eased between neighbours. Nothing here touches the DOM. */

export const SECTION_IDS = ['top', 'fear', 'offer', 'how', 'element', 'claim', 'faq'];

const HIDDEN = 0.0001;

/* One keyframe per section, in SECTION_IDS order. */
const DESKTOP = {
  atomPos: [[0.92, 0.02, 0], [0.85, 0, -0.6], [0.6, 0.2, -2.4], [0, 0.3, -3], [0, 0.3, -3], [0.95, 0.02, -0.2], [0.9, 0.1, -0.8]],
  atomScale: [1, 1.05, HIDDEN, HIDDEN, HIDDEN, 0.8, 0.5],
  spread: [1, 2.3, 3.4, 3.4, 3.4, 1, 1.5],
  ringAlpha: [1, 0.2, 0, 0, 0, 0.9, 0.3],
  barPos: [[3.6, -0.1, -0.4], [2.8, -0.08, -0.4], [0.74, -0.02, -0.6], [0.98, 0.26, -0.7], [-3.6, 0.35, 0], [-3.6, 0.35, 0], [-3.6, 0.35, 0]],
  barRot: [[0, -0.82, 0], [0, -0.82, 0], [0.05, -0.82, 0], [0.18, -0.62, 0.08], [0, 0.2, 0], [0, 0.2, 0], [0, 0.2, 0]],
  barScale: [HIDDEN, 0.82, 0.82, 0.82, 0.82, HIDDEN, HIDDEN],
  dbPos: [[3, 0, 0], [3, 0, 0], [3, 0, 0], [2.4, 0, 0], [0.92, 0.02, 0], [-2.6, 0.2, 0], [-2.6, 0.2, 0]],
  dbScale: [HIDDEN, HIDDEN, HIDDEN, 2.3, 2.3, HIDDEN, HIDDEN],
  camPos: [[0, 0, 3.4], [0, 0.05, 4], [0, 0, 3.1], [0, 0.12, 3.25], [0, 0, 3.2], [0, 0, 3.35], [0, 0.1, 4.2]],
  exposure: [1.05, 0.82, 1, 1, 1.02, 1.05, 0.7],
};

/* Phones: everything sits in the top half, behind the copy, a little smaller. */
const MOBILE = {
  atomPos: [[0, 0.74, 0], [0, 0.8, -0.6], [0, 0.6, -2.4], [0, 0.6, -3], [0, 0.6, -3], [0, 0.62, -0.4], [0, 0.6, -1]],
  atomScale: [0.6, 0.66, HIDDEN, HIDDEN, HIDDEN, 0.55, 0.45],
  spread: [1, 2.3, 3.4, 3.4, 3.4, 1, 1.5],
  ringAlpha: [1, 0.25, 0, 0, 0, 0.7, 0.3],
  barPos: [[3.2, 0.7, 0], [2.6, 0.7, 0], [0.05, 0.72, -0.2], [0.05, 0.8, -0.2], [-3.2, 0.8, 0], [-3.2, 0.8, 0], [-3.2, 0.8, 0]],
  barRot: [[0, -0.95, 0], [0, -0.95, 0], [0.06, -0.95, 0], [0.2, -0.6, 0.06], [0, 0.2, 0], [0, 0.2, 0], [0, 0.2, 0]],
  barScale: [HIDDEN, 0.52, 0.52, 0.52, 0.52, HIDDEN, HIDDEN],
  dbPos: [[2.4, 0.6, 0], [2.4, 0.6, 0], [2.4, 0.6, 0], [2, 0.6, 0], [0, 0.6, 0], [-2.2, 0.7, 0], [-2.2, 0.7, 0]],
  dbScale: [HIDDEN, HIDDEN, HIDDEN, 1.6, 1.6, HIDDEN, HIDDEN],
  camPos: [[0, 0, 4.6], [0, 0.05, 4.9], [0, 0, 4.4], [0, 0.1, 4.5], [0, 0, 4.4], [0, 0, 4.6], [0, 0.1, 5]],
  exposure: [1.05, 0.82, 1, 1, 1.02, 1.05, 0.7],
};

/* Where in the offer section (0..1) each of the six plate pairs goes on.
   Matches the six stack items in the HTML. */
export function plateThreshold(index) {
  return 0.22 + index * 0.095;
}

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));

function sampleKeys(keys, cursor) {
  const t = Math.min(keys.length - 1, Math.max(0, cursor - 0.5));
  const i = Math.min(keys.length - 2, Math.floor(t));
  const f = smooth(clamp01(t - i));
  const a = keys[i];
  const b = keys[i + 1];
  if (Array.isArray(a)) return a.map((v, k) => v + (b[k] - v) * f);
  return a + (b - a) * f;
}

/* Every scene value for a cursor position. */
export function sampleScene(cursor, isMobile) {
  const table = isMobile ? MOBILE : DESKTOP;
  const out = {};
  Object.keys(table).forEach((key) => { out[key] = sampleKeys(table[key], cursor); });
  out.offerProgress = clamp01(cursor - 2);
  return out;
}
