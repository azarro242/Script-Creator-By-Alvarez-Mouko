// Meta Ads x Claude - la méthode. A pure function of time: window.seek(t) paints frame t.
// The voice-over is the clock: beats.json has period 1, so u (beats) === t (seconds) everywhere.
// Look: the sky background, top-left titles and travelling frame of the second reference, with the
// coral accent, word-by-word captions and typed prompts of the first film. docs/shotlist.md is the plan.
import * as M from './lib/motion.js';
import { WORDS } from './words.js';
import { C, UI, MONO, sp, P, T, tw, glow, card, pill, spark, sparkDisc, icon, ring, wire } from './ui.js';
import { L, wcard, wtag, checkbox, toggle, loop, lbar, numDot, thumb } from './light.js';

const { W, H, TAU, E, clamp, lerp, prog, bump, kf, springKeys, SPRING, wobble, hash01, noise1, font, fitSize, rrect, cover, zoomAbout } = M;

// ================================================================ clips (frame sequences)
// assets/clips/<name>/NNNN.jpg at 30 fps. clipAt maps film time to clip time (null = not on screen);
// seek() awaits the frames it needs before drawing, so draw stays pure.
const CLIPS = { meta: 239, holo: 229, claude: 265, ask: 287, conn: 240, higgs: 117 };
const clipAt = {
  meta: (t) => (t < 5.3 ? 1.7 + Math.max(t, 0) * 0.5 : t >= 38.9 && t < 43.2 ? 2.4 + (t - 39.4) * 0.6 : null),
  claude: (t) => (t >= 4.6 && t < 9.9 ? 0.4 + (t - 4.95) : t >= 62.8 ? 3.0 + (t - 63.4) * 0.95 : null),
  holo: (t) => (t >= 9.1 && t < 13.1 ? 0.3 + (t - 9.5) : t >= 30.4 && t < 36.6 ? 2.4 + (t - 30.8) * 0.9 : null),
  higgs: (t) => (t >= 35.0 && t < 39.95 ? Math.max(0, (t - 35.5) * 0.9) : null),
  conn: (t) => (t >= 12.3 && t < 21.8 ? 0.2 + (t - 12.7) * 0.87 : null),
  ask: (t) => (t >= 21.0 && t < 31.2 ? kf(t, [[21.4, 0.6], [23.9, 1.7], [25.0, 3.4], [27.5, 6.9], [30.8, 9.3]], E.linear) : null),
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

// ================================================================ captions: word by word, the spoken word boxed in coral
const CAPS = (() => {
  const chunks = [];
  let cur = [];
  WORDS.forEach((w, i) => {
    const prev = WORDS[i - 1];
    const len = cur.reduce((n, x) => n + x[0].length + 1, 0);
    if (cur.length && (/[.,?!]$/.test(prev[0]) || cur.length >= 4 || len + w[0].length > 20 || w[1] - prev[2] > 0.45)) { chunks.push(cur); cur = []; }
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
  let size = 66;
  const wFull = tw(ctx, full, size, 700, UI) + 30 * (c.ws.length - 1);
  if (wFull > 940) size = Math.floor((size * 940) / wFull);
  const f = font(size, 700, UI);
  ctx.font = f;
  const gap = ctx.measureText(' ').width + 14;
  const widths = c.ws.map((x) => ctx.measureText(x.w).width);
  let x = 540 - (widths.reduce((a, b) => a + b, 0) + gap * (c.ws.length - 1)) / 2;
  const base = 1492;
  c.ws.forEach((wd, i) => {
    const ww = widths[i], a = prog(t, wd.s - 0.07, wd.s + 0.03);
    if (a > 0) {
      const next = c.ws[i + 1], active = !next || t < next.s - 0.02;
      const k = M.spring(t - wd.s + 0.07, SPRING.snappy);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(x + ww / 2, base + (1 - k) * 16);
      if (active) {
        const bw = ww + 30, bh = size * 1.3;
        rrect(ctx, -bw / 2, -size * 0.93, bw, bh, 18); ctx.fillStyle = C.coral; ctx.fill();
      }
      ctx.font = f; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
      if (!active) { ctx.lineWidth = 12; ctx.strokeStyle = 'rgba(10,58,140,0.42)'; ctx.strokeText(wd.w, 0, 0); }
      ctx.fillStyle = '#fff'; ctx.fillText(wd.w, 0, 0);
      ctx.restore();
    }
    x += ww + gap;
  });
}

// ================================================================ background: the sky, drifting
const WISPS = Array.from({ length: 7 }, (_, i) => ({ x: hash01(i, 41) * 1900, y: 250 + hash01(i, 42) * 1300, r: 260 + hash01(i, 43) * 320, v: 9 + hash01(i, 44) * 16, a: 0.1 + hash01(i, 45) * 0.1 }));
function background(ctx, t, IMG) {
  ctx.fillStyle = '#5FAEF5'; ctx.fillRect(0, 0, W, H);
  const s = 1.3;
  if (IMG.sky) ctx.drawImage(IMG.sky, -(1001 * s - W) / 2 + 36 * Math.sin(t * 0.06), -40 - t * 1.6, 1001 * s, 2000 * s);
  for (const c of WISPS) {
    const x = ((c.x + t * c.v) % 1900) - 400;
    glow(ctx, x, c.y + 14 * Math.sin(t * 0.2 + c.x), c.r, '255,255,255', c.a, 1, 0.32);
  }
  let g = ctx.createLinearGradient(0, 0, 0, 760);      // deeper blue behind the title
  g.addColorStop(0, 'rgba(14,92,214,0.5)'); g.addColorStop(1, 'rgba(14,92,214,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, 760);
  g = ctx.createLinearGradient(0, 1120, 0, H);         // and behind the captions
  g.addColorStop(0, 'rgba(20,100,222,0)'); g.addColorStop(0.5, 'rgba(20,100,222,0.5)'); g.addColorStop(1, 'rgba(16,84,200,0.75)');
  ctx.fillStyle = g; ctx.fillRect(0, 1120, W, H - 1120);
}

// ================================================================ title block (top left): coral chip + two white lines
const TITLES = [
  { t: -9, chip: 'META ADS', l1: 'Quelle pub ramène', l2: 'des clients ?' },
  { t: 4.95, chip: 'NOUVEAU', l1: 'Connecte Meta Ads', l2: 'à Claude' },
  { t: 9.5, chip: 'LA SUITE', l1: 'Le plus intéressant', l2: 'vient après' },
  { t: 12.7, chip: 'ÉTAPE 01', l1: 'Connecte tes', l2: 'données pub' },
  { t: 18.0, chip: 'ÉTAPE 01', l1: 'Vérifie', l2: 'les accès' },
  { t: 21.4, chip: 'ÉTAPE 02', l1: 'Pose-lui', l2: '3 questions' },
  { t: 30.8, chip: 'ÉTAPE 03', l1: '3 accroches', l2: '+ 3 scripts' },
  { t: 35.45, chip: 'ÉTAPE 04', l1: 'Crée plusieurs', l2: 'versions' },
  { t: 39.55, chip: 'ÉTAPE 05', l1: 'Lance', l2: 'ton test' },
  { t: 42.05, chip: 'ÉTAPE 05', l1: 'Laisse tourner,', l2: 'puis reviens' },
  { t: 46.4, chip: 'ÉTAPE 06', l1: 'Analyse', l2: 'les résultats' },
  { t: 51.15, chip: 'LA MÉTHODE', l1: 'Une méthode', l2: 'simple' },
  { t: 56.2, chip: 'À TON TOUR', l1: 'Commente', l2: '« IA »' },
  { t: 63.4, chip: 'EN RÉSUMÉ', l1: 'Connecte. Analyse.', l2: 'Crée.' },
];
function titleBlock(ctx, x, alpha, dy, chipK) {
  if (alpha <= 0.003) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  const cw = tw(ctx, x.chip, 35, 700, MONO, 5) + 64;
  pill(ctx, 64 + cw / 2, 268 + dy * 0.6, x.chip, { size: 35, padX: 32, k: chipK, glowA: 0.3 });
  const size = Math.min(98, fitSize(ctx, x.l1.length > x.l2.length ? x.l1 : x.l2, 700, UI, 940, 98));
  [x.l1, x.l2].forEach((line, i) => {
    const y = 392 + i * size * 1.1 + dy * (1 + i * 0.35);
    T(ctx, line, 64, y + 5, size, 700, UI, 'rgba(8,52,130,0.3)', 'left', -1);
    T(ctx, line, 62, y, size, 700, UI, '#fff', 'left', -1);
  });
  ctx.restore();
}
function titles(ctx, t) {
  let i = 0;
  TITLES.forEach((x, k) => { if (t >= x.t - 0.14) i = k; });
  const cur = TITLES[i], prev = TITLES[i - 1];
  const p = i ? P(t, cur.t - 0.14, cur.t + 0.2) : 1;
  const sameChip = prev && prev.chip === cur.chip;
  if (prev && p < 1) titleBlock(ctx, prev, clamp(1 - p * 1.7), -80 * p, 1);
  titleBlock(ctx, cur, clamp((p - 0.25) / 0.75), (1 - p) * 90, sameChip || !i ? 1 : sp(t, cur.t - 0.02, SPRING.bouncy));
}

// ================================================================ the frame: one white panel that travels, resizes and flips
// Each segment is a list of [time, [cx, cy, w, h, rotation in degrees]] steps chased by a spring.
const SEGS = [
  { a: -99, b: 43.1, keys: [
    [-9, [540, 1010, 640, 800, -2.5]], [1.7, [300, 930, 430, 538, -5]], [4.9, [540, 830, 900, 506, 1.5]],
    [9.45, [770, 1010, 420, 747, 4]], [12.65, [540, 950, 940, 741, -1.5]], [16.2, [540, 896, 840, 662, 1]],
    [17.95, [760, 770, 520, 410, 3]], [21.35, [540, 818, 960, 504, -2]], [23.8, [610, 766, 760, 399, 2]],
    [30.75, [260, 980, 370, 658, -4]], [35.38, [540, 762, 940, 388, 1.5]], [39.45, [320, 940, 480, 600, -3]], [41.95, [-480, 940, 480, 600, -12]],
  ] },
  { a: 62.8, b: 999, keys: [[62.8, [540, -460, 900, 506, 0]], [63.25, [540, 840, 900, 506, 1.5]]] },
];
const CONTENT = [[-9, 'meta'], [4.95, 'claude'], [9.5, 'holo'], [12.7, 'conn'], [21.4, 'ask'], [30.8, 'holo'], [35.45, 'higgs'], [39.55, 'meta'], [50, 'claude']];
const FLIPS = [4.95, 9.5, 12.7, 21.4, 30.8, 35.45, 39.55];
function frame(ctx, t) {
  const seg = SEGS.find((s) => t >= s.a && t < s.b);
  if (!seg) return;
  const [cx, cy, w, h, rot] = springKeys(t, seg.keys, { stiffness: 150, damping: 21 });
  if (cx < -w || cx > W + w || cy < -h) return;
  let name = 'meta';
  CONTENT.forEach(([at, n]) => { if (t >= at) name = n; });
  let flip = 1;
  for (const f of FLIPS) { const q = prog(t, f - 0.17, f + 0.17); if (q > 0 && q < 1) flip = Math.max(0.02, Math.abs(1 - 2 * E.inOutCubic(q))); }
  const img = clip(name, t), r = 38, rim = 13;
  ctx.save();
  ctx.translate(cx + 7 * noise1(t * 0.35, 3), cy + 10 * noise1(t * 0.31, 7));
  ctx.rotate(((rot + 1.1 * Math.sin(t * 0.8)) * Math.PI) / 180);
  ctx.scale(flip, 1);
  for (let i = 4; i >= 1; i--) { rrect(ctx, -w / 2 - rim - i * 7, -h / 2 - rim - i * 2 + 26, w + 2 * rim + i * 14, h + 2 * rim + i * 10, r + rim + i * 7); ctx.fillStyle = 'rgba(10,54,134,0.07)'; ctx.fill(); }
  rrect(ctx, -w / 2 - rim, -h / 2 - rim, w + 2 * rim, h + 2 * rim, r + rim);
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.stroke();
  rrect(ctx, -w / 2, -h / 2, w, h, r); ctx.fillStyle = name === 'claude' || name === 'higgs' ? '#000' : '#fff'; ctx.fill();
  const look = name === 'conn' ? { zoom: kf(t, [[12.7, 1.12], [14.3, 1.12], [15.6, 1.8]]), fx: 0.3, fy: 0.04 }
    : name === 'ask' ? { zoom: 1.1, fx: 0.5, fy: 0.12 } : { zoom: 1.02, fx: 0.5, fy: 0.5 };
  if (img) cover(ctx, img, -w / 2, -h / 2, w, h, { radius: r, ...look });
  ctx.restore();
}

// ================================================================ shared pieces
function adCard(ctx, x, y, w, i, { alpha = 1, tagK = 1, spend, tagText = '? clients', tagKind = 'coral' } = {}) {
  const h = 186;
  wcard(ctx, x, y, w, h, 30, { alpha });
  if (alpha <= 0.003) return;
  ctx.save(); ctx.globalAlpha *= alpha;
  thumb(ctx, x + 18, y + 18, 150, 150, 24, i);
  T(ctx, `Pub ${'ABC'[i]}`, x + 190, y + 66, 46, 700, UI, L.ink);
  if (spend) T(ctx, spend, x + 190, y + 108, 29, 500, UI, L.sub);
  wtag(ctx, x + 190, y + 146, tagText, { kind: tagKind, k: tagK, align: 'left', size: 23 });
  ctx.restore();
}
function claudeTile(ctx, cx, cy, s, k, t) {
  if (k <= 0.003) return;
  ctx.save(); zoomAbout(ctx, k, cx, cy);
  glow(ctx, cx, cy, s * 1.2, C.coralRgb, 0.22);
  card(ctx, cx - s / 2, cy - s / 2, s, s, s * 0.26, { accent: 1 });
  spark(ctx, cx, cy, s * 0.3, C.coral, t * 0.25);
  ctx.restore();
}
const SPEND = ['18 € / jour', '22 € / jour', '10 € / jour'];

// ================================================================ S1  the hook (0 - 4.95)
function sHook(ctx, t) {
  const sk = sp(t, 0.12, SPRING.bouncy), mv = sp(t, 1.7, SPRING.gentle);
  const px = lerp(590, 96, mv), py = lerp(1300, 1240, mv), euros = Math.round(50 * prog(t, 0.2, 1.55));
  ctx.save(); zoomAbout(ctx, sk, px + 200, py + 62);
  wcard(ctx, px, py, 400, 124, 62);
  loop(ctx, px + 66, py + 62, 30, 9);
  T(ctx, 'Dépense du jour', px + 118, py + 50, 27, 500, UI, L.sub);
  T(ctx, `${euros} €`, px + 118, py + 100, 46, 800, UI, L.ink);
  ctx.restore();
  for (let i = 0; i < 3; i++) {
    const k = sp(t, 1.9 + i * 0.2, SPRING.bouncy);
    if (k <= 0.003) continue;
    const pulse = 1 + 0.2 * wobble(t - 3.42 - i * 0.28, 2.6, 6) + 0.25 * wobble(t - 4.32, 2.4, 5);
    adCard(ctx, 550 + (1 - k) * 560, 640 + i * 208, 462, i, { alpha: clamp(k * 1.6), spend: SPEND[i], tagK: pulse });
  }
  const qk = sp(t, 4.3, SPRING.bouncy);
  if (qk > 0.003) {
    const p = prog(t, 4.3, 4.95);
    ring(ctx, 300, 930, 90 + 220 * p, 1 - p, 6);
    numDot(ctx, 300, 930, 74, '?', C.coral, qk);
  }
}

// ================================================================ S2  connect the ad account to Claude and ask (4.95 - 9.5)
const ASK0 = 'Quelle pub me ramène des clients ?';
function sConnect(ctx, t) {
  const y = 1118, k1 = sp(t, 5.2, SPRING.bouncy), k2 = sp(t, 5.42, SPRING.bouncy);
  const link = P(t, 5.9, 6.85), on = t >= 6.86;
  if (link > 0) {
    ctx.beginPath(); ctx.moveTo(450, y + 58); ctx.lineTo(450 + 180 * link, y + 58);
    ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.strokeStyle = on ? C.coral : 'rgba(255,255,255,0.9)'; ctx.stroke();
  }
  ctx.save(); zoomAbout(ctx, k1, 265, y + 58);
  wcard(ctx, 80, y, 370, 116, 58);
  loop(ctx, 146, y + 58, 34, 10);
  T(ctx, 'Meta Ads', 200, y + 74, 46, 700, UI, L.ink);
  ctx.restore();
  ctx.save(); zoomAbout(ctx, k2, 815, y + 58);
  card(ctx, 630, y, 370, 116, 58, { accent: on ? 1 : 0.35 });
  sparkDisc(ctx, 694, y + 58, 36);
  T(ctx, 'Claude', 750, y + 74, 46, 700, UI, C.white);
  ctx.restore();
  if (on) {
    const p = prog(t, 6.86, 7.5), k = sp(t, 6.86, SPRING.bouncy);
    ring(ctx, 540, y + 58, 40 + 130 * p, 1 - p, 5);
    ctx.save(); zoomAbout(ctx, k, 540, y + 58);
    ctx.beginPath(); ctx.arc(540, y + 58, 40, 0, TAU); ctx.fillStyle = C.coral; ctx.fill();
    icon.link(ctx, 540, y + 58, 15, '#fff', 4.5);
    ctx.restore();
  }
  const bk = sp(t, 7.3);
  if (bk > 0.003) {
    ctx.save(); ctx.translate(0, (1 - bk) * 80);
    lbar(ctx, 80, 1276, 920, 116, ASK0, ASK0.length * prog(t, 7.45, 8.75), t, { sent: t >= 8.9 ? 1 : 0, pulse: bump(t, 9.0, 0.25), alpha: clamp(bk * 1.6), size: 42, dark: 1 });
    ctx.restore();
  }
}

// ================================================================ S3  "the best part comes after" (9.5 - 12.7)
const STEPS = ['Analyser', 'Créer', 'Tester', 'Améliorer'];
function sAfter(ctx, t) {
  STEPS.forEach((s, i) => {
    const k = sp(t, 9.95 + i * 0.28, SPRING.bouncy);
    if (k <= 0.003) return;
    const x = 70 - (1 - k) * 500, y = 640 + i * 186, lit = t >= 11.9 + i * 0.12;
    wcard(ctx, x, y, 440, 150, 40, { alpha: clamp(k * 1.6), accent: lit ? 1 : 0 });
    numDot(ctx, x + 76, y + 75, 38, i + 1, lit ? C.coral : '#B4C0D2', 1 + 0.2 * wobble(t - 11.9 - i * 0.12, 2.6, 6));
    T(ctx, s, x + 138, y + 92, 48, 700, UI, L.ink);
  });
}

// ================================================================ S4  connect the ad data, e.g. Windsor.ai (12.7 - 18.0)
function sData(ctx, t) {
  const ck = sp(t, 13.4) * (1 - P(t, 15.9, 16.15));
  if (ck > 0.003) {
    const w = 620;
    ctx.save(); ctx.globalAlpha *= clamp(ck * 1.6); ctx.translate(0, (1 - ck) * 50);
    wcard(ctx, 540 - w / 2, 1352, w, 86, 43);
    T(ctx, 'Paramètres', 540 - w / 2 + 44, 1408, 36, 600, UI, L.sub);
    T(ctx, '›', 540 - 28, 1408, 40, 600, UI, L.faint, 'center');
    T(ctx, 'Connecteurs', 540 + 4, 1408, 36, 700, UI, L.ink);
    ctx.restore();
  }
  const k = sp(t, 16.38, SPRING.bouncy);
  if (k <= 0.003) return;
  const x = 90, y = 1250, w = 900, h = 160, done = t >= 17.35;
  ctx.save(); zoomAbout(ctx, lerp(0.8, 1, k), 540, y + h / 2); ctx.globalAlpha *= clamp(k * 1.6);
  wcard(ctx, x, y, w, h, 40, { accent: done ? 1 : 0, accentCol: L.green });
  const g = ctx.createLinearGradient(x + 30, y + 30, x + 130, y + 130);
  g.addColorStop(0, '#0FB5AE'); g.addColorStop(1, '#2A7BFF');
  rrect(ctx, x + 30, y + 30, 100, 100, 26); ctx.fillStyle = g; ctx.fill();
  T(ctx, 'W', x + 80, y + 102, 62, 800, UI, '#fff', 'center');
  T(ctx, 'Windsor.ai', x + 158, y + 78, 50, 700, UI, L.ink);
  T(ctx, 'Connecteur de données pub', x + 158, y + 122, 29, 500, UI, L.sub);
  const bw = 230, bx = x + w - bw - 30, kk = 1 + 0.14 * wobble(t - 17.35, 2.4, 5);
  ctx.save(); zoomAbout(ctx, kk, bx + bw / 2, y + h / 2);
  rrect(ctx, bx, y + 42, bw, 76, 38); ctx.fillStyle = done ? L.green : L.blue; ctx.fill();
  if (done) icon.check(ctx, bx + 44, y + 80, 13, '#fff', 5, prog(t, 17.35, 17.6));
  T(ctx, done ? 'Connecté' : 'Connecter', bx + bw / 2 + (done ? 18 : 0), y + 92, 34, 700, UI, '#fff', 'center');
  ctx.restore();
  const p = prog(t, 17.35, 17.95); ring(ctx, bx + bw / 2, y + 80, 60 + 130 * p, done ? 1 - p : 0, 5, '25,165,107');
  ctx.restore();
}

// ================================================================ S5  check accounts and permissions (18.0 - 21.4)
function sVerify(ctx, t) {
  const ak = sp(t, 18.1, SPRING.gentle);
  ctx.save(); ctx.globalAlpha *= clamp(ak * 1.6); ctx.translate(-(1 - ak) * 300, 0);
  wcard(ctx, 70, 590, 400, 366, 36);
  T(ctx, 'Comptes', 104, 656, 40, 700, UI, L.ink);
  ['Compte pub 1', 'Compte pub 2'].forEach((n, i) => {
    const cy = 742 + i * 112;
    ctx.fillStyle = L.line; ctx.fillRect(100, cy - 56, 340, 2);
    loop(ctx, 134, cy, 22, 7);
    T(ctx, n, 176, cy + 11, 31, 600, UI, L.ink);
    checkbox(ctx, 414, cy, 46, prog(t, 18.74 + i * 0.22, 18.96 + i * 0.22));
  });
  ctx.restore();
  const pk = sp(t, 18.5, SPRING.gentle), x = 70, y = 1010 + (1 - pk) * 260, w = 940;
  ctx.save(); ctx.globalAlpha *= clamp(pk * 1.6);
  wcard(ctx, x, y, w, 386, 36);
  icon.lock(ctx, x + 62, y + 66, 22, L.blue);
  T(ctx, 'Autorisations de Claude', x + 104, y + 80, 40, 700, UI, L.ink);
  ['Lire les campagnes', 'Lire les dépenses', 'Lire les résultats'].forEach((n, i) => {
    const cy = y + 156 + i * 84, at = [19.3, 19.72, 20.34][i];
    ctx.fillStyle = L.line; ctx.fillRect(x + 36, cy - 42, w - 72, 2);
    checkbox(ctx, x + 66, cy, 48, prog(t, at, at + 0.22));
    T(ctx, n, x + 118, cy + 13, 38, 600, UI, L.ink);
  });
  wtag(ctx, x + w - 34, y + 66, 'VÉRIFIÉ', { kind: 'green', solid: 1, size: 26, k: sp(t, 20.82, SPRING.bouncy) });
  const p = prog(t, 20.82, 21.4); ring(ctx, x + w - 110, y + 66, 50 + 120 * p, p > 0 ? 1 - p : 0, 5, '25,165,107');
  ctx.restore();
}

// ================================================================ S6  the three questions (21.4 - 30.8)
const QS = [['Où part mon budget ?', 23.98, 25.3], ['Quelle pub dépense sans résultats ?', 25.4, 28.4], ['Que tester ensuite ?', 28.86, 30.7]];
function sQuestions(ctx, t) {
  const big = sp(t, 22.8, SPRING.bouncy) * (1 - P(t, 23.65, 23.9));
  pill(ctx, 540, 1210, '3 QUESTIONS', { size: 66, fam: UI, wgt: 800, track: 3, padX: 60, k: big, glowA: 0.4 });
  QS.forEach(([q, a, b], i) => {
    const k = sp(t, a, SPRING.bouncy);
    if (k <= 0.003) return;
    const x = 80, y = 990 + i * 146 + (1 - k) * 120, on = t >= a && t < b;
    card(ctx, x, y, 920, 128, 40, { alpha: clamp(k * 1.6), accent: on ? 1 : 0 });
    ctx.save(); ctx.globalAlpha *= clamp(k * 1.6);
    numDot(ctx, x + 70, y + 64, 36, i + 1, C.coral, 1 + 0.18 * wobble(t - a, 2.6, 6));
    T(ctx, q, x + 128, y + 79, 42, 600, UI, C.white);
    ctx.restore();
  });
}

// ================================================================ S7  three hooks and their scripts (30.8 - 35.45)
function sHooks(ctx, t) {
  for (let i = 0; i < 3; i++) {
    const at = 32.84 + i * 0.24, k = sp(t, at, SPRING.bouncy), x = 490, y = 640 + i * 218, w = 520, h = 196;
    const wp = P(t, at - 0.5, at, E.outCubic);
    wire(ctx, 452, 980, 470, y + h / 2, x - 8, y + h / 2, wp, { col: 'rgba(255,255,255,0.95)', w: 5, dot: wp > 0 && wp < 1 ? wp : -1 });
    if (k <= 0.003) continue;
    ctx.save(); zoomAbout(ctx, lerp(0.75, 1, k), x + w / 2, y + h / 2); ctx.globalAlpha *= clamp(k * 1.6);
    wcard(ctx, x, y, w, h, 34);
    T(ctx, `ACCROCHE 0${i + 1}`, x + 34, y + 58, 26, 700, MONO, '#D9532B', 'left', 4);
    rrect(ctx, x + 34, y + 84, [380, 330, 400][i], 16, 8); ctx.fillStyle = L.ink; ctx.globalAlpha *= 0.85; ctx.fill(); ctx.globalAlpha /= 0.85;
    rrect(ctx, x + 34, y + 118, [300, 360, 260][i], 13, 7); ctx.fillStyle = L.faint; ctx.fill();
    const sk = sp(t, 34.22 + i * 0.16, SPRING.bouncy);
    if (sk > 0.003) { icon.doc(ctx, x + 50, y + 160, 12, L.blue, 2.5); }
    wtag(ctx, x + 76, y + 160, 'SCRIPT', { kind: 'blue', align: 'left', size: 23, k: sk });
    ctx.restore();
  }
}

// ================================================================ S8  several versions with Higgsfield (35.45 - 39.55)
function sVersions(ctx, t) {
  pill(ctx, 540, 972, 'HIGGSFIELD', { size: 32, k: sp(t, 36.2, SPRING.bouncy) });
  for (let i = 0; i < 4; i++) {
    const at = [37.2, 37.5, 38.0, 38.38][i], k = sp(t, at, SPRING.bouncy);
    if (k <= 0.003) continue;
    const x = 62 + i * 244, y = 1034, w = 224, h = 362;
    ctx.save(); zoomAbout(ctx, lerp(0.6, 1, k), x + w / 2, y + h / 2); ctx.globalAlpha *= clamp(k * 1.6);
    wcard(ctx, x, y, w, h, 30, { rim: 8 });
    thumb(ctx, x + 10, y + 10, w - 20, 268, 22, i);
    const sh = prog(t, at, at + 0.7);              // a sheen sweeps the thumbnail as it is generated
    if (sh > 0 && sh < 1) {
      ctx.save(); rrect(ctx, x + 10, y + 10, w - 20, 268, 22); ctx.clip();
      const sx = x - 100 + (w + 200) * sh, g = ctx.createLinearGradient(sx - 70, 0, sx + 70, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(sx - 70, y, 140, 290);
      ctx.restore();
    }
    T(ctx, `Version ${i + 1}`, x + w / 2, y + 328, 32, 700, UI, L.ink, 'center');
    ctx.restore();
  }
}

// ================================================================ S9  launch the test in Meta Ads Manager (39.55 - 42.05)
function sLaunch(ctx, t) {
  const k = sp(t, 39.6, SPRING.gentle), x = 590 + (1 - k) * 520, y = 650, w = 420, h = 600, live = t >= 41.2;
  ctx.save(); ctx.globalAlpha *= clamp(k * 1.6);
  wcard(ctx, x, y, w, h, 36);
  T(ctx, 'Nouveau test', x + 34, y + 74, 40, 700, UI, L.ink);
  for (let i = 0; i < 3; i++) {
    const cy = y + 164 + i * 108;
    ctx.fillStyle = L.line; ctx.fillRect(x + 30, cy - 54, w - 60, 2);
    thumb(ctx, x + 34, cy - 36, 72, 72, 18, i, { play: 0 });
    T(ctx, `Version ${i + 1}`, x + 124, cy + 12, 34, 600, UI, L.ink);
    toggle(ctx, x + w - 82, cy, sp(t, 40.08 + i * 0.2));
  }
  const by = y + 468, kk = 1 + 0.14 * wobble(t - 41.2, 2.4, 5);
  ctx.save(); zoomAbout(ctx, kk, x + w / 2, by + 46);
  rrect(ctx, x + 30, by, w - 60, 92, 46); ctx.fillStyle = live ? L.green : L.blue; ctx.fill();
  T(ctx, live ? 'Test en ligne' : 'Lancer le test', x + w / 2, by + 59, 36, 700, UI, '#fff', 'center');
  ctx.restore();
  const p = prog(t, 41.2, 41.9); ring(ctx, x + w / 2, by + 46, 70 + 190 * p, live ? 1 - p : 0, 6, '25,165,107');
  ctx.restore();
  pill(ctx, 320, 1330, 'META ADS MANAGER', { size: 30, k: sp(t, 40.6, SPRING.bouncy) });
}

// ================================================================ S10  let it gather data, then bring the results to Claude (42.05 - 46.4)
function sCollect(ctx, t) {
  const k = sp(t, 42.1, SPRING.gentle), x = 80, y = 610 + (1 - k) * 200, w = 920, h = 520;
  ctx.save(); ctx.globalAlpha *= clamp(k * 1.6);
  wcard(ctx, x, y, w, h, 36);
  T(ctx, 'Données recueillies', x + 44, y + 80, 42, 700, UI, L.ink);
  const pct = Math.round(100 * prog(t, 42.5, 44.25));
  T(ctx, `${pct} %`, x + w - 44, y + 82, 48, 800, UI, pct >= 100 ? L.green : L.blue, 'right');
  [90, 140, 120, 190, 230, 210, 280].forEach((bh, i) => {
    const p = P(t, 42.5 + i * 0.24, 42.9 + i * 0.24, E.outCubic), bx = x + 62 + i * 118;
    rrect(ctx, bx, y + 424 - 280, 80, 280, 16); ctx.fillStyle = L.greyTint; ctx.fill();
    if (p > 0) { rrect(ctx, bx, y + 424 - bh * p, 80, bh * p, 16); ctx.fillStyle = i === 6 ? C.coral : L.blue; ctx.fill(); }
    T(ctx, `J${i + 1}`, bx + 40, y + 472, 28, 600, UI, L.sub, 'center');
  });
  ctx.restore();
  const wp = P(t, 44.5, 45.15, E.inOutCubic);
  wire(ctx, 540, 1146, 540, 1170, 540, 1196, wp, { col: 'rgba(255,255,255,0.95)', w: 6, dot: wp > 0 && wp < 1 ? wp : -1 });
  claudeTile(ctx, 540, 1296, 190, sp(t, 44.36, SPRING.bouncy), t);
  const p = prog(t, 45.2, 45.9); ring(ctx, 540, 1296, 100 + 190 * p, p > 0 ? 1 - p : 0, 6);
  wtag(ctx, 664, 1296, 'RÉSULTATS REÇUS', { kind: 'green', solid: 1, align: 'left', size: 25, k: sp(t, 45.3, SPRING.bouncy) });
}

// ================================================================ S11  read the results (46.4 - 51.15)
const RES = [{ clients: 14, cost: 9 }, { clients: 2, cost: 41 }, { clients: 6, cost: 17 }];
function sResults(ctx, t) {
  const k = sp(t, 46.45, SPRING.gentle), x = 70, y = 600 + (1 - k) * 200, w = 940, rh = 176;
  ctx.save(); ctx.globalAlpha *= clamp(k * 1.6);
  wcard(ctx, x, y, w, 110 + 3 * rh + 14, 36);
  T(ctx, 'PUBLICITÉ', x + 44, y + 70, 25, 700, MONO, L.sub, 'left', 3);
  T(ctx, 'CLIENTS', x + 600, y + 70, 25, 700, MONO, t >= 46.9 && t < 48.1 ? '#D9532B' : L.sub, 'center', 3);
  T(ctx, 'COÛT / CLIENT', x + 810, y + 70, 25, 700, MONO, t >= 48.1 && t < 49.1 ? '#D9532B' : L.sub, 'center', 3);
  RES.forEach((r, i) => {
    const ry = y + 104 + i * rh, cy = ry + rh / 2;
    const win = i === 0 ? sp(t, 47.6) : 0, redo = i === 2 ? sp(t, 49.8, SPRING.bouncy) : 0;
    if (win > 0.003) { rrect(ctx, x + 14, ry + 8, w - 28, rh - 16, 26); ctx.fillStyle = `rgba(25,165,107,${0.13 * win})`; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = `rgba(25,165,107,${win})`; ctx.stroke(); }
    else { ctx.fillStyle = L.line; ctx.fillRect(x + 36, ry, w - 72, 2); }
    thumb(ctx, x + 40, cy - 56, 112, 112, 22, i, { play: 0 });
    T(ctx, `Pub ${'ABC'[i]}`, x + 180, cy - 2, 46, 700, UI, L.ink);
    if (i === 0) wtag(ctx, x + 180, cy + 40, 'GAGNANTE', { kind: 'green', solid: 1, align: 'left', size: 22, k: sp(t, 47.66, SPRING.bouncy) });
    if (i === 1) wtag(ctx, x + 180, cy + 40, 'TROP CHÈRE', { kind: 'grey', align: 'left', size: 22, k: sp(t, 48.64, SPRING.bouncy) });
    if (i === 2) wtag(ctx, x + 180, cy + 40, 'À RETESTER', { kind: 'coral', solid: 1, align: 'left', size: 22, k: redo * (1 + 0.2 * wobble(t - 49.8, 2.4, 5)) });
    const c = Math.round(r.clients * P(t, 46.9 + i * 0.1, 47.6 + i * 0.1, E.outCubic));
    T(ctx, String(c), x + 600, cy + 20, 62, 800, UI, i === 0 && win > 0.5 ? L.green : L.ink, 'center');
    const cp = P(t, 48.1 + i * 0.1, 48.7 + i * 0.1, E.outCubic);
    T(ctx, cp > 0 ? `${Math.round(r.cost * cp)} €` : '—', x + 810, cy + 20, 62, 800, UI, cp > 0 ? L.ink : L.faint, 'center');
    if (i === 2) { const p = prog(t, 49.8, 50.5); ring(ctx, x + 270, cy + 40, 60 + 150 * p, p > 0 ? 1 - p : 0, 5); }
  });
  ctx.restore();
}

// ================================================================ S12  the method: a loop of four steps (51.15 - 56.2)
function sMethod(ctx, t) {
  const cx = 540, cy = 1010, R = 300, times = [53.36, 54.26, 54.98, 55.78];
  const rk = sp(t, 51.3, SPRING.gentle);
  ctx.save(); ctx.globalAlpha *= clamp(rk * 1.6);
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.lineWidth = 8; ctx.setLineDash([4, 22]); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.stroke(); ctx.setLineDash([]);
  const sweep = kf(t, [[53.3, 0], [54.26, 0.25], [54.98, 0.5], [55.78, 0.75], [56.25, 1]], E.inOutCubic);
  if (sweep > 0) {
    ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + TAU * sweep); ctx.lineWidth = 10; ctx.strokeStyle = C.coral; ctx.stroke();
    const a = -Math.PI / 2 + TAU * sweep;
    glow(ctx, cx + R * Math.cos(a), cy + R * Math.sin(a), 44, '255,230,215', 0.9);
  }
  ctx.restore();
  claudeTile(ctx, cx, cy, 200, sp(t, 51.4, SPRING.bouncy), t);
  STEPS.forEach((s, i) => {
    const a = -Math.PI / 2 + (i * TAU) / 4, nx = cx + R * Math.cos(a), ny = cy + R * Math.sin(a);
    const k = sp(t, 51.55 + i * 0.12, SPRING.bouncy), lit = t >= times[i];
    if (k <= 0.003) return;
    const w = 330, h = 118;
    ctx.save(); zoomAbout(ctx, k * (1 + 0.14 * wobble(t - times[i], 2.4, 5)), nx, ny);
    wcard(ctx, nx - w / 2, ny - h / 2, w, h, h / 2, { accent: lit ? 1 : 0 });
    numDot(ctx, nx - w / 2 + 60, ny, 36, i + 1, lit ? C.coral : '#B4C0D2');
    T(ctx, s, nx - w / 2 + 112, ny + 16, 44, 700, UI, L.ink);
    ctx.restore();
    const p = prog(t, times[i], times[i] + 0.55); ring(ctx, nx, ny, 70 + 150 * p, p > 0 ? 1 - p : 0, 5);
  });
}

// ================================================================ S13  "comment IA, I send you the method" (56.2 - 63.4)
function sComment(ctx, t) {
  const fanOut = P(t, 60.5, 60.8, E.inCubic);
  for (let i = 0; i < 3; i++) {
    const k = sp(t, 56.35 + i * 0.12, SPRING.bouncy);
    if (k <= 0.003 || fanOut >= 1) continue;
    ctx.save();
    ctx.globalAlpha *= clamp(k * 1.6) * (1 - fanOut);
    ctx.translate(540 + (i - 1) * 270, 790 - fanOut * 160 + Math.abs(i - 1) * 46); ctx.rotate((i - 1) * 0.13); ctx.scale(lerp(0.6, 1, k), lerp(0.6, 1, k));
    wcard(ctx, -150, -190, 300, 380, 34);
    thumb(ctx, -134, -174, 268, 240, 24, i);
    T(ctx, `Pub ${'ABC'[i]}`, -124, 122, 42, 700, UI, L.ink);
    wtag(ctx, 126, 108, '? clients', { kind: 'coral', size: 21 });
    ctx.restore();
  }
  pill(ctx, 540, 1060, 'TES PUBLICITÉS', { size: 34, k: sp(t, 57.7, SPRING.bouncy) * (1 - fanOut) });
  // the comment box
  const ck = sp(t, 58.9, SPRING.gentle), x = 80, y = 1262 + (1 - ck) * 200, w = 920, h = 120;
  const n = t >= 59.78 ? 2 : t >= 59.6 ? 1 : 0, posted = t >= 60.12;
  ctx.save(); ctx.globalAlpha *= clamp(ck * 1.6);
  wcard(ctx, x, y, w, h, 60);
  icon.user(ctx, x + 64, y + 60, 38, L.blue, '#fff');
  if (posted || !n) T(ctx, 'Ajouter un commentaire…', x + 124, y + 73, 36, 500, UI, L.sub);
  else {
    T(ctx, 'IA'.slice(0, n), x + 124, y + 78, 50, 800, UI, L.ink, 'left', 2);
    ctx.fillStyle = C.coral; ctx.fillRect(x + 130 + tw(ctx, 'IA'.slice(0, n), 50, 800, UI, 2), y + 32, 4, 56);
  }
  const bx = x + w - 122;
  rrect(ctx, bx - 96, y + 22, 192, 76, 38); ctx.fillStyle = n && !posted ? L.blue : '#C7D1E0'; ctx.fill();
  T(ctx, 'Publier', bx, y + 73, 34, 700, UI, '#fff', 'center');
  const p = prog(t, 60.05, 60.6); ring(ctx, bx, y + 60, 60 + 120 * p, p > 0 ? 1 - p : 0, 5, L.blueRgb);
  ctx.restore();
  const pk = sp(t, 60.12, SPRING.bouncy);
  if (pk > 0.003) {
    ctx.save(); zoomAbout(ctx, lerp(0.6, 1, pk), 300, 1150); ctx.globalAlpha *= clamp(pk * 1.6);
    wcard(ctx, 80, 1090, 470, 132, 50);
    icon.user(ctx, 146, 1156, 40, L.blue, '#fff');
    T(ctx, 'toi', 208, 1136, 26, 500, UI, L.sub);
    T(ctx, 'IA', 208, 1192, 52, 800, UI, L.ink, 'left', 2);
    ctx.restore();
  }
  // the DM that comes back
  const dk = sp(t, 60.74, SPRING.bouncy);
  if (dk > 0.003) {
    const dx = 90, dy = 610, dw = 900, dh = 420;
    ctx.save(); zoomAbout(ctx, lerp(0.7, 1, dk), 540, dy + dh / 2); ctx.globalAlpha *= clamp(dk * 1.6);
    glow(ctx, 540, dy + dh / 2, 700, C.coralRgb, 0.16, 1, 0.5);
    card(ctx, dx, dy, dw, dh, 44, { accent: 1 });
    sparkDisc(ctx, dx + 82, dy + 84, 44);
    T(ctx, 'NOUVEAU MESSAGE · DM', dx + 146, dy + 96, 27, 700, MONO, C.coral, 'left', 4);
    T(ctx, 'La méthode complète', dx + 46, dy + 208, 68, 700, UI, C.white, 'left', -1);
    const sk = sp(t, 62.3);
    ctx.globalAlpha *= clamp(sk * 1.6);
    T(ctx, 'étape par étape', dx + 48, dy + 268, 40, 500, UI, C.grey);
    for (let i = 0; i < 4; i++) {
      const kk = sp(t, 62.34 + i * 0.16, SPRING.bouncy), nx = dx + 86 + i * 190;
      if (i < 3) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(nx + 36, dy + 344, 118 * clamp(kk), 6); }
      numDot(ctx, nx, dy + 347, 34, i + 1, C.coral, kk);
    }
    ctx.restore();
  }
}

// ================================================================ S14  recap (63.4 - end)
function sRecap(ctx, t) {
  [['Connecte', 63.56], ['Analyse', 65.04], ['Crée', 66.54]].forEach(([s, at], i) => {
    const k = sp(t, at - 0.06, SPRING.bouncy), x = 70 + i * 322, y = 1168, w = 296, h = 124;
    if (k <= 0.003) return;
    ctx.save(); zoomAbout(ctx, k, x + w / 2, y + h / 2);
    wcard(ctx, x, y, w, h, 40, { accent: 1 });
    checkbox(ctx, x + 54, y + h / 2, 46, prog(t, at + 0.05, at + 0.3), C.coral);
    T(ctx, s, x + 92, y + h / 2 + 13, 38, 700, UI, L.ink);
    ctx.restore();
    const p = prog(t, at, at + 0.6); ring(ctx, x + w / 2, y + h / 2, 80 + 150 * p, p > 0 ? 1 - p : 0, 5);
  });
  pill(ctx, 540, 1370, 'COMMENTE « IA »', { size: 40, k: sp(t, 67.3, SPRING.bouncy) * (1 + 0.1 * wobble(t - 67.3, 2.2, 4)) });
}

// ================================================================ the edit: content swaps with a sideways whip under a fixed title
const SHOTS = [
  { b: 4.95, fn: sHook }, { b: 9.5, fn: sConnect }, { b: 12.7, fn: sAfter }, { b: 18.0, fn: sData },
  { b: 21.4, fn: sVerify }, { b: 30.8, fn: sQuestions }, { b: 35.45, fn: sHooks }, { b: 39.55, fn: sVersions },
  { b: 42.05, fn: sLaunch }, { b: 46.4, fn: sCollect }, { b: 51.15, fn: sResults }, { b: 56.2, fn: sMethod },
  { b: 63.4, fn: sComment }, { b: 999, fn: sRecap },
];
const PAN = 0.34;
function shots(ctx, t, IMG) {
  SHOTS.forEach((s, i) => {
    const a = i ? SHOTS[i - 1].b : -99;
    if (t < a - PAN / 2 || t >= s.b + PAN / 2) return;
    ctx.save();
    const pi = P(t, a - PAN / 2, a + PAN / 2), po = P(t, s.b - PAN / 2, s.b + PAN / 2);
    ctx.translate((1 - pi) * W - po * W, 0);
    ctx.translate(4 * noise1(t * 0.33, 31 + i), 6 * noise1(t * 0.4, 17 + i));
    s.fn(ctx, t, IMG);
    ctx.restore();
  });
}

// ================================================================ sound: every visual accent, in seconds
const pan = (t) => [t, 'pan', 'whoosh', { len: 0.42, gain: 0.2 }];
const HITS = [
  [0, 'hook', 'impact', { gain: 0.45 }], [0.2, 'spend counter', 'type', { len: 1.3, gain: 0.1 }], [1.7, 'frame moves', 'whoosh', { len: 0.4, gain: 0.16 }],
  [1.9, 'pub A', 'click'], [2.1, 'pub B', 'click'], [2.3, 'pub C', 'click'], [4.3, 'question mark', 'pop', { pitch: 'A5' }],
  pan(4.95), [5.2, 'meta chip', 'click'], [5.42, 'claude chip', 'click'], [6.86, 'linked', 'bell', { pitch: 'D6' }], [7.45, 'typing', 'type', { len: 1.3, gain: 0.1 }], [8.9, 'sent', 'blip', { pitch: 'A5' }],
  pan(9.5), [9.95, 'step 1', 'click'], [10.23, 'step 2', 'click'], [10.51, 'step 3', 'click'], [10.79, 'step 4', 'click'], [11.9, 'after', 'pop', { pitch: 'E5' }],
  pan(12.7), [13.4, 'breadcrumb', 'click'], [16.2, 'frame up', 'whoosh', { len: 0.35, gain: 0.14 }], [16.38, 'windsor', 'pop', { pitch: 'D5' }], [17.35, 'connected', 'bell', { pitch: 'A5' }],
  pan(18.0), [18.74, 'account 1', 'tick'], [18.96, 'account 2', 'tick'], [19.3, 'perm 1', 'tick'], [19.72, 'perm 2', 'tick'], [20.34, 'perm 3', 'tick'], [20.82, 'verified', 'bell', { pitch: 'D6' }],
  pan(21.4), [22.8, '3 questions', 'pop', { pitch: 'A5' }], [23.98, 'question 1', 'tok', { pitch: 'D5' }], [25.4, 'question 2', 'tok', { pitch: 'E5' }], [28.86, 'question 3', 'tok', { pitch: 'G5' }],
  pan(30.8), [32.84, 'hook 1', 'blip', { pitch: 'A5' }], [33.08, 'hook 2', 'blip', { pitch: 'C6' }], [33.32, 'hook 3', 'blip', { pitch: 'E6' }], [34.22, 'script 1', 'tick'], [34.38, 'script 2', 'tick'], [34.54, 'script 3', 'tick'],
  pan(35.45), [35.4, 'frame to higgsfield', 'whoosh', { len: 0.4, gain: 0.14 }], [36.2, 'higgsfield', 'pop', { pitch: 'A5' }], [37.2, 'version 1', 'click'], [37.5, 'version 2', 'click'], [38.0, 'version 3', 'click'], [38.38, 'version 4', 'click'],
  pan(39.55), [40.08, 'toggle 1', 'tick'], [40.28, 'toggle 2', 'tick'], [40.48, 'toggle 3', 'tick'], [41.2, 'launched', 'bell', { pitch: 'A5' }],
  pan(42.05), [42.5, 'bars', 'type', { len: 1.7, gain: 0.1 }], [44.36, 'claude tile', 'pop', { pitch: 'D5' }], [45.2, 'results received', 'bell', { pitch: 'D6' }],
  pan(46.4), [46.9, 'clients count', 'type', { len: 0.7, gain: 0.1 }], [47.66, 'winner', 'bell', { pitch: 'A5' }], [48.1, 'cost count', 'type', { len: 0.6, gain: 0.1 }], [49.8, 'retest', 'pop', { pitch: 'E5' }],
  pan(51.15), [51.4, 'loop', 'click'], [53.36, 'analyser', 'tok', { pitch: 'D5' }], [54.26, 'créer', 'tok', { pitch: 'E5' }], [54.98, 'tester', 'tok', { pitch: 'G5' }], [55.78, 'améliorer', 'tok', { pitch: 'A5' }],
  pan(56.2), [57.7, 'tes publicités', 'pop', { pitch: 'A5' }], [59.6, 'IA', 'type', { len: 0.25, gain: 0.14 }], [60.05, 'publier', 'click'], [60.12, 'posted', 'pop', { pitch: 'E5' }], [60.74, 'DM', 'bell', { pitch: 'D6' }], [62.34, 'steps', 'type', { len: 0.6, gain: 0.1 }],
  pan(63.4), [63.56, 'connecte', 'tok', { pitch: 'D5' }], [65.04, 'analyse', 'tok', { pitch: 'G5' }], [66.54, 'crée', 'tok', { pitch: 'A5' }], [67.3, 'commente IA', 'bell', { pitch: 'D6' }],
];

// ================================================================ go
await M.film({
  fonts: [font(40, 500, UI), font(40, 700, UI), font(40, 800, UI), font(30, 700, MONO)],
  images: { sky: 'assets/img/sky.jpg' },
  hits: HITS,
  samples: 8,
  draw(ctx, u, t, IMG) {
    background(ctx, t, IMG);
    frame(ctx, t);
    shots(ctx, t, IMG);
    titles(ctx, t);
    captions(ctx, t);
  },
});
// seek() must return only once the clip frames for t are decoded; the renderer awaits it.
const paint = window.seek;
window.seek = async (t) => { await ensureFrames(t); paint(t); };
await window.seek(0);
