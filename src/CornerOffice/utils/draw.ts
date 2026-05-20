// v0.2 — radical visual cleanup.
//
// Cuts the busy lit-window grid (it competed with brown desks at a
// glance) for a quiet dark sky with faint floor markers every 10
// floors. Redraws the player as a recognizable suit-and-tie figure
// with motion-driven tie + hair + body tilt so the climb reads as a
// real character, not a stack of rectangles.

import {
  PLAYER_W, PLAYER_H, FLOOR_HEIGHT_PX,
  type Platform, type Pickup, type Hazard, type Player,
} from '../types';

// ─── Background ───────────────────────────────────────────────────────

/** Dark sky gradient — slate at the lobby, smoldering red up top. */
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

/**
 * Floor markers — faint horizontal rules every 10 floors with the floor
 * number on the right. These ARE the background. No competing imagery.
 *
 * Args:
 *   startWorldY — player feet at start (worldY of floor 0)
 *   cameraY     — top of visible window in world coords
 *   scale       — logical → screen px multiplier
 */
export function drawFloorMarkers(
  ctx: CanvasRenderingContext2D,
  cssW: number, cssH: number,
  startWorldY: number,
  cameraY: number,
  scale: number,
) {
  ctx.save();
  // A faint ledger-paper feeling for the climb.
  ctx.font = `bold ${Math.round(11 * scale)}px Inter, sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  // Find the first multiple-of-10 floor whose y is at-or-below screen top.
  const logicalH = cssH / scale;
  const topFloor = Math.ceil((startWorldY - cameraY) / FLOOR_HEIGHT_PX);
  const botFloor = Math.floor((startWorldY - (cameraY + logicalH)) / FLOOR_HEIGHT_PX);

  // Iterate every floor between bot and top, draw only multiples of 10.
  for (let f = Math.max(0, botFloor); f <= topFloor; f++) {
    if (f === 0 || f % 10 !== 0) continue;
    const worldY = startWorldY - f * FLOOR_HEIGHT_PX;
    const sy = (worldY - cameraY) * scale;
    if (sy < -16 || sy > cssH + 16) continue;

    // line
    ctx.strokeStyle = 'rgba(244, 236, 216, 0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, sy);
    ctx.lineTo(cssW, sy);
    ctx.stroke();

    // label
    ctx.fillStyle = 'rgba(215, 181, 106, 0.30)';
    ctx.fillText(`FL.${f}`, cssW - 12, sy - 10);
  }
  ctx.restore();
}

// ─── Platforms ────────────────────────────────────────────────────────

export function drawPlatform(
  ctx: CanvasRenderingContext2D,
  p: Platform,
  screenY: number,
  scale: number,
  now: number,
) {
  const squish = p.squishUntil && now < p.squishUntil
    ? Math.sin(((p.squishUntil - now) / 220) * Math.PI) * 0.55
    : 0;
  const w = p.w * scale;
  const h = p.h * scale * (1 - squish);
  const yTop = screenY + (p.h * scale - h);
  const x = p.x * scale - w / 2;

  switch (p.kind) {
    case 'desk':
      // Wood desktop: warm brown plank, single highlight rail.
      roundRect(ctx, x, yTop, w, h, 4);
      ctx.fillStyle = '#7a4524';
      ctx.fill();
      ctx.fillStyle = '#a6643c';
      ctx.fillRect(x + 3, yTop + 3, w - 6, 3);
      ctx.fillStyle = '#3a1e0a';
      ctx.fillRect(x + 6, yTop + h - 3, w - 12, 1.4);
      break;

    case 'spring':
      // Bright teal coil — high contrast against everything else.
      roundRect(ctx, x, yTop, w, h, 4);
      ctx.fillStyle = '#2da3a0';
      ctx.fill();
      // coil ridges
      ctx.strokeStyle = '#7feadf';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 1; i <= 4; i++) {
        const cy = yTop + (i / 5) * h;
        ctx.moveTo(x + 4, cy);
        ctx.lineTo(x + w - 4, cy);
      }
      ctx.stroke();
      break;

    case 'moving':
      // Slate with rim shine — distinctive without color clash.
      roundRect(ctx, x, yTop, w, h, 4);
      ctx.fillStyle = '#3d4a5e';
      ctx.fill();
      ctx.fillStyle = '#6f88a9';
      ctx.fillRect(x + 3, yTop + 3, w - 6, 3);
      // direction nub
      ctx.fillStyle = '#e3ce95';
      const dirSign = (p.vx ?? 0) >= 0 ? 1 : -1;
      ctx.beginPath();
      const nx = x + w / 2 + dirSign * (w * 0.30);
      ctx.moveTo(nx, yTop + h * 0.30);
      ctx.lineTo(nx + dirSign * 6, yTop + h * 0.55);
      ctx.lineTo(nx, yTop + h * 0.80);
      ctx.closePath();
      ctx.fill();
      break;
  }
}

// ─── Pickups (latte only) ─────────────────────────────────────────────

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
  // cup body
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
  // steam — two wavy lines
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

// ─── Hazard (burnout) ────────────────────────────────────────────────

export function drawHazard(
  ctx: CanvasRenderingContext2D,
  h: Hazard,
  screenY: number,
  scale: number,
  now: number,
) {
  const pulse = 1 + Math.sin(now / 160 + h.phase) * 0.10;
  ctx.save();
  ctx.translate(h.x * scale, screenY);
  ctx.scale(pulse * scale, pulse * scale);

  const r = 14;
  const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, r + 4);
  grad.addColorStop(0, 'rgba(255, 200, 160, 0.95)');
  grad.addColorStop(0.5, 'rgba(214, 50, 36, 0.95)');
  grad.addColorStop(1, 'rgba(120, 12, 8, 0.20)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  const points = 9;
  for (let i = 0; i < points * 2; i++) {
    const ang = (i / (points * 2)) * Math.PI * 2 + h.phase;
    const rad = i % 2 === 0 ? r + 4 : r - 2;
    const x = Math.cos(ang) * rad;
    const y = Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#fff6e8';
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', 0, 0);

  ctx.restore();
}

// ─── Player (a recognizable suit silhouette) ──────────────────────────
//
// The figure tilts toward its motion, the tie swings as a pendulum, the
// hair-tuft fights gravity, and the eyes change with vy. The whole
// sprite is drawn relative to a single origin so animation is just a
// translate / rotate / scale wrapper around static geometry.

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  p: Player,
  screenY: number,
  scale: number,
  now: number,
) {
  // Body tilt — proportional to horizontal speed but capped.
  const tilt = Math.max(-0.22, Math.min(0.22, p.vx * 0.42));
  // Squash & stretch — based on vy.
  const stretch = Math.max(-0.16, Math.min(0.16, -p.vy * 0.10));
  const sx = 1 - stretch * 0.5;
  const sy = 1 + stretch;

  ctx.save();
  ctx.translate(p.x * scale, screenY);
  ctx.rotate(tilt);
  ctx.scale(scale * sx, scale * sy);

  // Coords are now in logical px, origin at feet center.
  // We draw upward (negative y).

  // ── Shadow at the feet ──
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(0, 1, PLAYER_W * 0.42, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // ── Legs (knees bent slightly when stretched) ──
  ctx.fillStyle = '#1d1d28';
  // left leg
  ctx.beginPath();
  ctx.moveTo(-8, -2);
  ctx.lineTo(-5, -2);
  ctx.lineTo(-4, -18);
  ctx.lineTo(-9, -18);
  ctx.closePath();
  ctx.fill();
  // right leg
  ctx.beginPath();
  ctx.moveTo(4, -2);
  ctx.lineTo(8, -2);
  ctx.lineTo(9, -18);
  ctx.lineTo(5, -18);
  ctx.closePath();
  ctx.fill();
  // shoes
  ctx.fillStyle = '#070707';
  roundRect(ctx, -11, -3, 8, 3, 1);
  ctx.fill();
  roundRect(ctx, 3, -3, 8, 3, 1);
  ctx.fill();

  // ── Torso (suit jacket) ──
  ctx.fillStyle = '#26262f';
  // a curvy trapezoid for the jacket
  ctx.beginPath();
  ctx.moveTo(-12, -18);
  ctx.lineTo(12, -18);
  ctx.lineTo(14, -42);
  ctx.lineTo(-14, -42);
  ctx.closePath();
  ctx.fill();
  // collar V (cream)
  ctx.fillStyle = '#f4ecd8';
  ctx.beginPath();
  ctx.moveTo(-7, -42);
  ctx.lineTo(7, -42);
  ctx.lineTo(0, -32);
  ctx.closePath();
  ctx.fill();
  // lapels (darker stripes)
  ctx.fillStyle = '#16161d';
  ctx.beginPath();
  ctx.moveTo(-12, -18);
  ctx.lineTo(-1, -32);
  ctx.lineTo(-3, -42);
  ctx.lineTo(-13, -42);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(12, -18);
  ctx.lineTo(1, -32);
  ctx.lineTo(3, -42);
  ctx.lineTo(13, -42);
  ctx.closePath();
  ctx.fill();

  // ── Tie (swings opposite to body tilt — pendulum) ──
  const tieSwing = -tilt * 1.5 + Math.sin(now / 220) * 0.04;
  ctx.save();
  ctx.translate(0, -32);
  ctx.rotate(tieSwing);
  ctx.fillStyle = '#c1322a';
  ctx.beginPath();
  ctx.moveTo(-3, 0);
  ctx.lineTo(3, 0);
  ctx.lineTo(4, 16);
  ctx.lineTo(0, 21);
  ctx.lineTo(-4, 16);
  ctx.closePath();
  ctx.fill();
  // tie knot
  ctx.fillStyle = '#7f1e18';
  roundRect(ctx, -3.5, -2, 7, 5, 1);
  ctx.fill();
  ctx.restore();

  // ── Arms (small swing) ──
  const armSwing = -tilt * 1.0;
  ctx.fillStyle = '#1d1d28';
  // left
  ctx.save();
  ctx.translate(-12, -36);
  ctx.rotate(armSwing);
  roundRect(ctx, -3, 0, 6, 22, 2);
  ctx.fill();
  ctx.fillStyle = '#e3b89a';
  ctx.beginPath();
  ctx.arc(0, 23, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // right
  ctx.fillStyle = '#1d1d28';
  ctx.save();
  ctx.translate(12, -36);
  ctx.rotate(-armSwing);
  roundRect(ctx, -3, 0, 6, 22, 2);
  ctx.fill();
  ctx.fillStyle = '#e3b89a';
  ctx.beginPath();
  ctx.arc(0, 23, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // ── Head ──
  ctx.fillStyle = '#e3b89a';
  ctx.beginPath();
  ctx.arc(0, -52, 11, 0, Math.PI * 2);
  ctx.fill();

  // ── Hair (with motion-driven tuft) ──
  ctx.fillStyle = '#1a0e06';
  // base helmet
  ctx.beginPath();
  ctx.arc(0, -54, 11, Math.PI, Math.PI * 2);
  ctx.fill();
  // side part block on the heavier side
  ctx.fillRect(-10, -54, 7, 6);
  // tuft: a small swoop that flicks opposite to motion (wind in the climb)
  const tuftAng = -tilt * 1.8 - 0.15;
  ctx.save();
  ctx.translate(-2, -62);
  ctx.rotate(tuftAng);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-2, -6, -8, -7);
  ctx.quadraticCurveTo(-3, -2, 0, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // ── Eyes & mouth ──
  // Eyes track the climb: looking up when rising, wide when falling.
  ctx.fillStyle = '#0a0a0a';
  if (p.vy < -0.15) {
    // rising — closed concentration lines
    ctx.fillRect(-5, -55, 3, 1);
    ctx.fillRect(2, -55, 3, 1);
  } else if (p.vy > 0.45) {
    // falling fast — wide-eyed
    ctx.beginPath();
    ctx.arc(-3.5, -53, 1.8, 0, Math.PI * 2);
    ctx.arc(3.5, -53, 1.8, 0, Math.PI * 2);
    ctx.fill();
    // worried mouth
    ctx.strokeStyle = '#0a0a0a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -45, 2.5, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  } else {
    // neutral
    ctx.fillRect(-4.5, -54, 2, 2);
    ctx.fillRect(2.5, -54, 2, 2);
  }

  ctx.restore();

  // hit flash overlay
  if (now < p.hitUntil) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 78, 60, 0.32)';
    ctx.beginPath();
    ctx.arc(p.x * scale, screenY - PLAYER_H * scale * 0.5,
            PLAYER_W * scale * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ─── HUD (one number, centered top, that's it) ────────────────────────

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
  // Slight drop shadow so the number reads against any background tone.
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.fillText(String(floor), cssW / 2, 22);
  ctx.restore();
}

/** Red panic vignette. */
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

/** Lobby silhouette — a single distant tower at the very bottom of the
 *  climb, drawn only when the camera is near the start so it doesn't
 *  follow the player up forever. */
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
  // city skyline ground band
  const horizon = lobbyScreenY + 80;
  ctx.fillRect(0, horizon, cssW, cssH - horizon);

  // a single tower silhouette right-of-center
  ctx.fillStyle = 'rgba(16, 10, 18, 0.9)';
  const towerX = cssW * 0.62;
  const towerW = cssW * 0.18;
  ctx.fillRect(towerX, horizon - 140, towerW, 140);
  ctx.fillRect(towerX + towerW * 0.4, horizon - 168, towerW * 0.2, 30);

  // a second smaller tower left
  ctx.fillRect(cssW * 0.10, horizon - 90, cssW * 0.12, 90);
  ctx.restore();
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
