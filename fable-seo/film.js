// Claude Fable 5.2 - 3 prompts SEO. A pure function of time: window.seek(t) paints frame t.
// The voice-over is the clock: beats.json has period 1, so u (beats) === t (seconds) everywhere.
// docs/shotlist.md is the plan this file follows.
import * as M from './lib/motion.js';
import { WORDS } from './words.js';
import { C, DISPLAY, UI, MONO, sp, P, T, tw, glow, card, pill, tag, spark, sparkDisc, icon, sendButton, promptCard, promptBar, row, listHeader, ring, burst, wire } from './ui.js';

const { W, H, TAU, E, clamp, lerp, prog, bump, kf, springKeys, SPRING, wobble, hash01, noise1, font, layout, glyph, rrect, cover, zoomAbout } = M;

// ================================================================ clips (frame sequences)
// Video clips are JPEG sequences in assets/clips/<name>/NNNN.jpg. clipAt maps film time to clip time
// (null = not on screen); seek() awaits the frames it needs before drawing, so draw stays pure.
const CLIPS = { astro: 302, hands: 151, site: 148, tuto: 275 };
const clipAt = {
  astro: (t) => (t >= 0.9 && t < 3.75 ? 1.6 + (t - 1.25) : null),
  hands: (t) => (t >= 3.1 && t < 5.9 ? 0.4 + (t - 3.4) * 0.9 : null),
  site: (t) => (t >= 26.2 && t < 29.9 ? (t - 26.5) * 1.5 : null),
  tuto: (t) => (t >= 82.8 && t < 94.7 ? kf(t, [[83.1, 0.9], [85.7, 3.3], [87.7, 6.4], [89.8, 9.0], [94.7, 9.1]], E.linear) : null),
};
const frames = new Map();
const frameIdx = (name, ct) => clamp(Math.floor(ct * 30), 0, CLIPS[name] - 1) + 1;
const frameKey = (name, i) => `assets/clips/${name}/${String(i).padStart(4, '0')}.jpg`;
function clip(name, t) {
  const ct = clipAt[name](t);
  return ct === null ? null : frames.get(frameKey(name, frameIdx(name, ct))) || null;
}
async function ensureFrames(t) {
  const need = [];
  for (const name of Object.keys(CLIPS)) {
    for (const dt of [0, 0.017, 0.034]) {
      const ct = clipAt[name](t + dt);
      if (ct !== null) need.push(frameKey(name, frameIdx(name, ct)));
    }
  }
  await Promise.all([...new Set(need)].filter((k) => !frames.has(k)).map(async (k) => {
    const im = new Image(); im.src = k;
    try { await im.decode(); frames.set(k, im); } catch { console.error(`frame failed to load: ${k}`); }
  }));
  while (frames.size > 48) frames.delete(frames.keys().next().value);
}

// ================================================================ captions (word by word)
const CAPS = (() => {
  const chunks = [];
  let cur = [];
  WORDS.forEach((w, i) => {
    const prev = WORDS[i - 1];
    const len = cur.reduce((n, x) => n + x[0].length + 1, 0);
    if (cur.length && (/[.,?!]$/.test(prev[0]) || cur.length >= 4 || len + w[0].length > 21 || w[1] - prev[2] > 0.45)) { chunks.push(cur); cur = []; }
    cur.push(w);
  });
  chunks.push(cur);
  return chunks.map((ws, i) => ({
    ws: ws.map(([w, s, e]) => ({ w: w.replace(/[.,]$/, ''), s, e })),
    a: ws[0][1],
    b: Math.min(chunks[i + 1] ? chunks[i + 1][0][1] : 1e9, ws[ws.length - 1][2] + 0.7),
  }));
})();
function captions(ctx, t) {
  const c = CAPS.find((x) => t >= x.a - 0.06 && t < x.b);
  if (!c) return;
  const full = c.ws.map((x) => x.w).join(' ');
  let size = 68;
  const wFull = tw(ctx, full, size, 700, UI);
  if (wFull > 930) size = Math.floor((size * 930) / wFull);
  const f = font(size, 700, UI);
  ctx.font = f; ctx.textAlign = 'left'; ctx.lineJoin = 'round';
  let x = 540 - tw(ctx, full, size, 700, UI) / 2;
  const space = ctx.measureText(' ').width;
  c.ws.forEach((wd, i) => {
    const ww = ctx.measureText(wd.w).width;
    const a = prog(t, wd.s - 0.07, wd.s + 0.03);
    if (a > 0) {
      const next = c.ws[i + 1];
      const active = !next || t < next.s - 0.02;
      const k = M.spring(t - wd.s + 0.07, SPRING.snappy);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(x + ww / 2, 1482 + (1 - k) * 16);
      ctx.font = f; ctx.textAlign = 'center';
      ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(4,5,9,0.55)'; ctx.strokeText(wd.w, 0, 0);
      ctx.fillStyle = active ? C.coral : C.white; ctx.fillText(wd.w, 0, 0);
      ctx.restore();
    }
    x += ww + space;
  });
}

// Typed prompt text built from the spoken words between a and b: the bar types what the voice says.
function typedPrompt(a, b) {
  const ws = WORDS.filter(([, s]) => s >= a && s < b);
  const str = ws.map((w) => w[0]).join(' ');
  let pos = 0;
  const marks = ws.map(([w, s, e]) => { const m = { from: pos, len: w.length + 1, s: s - 0.04, d: clamp(e - s, 0.1, 0.26) }; pos += w.length + 1; return m; });
  return {
    str, end: ws[ws.length - 1][2],
    chars(t) {
      let n = 0;
      for (const m of marks) {
        if (t >= m.s + m.d) n = m.from + m.len;
        else { if (t > m.s) n = m.from + (m.len * (t - m.s)) / m.d; break; }
      }
      return Math.min(n, str.length);
    },
  };
}
const TP1 = typedPrompt(26.4, 36.0), TP2 = typedPrompt(42.0, 51.6), TP3 = typedPrompt(58.5, 67.0);

// ================================================================ background: the Earth, stars, limb light
const EARTH = { cx: 548, cy: 1167, r: 416 };          // globe in the source image (measured)
const STARS = Array.from({ length: 170 }, (_, i) => ({ x: hash01(i, 21) * W, y: hash01(i, 22) * H * 0.82, r: 0.7 + hash01(i, 23) * 1.6, f: 0.3 + hash01(i, 24) * 1.2, p: hash01(i, 25) * TAU }));
function background(ctx, t, IMG) {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const k = sp(t, 5.3, SPRING.gentle);                 // intro framing -> horizon framing
  const s = 1.9 * (1 + 0.004 * Math.min(t, 5.3) + 0.006 * Math.sin(t * 0.21));
  const cx = 540 + 12 * Math.sin(t * 0.13), R = EARTH.r * s;
  const cy = lerp(905, 1255, k) + R + 6 * Math.sin(t * 0.17);
  // stars above the limb
  for (const st of STARS) {
    if ((st.x - cx) ** 2 + (st.y - cy) ** 2 < (R + 8) ** 2) continue;
    const a = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(t * st.f + st.p));
    ctx.fillStyle = `rgba(235,240,255,${a})`;
    ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, TAU); ctx.fill();
  }
  if (IMG.earth) ctx.drawImage(IMG.earth, cx - EARTH.cx * s, cy - EARTH.cy * s, 1080 * s, 1920 * s);
  // atmosphere: soft halo outside the limb, then a crisp rim line
  const halo = ctx.createRadialGradient(cx, cy, R - 70, cx, cy, R + 130);
  halo.addColorStop(0, 'rgba(110,170,255,0)'); halo.addColorStop(0.35, 'rgba(110,170,255,0.32)'); halo.addColorStop(0.55, 'rgba(90,150,255,0.10)'); halo.addColorStop(1, 'rgba(90,150,255,0)');
  ctx.fillStyle = halo; ctx.fillRect(0, cy - R - 130, W, R + 130);
  const g = ctx.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(255,235,220,0.95)'); g.addColorStop(0.3, 'rgba(215,232,255,0.85)'); g.addColorStop(1, 'rgba(160,200,255,0.25)');
  ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI * 1.08, Math.PI * 1.92);
  ctx.lineWidth = 3.5; ctx.strokeStyle = g; ctx.stroke();
  // sun glint on the limb at the left, warm like the accent
  const ga = Math.PI * 1.2, gx = cx + R * Math.cos(ga), gy = cy + R * Math.sin(ga);
  const pulse = 0.85 + 0.15 * Math.sin(t * 1.3);
  glow(ctx, gx, gy, 300, '255,150,100', 0.5 * pulse);
  glow(ctx, gx, gy, 620, '255,190,150', 0.28 * pulse, 1, 0.07);
  glow(ctx, gx, gy, 70, '255,250,240', 1);
  // readability: darken under the captions, vignette the corners
  const sc = ctx.createLinearGradient(0, 1240, 0, H);
  sc.addColorStop(0, 'rgba(0,0,0,0)'); sc.addColorStop(0.45, 'rgba(0,0,0,0.5)'); sc.addColorStop(1, 'rgba(0,0,0,0.82)');
  ctx.fillStyle = sc; ctx.fillRect(0, 1240, W, H - 1240);
  const v = ctx.createRadialGradient(540, 900, 600, 540, 900, 1250);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

// ================================================================ shared pieces
function tile(ctx, cx, cy, s, k, { hl = 1, glowA = 0.25, slots = false } = {}) {
  if (k <= 0.003) return;
  ctx.save();
  zoomAbout(ctx, k, cx, cy);
  glow(ctx, cx, cy, s * 1.15, C.coralRgb, glowA);
  card(ctx, cx - s / 2, cy - s / 2, s, s, s * 0.24, { accent: hl });
  spark(ctx, cx + (slots ? s * 0.08 : 0), cy, s * 0.3, C.coral);
  if (slots) for (const dy of [-0.12, 0.12]) { rrect(ctx, cx - s * 0.41, cy + s * dy - s * 0.035, s * 0.1, s * 0.07, s * 0.025); ctx.fillStyle = '#0B0C10'; ctx.fill(); }
  ctx.restore();
}
// A plug: cable, body with a label, two prongs ending at tipX. s = body scale.
function plug(ctx, tipX, cy, s, label) {
  const bodyR = tipX - s, bodyL = bodyR - s * 2.2;
  ctx.lineCap = 'butt';
  ctx.beginPath(); ctx.moveTo(bodyL - 1600, cy); ctx.lineTo(bodyL + 10, cy);
  ctx.lineWidth = s * 0.2; ctx.strokeStyle = '#23252C'; ctx.stroke();
  for (const dy of [-0.3, 0.3]) { rrect(ctx, bodyR - 6, cy + s * dy - s * 0.085, s + 6, s * 0.17, s * 0.05); ctx.fillStyle = '#D9DBE2'; ctx.fill(); }
  card(ctx, bodyL, cy - s * 0.62, s * 2.2, s * 1.24, s * 0.3, { light: 1 });
  rrect(ctx, bodyL + s * 0.22, cy - s * 0.36, s * 0.09, s * 0.72, s * 0.045); ctx.fillStyle = C.coral; ctx.fill();
  T(ctx, label, bodyL + s * 1.2, cy + s * 0.2, s * 0.56, 800, UI, label === '?' ? C.coral : C.white, 'center');
}
// Browser window: chrome bar with a label, then an image (cover fit) or nothing.
function browser(ctx, x, y, w, h, label, img, { accent = 0 } = {}) {
  card(ctx, x, y, w, h, 30, { accent });
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + 38 + i * 26, y + 33, 7, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.fill(); }
  rrect(ctx, x + 122, y + 14, w - 160, 38, 19); ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill();
  T(ctx, label, x + 146, y + 42, 22, 700, MONO, C.grey, 'left', 4);
  if (img) cover(ctx, img, x + 8, y + 64, w - 16, h - 72, { radius: 22, fy: 0 });
}
// Small "professional site" card.
function siteCard(ctx, x, y, w, h, k, { label = 'SITE PRO', chip, chipK = 0, hl = 0, rank = 0, rankK = 0 } = {}) {
  if (k <= 0.003) return;
  ctx.save();
  ctx.globalAlpha *= clamp(k * 1.6);
  zoomAbout(ctx, lerp(0.7, 1, k), x + w / 2, y + h / 2);
  card(ctx, x, y, w, h, 26, { accent: hl });
  icon.site(ctx, x + 44, y + 46, 15, C.grey, 2.5);
  T(ctx, label, x + 72, y + 56, 25, 700, MONO, C.white, 'left', 3);
  rrect(ctx, x + 28, y + 86, w * 0.62, 13, 7); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
  rrect(ctx, x + 28, y + 114, w * 0.42, 10, 5); ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fill();
  if (chip) {
    T(ctx, 'recommande', x + 28, y + 166, 27, 500, UI, C.grey);
    pill(ctx, x + w / 2, y + 208, chip, { size: 28, fam: UI, wgt: 600, track: 0, padX: 20, k: chipK, glowA: 0.25 });
  } else {
    rrect(ctx, x + 28, y + 146, w * 0.3, 10, 5); ctx.fillStyle = `rgba(${C.coralRgb},0.9)`; ctx.fill();
  }
  if (rankK > 0.003) {
    ctx.save(); zoomAbout(ctx, rankK, x + w - 8, y + 8);
    glow(ctx, x + w - 8, y + 8, 70, C.coralRgb, 0.4);
    ctx.beginPath(); ctx.arc(x + w - 8, y + 8, 32, 0, TAU); ctx.fillStyle = C.coral; ctx.fill();
    T(ctx, String(rank), x + w - 8, y + 20, 34, 800, UI, '#fff', 'center');
    ctx.restore();
  }
  ctx.restore();
}
// Pill + typing bar at the top of a prompt shot. Returns nothing; layout below starts at y = 630.
function promptHead(ctx, t, n, pillAt, barAt, tp) {
  pill(ctx, 540, 296, `PROMPT 0${n}`, { k: sp(t, pillAt, SPRING.bouncy) });
  const bk = sp(t, barAt);
  if (bk <= 0.003) return;
  ctx.save();
  ctx.globalAlpha *= clamp(bk * 1.6);
  ctx.translate(0, (1 - bk) * 70);
  const sent = t >= tp.end + 0.12 ? 1 : 0;
  promptBar(ctx, 90, 352, 900, tp.str, tp.chars(t), t, { sent, pulse: bump(t, tp.end + 0.22, 0.22), hl: sent * 0.6 });
  ctx.restore();
}
const LIST = { x: 90, y: 640, w: 900, head: 196, row: 94 };
const ROWS = [
  { n: 1, letter: 'A', name: 'Concurrent A' }, { n: 2, letter: 'B', name: 'Concurrent B' },
  { n: 3, letter: 'C', name: 'Concurrent C' }, { n: 4, letter: 'D', name: 'Concurrent D' },
];
function listShell(ctx, title = 'Les 10 meilleurs outils') {
  const h = LIST.head + 5 * LIST.row + 22;
  card(ctx, LIST.x, LIST.y, LIST.w, h, 34);
  listHeader(ctx, LIST.x, LIST.y, 'COMPARATIF', title, 'classés pour votre domaine');
}
const rowY = (i) => LIST.y + LIST.head + i * LIST.row;

// ================================================================ S1  intro (0 - 5.45)
// Title, the rounded frame cycling the banner and the two science clips, "EST SORTI", then a search bar.
const FR = { x: 108, y: 590, w: 864, h: 540, r: 38 };
function sIntro(ctx, t, IMG) {
  const k0 = sp(t, -0.9, SPRING.gentle);
  const cw = tw(ctx, 'Claude', 72, 600, UI), x0 = 540 - (66 + 22 + cw) / 2, ly = 306 - (1 - k0) * 50;
  spark(ctx, x0 + 33, ly - 25, 36, C.coral, t * 0.12);
  T(ctx, 'Claude', x0 + 88, ly, 72, 600, UI, C.white);
  const f = font(222, 600, DISPLAY), L = layout(ctx, 'Fable 5.2', f, -3), bx = 540 - L.width / 2;
  L.glyphs.forEach((g, j) => {
    const k = sp(t, -0.62 + j * 0.03, SPRING.bouncy);
    if (k <= 0) return;
    ctx.save(); ctx.globalAlpha *= clamp(k * 2);
    glyph(ctx, g.ch, bx + g.cx, 518 + (1 - k) * 110, f, C.white);
    ctx.restore();
  });

  // the frame
  const fk = sp(t, -0.55, SPRING.gentle);
  ctx.save();
  zoomAbout(ctx, lerp(0.86, 1, fk), 540, FR.y + FR.h / 2);
  glow(ctx, 540, FR.y + FR.h / 2, 700, '120,170,255', 0.12);
  for (let i = 3; i >= 1; i--) { rrect(ctx, FR.x - i * 6, FR.y - i * 3 + 22, FR.w + i * 12, FR.h + i * 10, FR.r + i * 6); ctx.fillStyle = 'rgba(0,0,0,0.16)'; ctx.fill(); }
  ctx.save();
  rrect(ctx, FR.x, FR.y, FR.w, FR.h, FR.r); ctx.clip();
  ctx.fillStyle = '#05060A'; ctx.fillRect(FR.x, FR.y, FR.w, FR.h);
  const items = [{ img: IMG.banner, a: -9, b: 1.25 }, { img: clip('astro', t), a: 1.25, b: 3.4 }, { img: clip('hands', t), a: 3.4, b: 99 }];
  for (const it of items) {
    const pin = P(t, it.a - 0.15, it.a + 0.15), pout = P(t, it.b - 0.15, it.b + 0.15);
    if (pin <= 0 || pout >= 1 || !it.img) continue;
    cover(ctx, it.img, FR.x, FR.y + ((1 - pin) - pout) * FR.h, FR.w, FR.h, { zoom: 1.03 + 0.022 * Math.max(0, t - Math.max(0, it.a)) });
  }
  ctx.restore();
  rrect(ctx, FR.x + 1.5, FR.y + 1.5, FR.w - 3, FR.h - 3, FR.r); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.stroke();
  ctx.restore();

  // "EST SORTI": outline on "vient", fills on "sortir"
  const py = 1262, filled = t >= 1.66;
  const pk = sp(t, 1.3, SPRING.bouncy) * (1 - P(t, 3.25, 3.45, E.inCubic)) * (1 + 0.16 * wobble(t - 1.66, 2.4, 5));
  pill(ctx, 540, py, 'EST SORTI', { size: 72, fam: UI, wgt: 800, track: 3, padX: 58, k: pk, outline: filled ? 0 : 1, glowA: 0.6 });

  // search bar: "... vous trouvent sur Google"
  const sk = sp(t, 3.42);
  if (sk > 0.003) {
    ctx.save();
    ctx.globalAlpha *= clamp(sk * 1.6);
    zoomAbout(ctx, lerp(0.8, 1, sk), 540, py);
    const bw = 820, bh = 128, bx0 = 540 - bw / 2, by0 = py - bh / 2, on = t >= 4.76;
    T(ctx, 'RECHERCHE GOOGLE', 540, by0 - 20, 30, 700, MONO, C.white, 'center', 7);
    card(ctx, bx0, by0, bw, bh, bh / 2, { accent: on ? 0.7 : 0 });
    icon.search(ctx, bx0 + 76, py + 2, 24, C.grey, 5);
    const q = 'votre entreprise', n = Math.floor(q.length * prog(t, 3.55, 4.55));
    T(ctx, q.slice(0, n), bx0 + 130, py + 16, 46, 500, UI, C.white);
    if (!on) { ctx.fillStyle = C.coral; ctx.fillRect(bx0 + 136 + tw(ctx, q.slice(0, n), 46, 500, UI), py - 24, 4, 50); }
    const bxr = bx0 + bw - 66, pu = on ? wobble(t - 4.76, 2.2, 5) : 0;
    if (on) glow(ctx, bxr, py, 110, C.coralRgb, 0.5);
    ctx.beginPath(); ctx.arc(bxr, py, 42 * (1 + 0.18 * pu), 0, TAU); ctx.fillStyle = on ? C.coral : '#41444F'; ctx.fill();
    icon.search(ctx, bxr + 2, py + 2, 17, '#fff', 4.5);
    ring(ctx, bxr, py, 42 + 90 * prog(t, 4.76, 5.3), 0.8 * (1 - prog(t, 4.76, 5.3)), 4);
    ctx.restore();
  }
}

// ================================================================ S2  "3 PROMPTS" (5.45 - 7.42)
function sThree(ctx, t) {
  const f = font(158, 900, UI);
  const w3 = tw(ctx, '3', 158, 900, UI), wp = tw(ctx, 'PROMPTS', 158, 900, UI), x0 = 540 - (w3 + 34 + wp) / 2;
  const k3 = sp(t, 5.34, SPRING.bouncy), kp = sp(t, 5.74, SPRING.bouncy);
  if (k3 > 0) { ctx.save(); zoomAbout(ctx, k3, x0 + w3 / 2, 410); M.text(ctx, '3', x0, 468, f, C.coral); ctx.restore(); }
  if (kp > 0) { ctx.save(); zoomAbout(ctx, lerp(0.6, 1, kp), x0 + w3 + 34 + wp / 2, 410); ctx.globalAlpha *= clamp(kp * 2); M.text(ctx, 'PROMPTS', x0 + w3 + 34, 468, f, C.white); ctx.restore(); }
  for (let i = 0; i < 3; i++) {
    const k = sp(t, 5.5 + i * 0.2);
    promptCard(ctx, 120, 570 + i * 206 + (1 - k) * 140, 840, 176, i + 1, { alpha: clamp(k * 1.6) });
  }
}

// ================================================================ S3  the goal: rank higher (7.42 - 13.3)
function sObjective(ctx, t) {
  pill(ctx, 540, 322, "L'OBJECTIF", { k: sp(t, 7.3, SPRING.bouncy), size: 40 });
  const tk = sp(t, 8.0, SPRING.bouncy);
  tile(ctx, 540, 510, 184, tk);
  const ck = sp(t, 9.5, SPRING.gentle);
  if (ck <= 0.003) return;
  const x = 110, y = 690 + (1 - ck) * 260, w = 860, rh = 116;
  ctx.save();
  ctx.globalAlpha *= clamp(ck * 1.6);
  wire(ctx, 540, 606, 540, 650, 540, y, clamp(ck * 1.4), { w: 3, dot: prog(t, 9.6, 10.3) < 1 ? prog(t, 9.6, 10.3) : -1 });
  card(ctx, x, y, w, 110 + 4 * rh + 20, 34);
  icon.search(ctx, x + 58, y + 58, 17, C.grey, 4);
  T(ctx, 'RÉSULTATS DE RECHERCHE', x + 92, y + 68, 25, 700, MONO, C.grey, 'left', 5);
  // "Votre site" climbs from 4th to 1st as the voice says "améliorer votre référencement naturel"
  const r = springKeys(t, [[0, 3], [11.0, 2], [11.72, 1], [12.4, 0]], SPRING.snappy);
  ROWS.slice(0, 3).forEach((o, i) => {
    const slot = i + clamp(i + 1 - r);
    row(ctx, x, y + 110 + slot * rh, w, rh, { ...o, n: Math.round(slot) + 1, tagText: 'CONCURRENT' });
  });
  const top = r < 0.5;
  row(ctx, x, y + 110 + r * rh, w, rh, { n: Math.round(r) + 1, letter: 'V', name: 'Votre site', hl: 1, tagText: top ? 'N°1' : `+${3 - Math.round(r)}`, tagOn: 1, tagK: r < 2.9 ? 1 + 0.2 * wobble(t - 12.4, 2.4, 5) * (top ? 1 : 0) : 0 });
  if (top) { const p = prog(t, 12.4, 13.0); ring(ctx, x + w - 90, y + 110 + rh / 2, 30 + 120 * p, 1 - p, 4); }
  ctx.restore();
}

// ================================================================ S4  "... autrement dit votre SEO" (13.3 - 15.4)
function sSEO(ctx, t) {
  pill(ctx, 540, 560, 'RÉFÉRENCEMENT NATUREL', { k: sp(t, 13.18, SPRING.bouncy), size: 36, outline: 1 });
  const ke = sp(t, 13.85);
  if (ke > 0) { ctx.save(); ctx.globalAlpha *= clamp(ke * 2); T(ctx, '=', 540, 720 + (1 - ke) * 30, 110, 300, UI, C.grey, 'center'); ctx.restore(); }
  const k = sp(t, 14.18, SPRING.bouncy);
  if (k <= 0.003) return;
  ctx.save();
  zoomAbout(ctx, lerp(1.7, 1, k), 540, 950);
  ctx.globalAlpha *= clamp(k * 2.5);
  glow(ctx, 540, 950, 620, C.coralRgb, 0.22, 1, 0.6);
  const g = ctx.createLinearGradient(0, 780, 0, 1090);
  g.addColorStop(0, '#FFFFFF'); g.addColorStop(1, '#AEB1BC');
  M.text(ctx, 'SEO', 540, 1090, font(440, 900, UI), g, 'center', -6);
  const u = P(t, 14.3, 14.75, E.outCubic);
  rrect(ctx, 540 - 330 * u, 1150, 660 * u, 16, 8); ctx.fillStyle = C.coral; ctx.fill();
  ctx.restore();
}

// ================================================================ S5  prompt 3 teaser (15.4 - 20.62)
const SITE_X = [60, 390, 720];
function sTeaser(ctx, t) {
  const hl = sp(t, 15.74), push = sp(t, 16.5, SPRING.gentle);
  for (let i = 0; i < 2; i++) {
    const k = sp(t, 15.24 + i * 0.07);
    promptCard(ctx, 120, 400 + i * 196 - push * 760 + (1 - k) * 120, 840, 172, i + 1, { dim: hl * 0.8, alpha: clamp(k * 1.6) * (1 - push) });
  }
  const k3 = sp(t, 15.38), y3 = lerp(792, 430, push) + (1 - k3) * 120;
  ctx.save();
  zoomAbout(ctx, 1 + 0.06 * push, 540, y3 + 86);
  if (hl > 0.01) glow(ctx, 540, y3 + 86, 620, C.coralRgb, 0.16 * hl, 1, 0.4);
  promptCard(ctx, 120, y3, 840, 172, 3, { hl, alpha: clamp(k3 * 1.6), badge: sp(t, 16.0, SPRING.bouncy), lock: t >= 15.9 ? 1 : 0 });
  ctx.restore();
  // the professional sites it finds
  SITE_X.forEach((x, j) => {
    const at = 17.45 + j * 0.24, wp = P(t, at - 0.4, at, E.outCubic);
    wire(ctx, 540, y3 + 180, 540 + (x + 150 - 540) * 0.2, 800, x + 150, 880, wp, { dot: wp > 0 && wp < 1 ? wp : -1 });
    const ck = [18.72, 19.0, 19.24][j];
    siteCard(ctx, x, 880, 300, 250, sp(t, at, SPRING.bouncy), { chip: `Concurrent ${'ABC'[j]}`, chipK: sp(t, ck, SPRING.bouncy) * (1 + 0.12 * wobble(t - 19.78, 2.4, 5)), hl: t >= ck ? 0.6 : 0 });
  });
}

// ================================================================ S6  "connect a tool first... at the end" (20.62 - 25.25)
function sConnect(ctx, t) {
  const fade = 1 - P(t, 21.25, 21.55);
  for (let i = 0; i < 3; i++) {
    const k = sp(t, 20.46 + i * 0.06);
    promptCard(ctx, 120, 360 + i * 196 + (1 - k) * 100 - (1 - fade) * 200, 840, 172, i + 1, { dim: 1, label: 'NON CONNECTÉ', alpha: clamp(k * 1.6) * fade });
  }
  const pk = sp(t, 21.5, SPRING.gentle);
  if (pk > 0.003) {
    const cy = 720;
    ctx.save();
    ctx.globalAlpha *= clamp(pk * 1.6);
    tile(ctx, 750, cy, 300, lerp(0.7, 1, pk), { slots: true });
    T(ctx, 'CLAUDE', 750, cy + 222, 34, 700, MONO, C.white, 'center', 12);
    const tip = lerp(-200, 520, pk) + 10 * Math.sin(t * 3.2);
    plug(ctx, tip, cy, 120, '?');
    for (let i = 0; i < 4; i++) {      // the gap that is not closed yet
      const a = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * 6 - i * 0.9));
      ctx.beginPath(); ctx.arc(tip + 22 + i * 17, cy, 4.5, 0, TAU); ctx.fillStyle = `rgba(${C.coralRgb},${a * pk})`; ctx.fill();
    }
    ctx.restore();
  }
  // "je vous explique lequel à la fin": the timeline, and where the answer is
  const tk = sp(t, 23.3);
  if (tk > 0.003) {
    const y = 1090, x0 = 140, x1 = 940, now = x0 + (x1 - x0) * 0.235;
    ctx.save();
    ctx.globalAlpha *= clamp(tk * 1.6);
    ctx.translate(0, (1 - tk) * 60);
    rrect(ctx, x0, y - 6, x1 - x0, 12, 6); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fill();
    rrect(ctx, x0, y - 6, now - x0, 12, 6); ctx.fillStyle = C.coral; ctx.fill();
    ctx.beginPath(); ctx.arc(now, y, 19, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
    T(ctx, '0:23', x0, y - 40, 34, 700, MONO, C.white, 'left', 2);
    T(ctx, '1:40', x1, y - 40, 34, 700, MONO, C.grey, 'right', 2);
    const hop = P(t, 23.65, 24.3, E.inOutCubic);
    wire(ctx, now, y - 30, (now + x1) / 2, y - 210, x1 - 4, y - 26, hop, { w: 4, dot: hop > 0 && hop < 1 ? hop : -1 });
    const ek = sp(t, 24.25, SPRING.bouncy);
    if (ek > 0) {
      const p = prog(t, 24.25, 24.9);
      ring(ctx, x1 - 4, y, 24 + 80 * p, 1 - p, 5);
      ctx.beginPath(); ctx.arc(x1 - 4, y, 17 * ek, 0, TAU); ctx.fillStyle = C.coral; ctx.fill();
      pill(ctx, x1 - 118, y + 84, 'À LA FIN', { size: 34, k: ek });
    }
    ctx.restore();
  }
}

// ================================================================ S7  prompt 1 (25.25 - 36.2)
function sPrompt1(ctx, t) {
  promptHead(ctx, t, 1, 25.12, 25.34, TP1);
  // "Voici mon site": the real site, in a browser card
  const sk = sp(t, 26.5, SPRING.gentle), sout = P(t, 29.3, 29.62, E.inCubic);
  if (sk > 0.003 && sout < 1) {
    ctx.save();
    ctx.globalAlpha *= clamp(sk * 1.6);
    ctx.translate(-sout * 1200, (1 - sk) * 420);
    browser(ctx, 90, 640, 900, 554, 'VOTRE SITE', clip('site', t), { accent: 0.5 });
    ctx.restore();
  }
  // the comparison list Claude finds
  const lk = sp(t, 29.5), lout = P(t, 33.95, 34.25, E.inCubic);
  if (lk > 0.003 && lout < 1) {
    ctx.save();
    ctx.translate((1 - lk) * 1200 - lout * 1200, 0);
    listShell(ctx);
    ROWS.forEach((o, i) => {
      const k = sp(t, 29.78 + i * 0.15), on = t >= 33.0 + i * 0.2;
      row(ctx, LIST.x + (1 - k) * 80, rowY(i), LIST.w, LIST.row, { ...o, alpha: clamp(k * 1.6), tagText: 'CONCURRENT', tagOn: on ? 1 : 0, tagK: 1 + 0.18 * wobble(t - 33.0 - i * 0.2, 2.6, 6) });
    });
    const ky = sp(t, 30.4);
    row(ctx, LIST.x, rowY(4), LIST.w, LIST.row, { n: '?', letter: 'V', name: 'Vous', dashed: true, alpha: clamp(ky * 1.6), tagText: 'ABSENT' });
    const scan = prog(t, 32.9, 33.85);          // "repère mes concurrents"
    if (scan > 0 && scan < 1) {
      const sy = rowY(0) + scan * 4 * LIST.row;
      glow(ctx, 540, sy, 520, C.coralRgb, 0.55, 1, 0.05);
    }
    ctx.restore();
  }
  // "classe les sites les plus pertinents"
  const rk = sp(t, 34.1);
  if (rk > 0.003) {
    const x = 90, y = 640, w = 900, rh = 132;
    ctx.save();
    ctx.translate((1 - rk) * 1200, 0);
    card(ctx, x, y, w, 120 + 3 * rh + 24, 34);
    icon.doc(ctx, x + 56, y + 58, 15, C.grey, 2.5);
    T(ctx, 'SITES LES PLUS PERTINENTS', x + 84, y + 67, 25, 700, MONO, C.grey, 'left', 5);
    const data = [{ name: 'Comparatif B', score: 81, to: 2 }, { name: 'Comparatif A', score: 96, to: 0 }, { name: 'Comparatif C', score: 88, to: 1 }];
    const sort = sp(t, 34.62);
    data.forEach((d, i) => {
      const slot = lerp(i, d.to, sort), ry = y + 120 + slot * rh, cy = ry + rh / 2, first = d.to === 0 && sort > 0.5;
      if (first) { rrect(ctx, x + 14, ry + 8, w - 28, rh - 16, 24); ctx.fillStyle = `rgba(${C.coralRgb},0.2)`; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.coral; ctx.stroke(); }
      ctx.beginPath(); ctx.arc(x + 80, cy, 31, 0, TAU); ctx.fillStyle = first ? C.coral : '#3A3D47'; ctx.fill();
      T(ctx, String(Math.round(slot) + 1), x + 80, cy + 12, 34, 800, UI, '#fff', 'center');
      T(ctx, d.name, x + 136, cy - 6, 40, 600, UI, C.white);
      const bw = 520, fillW = bw * (d.score / 100) * P(t, 34.3 + i * 0.08, 34.95 + i * 0.08, E.outCubic);
      rrect(ctx, x + 136, cy + 20, bw, 12, 6); ctx.fillStyle = 'rgba(255,255,255,0.14)'; ctx.fill();
      rrect(ctx, x + 136, cy + 20, fillW, 12, 6); ctx.fillStyle = C.coral; ctx.fill();
      T(ctx, `${d.score}%`, x + w - 50, cy + 16, 42, 700, UI, first ? C.coral : C.white, 'right');
    });
    ctx.restore();
  }
}

// ================================================================ S8  "a list of pages where you could have your place" (36.2 - 40.62)
function sPages(ctx, t) {
  pill(ctx, 540, 322, 'VOTRE LISTE DE PAGES', { k: sp(t, 36.06, SPRING.bouncy), size: 36 });
  const titles = ['Les 10 meilleurs outils', 'Le comparatif 2026', 'Le top des services'];
  titles.forEach((title, i) => {
    const k = sp(t, 36.26 + i * 0.44), x = 110, y = 420 + i * 290 + (1 - k) * 160, w = 860, h = 262;
    if (k <= 0.003) return;
    const at = [38.42, 38.96, 39.5][i], on = sp(t, at, SPRING.bouncy);
    ctx.save();
    ctx.globalAlpha *= clamp(k * 1.6);
    card(ctx, x, y, w, h, 32, { accent: on > 0.01 ? 0.5 * clamp(on) : 0 });
    icon.doc(ctx, x + 54, y + 50, 14, C.grey, 2.5);
    T(ctx, `PAGE 0${i + 1}`, x + 82, y + 59, 23, 700, MONO, C.grey, 'left', 5);
    T(ctx, title, x + 40, y + 122, 52, 600, DISPLAY, C.white);
    row(ctx, x + 12, y + 148, w - 24, 100, on > 0.5
      ? { n: '', letter: 'V', name: 'Votre entreprise', hl: clamp(on), tagText: 'VOTRE PLACE', tagOn: 1, tagK: on }
      : { n: '', letter: '?', name: 'Votre entreprise ?', dashed: true, nameCol: C.grey });
    const p = prog(t, at, at + 0.55);
    ring(ctx, x + w - 130, y + 198, 30 + 110 * p, (1 - p) * (p > 0 ? 1 : 0), 4);
    ctx.restore();
  });
}

// ================================================================ S9  prompt 2 (40.62 - 51.85)
function sPrompt2(ctx, t) {
  promptHead(ctx, t, 2, 40.5, 40.64, TP2);
  const lk = sp(t, 40.8, SPRING.gentle);
  if (lk <= 0.003) return;
  ctx.save();
  ctx.globalAlpha *= clamp(lk * 1.6);
  ctx.translate(0, (1 - lk) * 420);
  listShell(ctx);
  const dead = [null, { at: 45.5, tag: "N'EXISTE PLUS" }, { at: 43.98, tag: 'ABANDONNÉ' }, { at: 47.0, tag: 'LIEN MORT' }];
  const move = sp(t, 49.3), gone = P(t, 49.2, 49.55);
  ROWS.forEach((o, i) => {
    const d = dead[i], s = d ? P(t, d.at, d.at + 0.28, E.outCubic) : 0;
    row(ctx, LIST.x, rowY(i), LIST.w, LIST.row, {
      ...o, strike: s, alpha: i === 2 ? 1 - gone : 1,
      tagText: d && t >= d.at + 0.1 ? d.tag : 'CONCURRENT', tagOn: d && t >= d.at + 0.1 ? 1 : 0, tagK: d ? 1 + 0.2 * wobble(t - d.at - 0.1, 2.6, 6) : 1,
    });
  });
  // "Vous" leaves the dashed slot and takes the abandoned tool's place
  const alt = t >= 50.25;
  const yy = lerp(rowY(4), rowY(2), move);
  if (move < 0.5) row(ctx, LIST.x, yy, LIST.w, LIST.row, { n: '?', letter: 'V', name: 'Vous', dashed: true, tagText: 'ABSENT' });
  else row(ctx, LIST.x, yy, LIST.w, LIST.row, { n: 3, letter: 'V', name: 'Vous', hl: 1, noRule: true, tagText: alt ? 'ALTERNATIVE' : '', tagOn: 1, tagK: 1 + 0.25 * wobble(t - 50.25, 2.4, 5) });
  if (alt) { const p = prog(t, 50.25, 50.95); ring(ctx, 540, rowY(2) + LIST.row / 2, 60 + 420 * p, 0.9 * (1 - p), 5); }
  // the dead link
  const k4 = sp(t, 47.2, SPRING.bouncy) * (1 - P(t, 48.5, 48.8));
  if (k4 > 0.003) {
    ctx.save();
    ctx.translate(700, rowY(3) - 96); ctx.rotate(0.06); ctx.scale(k4, k4);
    card(ctx, -160, -96, 320, 192, 26, { light: 1 });
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(-128 + i * 20, -66, 5, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fill(); }
    T(ctx, '404', 0, 26, 88, 700, MONO, C.white, 'center', 4);
    T(ctx, 'page introuvable', 0, 68, 26, 500, UI, C.grey, 'center');
    ctx.restore();
  }
  ctx.restore();
}

// ================================================================ S10  the idea: replace an outdated recommendation (51.85 - 57.3)
function sIdea(ctx, t) {
  pill(ctx, 540, 330, "L'IDÉE", { k: sp(t, 51.72, SPRING.bouncy), size: 40 });
  const x = 110, w = 860, h = 240;
  const ok = sp(t, 52.4, SPRING.gentle), old = t >= 54.3, stk = P(t, 54.3, 54.62, E.outCubic), dimK = P(t, 55.0, 55.4);
  if (ok > 0.003) {
    const y = 470 + (1 - ok) * 300;
    ctx.save();
    ctx.globalAlpha *= clamp(ok * 1.6) * (1 - 0.5 * dimK);
    card(ctx, x, y, w, h, 34);
    T(ctx, 'RECOMMANDATION', x + 44, y + 62, 24, 700, MONO, C.grey, 'left', 5);
    ctx.beginPath(); ctx.arc(x + 84, y + 152, 40, 0, TAU); ctx.fillStyle = '#3A3D47'; ctx.fill();
    T(ctx, 'C', x + 84, y + 166, 38, 700, MONO, C.white, 'center');
    T(ctx, 'Concurrent C', x + 150, y + 172, 60, 600, UI, old ? C.grey : C.white);
    ctx.fillStyle = C.grey; ctx.fillRect(x + 144, y + 150, (tw(ctx, 'Concurrent C', 60, 600, UI) + 12) * stk, 5);
    tag(ctx, x + w - 44, y + 62, 'DÉPASSÉE', { size: 26, on: 1, k: sp(t, 54.4, SPRING.bouncy) });
    ctx.restore();
  }
  const ak = sp(t, 54.9);
  if (ak > 0.003) { ctx.save(); ctx.globalAlpha *= clamp(ak * 2); icon.arrowUp(ctx, 540, 782 + (1 - ak) * -30, 34, C.coral, 9); ctx.restore(); }
  const nk = sp(t, 55.14, SPRING.bouncy);
  if (nk > 0.003) {
    const y = 858 + (1 - nk) * 320, done = t >= 56.18;
    ctx.save();
    ctx.globalAlpha *= clamp(nk * 1.6);
    glow(ctx, 540, y + h / 2, 640, C.coralRgb, 0.2, 1, 0.45);
    card(ctx, x, y, w, h, 34, { accent: 1 });
    T(ctx, 'NOUVELLE RECOMMANDATION', x + 44, y + 62, 24, 700, MONO, C.coral, 'left', 5);
    ctx.beginPath(); ctx.arc(x + 84, y + 152, 40, 0, TAU); ctx.fillStyle = C.coral; ctx.fill();
    T(ctx, 'V', x + 84, y + 166, 38, 700, MONO, C.white, 'center');
    T(ctx, 'Votre entreprise', x + 150, y + 172, 60, 600, UI, C.white);
    tag(ctx, x + w - 44, y + 62, 'AJOUTÉE', { size: 26, on: 1, k: done ? 1 + 0.25 * wobble(t - 56.18, 2.4, 5) : 0 });
    if (done) { const p = prog(t, 56.18, 57.0); ring(ctx, 540, y + h / 2, 120 + 420 * p, 0.9 * (1 - p), 5); burst(ctx, x + w - 110, y + 62, p, { r0: 50, r1: 210, seed: 7 }); }
    ctx.restore();
  }
}

// ================================================================ S11  prompt 3 (57.3 - 67.15)
function sPrompt3(ctx, t) {
  const lockA = sp(t, 57.32) * (1 - P(t, 58.3, 58.5));
  if (lockA > 0.003) promptCard(ctx, 90, 352, 900, 150, 3, { hl: 1, lock: 1, label: "CELUI QUE J'AI PROMIS", alpha: lockA });
  promptHead(ctx, t, 3, 57.18, 58.42, TP3);
  // professional sites, then the tools they all recommend, then the ranking and the "why"
  const order = [2, 0, 1], sort = sp(t, 63.45);          // card j ends in slot order[j]
  const hubK = sp(t, 61.38, SPRING.bouncy), hy = 640;
  const pos = SITE_X.map((x, j) => lerp(x, SITE_X[order[j]], sort));
  pos.forEach((x, j) => {
    const wp = P(t, 60.85 + j * 0.1, 61.45 + j * 0.1, E.outCubic);
    wire(ctx, x + 150, 880, x + 150, 800, 540 + (j - 1) * 60, hy + 150, wp, { dot: wp > 0 && wp < 1 ? wp : -1 });
  });
  if (hubK > 0.003) {
    ctx.save(); zoomAbout(ctx, hubK, 540, hy + 75);
    card(ctx, 270, hy, 540, 150, 40, { accent: 0.8 });
    T(ctx, 'MÊMES OUTILS', 310, hy + 60, 24, 700, MONO, C.coral, 'left', 5);
    ['A', 'B', 'C'].forEach((l, i) => {
      ctx.beginPath(); ctx.arc(336 + i * 66, hy + 104, 25, 0, TAU); ctx.fillStyle = '#3A3D47'; ctx.fill();
      T(ctx, l, 336 + i * 66, hy + 113, 24, 700, MONO, C.white, 'center');
    });
    T(ctx, 'ou services', 540, hy + 114, 30, 500, UI, C.grey);
    ctx.restore();
  }
  pos.forEach((x, j) => {
    const rank = order[j] + 1;
    siteCard(ctx, x, 880, 300, 196, sp(t, 59.36 + j * 0.3, SPRING.bouncy), { hl: rank === 1 && sort > 0.5 ? 1 : 0, rank, rankK: sp(t, 63.36 + order[j] * 0.1, SPRING.bouncy) });
  });
  const nk = sp(t, 64.6, SPRING.gentle);
  if (nk > 0.003) {
    const x = 110, y = 1112 + (1 - nk) * 200;
    ctx.save();
    ctx.globalAlpha *= clamp(nk * 1.6);
    card(ctx, x, y, 860, 196, 30, { accent: 0.6 });
    T(ctx, 'POURQUOI VOTRE OFFRE LES INTÉRESSE', x + 40, y + 58, 23, 700, MONO, C.coral, 'left', 3);
    [[0.62, 64.95], [0.48, 65.5], [0.3, 65.95]].forEach(([wd, at], i) => {
      rrect(ctx, x + 40, y + 88 + i * 32, 700 * wd * P(t, at, at + 0.5, E.outCubic), 13, 7); ctx.fillStyle = `rgba(255,255,255,${i ? 0.3 : 0.75})`; ctx.fill();
    });
    const ck = sp(t, 66.2, SPRING.bouncy);
    if (ck > 0) { ctx.beginPath(); ctx.arc(x + 790, y + 118, 34 * ck, 0, TAU); ctx.fillStyle = C.coral; ctx.fill(); icon.check(ctx, x + 790, y + 118, 17, '#fff', 6, prog(t, 66.2, 66.5)); }
    ctx.restore();
  }
}

// ================================================================ S12  "you now know where to look" (67.15 - 70.3)
function sWhere(ctx, t, IMG) {
  const bk = sp(t, 67.02, SPRING.gentle);
  ctx.save();
  ctx.globalAlpha *= clamp(bk * 1.6);
  ctx.translate(0, (1 - bk) * 200);
  browser(ctx, 230, 330, 620, 410, 'VOTRE SITE', IMG.siteThumb, { accent: 0.5 });
  ctx.restore();
  SITE_X.forEach((x, j) => {
    const at = [68.02, 68.34, 68.62][j];
    const wp = P(t, at - 0.45, at, E.outCubic);
    wire(ctx, 540, 744, 540 + (x + 150 - 540) * 0.3, 820, x + 150, 900, wp, { dot: wp > 0 && wp < 1 ? wp : -1 });
    siteCard(ctx, x, 900, 300, 196, sp(t, 67.6 + j * 0.12, SPRING.bouncy), { label: `PISTE 0${j + 1}`, hl: t >= at ? 1 : 0 });
    const p = prog(t, at, at + 0.6);
    ring(ctx, x + 150, 998, 40 + 160 * p, p > 0 ? 1 - p : 0, 5);
  });
}

// ================================================================ S13  "... without sending a single email" (70.3 - 74.4)
function sReady(ctx, t) {
  const ck = sp(t, 70.16, SPRING.gentle), x = 120, y = 350 + (1 - ck) * 200, w = 840;
  ctx.save();
  ctx.globalAlpha *= clamp(ck * 1.6);
  card(ctx, x, y, w, 110 + 3 * 112 + 16, 34);
  T(ctx, 'RECHERCHE PRÊTE', x + 48, y + 70, 26, 700, MONO, C.coral, 'left', 6);
  [['Pages où avoir votre place', 70.82], ['Recommandations dépassées', 71.32], ['Sites pros à contacter', 71.74]].forEach(([label, at], i) => {
    const cy = y + 110 + i * 112 + 52, k = sp(t, at, SPRING.bouncy);
    ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x + 36, cy - 54, w - 72, 2);
    ctx.beginPath(); ctx.arc(x + 82, cy, 30, 0, TAU); ctx.fillStyle = k > 0.01 ? C.coral : '#3A3D47'; ctx.fill();
    icon.check(ctx, x + 82, cy, 15, '#fff', 6, prog(t, at, at + 0.25));
    T(ctx, label, x + 140, cy + 15, 44, 600, UI, k > 0.01 ? C.white : C.grey);
  });
  ctx.restore();
  const mk = sp(t, 72.5, SPRING.bouncy);
  if (mk > 0.003) {
    ctx.save(); zoomAbout(ctx, mk, 540, 1010);
    icon.mail(ctx, 540, 1010, 150, C.white, 10);
    ctx.restore();
    const s = P(t, 73.3, 73.55, E.outCubic);
    if (s > 0) {
      ctx.beginPath(); ctx.moveTo(350, 1150); ctx.lineTo(350 + 380 * s, 1150 - 280 * s);
      ctx.lineWidth = 14; ctx.strokeStyle = C.coral; ctx.lineCap = 'round'; ctx.stroke();
    }
    pill(ctx, 540, 1250, '0 EMAIL ENVOYÉ', { size: 36, k: sp(t, 73.56, SPRING.bouncy) });
  }
}

// ================================================================ S14  "Careful: Claude spots the opportunities" (74.4 - 77.25)
function sRadar(ctx, t) {
  const pk = sp(t, 74.28, SPRING.bouncy);
  ctx.save(); M.shake(ctx, t, 74.5, 14, 5, 0.1);
  pill(ctx, 540, 350, 'ATTENTION', { k: pk, size: 46 });
  ctx.restore();
  const cx = 540, cy = 800;
  const wk = sp(t, 74.36, SPRING.bouncy) * (1 - P(t, 75.2, 75.42));
  if (wk > 0.003) { ctx.save(); zoomAbout(ctx, wk, cx, cy); glow(ctx, cx, cy, 380, C.coralRgb, 0.25); icon.warn(ctx, cx, cy - 20, 150, C.coral, 16); ctx.restore(); }
  for (let i = 0; i < 3; i++) {
    const ph = ((t - 75.5) / 1.5 + i / 3) % 1;
    if (t > 75.5 && ph >= 0) ring(ctx, cx, cy, 130 + 330 * ph, 0.55 * (1 - ph), 3);
  }
  [[-310, -150], [300, -200], [-250, 220], [330, 130], [20, -330], [60, 330]].forEach(([dx, dy], j) => {
    const at = 75.74 + j * 0.2, k = sp(t, at, SPRING.bouncy);
    if (k <= 0.003) return;
    ctx.save(); zoomAbout(ctx, k, cx + dx, cy + dy);
    glow(ctx, cx + dx, cy + dy, 90, C.coralRgb, 0.4);
    ctx.beginPath(); ctx.arc(cx + dx, cy + dy, 40, 0, TAU); ctx.fillStyle = '#23252C'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = C.coral; ctx.stroke();
    icon.link(ctx, cx + dx, cy + dy, 14, C.coral, 4);
    ctx.restore();
  });
  tile(ctx, cx, cy, 230, sp(t, 75.4, SPRING.bouncy));
}

// ================================================================ S15  "it does not add your link automatically" (77.25 - 81.2)
function sNotAuto(ctx, t) {
  const bk = sp(t, 77.12, SPRING.gentle), x = 110, y = 430 + (1 - bk) * 200, w = 860, h = 600;
  ctx.save();
  ctx.globalAlpha *= clamp(bk * 1.6);
  browser(ctx, x, y, w, h, "LE SITE DE QUELQU'UN D'AUTRE", null);
  rrect(ctx, x + 50, y + 110, 420, 26, 13); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
  [0.9, 0.82, 0.6].forEach((q, i) => { rrect(ctx, x + 50, y + 170 + i * 38, (w - 100) * q, 13, 7); ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill(); });
  // the slot where a link could go: it lights up as an idea, then stays empty
  const tryK = t >= 78.24 && t < 80.12 ? 0.5 + 0.5 * Math.sin((t - 78.24) * 9) : 0, no = t >= 80.12;
  const sx = x + 50, sy = y + 320, sw = w - 100, shh = 130;
  rrect(ctx, sx, sy, sw, shh, 26);
  ctx.fillStyle = `rgba(${C.coralRgb},${0.18 * tryK})`; ctx.fill();
  ctx.lineWidth = 3; ctx.setLineDash([14, 10]); ctx.strokeStyle = tryK > 0 ? `rgba(${C.coralRgb},${0.5 + 0.5 * tryK})` : 'rgba(245,242,236,0.45)'; ctx.stroke(); ctx.setLineDash([]);
  const col = no ? C.grey : tryK > 0 ? C.coral : C.grey;
  icon.link(ctx, sx + 70, sy + shh / 2, 20, col, 5);
  T(ctx, 'votre lien', sx + 124, sy + shh / 2 + 16, 48, 600, UI, col);
  const st = P(t, 80.12, 80.4, E.outCubic);
  if (st > 0) { ctx.fillStyle = C.grey; ctx.fillRect(sx + 118, sy + shh / 2, (tw(ctx, 'votre lien', 48, 600, UI) + 12) * st, 5); }
  tag(ctx, sx + sw - 30, sy + shh / 2, '0 LIEN AJOUTÉ', { size: 24, on: no ? 1 : 0, k: sp(t, 78.9, SPRING.bouncy) });
  [0.7, 0.5].forEach((q, i) => { rrect(ctx, x + 50, y + 496 + i * 38, (w - 100) * q, 13, 7); ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fill(); });
  ctx.restore();
  ctx.save(); M.shake(ctx, t, 80.12, 10, 9, 0.1);
  pill(ctx, 540, 1140, 'PAS AUTOMATIQUE', { size: 42, k: sp(t, 80.12, SPRING.bouncy) });
  ctx.restore();
}

// ================================================================ S16  plug the SEO tool into Claude (81.2 - 83.1)
function sPlug(ctx, t) {
  pill(ctx, 540, 400, 'POUR COMMENCER', { k: sp(t, 81.08, SPRING.bouncy), size: 38 });
  const cy = 760, sx = 740, on = t >= 82.6;
  const tip = kf(t, [[81.2, -60], [81.9, 470], [82.32, 450], [82.6, 632]], E.inOutCubic);
  if (on) glow(ctx, sx, cy, 520, C.coralRgb, 0.3 + 0.2 * wobble(t - 82.6, 2, 3));
  ctx.save(); M.shake(ctx, t, 82.6, 16, 3, 0.09);
  plug(ctx, tip, cy, 120, 'SEO');
  tile(ctx, sx, cy, 300, 1, { slots: true, glowA: on ? 0.5 : 0.2 });
  T(ctx, 'CLAUDE', sx, cy + 222, 34, 700, MONO, C.white, 'center', 12);
  ctx.restore();
  const p = prog(t, 82.6, 83.2);
  burst(ctx, sx - 150, cy, p, { n: 26, r0: 30, r1: 330, seed: 2 });
  ring(ctx, sx - 150, cy, 40 + 320 * p, on ? 1 - p : 0, 6);
}

// ================================================================ S17  the real walkthrough, then "share this video" (83.1 - 94.3)
function sTuto(ctx, t) {
  const img = clip('tuto', t);
  const enter = P(t, 82.92, 83.34, E.inOutCubic), k = sp(t, 89.95, SPRING.gentle);
  if (enter <= 0) return;
  if (enter < 1) {          // the plugged socket opens into the footage
    ring(ctx, 590, 760, enter * 2300 + 8, 1, 10);
    ctx.beginPath(); ctx.arc(590, 760, enter * 2300, 0, TAU); ctx.clip();
  }
  // the footage goes from full bleed to a card on the left
  const cw = lerp(1166, 470, k), ch = lerp(1920, 771, k), cxm = lerp(540, 315, k), cym = lerp(960, 800, k);
  ctx.save();
  ctx.translate(cxm, cym); ctx.rotate(-0.045 * k); ctx.scale(lerp(1.14, 1, enter), lerp(1.14, 1, enter));
  if (k > 0.02) for (let i = 3; i >= 1; i--) { rrect(ctx, -cw / 2 - i * 6, -ch / 2 - i * 3 + 20, cw + i * 12, ch + i * 10, 40 + i * 6); ctx.fillStyle = `rgba(0,0,0,${0.16 * k})`; ctx.fill(); }
  if (img) cover(ctx, img, -cw / 2, -ch / 2, cw, ch, { radius: 40 * k, zoom: 1 + 0.03 * prog(t, 83.1, 89.9) });
  if (k > 0.02) { rrect(ctx, -cw / 2 + 1.5, -ch / 2 + 1.5, cw - 3, ch - 3, 40 * k); ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,255,255,${0.4 * k})`; ctx.stroke(); }
  ctx.restore();
  const ov = 1 - k;
  if (ov > 0.003) {
    let g = ctx.createLinearGradient(0, 0, 0, 520);
    g.addColorStop(0, `rgba(0,0,0,${0.8 * ov})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, 520);
    g = ctx.createLinearGradient(0, 1150, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, `rgba(0,0,0,${0.7 * ov})`); g.addColorStop(1, `rgba(0,0,0,${0.9 * ov})`);
    ctx.fillStyle = g; ctx.fillRect(0, 1150, W, H - 1150);
    // step pill: three dots and the step's name
    const steps = [[83.1, 'Paramètres'], [85.7, 'Connecteurs'], [87.7, "Autoriser l'accès"]];
    let si = 0; steps.forEach((s, i) => { if (t >= s[0]) si = i; });
    const pk = sp(t, steps[si][0], SPRING.bouncy), label = steps[si][1];
    const lw = tw(ctx, label, 48, 600, UI), pw = lw + 250, ph = 104;
    ctx.save();
    ctx.globalAlpha *= ov;
    zoomAbout(ctx, lerp(0.8, 1, pk), 540, 330);
    card(ctx, 540 - pw / 2, 330 - ph / 2, pw, ph, ph / 2);
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(540 - pw / 2 + 56 + i * 34, 330, i === si ? 11 : 7, 0, TAU); ctx.fillStyle = i <= si ? C.coral : 'rgba(255,255,255,0.28)'; ctx.fill(); }
    T(ctx, label, 540 - pw / 2 + 176, 347, 48, 600, UI, C.white);
    ctx.restore();
    const ak = sp(t, 84.5, SPRING.bouncy) * (1 - P(t, 85.75, 86.0));
    pill(ctx, 540, 1250, 'EX. AHREFS', { size: 36, k: ak * ov });
  }
  // "Partagez cette vidéo avec un entrepreneur ..."
  if (k > 0.02) {
    const bx = 800, by = 600, pressed = t >= 90.52, bk = sp(t, 90.1, SPRING.bouncy);
    ctx.save(); zoomAbout(ctx, bk * (1 + 0.14 * wobble(t - 90.52, 2.4, 5)), bx, by);
    if (pressed) glow(ctx, bx, by, 240, C.coralRgb, 0.45);
    ctx.beginPath(); ctx.arc(bx, by, 100, 0, TAU); ctx.fillStyle = pressed ? C.coral : '#2B2D36'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = pressed ? 'rgba(255,255,255,0.5)' : `rgba(${C.coralRgb},0.8)`; ctx.stroke();
    const fly = P(t, 90.6, 91.35, E.inOutCubic);
    icon.plane(ctx, bx - 6, by + 6, 40, C.white, 6);
    ctx.restore();
    T(ctx, 'Partager', bx, by + 160, 36, 600, UI, C.white, 'center');
    if (fly > 0 && fly < 1) {
      const px = bx - 6 + Math.sin(fly * Math.PI) * 110, pyy = lerp(by + 6, 1000, fly);
      ctx.save(); ctx.translate(px, pyy); ctx.rotate(Math.PI * 0.62 * fly);
      glow(ctx, 0, 0, 70, '255,220,200', 0.5);
      icon.plane(ctx, 0, 0, 34, C.white, 6, 1);
      ctx.restore();
    }
    const fk = sp(t, 91.3, SPRING.bouncy);
    if (fk > 0.003) {
      const x = 560, y = 930, w = 470, h = 164;
      ctx.save(); zoomAbout(ctx, fk, x + w / 2, y + h / 2);
      card(ctx, x, y, w, h, 44, { accent: 0.7 });
      icon.user(ctx, x + 74, y + h / 2, 44);
      T(ctx, 'UN ENTREPRENEUR', x + 136, y + 70, 25, 700, MONO, C.coral, 'left', 3);
      T(ctx, 'visible sur Google', x + 136, y + 120, 35, 600, UI, C.white);
      ctx.restore();
      const sk = sp(t, 92.2, SPRING.bouncy);
      pill(ctx, x + w / 2, y + h + 76, 'ENVOYÉ', { size: 36, k: sk });
      const p = prog(t, 92.2, 92.8); ring(ctx, x + w / 2, y + h + 76, 60 + 150 * p, p > 0 ? 1 - p : 0, 4);
    }
  }
}

// ================================================================ S18  "comment IA" (94.3 - 95.65)
function sComment(ctx, t) {
  pill(ctx, 540, 470, 'COMMENTE', { k: sp(t, 94.18, SPRING.bouncy), size: 42 });
  const k = sp(t, 94.22, SPRING.gentle), x = 90, y = 570 + (1 - k) * 260, w = 900, h = 470;
  ctx.save();
  ctx.globalAlpha *= clamp(k * 1.6);
  card(ctx, x, y, w, h, 40);
  rrect(ctx, 540 - 40, y + 20, 80, 8, 4); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fill();
  T(ctx, 'Commentaires', 540, y + 92, 40, 600, UI, C.white, 'center');
  const n = t >= 95.1 ? 2 : t >= 94.96 ? 1 : 0, posted = t >= 95.42, pk = sp(t, 95.42, SPRING.bouncy);
  if (pk > 0.003) {       // the published comment
    ctx.save(); ctx.globalAlpha *= clamp(pk * 2); zoomAbout(ctx, lerp(0.7, 1, pk), x + 190, y + 220);
    icon.user(ctx, x + 86, y + 206, 42);
    T(ctx, 'vous', x + 150, y + 176, 26, 500, UI, C.grey);
    T(ctx, 'IA', x + 150, y + 252, 84, 800, UI, C.white, 'left', 4);
    ctx.restore();
  } else T(ctx, 'Soyez le premier à commenter', 540, y + 216, 32, 500, UI, C.grey, 'center');
  icon.user(ctx, x + 86, y + 370, 42);
  rrect(ctx, x + 150, y + 324, w - 200, 92, 46); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
  const typedStr = posted ? '' : 'IA'.slice(0, n);
  T(ctx, typedStr, x + 190, y + 388, 50, 700, UI, C.white, 'left', 2);
  if (!posted) { ctx.fillStyle = C.coral; ctx.fillRect(x + 194 + tw(ctx, typedStr, 50, 700, UI, 2), y + 344, 4, 54); }
  const on = t >= 95.38, bx = x + w - 150;
  rrect(ctx, bx - 86, y + 336, 172, 68, 34); ctx.fillStyle = n && !posted ? C.coral : '#41444F'; ctx.fill();
  T(ctx, 'Publier', bx, y + 382, 34, 600, UI, '#fff', 'center');
  const p = prog(t, 95.38, 95.9);
  ring(ctx, bx, y + 370, 60 + 110 * p, on ? 1 - p : 0, 6);
  ctx.restore();
}

// ================================================================ S19  "I send you the connector and the 3 prompts" (95.65 - end)
function sMessage(ctx, t) {
  const k = sp(t, 95.86, SPRING.gentle), x = 90, y = 520 + (1 - k) * 200, w = 900, h = 590;
  ctx.save();
  ctx.globalAlpha *= clamp(k * 1.6);
  glow(ctx, 540, y + h / 2, 760, C.coralRgb, 0.14, 1, 0.6);
  card(ctx, x, y, w, h, 40, { accent: 0.7 });
  T(ctx, 'NOUVEAU MESSAGE', x + 48, y + 72, 26, 700, MONO, C.coral, 'left', 6);
  T(ctx, 'Voici pour vous', x + 46, y + 138, 50, 500, UI, C.white);
  const inner = (iy, at, drawIcon, title, sub, button) => {
    const ik = sp(t, at, SPRING.bouncy);
    if (ik <= 0.003) return;
    ctx.save();
    ctx.globalAlpha *= clamp(ik * 1.6);
    zoomAbout(ctx, lerp(0.85, 1, ik), 540, iy + 85);
    card(ctx, x + 30, iy, w - 60, 170, 30, { light: 1 });
    drawIcon(x + 108, iy + 85);
    T(ctx, title, x + 180, iy + 82, 50, 700, UI, C.white);
    T(ctx, sub, x + 180, iy + 128, 30, 500, UI, C.grey);
    if (button) button(x + w - 160, iy + 85);
    ctx.restore();
  };
  inner(y + 180, 96.5, (cx, cy) => sparkDisc(ctx, cx, cy, 46), 'Connecteur SEO', 'pour Claude');
  inner(y + 376, 97.66, (cx, cy) => { ctx.beginPath(); ctx.arc(cx, cy, 46, 0, TAU); ctx.fillStyle = '#34363F'; ctx.fill(); icon.doc(ctx, cx, cy, 20, C.coral, 3.5); },
    '3 prompts', 'à copier-coller', (bx, by) => {
      const done = t >= 98.5, bw = done ? 196 : 180, kk = 1 + 0.16 * wobble(t - 98.5, 2.4, 5);
      ctx.save(); zoomAbout(ctx, kk, bx, by);
      if (!done) glow(ctx, bx, by, 150, C.coralRgb, 0.4);
      rrect(ctx, bx - bw / 2, by - 40, bw, 80, 40); ctx.fillStyle = done ? '#FFFFFF' : C.coral; ctx.fill();
      if (done) { icon.check(ctx, bx - 62, by, 13, C.coral, 5); T(ctx, 'Copié', bx + 18, by + 13, 36, 600, UI, C.ink, 'center'); }
      else T(ctx, 'Copier', bx, by + 13, 36, 600, UI, '#fff', 'center');
      ctx.restore();
      const p = prog(t, 98.5, 99.1); ring(ctx, bx, by, 60 + 130 * p, done ? 1 - p : 0, 5);
    });
  ctx.restore();
}

// ================================================================ the edit: shots joined by whip pans
// Each shot ends at b; `out` is where it leaves to (the next shot enters from the opposite side, at the
// same speed, so the cut reads as one camera pan with both shots on screen).
const SHOTS = [
  { b: 5.45, fn: sIntro, out: [0, -1] },
  { b: 7.42, fn: sThree, out: [-1, 0] },
  { b: 13.3, fn: sObjective, out: [0, -1] },
  { b: 15.4, fn: sSEO, out: [0, -1] },
  { b: 20.62, fn: sTeaser, out: [-1, 0] },
  { b: 25.25, fn: sConnect, out: [0, -1] },
  { b: 36.2, fn: sPrompt1, out: [0, -1] },
  { b: 40.62, fn: sPages, out: [-1, 0] },
  { b: 51.85, fn: sPrompt2, out: [0, -1] },
  { b: 57.3, fn: sIdea, out: [-1, 0] },
  { b: 67.15, fn: sPrompt3, out: [0, -1] },
  { b: 70.3, fn: sWhere, out: [0, -1] },
  { b: 74.4, fn: sReady, out: [-1, 0] },
  { b: 77.25, fn: sRadar, out: [0, -1] },
  { b: 81.2, fn: sNotAuto, out: [-1, 0] },
  { b: 83.1, fn: sPlug, out: 'hold' },
  { b: 94.3, fn: sTuto, out: [-1, 0] },
  { b: 96.0, fn: sComment, out: [0, -1] },
  { b: 999, fn: sMessage, out: null },
];
const PAN = 0.34;
function shots(ctx, t, IMG) {
  SHOTS.forEach((s, i) => {
    const a = i ? SHOTS[i - 1].b : -99, prevOut = i ? SHOTS[i - 1].out : null;
    if (t < a - PAN / 2 || t >= s.b + PAN / 2) return;
    ctx.save();
    const pi = P(t, a - PAN / 2, a + PAN / 2), po = P(t, s.b - PAN / 2, s.b + PAN / 2);
    if (pi < 1 && Array.isArray(prevOut)) ctx.translate(-prevOut[0] * (1 - pi) * W, -prevOut[1] * (1 - pi) * H);
    if (po > 0 && Array.isArray(s.out)) ctx.translate(s.out[0] * po * W, s.out[1] * po * H);
    if (po > 0 && s.out === 'zoom') { zoomAbout(ctx, 1 + 1.6 * po, 620, 760); ctx.globalAlpha *= 1 - po; }
    // a slow handheld float so nothing ever sits perfectly still
    ctx.translate(540, 960); ctx.rotate(0.0045 * noise1(t * 0.3, 11 + i)); ctx.translate(-540 + 4 * noise1(t * 0.33, 31), -960 + 6 * noise1(t * 0.4, 17));
    zoomAbout(ctx, 1 + 0.035 * prog(t, Math.max(a, 0), s.b), 540, 820);
    s.fn(ctx, t, IMG);
    ctx.restore();
  });
}

// ================================================================ sound: every visual accent, in seconds
const pan = (t) => [t, 'pan', 'whoosh', { len: 0.42, gain: 0.22 }];
const HITS = [
  [0, 'title', 'impact', { gain: 0.5 }],
  [1.25, 'frame: astronaut', 'whoosh', { len: 0.3, gain: 0.18 }], [1.66, 'EST SORTI', 'pop', { pitch: 'A5' }],
  [3.4, 'frame: earth', 'whoosh', { len: 0.3, gain: 0.18 }], [3.55, 'search typing', 'type', { len: 1.0, gain: 0.12 }], [4.76, 'Google', 'blip', { pitch: 'E6' }],
  pan(5.45), [5.5, '3', 'thud'], [5.78, 'PROMPTS', 'pop', { pitch: 'D5' }], [5.6, 'card 1', 'click'], [5.8, 'card 2', 'click'], [6.0, 'card 3', 'click'],
  pan(7.42), [7.5, 'objectif', 'pop', { pitch: 'A5' }], [8.0, 'claude tile', 'tok', { pitch: 'D5' }], [9.5, 'results card', 'click'],
  [11.0, 'rank 3', 'tick'], [11.72, 'rank 2', 'tick'], [12.4, 'rank 1', 'bell', { pitch: 'D6' }],
  pan(13.3), [13.4, 'référencement naturel', 'click'], [14.18, 'SEO', 'impact', { gain: 0.55 }],
  pan(15.4), [15.74, 'prompt 3 highlight', 'pop', { pitch: 'E5' }], [16.0, 'lock', 'click'],
  [17.45, 'site 1', 'blip', { pitch: 'A5' }], [17.69, 'site 2', 'blip', { pitch: 'C6' }], [17.93, 'site 3', 'blip', { pitch: 'E6' }],
  [18.72, 'chip 1', 'tick'], [19.0, 'chip 2', 'tick'], [19.24, 'chip 3', 'tick'],
  pan(20.62), [21.5, 'plug in', 'whoosh', { len: 0.6, gain: 0.18, from: 300, to: 1200 }], [23.3, 'timeline', 'click'], [24.25, 'à la fin', 'bell', { pitch: 'A5' }],
  pan(25.25), [25.32, 'prompt 01', 'pop', { pitch: 'A5' }], [26.5, 'site card', 'click'], [26.56, 'typing', 'type', { len: 0.9, gain: 0.1 }],
  [27.94, 'typing', 'type', { len: 4.0, gain: 0.1 }], [29.5, 'list', 'whoosh', { len: 0.35, gain: 0.18 }],
  [32.84, 'typing', 'type', { len: 2.9, gain: 0.1 }], [33.0, 'tag A', 'tick'], [33.2, 'tag B', 'tick'], [33.4, 'tag C', 'tick'], [33.6, 'tag D', 'tick'],
  [34.1, 'ranking', 'whoosh', { len: 0.35, gain: 0.18 }], [34.62, 'sorted', 'pop', { pitch: 'D5' }], [36.0, 'sent', 'blip', { pitch: 'A5' }],
  pan(36.2), [36.44, 'page 1', 'click'], [36.88, 'page 2', 'click'], [37.32, 'page 3', 'click'],
  [38.42, 'place 1', 'blip', { pitch: 'A5' }], [38.96, 'place 2', 'blip', { pitch: 'C6' }], [39.5, 'place 3', 'blip', { pitch: 'E6' }],
  pan(40.62), [40.74, 'prompt 02', 'pop', { pitch: 'A5' }], [42.14, 'typing', 'type', { len: 5.9, gain: 0.1 }],
  [43.98, 'abandonné', 'tick'], [45.5, "n'existe plus", 'tick'], [47.0, 'lien mort', 'tick'], [47.2, '404', 'thud', { gain: 0.3 }],
  [48.46, 'typing', 'type', { len: 2.9, gain: 0.1 }], [49.3, 'vous moves', 'whoosh', { len: 0.35, gain: 0.16 }], [50.25, 'alternative', 'bell', { pitch: 'D6' }],
  pan(51.85), [52.0, "l'idée", 'pop', { pitch: 'A5' }], [52.4, 'old card', 'click'], [54.3, 'dépassée', 'tick'], [55.14, 'new card', 'pop', { pitch: 'D5' }], [56.18, 'ajoutée', 'bell', { pitch: 'A5' }],
  pan(57.3), [57.44, 'prompt 03', 'pop', { pitch: 'A5' }], [57.62, 'promised', 'click'], [58.66, 'typing', 'type', { len: 4.0, gain: 0.1 }],
  [59.36, 'site 1', 'blip', { pitch: 'A5' }], [59.66, 'site 2', 'blip', { pitch: 'C6' }], [59.96, 'site 3', 'blip', { pitch: 'E6' }],
  [61.38, 'same tools', 'tok', { pitch: 'D5' }], [63.4, 'ranked', 'pop', { pitch: 'E5' }], [63.92, 'typing', 'type', { len: 2.6, gain: 0.1 }], [64.6, 'why card', 'click'], [66.2, 'why done', 'bell', { pitch: 'D6' }],
  pan(67.15), [68.02, 'piste 1', 'blip', { pitch: 'A5' }], [68.34, 'piste 2', 'blip', { pitch: 'C6' }], [68.62, 'piste 3', 'blip', { pitch: 'E6' }],
  pan(70.3), [70.82, 'check 1', 'tick'], [71.32, 'check 2', 'tick'], [71.74, 'check 3', 'tick'], [72.5, 'mail', 'pop', { pitch: 'D5' }], [73.3, 'mail struck', 'thud', { gain: 0.3 }], [73.56, '0 email', 'click'],
  pan(74.4), [74.5, 'attention', 'thud'], [75.4, 'claude tile', 'tok', { pitch: 'D5' }],
  [75.74, 'lead 1', 'blip', { pitch: 'A5' }], [75.94, 'lead 2', 'blip', { pitch: 'B5' }], [76.14, 'lead 3', 'blip', { pitch: 'C6' }], [76.34, 'lead 4', 'blip', { pitch: 'D6' }], [76.54, 'lead 5', 'blip', { pitch: 'E6' }], [76.74, 'lead 6', 'blip', { pitch: 'G6' }],
  pan(77.25), [78.24, 'link slot', 'tick'], [80.12, 'pas automatique', 'thud'],
  pan(81.2), [81.3, 'pour commencer', 'pop', { pitch: 'A5' }], [82.6, 'plugged', 'impact', { gain: 0.5 }],
  [83.1, 'walkthrough', 'whoosh', { len: 0.5, gain: 0.22 }], [85.7, 'step 2', 'click'], [87.7, 'step 3', 'click'],
  [89.95, 'to card', 'whoosh', { len: 0.5, gain: 0.2 }], [90.52, 'share', 'pop', { pitch: 'E5' }], [91.3, 'friend', 'blip', { pitch: 'C6' }], [92.2, 'sent', 'bell', { pitch: 'A5' }],
  pan(94.3), [94.4, 'commente', 'pop', { pitch: 'A5' }], [94.96, 'IA', 'type', { len: 0.25, gain: 0.14 }], [95.38, 'publier', 'click'],
  [95.42, 'posted', 'pop', { pitch: 'E5' }], pan(96.0), [96.5, 'connector', 'click'], [97.66, 'prompts', 'click'], [98.5, 'copied', 'bell', { pitch: 'D6' }],
];

// ================================================================ go
await M.film({
  fonts: [font(100, 600, DISPLAY), font(40, 500, UI), font(40, 700, UI), font(40, 900, UI), font(30, 700, MONO)],
  images: { earth: 'assets/img/earth.jpg', banner: 'assets/img/banner.jpg', siteThumb: 'assets/clips/site/0001.jpg' },
  hits: HITS,
  samples: 8,
  draw(ctx, u, t, IMG) {
    background(ctx, t, IMG);
    shots(ctx, t, IMG);
    captions(ctx, t);
  },
});
// seek() must return only once the clip frames for t are decoded; the renderer awaits it.
const paint = window.seek;
window.seek = async (t) => { await ensureFrames(t); paint(t); };
await window.seek(0);
