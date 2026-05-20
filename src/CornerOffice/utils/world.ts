// v0.2 — focused platform/pickup/hazard generation.
//
// Three platform kinds, one pickup, one hazard. Simpler weights, less
// to read on screen.

import {
  GAME_W, FLOOR_HEIGHT_PX, TOP_FLOOR,
  type Platform, type PlatformKind, type Pickup, type Hazard,
} from '../types';

let nextId = 1;
const id = () => nextId++;

const PLATFORM_GAP = 76;
const GAP_JITTER = 24;
const EDGE_PAD = 26;

function floorAtWorldY(startY: number, worldY: number): number {
  return Math.max(0, Math.floor((startY - worldY) / FLOOR_HEIGHT_PX));
}

function pickPlatformKind(floor: number): PlatformKind {
  // Below floor 10: only desks and the occasional spring (warm-up).
  // Above floor 10: introduce moving desks.
  // Above floor 30: more springs (variety) + more moving (challenge).
  if (floor < 4) return 'desk';

  const r = Math.random();
  if (floor < 10) {
    if (r < 0.84) return 'desk';
    return 'spring';
  }
  if (floor < 30) {
    if (r < 0.66) return 'desk';
    if (r < 0.84) return 'spring';
    return 'moving';
  }
  if (r < 0.55) return 'desk';
  if (r < 0.76) return 'spring';
  return 'moving';
}

function platformDims(kind: PlatformKind): { w: number; h: number } {
  switch (kind) {
    case 'desk':   return { w: 96, h: 16 };
    case 'spring': return { w: 76, h: 16 };
    case 'moving': return { w: 88, h: 16 };
  }
}

export interface WorldChunk {
  platforms: Platform[];
  pickups: Pickup[];
  hazards: Hazard[];
  /** Lowest (largest) y written. */
  bottomY: number;
}

/** Preload-safe demo state: just the wide starter desk. */
export function seedDemoOnly(startY: number): WorldChunk {
  return {
    platforms: [{
      id: id(),
      kind: 'desk',
      x: GAME_W / 2,
      y: startY + 8,
      w: 150,
      h: 18,
    }],
    pickups: [],
    hazards: [],
    bottomY: startY,
  };
}

/** Add rows upward until `chunk.bottomY` is above `topY`. */
export function populateAbove(
  chunk: WorldChunk,
  topY: number,
  startY: number,
) {
  while (chunk.bottomY > topY) {
    chunk.bottomY -= PLATFORM_GAP + rand(-GAP_JITTER, GAP_JITTER);
    const floor = floorAtWorldY(startY, chunk.bottomY);
    addPlatformRow(chunk, chunk.bottomY, floor, startY);
    if (floor >= TOP_FLOOR) break;
  }
}

function addPlatformRow(chunk: WorldChunk, y: number, floor: number, _startY: number) {
  const kind = pickPlatformKind(floor);
  const { w, h } = platformDims(kind);
  const x = rand(EDGE_PAD + w / 2, GAME_W - EDGE_PAD - w / 2);
  const p: Platform = { id: id(), kind, x, y, w, h };
  if (kind === 'moving') {
    const dir = Math.random() < 0.5 ? -1 : 1;
    p.vx = dir * (0.04 + Math.random() * 0.04);
  }
  chunk.platforms.push(p);

  // Latte chance — gently rises with altitude.
  if (Math.random() < 0.14 + Math.min(0.10, floor / 200)) {
    chunk.pickups.push({
      id: id(),
      kind: 'latte',
      x: clamp(x + rand(-30, 30), 18, GAME_W - 18),
      y: y - 22,
      taken: false,
    });
  }

  // Burnout chance — none below fl.7, modest growth thereafter.
  if (floor >= 7 && Math.random() < 0.05 + Math.min(0.22, floor / 140)) {
    const hx = rand(30, GAME_W - 30);
    const hy = y - rand(30, 58);
    chunk.hazards.push({
      id: id(),
      kind: 'burnout',
      x: hx, y: hy, baseX: hx,
      phase: Math.random() * Math.PI * 2,
    });
  }
}

export function pruneBelow(chunk: WorldChunk, killY: number) {
  chunk.platforms = chunk.platforms.filter(p => p.y < killY);
  chunk.pickups = chunk.pickups.filter(p => p.y < killY);
  chunk.hazards = chunk.hazards.filter(h => h.y < killY);
}

function rand(a: number, b: number) { return a + Math.random() * (b - a); }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }
