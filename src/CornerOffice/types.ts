// v0.2 — radically simplified type surface.
//
// Cut: chair, meeting, coffin platforms; vest, adderall pickups. The
// fewer moving parts, the less the player has to decode at a glance.

export const GAME_W = 360;
export const PLAYER_W = 46;
export const PLAYER_H = 64;

// Snappier physics than v0.1.
export const GRAVITY = 0.0020;                  // px / ms^2 (was .0014)
export const JUMP_V_BASE = -0.88;               // px / ms (was -.78)
export const JUMP_V_SPRING = -1.45;             // spring desk
export const MAX_FALL_SPEED = 1.8;
export const FLOOR_HEIGHT_PX = 70;

export const TOP_FLOOR = 100;                   // EXECUTIVE LIFETIME goal
export const BURNOUT_PENALTY_FLOORS = 3;

export type PlatformKind =
  | 'desk'          // normal bounce — wood brown
  | 'spring'        // higher bounce — bright teal coil
  | 'moving';       // slides left↔right (>fl.10) — slate

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

export interface Pickup {
  id: number;
  /** v0.2 has only one pickup kind — kept as a field so the future can
   *  re-introduce variants without touching the world generator. */
  kind: 'latte';
  x: number;
  y: number;
  taken: boolean;
}

export interface Hazard {
  id: number;
  kind: 'burnout';
  x: number;
  y: number;
  /** Oscillation phase seed (radians) for floaty motion. */
  phase: number;
  baseX: number;
}

export interface Player {
  x: number;            // world x (center)
  y: number;            // world y (bottom of sprite — feet)
  vx: number;           // current horizontal velocity (px/ms)
  vy: number;           // current vertical velocity (px/ms)
  targetX: number;      // pointer target — drives horizontal tracking
  /** Brief invuln window after a hit so we don't multi-trigger. */
  hitUntil: number;
}

export type GameState = 'playing' | 'gameover' | 'cleared';

export interface RunStats {
  finalFloor: number;
  pickupsLatte: number;
  burnouts: number;
  isNewBest: boolean;
  cleared: boolean;       // reached TOP_FLOOR
}
