// Drawing kit for the film: glass cards, pills, icons, the Claude spark, typed prompt bars.
// Every function is a pure draw call: no state, sizes in canvas pixels (1080 x 1920).
import * as M from './lib/motion.js';

const { TAU, E, clamp, lerp, hash01, font, layout, rrect } = M;

export const C = {
  white: '#F5F2EC', grey: '#9A9DA8', dim: 'rgba(245,242,236,0.55)',
  coral: '#F0764F', coralRgb: '240,118,79', ink: '#0B0C10',
};
export const DISPLAY = 'Display', UI = 'UI', MONO = 'Mono';

export const sp = (t, t0, cfg = M.SPRING.snappy) => M.spring(t - t0, cfg);
export const P = (t, a, b, ease = E.inOutCubic) => ease(M.prog(t, a, b));

// ------------------------------------------------------------------ text
export function T(ctx, s, x, y, size, wgt, fam, col, align = 'left', track = 0) {
  M.text(ctx, s, x, y, font(size, wgt, fam), col, align, track);
}
export const tw = (ctx, s, size, wgt, fam, track = 0) => layout(ctx, s, font(size, wgt, fam), track).width;

// Greedy word wrap, cached. Returns [{ str, from }] where `from` is the char index of the line start.
const wrapCache = new Map();
export function wrap(ctx, str, size, wgt, fam, maxW) {
  const key = `${str}|${size}|${wgt}|${fam}|${maxW}`;
  if (wrapCache.has(key)) return wrapCache.get(key);
  ctx.font = font(size, wgt, fam);
  const lines = [];
  let cur = '', from = 0, pos = 0;
  for (const w of str.split(' ')) {
    const tryStr = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(tryStr).width > maxW) {
      lines.push({ str: cur, from });
      from = pos; cur = w;
    } else cur = tryStr;
    pos += w.length + 1;
  }
  if (cur) lines.push({ str: cur, from });
  wrapCache.set(key, lines);
  return lines;
}

// ------------------------------------------------------------------ light
export function glow(ctx, x, y, r, rgb, a, sx = 1, sy = 1) {
  if (a <= 0.003 || r <= 0) return;
  ctx.save();
  ctx.translate(x, y); ctx.scale(sx, sy);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0, `rgba(${rgb},${a})`);
  g.addColorStop(0.45, `rgba(${rgb},${a * 0.32})`);
  g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g;
  ctx.fillRect(-r, -r, 2 * r, 2 * r);
  ctx.restore();
}

// ------------------------------------------------------------------ surfaces
// Dark glass card: soft shadow, vertical gradient, hairline border. accent 0..1 warms it to coral.
export function card(ctx, x, y, w, h, r, { accent = 0, alpha = 1, light = 0, dashed = false } = {}) {
  if (alpha <= 0.003) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  for (let i = 3; i >= 1; i--) {
    rrect(ctx, x - i * 5, y - i * 3 + 16, w + i * 10, h + i * 8, r + i * 5);
    ctx.fillStyle = 'rgba(0,0,0,0.13)'; ctx.fill();
  }
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, light ? '#3A3C46' : '#2B2D36');
  g.addColorStop(1, light ? '#23252C' : '#16171C');
  rrect(ctx, x, y, w, h, r); ctx.fillStyle = g; ctx.fill();
  if (accent > 0) {
    const a = ctx.createLinearGradient(0, y, 0, y + h);
    a.addColorStop(0, `rgba(${C.coralRgb},${0.20 * accent})`);
    a.addColorStop(1, `rgba(${C.coralRgb},${0.05 * accent})`);
    rrect(ctx, x, y, w, h, r); ctx.fillStyle = a; ctx.fill();
  }
  // top sheen
  const s = ctx.createLinearGradient(0, y, 0, y + Math.min(h, 70));
  s.addColorStop(0, 'rgba(255,255,255,0.07)'); s.addColorStop(1, 'rgba(255,255,255,0)');
  rrect(ctx, x, y, w, h, r); ctx.fillStyle = s; ctx.fill();
  ctx.lineWidth = accent > 0 ? 3 : 2;
  if (dashed) ctx.setLineDash([14, 10]);
  ctx.strokeStyle = accent > 0 ? `rgba(${C.coralRgb},${0.35 + 0.65 * accent})` : 'rgba(255,255,255,0.12)';
  rrect(ctx, x + 1, y + 1, w - 2, h - 2, r); ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

// Coral label pill ("PROMPT 01"). k is the pop scale 0..1+.
export function pill(ctx, cx, cy, label, { size = 38, k = 1, fam = MONO, wgt = 700, track = 5, padX = 40, fill = C.coral, color = '#fff', outline = 0, glowA = 0.45 } = {}) {
  if (k <= 0.003) return 0;
  const w = tw(ctx, label, size, wgt, fam, track) + padX * 2, h = size * 1.95;
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(k, k);
  if (!outline) glow(ctx, 0, 6, w * 0.7, C.coralRgb, glowA, 1, 0.45);
  rrect(ctx, -w / 2, -h / 2, w, h, h / 2);
  if (outline) { ctx.lineWidth = 4; ctx.strokeStyle = C.white; ctx.stroke(); }
  else {
    ctx.fillStyle = fill; ctx.fill();
    const s = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    s.addColorStop(0, 'rgba(255,255,255,0.28)'); s.addColorStop(0.5, 'rgba(255,255,255,0)');
    ctx.fillStyle = s; ctx.fill();
  }
  T(ctx, label, track / 2, size * 0.355, size, wgt, fam, color, 'center', track);
  ctx.restore();
  return w;
}

// Small caps tag on a row: outline (neutral) or filled coral.
export function tag(ctx, xRight, cy, label, { size = 25, on = 0, k = 1, alpha = 1, color } = {}) {
  if (k <= 0.003 || alpha <= 0.003) return;
  const w = tw(ctx, label, size, 700, MONO, 3) + 30, h = size * 1.75;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(xRight - w / 2, cy); ctx.scale(k, k);
  rrect(ctx, -w / 2, -h / 2, w, h, h / 2);
  if (on > 0.5) { ctx.fillStyle = color || C.coral; ctx.fill(); }
  else { ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(245,242,236,0.6)'; ctx.stroke(); }
  T(ctx, label, 1.5, size * 0.36, size, 700, MONO, on > 0.5 ? '#fff' : 'rgba(245,242,236,0.85)', 'center', 3);
  ctx.restore();
}

// ------------------------------------------------------------------ the Claude spark
const RAYS = Array.from({ length: 12 }, (_, i) => ({ a: (i / 12) * TAU + (hash01(i, 5) - 0.5) * 0.18, l: 0.76 + hash01(i, 9) * 0.24 }));
export function spark(ctx, cx, cy, R, color = C.coral, rot = 0) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.fillStyle = color;
  for (const r of RAYS) {
    ctx.save(); ctx.rotate(r.a);
    const L = R * r.l, w0 = R * 0.06, w1 = R * 0.1;
    ctx.beginPath();
    ctx.moveTo(R * 0.08, -w0); ctx.lineTo(L - w1, -w1);
    ctx.arc(L - w1, 0, w1, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(R * 0.08, w0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(0, 0, R * 0.2, 0, TAU); ctx.fill();
  ctx.restore();
}
// Spark inside a dark disc (the avatar on prompt cards).
export function sparkDisc(ctx, cx, cy, r, { on = 1 } = {}) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU);
  ctx.fillStyle = '#34363F'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.stroke();
  spark(ctx, cx, cy, r * 0.66, on > 0.5 ? C.coral : '#8E919C');
}

// ------------------------------------------------------------------ icons (stroke, centred on x,y; s = half size)
function stroke(ctx, w, col) { ctx.lineWidth = w; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); }
export const icon = {
  arrowUp(ctx, x, y, s, col = C.white, w = 5) {
    ctx.beginPath(); ctx.moveTo(x, y + s); ctx.lineTo(x, y - s);
    ctx.moveTo(x - s * 0.75, y - s * 0.25); ctx.lineTo(x, y - s); ctx.lineTo(x + s * 0.75, y - s * 0.25);
    stroke(ctx, w, col);
  },
  lock(ctx, x, y, s, col = C.white) {
    ctx.beginPath(); ctx.arc(x, y - s * 0.3, s * 0.48, Math.PI, 0); stroke(ctx, s * 0.24, col);
    rrect(ctx, x - s * 0.78, y - s * 0.3, s * 1.56, s * 1.25, s * 0.22); ctx.fillStyle = col; ctx.fill();
  },
  mail(ctx, x, y, s, col = C.white, w = 6) {
    rrect(ctx, x - s, y - s * 0.7, 2 * s, s * 1.4, s * 0.16); stroke(ctx, w, col);
    ctx.beginPath(); ctx.moveTo(x - s * 0.9, y - s * 0.55); ctx.lineTo(x, y + s * 0.12); ctx.lineTo(x + s * 0.9, y - s * 0.55);
    stroke(ctx, w, col);
  },
  search(ctx, x, y, s, col = C.white, w = 5) {
    ctx.beginPath(); ctx.arc(x - s * 0.15, y - s * 0.15, s * 0.62, 0, TAU); stroke(ctx, w, col);
    ctx.beginPath(); ctx.moveTo(x + s * 0.32, y + s * 0.32); ctx.lineTo(x + s * 0.85, y + s * 0.85); stroke(ctx, w, col);
  },
  check(ctx, x, y, s, col = C.white, w = 6, p = 1) {
    if (p <= 0) return;
    const a = [x - s * 0.75, y + s * 0.05], b = [x - s * 0.2, y + s * 0.6], c = [x + s * 0.8, y - s * 0.55];
    const p1 = clamp(p * 2), p2 = clamp(p * 2 - 1);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(lerp(a[0], b[0], p1), lerp(a[1], b[1], p1));
    if (p2 > 0) ctx.lineTo(lerp(b[0], c[0], p2), lerp(b[1], c[1], p2));
    stroke(ctx, w, col);
  },
  warn(ctx, x, y, s, col = C.white, w = 5) {
    ctx.beginPath(); ctx.moveTo(x, y - s * 0.85); ctx.lineTo(x + s, y + s * 0.8); ctx.lineTo(x - s, y + s * 0.8); ctx.closePath(); stroke(ctx, w, col);
    ctx.beginPath(); ctx.moveTo(x, y - s * 0.25); ctx.lineTo(x, y + s * 0.2); stroke(ctx, w, col);
    ctx.beginPath(); ctx.arc(x, y + s * 0.52, w * 0.55, 0, TAU); ctx.fillStyle = col; ctx.fill();
  },
  doc(ctx, x, y, s, col = C.grey, w = 3) {
    rrect(ctx, x - s * 0.72, y - s, s * 1.44, 2 * s, s * 0.2); stroke(ctx, w, col);
    ctx.beginPath();
    for (const dy of [-0.4, 0, 0.4]) { ctx.moveTo(x - s * 0.36, y + s * dy); ctx.lineTo(x + s * 0.36, y + s * dy); }
    stroke(ctx, w, col);
  },
  site(ctx, x, y, s, col = C.grey, w = 3) {   // a browser window
    rrect(ctx, x - s, y - s * 0.78, 2 * s, s * 1.56, s * 0.2); stroke(ctx, w, col);
    ctx.beginPath(); ctx.moveTo(x - s, y - s * 0.3); ctx.lineTo(x + s, y - s * 0.3); stroke(ctx, w, col);
  },
  link(ctx, x, y, s, col = C.white, w = 5) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(-Math.PI / 4);
    rrect(ctx, -s * 1.05, -s * 0.36, s * 1.2, s * 0.72, s * 0.36); stroke(ctx, w, col);
    rrect(ctx, -s * 0.15, -s * 0.36, s * 1.2, s * 0.72, s * 0.36); stroke(ctx, w, col);
    ctx.restore();
  },
  plane(ctx, x, y, s, col = C.white, w = 5, filled = 0) {
    ctx.beginPath();
    ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y - s * 0.2); ctx.lineTo(x - s * 0.15, y + s * 0.15); ctx.lineTo(x + s * 0.2, y + s); ctx.closePath();
    if (filled > 0.5) { ctx.fillStyle = col; ctx.fill(); }
    stroke(ctx, w, col);
    ctx.beginPath(); ctx.moveTo(x - s * 0.15, y + s * 0.15); ctx.lineTo(x + s, y - s); stroke(ctx, w, filled > 0.5 ? C.ink : col);
  },
  user(ctx, x, y, r, bg = '#3A3D47', fg = C.white) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = bg; ctx.fill(); ctx.clip();
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(x, y - r * 0.2, r * 0.36, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y + r * 0.95, r * 0.68, 0, TAU); ctx.fill();
    ctx.restore();
  },
};

// Round button on the right of a prompt bar: grey idle, coral once sent.
export function sendButton(ctx, x, y, r, { on = 0, lock = 0, pulse = 0 } = {}) {
  if (on > 0.5 || lock > 0.5) glow(ctx, x, y, r * (2 + pulse), C.coralRgb, 0.35 + 0.3 * pulse);
  ctx.beginPath(); ctx.arc(x, y, r * (1 + 0.12 * pulse), 0, TAU);
  ctx.fillStyle = on > 0.5 || lock > 0.5 ? C.coral : '#41444F'; ctx.fill();
  if (lock > 0.5) icon.lock(ctx, x, y + r * 0.08, r * 0.42, '#FFE9DF');
  else icon.arrowUp(ctx, x, y, r * 0.42, C.white, Math.max(3, r * 0.12));
}

// Collapsed prompt card: spark, "PROMPT 0n", two placeholder bars, button. hl warms it, dim greys it.
export function promptCard(ctx, x, y, w, h, n, { hl = 0, dim = 0, label, badge = 0, badgeText = '+ sites pros', lock = 0, alpha = 1 } = {}) {
  if (alpha <= 0.003) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  card(ctx, x, y, w, h, h * 0.36, { accent: hl });
  const cy = y + h / 2, tx = x + h + 18;
  sparkDisc(ctx, x + h * 0.56, cy, h * 0.3, { on: 1 - dim });
  T(ctx, label || `PROMPT 0${n}`, tx, cy - 10, 33, 700, MONO, dim > 0.5 ? C.grey : C.white, 'left', 7);
  rrect(ctx, tx, cy + 18, w * 0.47, 11, 6); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill();
  rrect(ctx, tx, cy + 44, w * 0.3, 11, 6); ctx.fillStyle = 'rgba(255,255,255,0.12)'; ctx.fill();
  const bx = x + w - h * 0.5;
  sendButton(ctx, bx, cy, h * 0.25, { lock });
  if (badge > 0.003) pill(ctx, bx - h * 0.25 - 30 - tw(ctx, badgeText, 28, 600, UI) / 2 - 22, cy - 14, badgeText, { size: 28, fam: UI, wgt: 600, track: 0, padX: 22, k: badge, glowA: 0.3 });
  if (dim > 0.003) { rrect(ctx, x, y, w, h, h * 0.36); ctx.fillStyle = `rgba(6,7,11,${0.55 * dim})`; ctx.fill(); }
  ctx.restore();
}

// The prompt input: spark, typed text (3 visible lines that scroll), caret, send button.
// chars = how many characters are typed (float). Returns the bar height.
export function promptBar(ctx, x, y, w, str, chars, t, { sent = 0, pulse = 0, hl = 0, size = 40 } = {}) {
  const lh = size * 1.3, padY = 44, maxLines = 3;
  const textX = x + 150, textW = w - 150 - 130;
  const lines = wrap(ctx, str, size, 500, UI, textW);
  const n = Math.floor(chars);
  let cur = 0;
  for (let i = 0; i < lines.length; i++) if (n >= lines[i].from) cur = i;
  const vis = Math.min(maxLines, cur + 1);
  const into = n - lines[cur].from;
  // grow from 1 to 3 lines, then scroll one line at a time as the caret enters a new line
  const grow = cur < maxLines ? cur - 1 + E.outCubic(clamp(into / 4)) : maxLines - 1;
  const rows = clamp(cur === 0 ? 0 : grow, 0, maxLines - 1) + 1;
  const scroll = cur >= maxLines ? cur - maxLines + E.outCubic(clamp(into / 4)) : 0;
  const h = padY * 2 + rows * lh - (lh - size);
  card(ctx, x, y, w, h, Math.min(64, h * 0.42), { accent: hl });
  sparkDisc(ctx, x + 78, y + padY + size * 0.5 + 4, 44);
  ctx.save();
  ctx.beginPath(); ctx.rect(textX - 4, y + padY - size * 0.25, textW + 40, rows * lh + 6); ctx.clip();
  let cx = textX, cyy = y + padY + size * 0.82;
  for (let i = 0; i < lines.length; i++) {
    const ly = y + padY + size * 0.82 + (i - scroll) * lh;
    if (n < lines[i].from) break;
    const shown = lines[i].str.slice(0, Math.max(0, n - lines[i].from));
    if (ly > y - lh && ly < y + h + lh) T(ctx, shown, textX, ly, size, 500, UI, C.white);
    if (i === cur) { cx = textX + tw(ctx, shown, size, 500, UI) + 5; cyy = ly; }
  }
  if (sent < 0.5 && (n > 0 ? true : Math.sin(t * 9) > -0.2)) {
    ctx.fillStyle = C.coral; ctx.fillRect(cx, cyy - size * 0.82, 4, size * 1.02);
  }
  ctx.restore();
  sendButton(ctx, x + w - 78, y + h / 2, 44, { on: sent, pulse });
  return h;
}

// One row of a list card. o: { n, letter, name, tagText, tagOn, strike, hl, dashed, alpha, nameCol }
export function row(ctx, x, y, w, h, o) {
  const a = o.alpha === undefined ? 1 : o.alpha;
  if (a <= 0.003) return;
  ctx.save();
  ctx.globalAlpha *= a;
  const cy = y + h / 2;
  if (o.hl > 0.003 || o.dashed) {
    rrect(ctx, x + 14, y + 8, w - 28, h - 16, 22);
    if (o.hl > 0.003) {
      ctx.fillStyle = `rgba(${C.coralRgb},${0.22 * o.hl})`; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = `rgba(${C.coralRgb},${o.hl})`; ctx.stroke();
    } else {
      ctx.lineWidth = 2.5; ctx.setLineDash([12, 9]); ctx.strokeStyle = 'rgba(245,242,236,0.45)'; ctx.stroke(); ctx.setLineDash([]);
    }
  } else if (!o.noRule) {
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x + 36, y, w - 72, 2);
  }
  T(ctx, String(o.n), x + 56, cy + 10, 28, 600, UI, C.grey, 'center');
  ctx.beginPath(); ctx.arc(x + 122, cy, 25, 0, TAU);
  ctx.fillStyle = o.hl > 0.5 ? C.coral : '#3A3D47'; ctx.fill();
  T(ctx, o.letter, x + 122, cy + 9, 24, 700, MONO, C.white, 'center');
  const col = o.nameCol || (o.strike > 0.5 ? C.grey : C.white);
  T(ctx, o.name, x + 172, cy + 14, 40, 600, UI, col);
  if (o.strike > 0.003) {
    const nw = tw(ctx, o.name, 40, 600, UI);
    ctx.fillStyle = C.grey; ctx.fillRect(x + 166, cy - 1, (nw + 12) * clamp(o.strike), 4);
  }
  if (o.tagText) tag(ctx, x + w - 40, cy, o.tagText, { on: o.tagOn || 0, k: o.tagK === undefined ? 1 : o.tagK });
  ctx.restore();
}

// Header of a "best-of list" card: doc icon, mono kicker, serif title, grey subtitle.
export function listHeader(ctx, x, y, kicker, title, sub) {
  icon.doc(ctx, x + 56, y + 52, 15, C.grey, 2.5);
  T(ctx, kicker, x + 84, y + 61, 24, 700, MONO, C.grey, 'left', 5);
  T(ctx, title, x + 40, y + 132, 62, 600, DISPLAY, C.white);
  if (sub) T(ctx, sub, x + 42, y + 176, 28, 400, UI, C.grey);
}

// Expanding ring (ping / success burst).
export function ring(ctx, x, y, r, a, w = 5, rgb = C.coralRgb) {
  if (a <= 0.003 || r <= 0) return;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  ctx.lineWidth = w; ctx.strokeStyle = `rgba(${rgb},${a})`; ctx.stroke();
}
// Seeded spark burst around a point: p 0..1 is the life of the burst.
export function burst(ctx, x, y, p, { n = 18, r0 = 30, r1 = 190, seed = 3 } = {}) {
  if (p <= 0 || p >= 1) return;
  const e = E.outCubic(p);
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hash01(i, seed) * 0.5, l = 0.6 + hash01(i, seed + 4) * 0.6;
    const ra = lerp(r0, r1 * l, e), rb = ra + 34 * (1 - p) * l;
    ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * ra, y + Math.sin(a) * ra); ctx.lineTo(x + Math.cos(a) * rb, y + Math.sin(a) * rb);
    ctx.lineWidth = 5 * (1 - p) + 1; ctx.strokeStyle = `rgba(255,${190 + Math.round(hash01(i, 8) * 50)},150,${1 - p})`; ctx.stroke();
  }
}
// Quadratic curve drawn up to progress p, with an optional travelling dot.
export function wire(ctx, x0, y0, cx, cy, x1, y1, p, { col = `rgba(${C.coralRgb},0.7)`, w = 3, dot = -1 } = {}) {
  if (p <= 0) return;
  ctx.beginPath(); ctx.moveTo(x0, y0);
  const N = 24, last = Math.max(1, Math.round(N * clamp(p)));
  const at = (q) => [(1 - q) ** 2 * x0 + 2 * (1 - q) * q * cx + q * q * x1, (1 - q) ** 2 * y0 + 2 * (1 - q) * q * cy + q * q * y1];
  for (let i = 1; i <= last; i++) { const [px, py] = at((i / N)); ctx.lineTo(px, py); }
  ctx.lineWidth = w; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.stroke();
  if (dot >= 0 && dot <= 1) {
    const [px, py] = at(dot);
    glow(ctx, px, py, 26, '255,220,200', 0.8);
    ctx.beginPath(); ctx.arc(px, py, 7, 0, TAU); ctx.fillStyle = '#FFF4EC'; ctx.fill();
  }
}
