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

// ─── Background ───────────────────────────────────────────────────────

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  cssW: number, cssH: number,
  redness: number,
) {
  const top = mix('#1c0a14', '#3f0a14', redness);
  const mid = mix('#0c121e', '#1e0610', redness);
  const bot = mix('#06080f', '#0e0408', redness);
  const grad = ctx.createLinearGradient(0, 0, 0, cssH);
  grad.addColorStop(0, top);
  grad.addColorStop(0.55, mid);
  grad.addColorStop(1, bot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cssW, cssH);
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
  ctx.font = `bold ${Math.round(10 * scale)}px Inter, sans-serif`;
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

    ctx.strokeStyle = 'rgba(244, 236, 216, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(cssW, sy);
    ctx.stroke();

    const dept = DEPARTMENTS.find(d => d.floor === f);
    const labelTxt = dept
      ? `FL.${f} · ${dept.label}`
      : `FL.${f}`;
    ctx.fillStyle = 'rgba(215, 181, 106, 0.42)';
    ctx.fillText(labelTxt, cssW - 12, sy - 10);
  }
  ctx.restore();
}

// ─── Distant skyline at the lobby ─────────────────────────────────────

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
  ctx.fillStyle = 'rgba(8, 4, 10, 0.85)';
  const horizon = lobbyScreenY + 70;
  ctx.fillRect(0, horizon, cssW, cssH - horizon);

  // A row of skyscraper silhouettes with a hint of lit windows.
  const towers: Array<[number, number, number]> = [
    // [centerX_ratio, w, h]
    [0.05, 0.10, 100],
    [0.22, 0.14, 160],
    [0.42, 0.10, 110],
    [0.58, 0.18, 200],
    [0.78, 0.12, 130],
    [0.92, 0.10, 90],
  ];
  ctx.fillStyle = 'rgba(16, 10, 18, 0.95)';
  for (const [cxR, wR, h] of towers) {
    const w = cssW * wR;
    const x = cssW * cxR - w / 2;
    ctx.fillRect(x, horizon - h, w, h);
  }
  // a few faint warm-lit windows on the tallest tower
  ctx.fillStyle = 'rgba(255, 198, 110, 0.18)';
  const t = towers[3];
  const tw = cssW * t[1], tx = cssW * t[0] - tw / 2, th = t[2];
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 4; c++) {
      if (((r * 4 + c) * 7919) % 5 !== 0) continue;
      ctx.fillRect(tx + 6 + c * (tw / 4),
                   horizon - th + 14 + r * (th / 8),
                   tw * 0.15, th * 0.045);
    }
  }
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
      // SVG viewBox 240×80; collision is the desktop slab from y=40 to y=62.
      // We anchor so y=40 of the sprite lines up with p.y. The top of the
      // sprite (monitor/lamp) hangs above by 40/80 = 0.5 of drawn h.
      nativeAspect = 80 / 240;
      topAboveBy = 0.50;
      break;
    case 'spring':
      img = sprites.printer;
      // viewBox 200×90; collision = top of teal slot at y≈32.
      nativeAspect = 90 / 200;
      topAboveBy = 32 / 90;
      break;
    case 'moving':
      img = sprites.chair;
      // viewBox 220×100; collision = top of seat at y≈26.
      nativeAspect = 100 / 220;
      topAboveBy = 26 / 100;
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
  const bob = Math.sin(now / 240 + p.id) * 1.4;
  const sx = p.x * scale;
  const sy = screenY + bob;
  const s = scale;

  ctx.save();
  ctx.translate(sx, sy);

  // sleeve
  ctx.fillStyle = '#a6643c';
  roundRect(ctx, -9 * s, -3 * s, 18 * s, 7 * s, 1.4 * s);
  ctx.fill();
  // cup
  ctx.fillStyle = '#f4ecd8';
  roundRect(ctx, -8 * s, -11 * s, 16 * s, 18 * s, 2 * s);
  ctx.fill();
  // lid
  ctx.fillStyle = '#3a1f10';
  roundRect(ctx, -10 * s, -14 * s, 20 * s, 5 * s, 2 * s);
  ctx.fill();
  // sipper bump
  ctx.fillStyle = '#291108';
  roundRect(ctx, -3 * s, -16 * s, 6 * s, 3 * s, 1 * s);
  ctx.fill();
  // steam
  ctx.strokeStyle = 'rgba(244, 236, 216, 0.55)';
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

  // Sprite native aspect 256×320 (4:5). We size by PLAYER_H so the
  // body height matches the collision box; the briefcase naturally
  // extends past PLAYER_W which only matters for collision.
  const drawH = PLAYER_H * scale;
  const drawW = (256 / 320) * drawH;
  const cx = p.x * scale;
  const feetY = screenY;
  // Sprite has feet near y=290 of 320. Anchor by aligning that to feetY.
  const feetAnchor = 290 / 320;
  const drawX = -drawW / 2;
  const drawY = -drawH * feetAnchor;

  // Shadow at the feet
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.30)';
  ctx.beginPath();
  ctx.ellipse(cx, feetY + 2, PLAYER_W * scale * 0.40, 3 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

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
  ctx.fillStyle = `rgba(220, 200, 175, ${alpha * 0.55})`;
  for (const m of d.motes) {
    const x = (m.dx + d.side * spread) * scale;
    const y = -t * 4 * scale + m.dy * scale;
    ctx.beginPath();
    ctx.arc(x, y, m.r * (1 + t * 0.6) * scale, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ─── HUD ──────────────────────────────────────────────────────────────

export function drawHUD(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  floor: number,
) {
  ctx.save();
  ctx.fillStyle = 'rgba(244, 236, 216, 0.92)';
  ctx.font = 'bold 44px "Playfair Display", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillText(String(floor), cssW / 2, 22);
  ctx.restore();
}

export function drawRedTint(
  ctx: CanvasRenderingContext2D,
  cssW: number, cssH: number,
  redness: number,
) {
  if (redness <= 0.02) return;
  const grad = ctx.createRadialGradient(
    cssW / 2, cssH / 2, Math.min(cssW, cssH) * 0.18,
    cssW / 2, cssH / 2, Math.max(cssW, cssH) * 0.78,
  );
  grad.addColorStop(0, 'rgba(120, 12, 0, 0)');
  grad.addColorStop(1, `rgba(150, 8, 6, ${0.55 * redness})`);
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
