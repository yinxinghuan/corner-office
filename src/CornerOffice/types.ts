// ─── Game-wide constants ────────────────────────────────────────────────
// World coords are in CSS pixels relative to a virtual portrait playfield
// of width GAME_W (logical). The camera scrolls upward as the player climbs;
// `worldY` increases going DOWN (screen-space convention).

export const GAME_W = 360;
export const PLAYER_W = 40;
export const PLAYER_H = 56;

export const GRAVITY = 0.0014;                  // px / ms^2
export const JUMP_V_BASE = -0.78;               // px / ms — normal platform
export const JUMP_V_SPRING = -1.30;             // kombucha tap
export const JUMP_V_ADDERALL = -1.55;           // rocket hop
export const HORIZONTAL_LERP = 0.18;            // smoothing toward target x
export const MAX_FALL_SPEED = 1.6;
export const FLOOR_HEIGHT_PX = 70;              // 1 floor ≈ 70 world px climbed

export const TOP_FLOOR = 100;                   // "EXECUTIVE LIFETIME" gate
export const BURNOUT_PENALTY_FLOORS = 3;

export type PlatformKind =
  | 'desk'          // basic — brown wood
  | 'chair'         // basic — gray swivel
  | 'meeting'       // basic — orange rust ring (wider)
  | 'kombucha'      // spring — teal tap
  | 'moving_desk'   // slides left-right (rare, > floor 15)
  | 'coffin';       // executive lifetime — only at TOP_FLOOR

export interface Platform {
  id: number;
  kind: PlatformKind;
  /** Center x of platform in world. */
  x: number;
  /** Top edge y in world (player bottom must reach here to bounce). */
  y: number;
  w: number;
  h: number;
  /** For moving platforms — horizontal velocity in px/ms. */
  vx?: number;
  /** Track recent landing for compress animation (timestamp ms). */
  squishUntil?: number;
}

export type PickupKind = 'latte' | 'vest' | 'adderall';

export interface Pickup {
  id: number;
  kind: PickupKind;
  x: number;
  y: number;
  taken: boolean;
}

export type HazardKind = 'burnout';

export interface Hazard {
  id: number;
  kind: HazardKind;
  x: number;
  y: number;
  /** Oscillation phase seed (radians) for floaty motion. */
  phase: number;
  baseX: number;
}

export interface Player {
  x: number;            // world x (center)
  y: number;            // world y (bottom of sprite — feet)
  vx: number;
  vy: number;
  targetX: number;      // smoothed input target
  facing: 1 | -1;
  vested: boolean;      // stock-vest shield, absorbs next burnout
  adderallNext: boolean; // next bounce uses ADDERALL hop
  /** Brief invuln window after a hit so we don't multi-trigger. */
  hitUntil: number;
}

export type GameState = 'playing' | 'gameover' | 'cleared';

export interface RunStats {
  finalFloor: number;
  pickupsLatte: number;
  pickupsVest: number;
  pickupsAdderall: number;
  burnouts: number;
  isNewBest: boolean;
  cleared: boolean;       // reached TOP_FLOOR
}
