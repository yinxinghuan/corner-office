// v0.3 — SVG-sprite-based rendering.
//
// The character and the three platform kinds (desk, printer = spring,
// office chair = moving) are now hand-drawn SVGs loaded via the sprite
// preloader. The canvas pipeline does `ctx.drawImage(sprite, …)` with
// rotate / scale wrappers for tilt + squash. Background, hazards,
// pickups, HUD, and floor markers stay programmatic.

import {
  PLAYER_W, PLAYER_H, FLOOR_HEIGHT_PX, LAND_ANIM_MS,
  type Platform, type Pickup, type Hazard, type Player,
} from '../types';
import type { Sprites } from './sprites';

// ─── Photocopy palette ────────────────────────────────────────────────
const PAPER       = '#ebe4d0';   // cream paper
const PAPER_DK    = '#d4cdb8';   // shadow on paper
const PAPER_DKR   = '#b5ae9a';   // deep shadow
const INK         = '#0e0a05';   // photocopy black
const STAMP_RED   = '#b22b1f';   // rubber-stamp / URGENT accent

// ─── Background — a stack of overlapping document pages ────────────────
//
// The dark night-sky gradient is replaced with a cream paper field. As
// the player climbs, the background SUBTLY darkens to a more soiled,
// burnt-document look — the "redness" still drives a corner-of-page
// scorch that intensifies on high floors.

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  cssW: number, cssH: number,
  redness: number,
) {
  // Base paper field — soft warm cream that gets slightly toner-burnt up high.
  const top = mix(PAPER, '#9a6f5a', redness * 0.4);
  const bot = mix(PAPER_DK, '#7a5048', redness * 0.4);
  const grad = ctx.createLinearGradient(0, 0, 0, cssH);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cssW, cssH);

  // Subtle paper-grain dots (tiny static stipple, generated via PRNG by
  // the camera-y so the pattern moves with the page).
  ctx.fillStyle = 'rgba(14, 10, 5, 0.05)';
  const cols = Math.ceil(cssW / 5);
  const rows = Math.ceil(cssH / 5);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      // Deterministic noise pattern
      const seed = (r * 73856093) ^ (c * 19349663);
      if (((seed >>> 0) % 47) < 3) {
        ctx.fillRect(c * 5, r * 5, 1, 1);
      }
    }
  }
}

// Floor → department name. v0.3 ties altitude to a corporate hierarchy
// so the climb tells a story. `0` returns lobby; floors past the deck
// loop back to "EXECUTIVE" for sanity.
const DEPARTMENTS: Array<{ floor: number; label: string }> = [
  { floor: 10, label: 'ACCOUNTING' },
  { floor: 20, label: 'HR' },
  { floor: 30, label: 'LEGAL' },
  { floor: 40, label: 'IT' },
  { floor: 50, label: 'MARKETING' },
  { floor: 60, label: 'FINANCE' },
  { floor: 70, label: 'EXEC SUITE' },
  { floor: 80, label: 'BOARD ROOM' },
  { floor: 90, label: 'C-SUITE' },
  { floor: 100, label: 'CEO' },
];

export function drawFloorMarkers(
  ctx: CanvasRenderingContext2D,
  cssW: number, cssH: number,
  startWorldY: number,
  cameraY: number,
  scale: number,
) {
  ctx.save();
  // Typewriter / monospace for the "department directory" feel.
  ctx.font = `bold ${Math.round(11 * scale)}px Courier, monospace`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const logicalH = cssH / scale;
  const topFloor = Math.ceil((startWorldY - cameraY) / FLOOR_HEIGHT_PX);
  const botFloor = Math.floor((startWorldY - (cameraY + logicalH)) / FLOOR_HEIGHT_PX);

  for (let f = Math.max(0, botFloor); f <= topFloor; f++) {
    if (f === 0 || f % 10 !== 0) continue;
    const worldY = startWorldY - f * FLOOR_HEIGHT_PX;
    const sy = (worldY - cameraY) * scale;
    if (sy < -16 || sy > cssH + 16) continue;

    // Faint dashed rule — like a faxed margin line
    ctx.strokeStyle = 'rgba(14, 10, 5, 0.18)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(cssW, sy);
    ctx.stroke();
    ctx.setLineDash([]);

    const dept = DEPARTMENTS.find(d => d.floor === f);
    const labelTxt = dept
      ? `FL.${f}  ${dept.label}`
      : `FL.${f}`;
    ctx.fillStyle = 'rgba(14, 10, 5, 0.55)';
    ctx.fillText(labelTxt, cssW - 12, sy - 10);
  }
  ctx.restore();
}

// ─── Lobby: a stack of overlapping document pages ─────────────────────
//
// Replaces the nighttime skyline. The lobby (floor 0) is the ground —
// a desk surface with a fan of overlapping memos and a coffee ring,
// drawn deterministically so the layout is the same every run.

export function drawLobbySilhouette(
  ctx: CanvasRenderingContext2D,
  cssW: number, cssH: number,
  startWorldY: number,
  cameraY: number,
  scale: number,
) {
  const lobbyScreenY = (startWorldY - cameraY) * scale;
  if (lobbyScreenY < -200 || lobbyScreenY > cssH + 400) return;

  ctx.save();
  // Darker "desk wood" band beneath the starting platform.
  const tableTop = lobbyScreenY + 60;
  const grad = ctx.createLinearGradient(0, tableTop, 0, cssH);
  grad.addColorStop(0, PAPER_DKR);
  grad.addColorStop(1, '#5a4634');
  ctx.fillStyle = grad;
  ctx.fillRect(0, tableTop, cssW, cssH - tableTop);

  // Stack of memos drifting underneath the camera — each is a small
  // cream rectangle with a tiny ink line + a rotation.
  // Anchor positions in CSS px relative to the table top.
  const memos: Array<[number, number, number, number, string]> = [
    // [centerXRatio, yOffset, w, rotateDeg, label]
    [0.18, 22, 130, -6, ''],
    [0.42, 14, 150, 3, ''],
    [0.72, 28, 120, -4, ''],
    [0.30, 70, 110, 7, ''],
    [0.60, 76, 140, -2, ''],
  ];
  for (const [cxR, dy, w, deg] of memos) {
    const cx = cssW * cxR;
    const cy = tableTop + dy;
    const h = w * 0.68;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((deg * Math.PI) / 180);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(-w / 2 + 3, -h / 2 + 4, w, h);
    // paper
    ctx.fillStyle = PAPER;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.globalAlpha = 0.30;
    ctx.strokeRect(-w / 2, -h / 2, w, h);
    // text lines
    ctx.globalAlpha = 1;
    ctx.fillStyle = INK;
    ctx.globalAlpha = 0.55;
    const lineW = w * 0.6;
    ctx.fillRect(-lineW / 2, -h / 2 + 8, lineW, 1.5);
    ctx.globalAlpha = 0.30;
    ctx.fillRect(-lineW / 2, -h / 2 + 16, lineW * 0.85, 1.2);
    ctx.fillRect(-lineW / 2, -h / 2 + 22, lineW * 0.92, 1.2);
    ctx.fillRect(-lineW / 2, -h / 2 + 28, lineW * 0.70, 1.2);
    // a tiny red stamp on one of them
    if (cxR > 0.4 && cxR < 0.6) {
      ctx.fillStyle = STAMP_RED;
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = STAMP_RED;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(w / 2 - 28, -h / 2 + 6, 22, 9);
    }
    ctx.restore();
  }

  // Coffee ring stain front-and-center
  ctx.strokeStyle = 'rgba(110, 60, 30, 0.45)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cssW * 0.50, tableTop + 130, 32, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(70, 40, 20, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cssW * 0.50, tableTop + 130, 28, 0, Math.PI * 2);
  ctx.stroke();

  // void scale to suppress "unused" warning for the scale arg
  void scale;
  ctx.restore();
}

// ─── Platforms (sprite-based) ─────────────────────────────────────────

/**
 * Sprite-aware platform draw. Each kind has its own SVG with a specific
 * native aspect; we anchor by the *top edge* of the platform's collision
 * box, so the player's feet sit on `p.y`. Sprite art that extends above
 * `p.y` (lamps, paper jets, chair backs) hangs above and adds visual
 * interest without affecting collisions.
 */
export function drawPlatform(
  ctx: CanvasRenderingContext2D,
  p: Platform,
  screenY: number,            // p.y projected to screen
  scale: number,
  now: number,
  sprites: Sprites,
) {
  const w = p.w * scale;
  const squish = p.squishUntil && now < p.squishUntil
    ? Math.sin(((p.squishUntil - now) / 220) * Math.PI) * 0.18
    : 0;

  let img: HTMLImageElement;
  let nativeAspect: number;     // h / w
  let topAboveBy: number;       // sprite px above the collision line, as fraction of drawn h

  switch (p.kind) {
    case 'desk':
      img = sprites.desk;
      // viewBox 280×100; desktop slab top at sprite y≈48.
      nativeAspect = 100 / 280;
      topAboveBy = 48 / 100;
      break;
    case 'spring':
      img = sprites.printer;
      // viewBox 240×110; collision = top of red slot at sprite y≈38.
      nativeAspect = 110 / 240;
      topAboveBy = 38 / 110;
      break;
    case 'moving':
      img = sprites.chair;
      // viewBox 240×120; collision = top of seat at sprite y≈40.
      nativeAspect = 120 / 240;
      topAboveBy = 40 / 120;
      break;
  }

  const drawH = w * nativeAspect;
  const drawW = w;
  // squish compresses vertically slightly on landing.
  const sy = 1 - squish;
  const x = p.x * scale - drawW / 2;
  const y = screenY - drawH * topAboveBy * sy;

  ctx.save();
  // Apply vertical squash centered on the collision line.
  if (sy !== 1) {
    ctx.translate(0, screenY);
    ctx.scale(1, sy);
    ctx.translate(0, -screenY);
  }
  ctx.drawImage(img, x, y, drawW, drawH);
  ctx.restore();
}

// ─── Pickups (programmatic — small enough to stay clean) ──────────────

export function drawPickup(
  ctx: CanvasRenderingContext2D,
  p: Pickup,
  screenY: number,
  scale: number,
  now: number,
) {
  // Photocopy-style coffee cup: high-contrast ink outline on cream
  // body, no warm browns. The cup itself is the same paper as the
  // world, with a black silhouette + a red sleeve band.
  const bob = Math.sin(now / 240 + p.id) * 1.4;
  const sx = p.x * scale;
  const sy = screenY + bob;
  const s = scale;

  ctx.save();
  ctx.translate(sx, sy);

  // ink outlined cup body
  ctx.fillStyle = PAPER;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2 * s;
  roundRect(ctx, -8 * s, -11 * s, 16 * s, 18 * s, 2 * s);
  ctx.fill();
  ctx.stroke();
  // red rubber-stamp sleeve band
  ctx.fillStyle = STAMP_RED;
  roundRect(ctx, -8 * s, -3 * s, 16 * s, 5 * s, 1 * s);
  ctx.fill();
  // lid (dark)
  ctx.fillStyle = INK;
  roundRect(ctx, -10 * s, -14 * s, 20 * s, 5 * s, 2 * s);
  ctx.fill();
  // sipper
  ctx.fillStyle = INK;
  roundRect(ctx, -3 * s, -16 * s, 6 * s, 3 * s, 1 * s);
  ctx.fill();
  // steam — gray photocopy lines
  ctx.strokeStyle = 'rgba(14, 10, 5, 0.45)';
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(-3 * s, -20 * s);
  ctx.quadraticCurveTo(-5 * s, -23 * s, -3 * s, -26 * s);
  ctx.moveTo(2 * s, -20 * s);
  ctx.quadraticCurveTo(0, -23 * s, 2 * s, -26 * s);
  ctx.stroke();
  ctx.restore();
}

// ─── Hazard (URGENT email sprite, static position) ────────────────────
//
// v0.4 replaced the spiky red bubble with an iconic envelope so the
// danger reads at a glance ("don't touch incoming spam"). The hazard
// itself no longer oscillates — the game logic keeps `h.x = h.baseX`
// so the player can read its position and plan a path around it.
// The visual ALONE breathes: a subtle pulse-scale so it still feels
// alive.

export function drawHazard(
  ctx: CanvasRenderingContext2D,
  h: Hazard,
  screenY: number,
  scale: number,
  now: number,
  sprites: Sprites,
) {
  const pulse = 1 + Math.sin(now / 240 + h.phase) * 0.06;
  // Sprite is 120×100 viewBox; we draw 50 logical px wide for a clear
  // hazard footprint that matches the collision radius below.
  const W = 56;
  const H = 56 * (100 / 120);
  ctx.save();
  ctx.translate(h.x * scale, screenY);
  ctx.scale(pulse * scale, pulse * scale);
  ctx.drawImage(sprites.email, -W / 2, -H / 2, W, H);
  ctx.restore();
}

// ─── Player (sprite-based, tilt + squash) ─────────────────────────────
//
// The character SVG (worker.svg) is a single sprite. We rotate it
// around the feet point for horizontal-motion tilt and scale vertically
// for squash-and-stretch. Briefcase + tuft swing naturally with the
// body — for "independent" hair/briefcase swing we'd split the sprite,
// but the rotated-as-one approach already reads much more alive than
// the v0.2 rectangle stack.

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  p: Player,
  screenY: number,
  scale: number,
  now: number,
  sprites: Sprites,
) {
  const tilt = Math.max(-0.18, Math.min(0.18, p.vx * 0.32));

  // Vertical squash/stretch — two paths:
  //   (a) when a landing animation is active, override with a keyframed
  //       compress (heavy squash) → snap up (stretch) → settle
  //   (b) otherwise smooth from current vy
  let sx: number, sy: number;
  if (now < p.landAnimUntil) {
    const remaining = p.landAnimUntil - now;
    const t = 1 - remaining / LAND_ANIM_MS;     // 0..1, time since landing
    if (t < 0.28) {
      // Compress phase: heavy squash for ~70ms. Sharp ease-in.
      const k = t / 0.28;
      const compress = 0.40 * Math.sin(k * Math.PI * 0.5);  // up to .40
      sy = 1 - compress;
      sx = 1 + compress * 0.55;
    } else {
      // Snap-up phase: stretch then settle back. Ease-out cubic.
      const k = (t - 0.28) / 0.72;
      const peak = 0.32 * (1 - k) * Math.pow(1 - k, 0.6);
      sy = 1 + peak;
      sx = 1 - peak * 0.40;
    }
  } else {
    const stretch = Math.max(-0.14, Math.min(0.14, -p.vy * 0.09));
    sx = 1 - stretch * 0.45;
    sy = 1 + stretch;
  }

  // Photocopy sprite has a torn-paper backing around the figure, so
  // the drawn box is bigger than PLAYER_H. We scale by sprite-content
  // height (the figure proper goes from y≈54 to y≈290 = 236 native
  // px), then position so the figure's feet (sprite y≈290) sit at the
  // collision line.
  const figureHeight = 290 - 54;            // native sprite px of the body
  const fullHeight   = 320;                  // sprite viewBox height
  const ratio        = fullHeight / figureHeight;   // backing extra above
  const drawH = PLAYER_H * scale * ratio * 0.92;    // 0.92 = trim a bit
  const drawW = (256 / 320) * drawH;
  const cx = p.x * scale;
  const feetY = screenY;
  const feetAnchor = 290 / 320;
  const drawX = -drawW / 2;
  const drawY = -drawH * feetAnchor;

  // (Removed: feet shadow ellipse. The worker is a paper sticker on
  // a paper page — a cast shadow makes no sense for a flat cutout.)

  ctx.save();
  ctx.translate(cx, feetY);
  ctx.rotate(tilt);
  ctx.scale(sx, sy);
  ctx.drawImage(sprites.worker, drawX, drawY, drawW, drawH);
  ctx.restore();

  // hit flash overlay
  if (now < p.hitUntil) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 78, 60, 0.32)';
    ctx.beginPath();
    ctx.arc(cx, feetY - PLAYER_H * scale * 0.5,
            PLAYER_W * scale * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ─── Landing dust ─────────────────────────────────────────────────────

export interface DustParticle {
  x: number;            // world x
  yWorld: number;       // world y where landing happened (platform top)
  born: number;         // ms timestamp
  life: number;         // ms
  side: -1 | 1;         // direction of puff
  /** Random per-particle size so each puff has a few different motes. */
  motes: Array<{ dx: number; dy: number; r: number }>;
}

export function drawDust(
  ctx: CanvasRenderingContext2D,
  d: DustParticle,
  screenY: number,
  scale: number,
  now: number,
) {
  const age = now - d.born;
  const t = age / d.life;
  if (t >= 1) return;
  const alpha = 1 - t * t;
  const spread = 12 * t;
  ctx.save();
  ctx.translate(d.x * scale, screenY);
  // Photocopy-toner puff: dark gray motes on light paper.
  ctx.fillStyle = `rgba(14, 10, 5, ${alpha * 0.55})`;
  for (const m of d.motes) {
    const x = (m.dx + d.side * spread) * scale;
    const y = -t * 4 * scale + m.dy * scale;
    ctx.beginPath();
    ctx.arc(x, y, m.r * (1 + t * 0.6) * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ─── HUD — typewriter page counter ────────────────────────────────────

export function drawHUD(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  floor: number,
) {
  ctx.save();
  // Centered torn-paper-tag style counter at top.
  const padX = 18;
  const txt = String(floor).padStart(3, '0');
  ctx.font = 'bold 30px Courier, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(txt).width + padX * 2 + 60;
  const h = 38;
  const x = cssW / 2 - w / 2;
  const y = 14;

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(x + 3, y + 4, w, h);

  // paper tag
  ctx.fillStyle = PAPER;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = INK;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, w, h);
  ctx.globalAlpha = 1;

  // "FL." label in red stamp
  ctx.fillStyle = STAMP_RED;
  ctx.font = 'bold 12px Courier, monospace';
  ctx.fillText('FL.', x + padX + 14, y + h / 2);

  // number in ink
  ctx.fillStyle = INK;
  ctx.font = 'bold 30px Courier, monospace';
  ctx.fillText(txt, x + w - padX - 30, y + h / 2);

  // a couple of paper torn-edge nicks
  ctx.fillStyle = PAPER;
  ctx.fillRect(x - 2, y + 8, 4, 6);
  ctx.fillRect(x + w - 2, y + h - 14, 4, 6);

  ctx.restore();
}

export function drawRedTint(
  ctx: CanvasRenderingContext2D,
  cssW: number, cssH: number,
  redness: number,
) {
  if (redness <= 0.02) return;
  // Subtle red stamp glow at the screen corners — the page is "burning
  // with stress" at higher floors. Much lighter than the night-sky
  // version since we're on cream paper now.
  const grad = ctx.createRadialGradient(
    cssW / 2, cssH / 2, Math.min(cssW, cssH) * 0.20,
    cssW / 2, cssH / 2, Math.max(cssW, cssH) * 0.80,
  );
  grad.addColorStop(0, 'rgba(178, 43, 31, 0)');
  grad.addColorStop(1, `rgba(178, 43, 31, ${0.30 * redness})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cssW, cssH);
}

// ─── Toast ────────────────────────────────────────────────────────────

export function drawFloatToast(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, screenY: number,
  age: number, life: number,
  color: string,
) {
  const t = age / life;
  if (t >= 1) return;
  const yOff = -28 * t;
  const alpha = 1 - t * t;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.font = 'bold 16px "Playfair Display", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 4;
  ctx.fillText(text, x, screenY + yOff);
  ctx.restore();
}

// ─── Helpers ──────────────────────────────────────────────────────────

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return `rgb(${r},${g},${bl})`;
}
function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
