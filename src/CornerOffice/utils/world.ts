// Procedural platform / pickup / hazard generator. The hook calls
// `seedInitial` once and `populateAbove` whenever the camera reveals
// new world above `topY`.

import {
  GAME_W, FLOOR_HEIGHT_PX, TOP_FLOOR,
  type Platform, type PlatformKind, type Pickup, type Hazard, type PickupKind,
} from '../types';

let nextId = 1;
const id = () => nextId++;

const PLATFORM_GAP = 70;          // average vertical gap between platforms (px)
const GAP_JITTER = 28;
const EDGE_PAD = 28;

// ─── Difficulty curve ────────────────────────────────────────────────

/** Floor number for a given worldY relative to start. */
function floorAtWorldY(startY: number, worldY: number): number {
  return Math.max(0, Math.floor((startY - worldY) / FLOOR_HEIGHT_PX));
}

/**
 * Weighted platform kind picker — kombucha & moving become more common
 * higher up; coffin reserved for the very top floor.
 */
function pickPlatformKind(floor: number): PlatformKind {
  if (floor >= TOP_FLOOR) return 'coffin';
  const r = Math.random();
  // Base weights
  let w_desk = 0.45;
  let w_chair = 0.22;
  let w_meeting = 0.10;
  let w_kombu = 0.18;
  let w_moving = 0.0;
  if (floor > 8)  { w_moving = 0.06; w_chair -= 0.04; w_desk -= 0.02; }
  if (floor > 20) { w_moving = 0.12; w_kombu = 0.22; w_meeting = 0.06; w_desk -= 0.06; w_chair -= 0.06; }
  if (floor > 45) { w_moving = 0.18; w_kombu = 0.18; }
  const stops = [w_desk, w_chair, w_meeting, w_kombu, w_moving];
  const kinds: PlatformKind[] = ['desk', 'chair', 'meeting', 'kombucha', 'moving_desk'];
  let acc = 0;
  for (let i = 0; i < stops.length; i++) {
    acc += stops[i];
    if (r < acc) return kinds[i];
  }
  return 'desk';
}

function platformDims(kind: PlatformKind): { w: number; h: number } {
  switch (kind) {
    case 'desk':         return { w: 90,  h: 14 };
    case 'chair':        return { w: 60,  h: 12 };
    case 'meeting':      return { w: 110, h: 16 };
    case 'kombucha':     return { w: 72,  h: 14 };
    case 'moving_desk':  return { w: 84,  h: 14 };
    case 'coffin':       return { w: 130, h: 22 };
  }
}

// ─── Spawning ────────────────────────────────────────────────────────

export interface WorldChunk {
  platforms: Platform[];
  pickups: Pickup[];
  hazards: Hazard[];
  /** Lowest (largest) y written — useful for resuming. */
  bottomY: number;
}

/** Build the first screen worth of platforms. Starts with a wide safe
 *  desk under the player so they can't lose on tile #1. */
export function seedInitial(startY: number): WorldChunk {
  const out = seedDemoOnly(startY);
  // Fill upward.
  let y = startY - 60;
  for (let i = 0; i < 14; i++) {
    addPlatformRow(out, y, 0, startY);
    y -= PLATFORM_GAP + rand(-GAP_JITTER, GAP_JITTER);
  }
  return out;
}

/** Preload-safe demo state: just the wide starter desk so the player
 *  bounces in place on a static screen until first interaction. No
 *  platforms above, no pickups, no hazards → no chance of auto-dying
 *  while the user is still scrolling through the Aigram game list. */
export function seedDemoOnly(startY: number): WorldChunk {
  const out: WorldChunk = { platforms: [], pickups: [], hazards: [], bottomY: startY };
  out.platforms.push({
    id: id(),
    kind: 'desk',
    x: GAME_W / 2,
    y: startY + 8,
    w: 140,
    h: 16,
  });
  return out;
}

/** Add platforms until `bottomY` (most-recently-written y) is above
 *  `topY` (camera target). */
export function populateAbove(
  chunk: WorldChunk,
  topY: number,
  startY: number,
) {
  while (chunk.bottomY > topY) {
    chunk.bottomY -= PLATFORM_GAP + rand(-GAP_JITTER, GAP_JITTER);
    const floor = floorAtWorldY(startY, chunk.bottomY);
    addPlatformRow(chunk, chunk.bottomY, floor, startY);
    if (floor >= TOP_FLOOR) break;          // top reached — stop generating
  }
}

function addPlatformRow(chunk: WorldChunk, y: number, floor: number, startY: number) {
  // Top floor — single ceremonial coffin centered.
  if (floor >= TOP_FLOOR) {
    const { w, h } = platformDims('coffin');
    chunk.platforms.push({ id: id(), kind: 'coffin', x: GAME_W / 2, y, w, h });
    return;
  }

  const kind = pickPlatformKind(floor);
  const { w, h } = platformDims(kind);
  const x = rand(EDGE_PAD + w / 2, GAME_W - EDGE_PAD - w / 2);
  const p: Platform = { id: id(), kind, x, y, w, h };
  if (kind === 'moving_desk') {
    const dir = Math.random() < 0.5 ? -1 : 1;
    p.vx = dir * (0.05 + Math.random() * 0.04);    // px / ms
  }
  chunk.platforms.push(p);

  // Pickup chance — climbs slightly with floor
  if (Math.random() < 0.18 + Math.min(0.10, floor / 200)) {
    const pickupKind = pickPickupKind(floor);
    chunk.pickups.push({
      id: id(),
      kind: pickupKind,
      x: clamp(x + rand(-26, 26), 16, GAME_W - 16),
      y: y - 22,
      taken: false,
    });
  }

  // Hazard chance — none below floor 5, ramps up
  if (floor >= 5 && Math.random() < 0.06 + Math.min(0.30, floor / 110)) {
    const hx = rand(28, GAME_W - 28);
    // Push hazard above the platform row, biased to a different x
    const hy = y - rand(28, 60);
    chunk.hazards.push({
      id: id(),
      kind: 'burnout',
      x: hx,
      y: hy,
      baseX: hx,
      phase: Math.random() * Math.PI * 2,
    });
  }

  // Mark startY usage to silence TS (kept for future tuning hooks).
  void startY;
}

function pickPickupKind(floor: number): PickupKind {
  const r = Math.random();
  // Lattes most common; vest rarer and gains weight as burnouts ramp;
  // adderall least common but powerful.
  let w_latte = 0.65;
  let w_vest = 0.20;
  let w_adde = 0.15;
  if (floor > 10) { w_vest = 0.28; w_latte = 0.55; }
  if (floor > 30) { w_vest = 0.32; w_adde = 0.20; w_latte = 0.48; }
  void w_adde; // remainder = adderall
  if (r < w_latte) return 'latte';
  if (r < w_latte + w_vest) return 'vest';
  return 'adderall';
}

// ─── Cleanup ─────────────────────────────────────────────────────────

/** Drop entities far below the camera. */
export function pruneBelow(chunk: WorldChunk, killY: number) {
  chunk.platforms = chunk.platforms.filter(p => p.y < killY);
  chunk.pickups = chunk.pickups.filter(p => p.y < killY);
  chunk.hazards = chunk.hazards.filter(h => h.y < killY);
}

// ─── Misc ────────────────────────────────────────────────────────────

function rand(a: number, b: number) { return a + Math.random() * (b - a); }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
