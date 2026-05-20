// All canvas drawing for Corner Office. Pure functions so the game loop
// stays focused on physics. Coords are CSS px in the camera's local frame.

import {
  GAME_W, PLAYER_W, PLAYER_H,
  type Platform, type Pickup, type Hazard, type Player,
} from '../types';

// ─── Background ───────────────────────────────────────────────────────

/**
 * Tower-interior gradient. Wallpaper deepens from navy at the bottom
 * (lobby) toward smoky red at the top (burnout). `redness` is 0..1.
 */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  cssW: number, cssH: number,
  redness: number,
) {
  const top = mix('#1a0c14', '#3a0a14', redness);
  const mid = mix('#0e1422', '#240712', redness);
  const bot = mix('#070b14', '#100309', redness);
  const grad = ctx.createLinearGradient(0, 0, 0, cssH);
  grad.addColorStop(0, top);
  grad.addColorStop(0.55, mid);
  grad.addColorStop(1, bot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, cssW, cssH);
}

/**
 * Distant office windows scrolling at parallax. Renders a sparse grid of
 * warm-lit rectangles that shifts vertically with the camera (slower).
 */
export function drawWindows(
  ctx: CanvasRenderingContext2D,
  cssW: number, cssH: number,
  cameraY: number,
  redness: number,
) {
  const winW = 22;
  const winH = 34;
  const colGap = 44;
  const rowGap = 64;
  const parallax = cameraY * 0.35;            // far layer scrolls slower
  const offsetY = -((parallax % rowGap) + rowGap) % rowGap;

  const cols = Math.ceil(cssW / colGap) + 1;
  const rows = Math.ceil(cssH / rowGap) + 2;
  const dim = 0.22 + 0.10 * (1 - redness);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * colGap + (r % 2 === 0 ? 8 : 22);
      const y = r * rowGap + offsetY;
      // Pseudo-random "lights on" pattern, stable across frames
      const seed = ((Math.floor(parallax / rowGap) + r) * 73856093) ^ (c * 19349663);
      const on = ((seed >>> 0) % 7) < 3;
      ctx.fillStyle = on
        ? `rgba(255, 198, 110, ${dim + 0.20 * (((seed >>> 4) & 7) / 7)})`
        : `rgba(40, 50, 70, 0.35)`;
      ctx.fillRect(x, y, winW, winH);
    }
  }
}

// ─── Platforms ────────────────────────────────────────────────────────

export function drawPlatform(
  ctx: CanvasRenderingContext2D,
  p: Platform,
  screenY: number,
  now: number,
) {
  const squish = p.squishUntil && now < p.squishUntil
    ? Math.sin(((p.squishUntil - now) / 220) * Math.PI) * 0.55
    : 0;
  const h = p.h * (1 - squish);
  const yTop = screenY + (p.h - h);
  const x = p.x - p.w / 2;

  switch (p.kind) {
    case 'desk':
      // wood desktop with subtle drawer line
      roundRect(ctx, x, yTop, p.w, h, 3);
      ctx.fillStyle = '#6b3d20';
      ctx.fill();
      ctx.fillStyle = '#8a5230';
      ctx.fillRect(x + 2, yTop + 2, p.w - 4, 2);
      ctx.fillStyle = '#3c220f';
      ctx.fillRect(x + 6, yTop + h - 3, p.w - 12, 1);
      break;

    case 'chair':
      // pale beige rounded chair seat
      roundRect(ctx, x, yTop, p.w, h, h / 2);
      ctx.fillStyle = '#c8b290';
      ctx.fill();
      ctx.fillStyle = '#7c6748';
      ctx.fillRect(x + p.w / 2 - 1, yTop + h - 1, 2, 4); // chair post
      break;

    case 'meeting':
      // standing-meeting circle: dotted floor mat
      ctx.fillStyle = '#9d3a26';
      roundRect(ctx, x, yTop, p.w, h, 5);
      ctx.fill();
      ctx.fillStyle = '#f3d8c7';
      for (let i = 0; i < 5; i++) {
        const dx = x + 10 + i * ((p.w - 20) / 4);
        ctx.beginPath();
        ctx.arc(dx, yTop + h / 2, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;

    case 'kombucha':
      // teal tap with brass nozzle
      ctx.fillStyle = '#2a8b86';
      roundRect(ctx, x, yTop, p.w, h, 3);
      ctx.fill();
      ctx.fillStyle = '#62d8c9';
      ctx.fillRect(x + 2, yTop + 1, p.w - 4, 2);
      // little tap silhouette
      ctx.fillStyle = '#d6a04a';
      ctx.fillRect(x + p.w / 2 - 2, yTop - 6, 4, 6);
      ctx.fillRect(x + p.w / 2 - 5, yTop - 8, 10, 3);
      break;

    case 'moving_desk':
      roundRect(ctx, x, yTop, p.w, h, 3);
      ctx.fillStyle = '#3d6079';
      ctx.fill();
      ctx.fillStyle = '#5a87a8';
      ctx.fillRect(x + 2, yTop + 2, p.w - 4, 2);
      // wheels
      ctx.fillStyle = '#1a2530';
      ctx.beginPath(); ctx.arc(x + 6,        yTop + h + 2, 2, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + p.w - 6,  yTop + h + 2, 2, 0, Math.PI * 2); ctx.fill();
      break;

    case 'coffin':
      // brass plaque on rich wood — final platform
      roundRect(ctx, x, yTop, p.w, h, 4);
      ctx.fillStyle = '#2a1206';
      ctx.fill();
      ctx.strokeStyle = '#d7b56a';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 3, yTop + 3, p.w - 6, h - 6);
      ctx.fillStyle = '#d7b56a';
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('R.I.P.', x + p.w / 2, yTop + h / 2);
      break;
  }
}

// ─── Pickups ──────────────────────────────────────────────────────────

export function drawPickup(
  ctx: CanvasRenderingContext2D,
  p: Pickup,
  screenY: number,
  now: number,
) {
  // floaty hover
  const bob = Math.sin(now / 220 + p.id) * 1.5;
  const y = screenY + bob;

  ctx.save();
  ctx.translate(p.x, y);

  switch (p.kind) {
    case 'latte': {
      // coffee cup: white body, brown lid, steam
      ctx.fillStyle = '#f4ecd8';
      roundRect(ctx, -8, -10, 16, 18, 2); ctx.fill();
      ctx.fillStyle = '#5b3621';
      roundRect(ctx, -9, -13, 18, 5, 2); ctx.fill();
      // sleeve
      ctx.fillStyle = '#b07b48';
      ctx.fillRect(-8, -3, 16, 6);
      // ☆ heart-shaped foam mark
      ctx.fillStyle = '#c8966a';
      ctx.font = 'bold 6px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('☕', 0, 0);
      break;
    }
    case 'vest': {
      // blue argyle vest = diamond
      ctx.beginPath();
      ctx.moveTo(0, -11);
      ctx.lineTo(9, 0);
      ctx.lineTo(0, 11);
      ctx.lineTo(-9, 0);
      ctx.closePath();
      ctx.fillStyle = '#2e6cb8';
      ctx.fill();
      ctx.strokeStyle = '#9bc0ec';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = '#f3ece0';
      ctx.font = 'bold 8px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 0);
      break;
    }
    case 'adderall': {
      // capsule pill, orange + white
      ctx.fillStyle = '#e87b2f';
      roundRect(ctx, -10, -5, 10, 10, 5); ctx.fill();
      ctx.fillStyle = '#f4ecd8';
      roundRect(ctx, 0, -5, 10, 10, 5); ctx.fill();
      ctx.strokeStyle = '#3a1a08';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(0, -5); ctx.lineTo(0, 5);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

// ─── Hazards ──────────────────────────────────────────────────────────

export function drawHazard(
  ctx: CanvasRenderingContext2D,
  h: Hazard,
  screenY: number,
  now: number,
) {
  const pulse = 1 + Math.sin(now / 160 + h.phase) * 0.08;
  ctx.save();
  ctx.translate(h.x, screenY);
  ctx.scale(pulse, pulse);

  // angry red panic bubble — outer glow + body + jagged spikes
  const r = 14;
  const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, r + 4);
  grad.addColorStop(0, 'rgba(255, 200, 160, 0.95)');
  grad.addColorStop(0.5, 'rgba(214, 50, 36, 0.95)');
  grad.addColorStop(1, 'rgba(120, 12, 8, 0.20)');
  ctx.fillStyle = grad;
  // jagged star outline
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

  // exclamation mark
  ctx.fillStyle = '#fff6e8';
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('!', 0, 0);

  ctx.restore();
}

// ─── Player (anonymous office worker silhouette) ──────────────────────

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  p: Player,
  screenY: number,
  now: number,
) {
  const x = p.x - PLAYER_W / 2;
  const y = screenY - PLAYER_H;

  // squash & stretch based on vy
  const stretch = Math.max(-0.18, Math.min(0.18, -p.vy * 0.10));
  const sx = 1 - stretch * 0.6;
  const sy = 1 + stretch;

  ctx.save();
  ctx.translate(p.x, screenY);
  ctx.scale(sx, sy);
  ctx.translate(-p.x, -screenY);

  // body silhouette (charcoal suit, white collar, red tie)
  // legs
  ctx.fillStyle = '#1a1a22';
  ctx.fillRect(x + 9, y + 38, 8, 18);
  ctx.fillRect(x + PLAYER_W - 17, y + 38, 8, 18);
  // shoes
  ctx.fillStyle = '#070707';
  ctx.fillRect(x + 7, y + 54, 12, 3);
  ctx.fillRect(x + PLAYER_W - 19, y + 54, 12, 3);
  // torso (suit jacket)
  roundRect(ctx, x + 4, y + 18, PLAYER_W - 8, 24, 3);
  ctx.fillStyle = '#23232f';
  ctx.fill();
  // collar V
  ctx.fillStyle = '#f4ecd8';
  ctx.beginPath();
  ctx.moveTo(x + PLAYER_W / 2 - 5, y + 18);
  ctx.lineTo(x + PLAYER_W / 2 + 5, y + 18);
  ctx.lineTo(x + PLAYER_W / 2, y + 26);
  ctx.closePath();
  ctx.fill();
  // red tie
  ctx.fillStyle = '#c1322a';
  ctx.beginPath();
  ctx.moveTo(x + PLAYER_W / 2 - 2, y + 23);
  ctx.lineTo(x + PLAYER_W / 2 + 2, y + 23);
  ctx.lineTo(x + PLAYER_W / 2 + 3, y + 36);
  ctx.lineTo(x + PLAYER_W / 2, y + 40);
  ctx.lineTo(x + PLAYER_W / 2 - 3, y + 36);
  ctx.closePath();
  ctx.fill();
  // head (skin)
  ctx.fillStyle = '#e3b89a';
  ctx.beginPath();
  ctx.arc(x + PLAYER_W / 2, y + 12, 10, 0, Math.PI * 2);
  ctx.fill();
  // hair (slick side-part)
  ctx.fillStyle = '#1a1208';
  ctx.beginPath();
  ctx.arc(x + PLAYER_W / 2, y + 9, 10, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x + PLAYER_W / 2 - 10, y + 9, 6, 6);

  // eyes — closed dots when going up fast (concentration), open when falling
  ctx.fillStyle = '#222';
  if (p.vy > 0.3) {
    ctx.fillRect(x + PLAYER_W / 2 - 4, y + 12, 2, 2);
    ctx.fillRect(x + PLAYER_W / 2 + 2, y + 12, 2, 2);
  } else {
    ctx.fillRect(x + PLAYER_W / 2 - 4, y + 13, 2, 1);
    ctx.fillRect(x + PLAYER_W / 2 + 2, y + 13, 2, 1);
  }

  ctx.restore();

  // vest shimmer overlay
  if (p.vested) {
    const flicker = 0.5 + 0.5 * Math.sin(now / 90);
    ctx.strokeStyle = `rgba(155, 192, 236, ${0.45 + flicker * 0.35})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, screenY - PLAYER_H / 2, PLAYER_W * 0.55, 0, Math.PI * 2);
    ctx.stroke();
  }
  // adderall halo
  if (p.adderallNext) {
    ctx.strokeStyle = `rgba(232, 123, 47, ${0.6 + 0.3 * Math.sin(now / 110)})`;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(p.x, screenY - PLAYER_H / 2, PLAYER_W * 0.62, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// ─── HUD ──────────────────────────────────────────────────────────────

export function drawHUD(
  ctx: CanvasRenderingContext2D,
  cssW: number,
  floor: number,
  best: number,
  redness: number,
) {
  // top-left: current floor
  ctx.save();
  ctx.fillStyle = `rgba(0,0,0,${0.32 + redness * 0.2})`;
  roundRect(ctx, 12, 12, 86, 32, 6);
  ctx.fill();
  ctx.fillStyle = '#f4ecd8';
  ctx.font = 'bold 10px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('FLOOR', 22, 17);
  ctx.font = 'bold 18px Playfair Display, serif';
  ctx.fillText(String(floor).padStart(3, '0'), 22, 26);

  // top-right: best
  const rightW = 78;
  const rightX = cssW - 12 - rightW;
  ctx.fillStyle = `rgba(0,0,0,${0.28 + redness * 0.2})`;
  roundRect(ctx, rightX, 12, rightW, 32, 6);
  ctx.fill();
  ctx.fillStyle = '#d7b56a';
  ctx.font = 'bold 9px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('BEST', cssW - 18, 17);
  ctx.fillStyle = '#f4ecd8';
  ctx.font = 'bold 16px Playfair Display, serif';
  ctx.fillText(String(best).padStart(3, '0'), cssW - 18, 26);
  ctx.restore();
}

/** Red panic vignette — driven by `redness` 0..1. */
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

// ─── Helpers ──────────────────────────────────────────────────────────

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
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

/** Floating "+N" toast pinned to world coords; the caller converts to screen y. */
export function drawFloatToast(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, screenY: number,
  age: number, life: number,
  color: string,
) {
  const t = age / life;
  if (t >= 1) return;
  const yOff = -22 * t;
  const alpha = 1 - t * t;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.font = 'bold 14px Playfair Display, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, screenY + yOff);
  ctx.restore();
}

// Tower side margin — keeps platforms off the edge so the player can wrap.
export function withinPlayfield(x: number): number {
  return Math.max(0, Math.min(GAME_W, x));
}
