// Light-theme drawing kit for the sky film: white glass cards, tags, checkboxes, toggles, a light
// prompt bar. Pure draw calls, sizes in canvas pixels (1080 x 1920). Shares text + icons with ui.js.
import * as M from './lib/motion.js';
import { C, UI, MONO, T, tw, glow, card, spark, sparkDisc, icon } from './ui.js';

const { TAU, E, clamp, lerp, rrect } = M;

export const L = {
  ink: '#0E1A2B', sub: '#62708A', faint: '#C9D2E0', line: 'rgba(14,26,43,0.08)',
  blue: '#1877F2', blueRgb: '24,119,242', blueTint: '#E6F0FF',
  coralTint: '#FFE8DF', green: '#19A56B', greenTint: '#DFF5EA', greyTint: '#EEF1F6',
};

// White card with a translucent glass rim and a soft blue shadow (the reference's floating panels).
export function wcard(ctx, x, y, w, h, r, { alpha = 1, rim = 10, accent = 0, accentCol = C.coral, fill = '#FFFFFF' } = {}) {
  if (alpha <= 0.003) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  for (let i = 3; i >= 1; i--) {
    rrect(ctx, x - i * 6 - rim, y - i * 2 + 20 - rim, w + i * 12 + 2 * rim, h + i * 8 + 2 * rim, r + rim + i * 6);
    ctx.fillStyle = 'rgba(12,60,140,0.075)'; ctx.fill();
  }
  if (rim) {
    rrect(ctx, x - rim, y - rim, w + 2 * rim, h + 2 * rim, r + rim);
    ctx.fillStyle = 'rgba(255,255,255,0.34)'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.stroke();
  }
  rrect(ctx, x, y, w, h, r); ctx.fillStyle = fill; ctx.fill();
  if (accent > 0.003) {
    rrect(ctx, x + 2, y + 2, w - 4, h - 4, r - 2);
    ctx.lineWidth = 5; ctx.globalAlpha *= clamp(accent); ctx.strokeStyle = accentCol; ctx.stroke();
  }
  ctx.restore();
}

// Small tag. kind: blue | coral | green | grey; solid fills it with the colour. align: where x is.
const KINDS = {
  blue: [L.blueTint, L.blue], coral: [L.coralTint, '#D9532B'], green: [L.greenTint, '#0F7F50'], grey: [L.greyTint, L.sub],
};
export function wtag(ctx, x, cy, label, { kind = 'blue', k = 1, size = 24, solid = 0, align = 'right', alpha = 1 } = {}) {
  if (k <= 0.003 || alpha <= 0.003) return 0;
  const w = tw(ctx, label, size, 700, MONO, 2) + size * 1.3, h = size * 1.9;
  const cx = align === 'right' ? x - w / 2 : align === 'left' ? x + w / 2 : x;
  const [bg, fg] = KINDS[kind];
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(cx, cy); ctx.scale(k, k);
  rrect(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.fillStyle = solid > 0.5 ? fg : bg; ctx.fill();
  T(ctx, label, 1, size * 0.36, size, 700, MONO, solid > 0.5 ? '#fff' : fg, 'center', 2);
  ctx.restore();
  return w;
}

// Rounded checkbox: p 0..1 fills it blue and draws the check.
export function checkbox(ctx, cx, cy, s, p, col = L.blue) {
  rrect(ctx, cx - s / 2, cy - s / 2, s, s, s * 0.28);
  if (p > 0.003) { ctx.fillStyle = col; ctx.fill(); icon.check(ctx, cx, cy, s * 0.3, '#fff', s * 0.13, clamp(p)); }
  else { ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = L.faint; ctx.stroke(); }
}

// Switch: on 0..1.
export function toggle(ctx, cx, cy, on) {
  const w = 92, h = 52, o = clamp(on);
  rrect(ctx, cx - w / 2, cy - h / 2, w, h, h / 2);
  ctx.fillStyle = M.mix('#D5DBE5', L.blue, o); ctx.fill();
  ctx.beginPath(); ctx.arc(cx - w / 2 + h / 2 + (w - h) * o, cy, h / 2 - 5, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
}

// Coral spark on a pale disc (Claude's avatar on light cards).
export function sparkDot(ctx, cx, cy, r, rot = 0) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fillStyle = '#FFF0E9'; ctx.fill();
  spark(ctx, cx, cy, r * 0.66, C.coral, rot);
}

// A thick blue infinity loop: stands for Meta next to the real logo shown in the footage.
export function loop(ctx, cx, cy, a, w = 12, p = 1) {
  const N = 64, last = Math.max(2, Math.round(N * clamp(p)));
  ctx.beginPath();
  for (let i = 0; i <= last; i++) {
    const th = (i / N) * TAU - Math.PI / 2, d = 1 + Math.sin(th) ** 2;
    const x = cx + (a * Math.cos(th)) / d, y = cy + (a * 1.25 * Math.sin(th) * Math.cos(th)) / d;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  const g = ctx.createLinearGradient(cx - a, cy, cx + a, cy);
  g.addColorStop(0, '#0064E0'); g.addColorStop(1, '#2A9BFF');
  ctx.lineWidth = w; ctx.strokeStyle = g; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
}

// Light prompt bar: one line of typed text, caret, send button. chars = typed characters (float).
export function lbar(ctx, x, y, w, h, str, chars, t, { sent = 0, pulse = 0, size = 40, alpha = 1, dark = 0 } = {}) {
  if (alpha <= 0.003) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  if (dark) { card(ctx, x, y, w, h, h / 2, { accent: sent ? 0.9 : 0.25 }); sparkDisc(ctx, x + h / 2 + 6, y + h / 2, h * 0.3); }
  else { wcard(ctx, x, y, w, h, h / 2, { accent: sent ? 0.9 : 0 }); sparkDot(ctx, x + h / 2 + 6, y + h / 2, h * 0.3); }
  const shown = str.slice(0, Math.floor(chars)), tx = x + h + 14;
  T(ctx, shown, tx, y + h / 2 + size * 0.35, size, 500, UI, dark ? C.white : L.ink);
  if (!sent && (chars > 0 ? true : Math.sin(t * 9) > -0.2)) { ctx.fillStyle = C.coral; ctx.fillRect(tx + tw(ctx, shown, size, 500, UI) + 5, y + h / 2 - size * 0.55, 4, size * 1.1); }
  const bx = x + w - h / 2 - 4, r = h * 0.3;
  if (sent) glow(ctx, bx, y + h / 2, r * (2.2 + pulse), C.coralRgb, 0.3 + 0.3 * pulse);
  ctx.beginPath(); ctx.arc(bx, y + h / 2, r * (1 + 0.14 * pulse), 0, TAU); ctx.fillStyle = sent ? C.coral : dark ? '#41444F' : '#D5DBE5'; ctx.fill();
  icon.arrowUp(ctx, bx, y + h / 2, r * 0.42, '#fff', Math.max(3, r * 0.14));
  ctx.restore();
}

// Placeholder text bars inside a card.
export function bars(ctx, x, y, widths, { h = 13, gap = 30, col = L.ink, a0 = 0.8, p = 1 } = {}) {
  widths.forEach((wd, i) => {
    rrect(ctx, x, y + i * gap, wd * clamp(p * widths.length - i), h, h / 2);
    ctx.fillStyle = i === 0 ? col : L.faint; ctx.globalAlpha *= i === 0 ? a0 : 1; ctx.fill(); if (i === 0) ctx.globalAlpha /= a0;
  });
}

// Number in a coral (or blue / grey) disc.
export function numDot(ctx, cx, cy, r, n, col = C.coral, k = 1) {
  if (k <= 0.003) return;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fillStyle = col; ctx.fill();
  T(ctx, String(n), 0, r * 0.36, r * 1.05, 800, UI, '#fff', 'center');
  ctx.restore();
}

// Small ad thumbnail: a rounded gradient tile with a play mark.
const GRADS = [['#2A7BFF', '#7CC4FF'], ['#F0764F', '#FFC29B'], ['#7A5CFF', '#C2A8FF'], ['#19A56B', '#8FE3B8']];
export function thumb(ctx, x, y, w, h, r, i, { play = 1 } = {}) {
  const [a, b] = GRADS[i % GRADS.length];
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, a); g.addColorStop(1, b);
  rrect(ctx, x, y, w, h, r); ctx.fillStyle = g; ctx.fill();
  if (play) {
    const cx = x + w / 2, cy = y + h / 2, s = Math.min(w, h) * 0.16;
    ctx.beginPath(); ctx.moveTo(cx - s * 0.7, cy - s); ctx.lineTo(cx + s, cy); ctx.lineTo(cx - s * 0.7, cy + s); ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill();
  }
}
export { E, lerp };
