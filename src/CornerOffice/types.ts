// v0.2 — radically simplified type surface.
//
// Cut: chair, meeting, coffin platforms; vest, adderall pickups. The
// fewer moving parts, the less the player has to decode at a glance.

export const GAME_W = 360;
export const PLAYER_W = 64;
export const PLAYER_H = 90;

// v0.4 physics: weightier fall + sharper jump impulse. The character
// used to feel like it was on the moon — gravity bumped 30% so the
// fall reads as gravity, not levitation. Peak height stays close to
// v0.3 (≈210 vs 225 px) because impulse rises in step.
export const GRAVITY = 0.0026;                  // px / ms^2
export const JUMP_V_BASE = -1.05;               // px / ms
export const JUMP_V_SPRING = -1.75;             // printer kick
export const MAX_FALL_SPEED = 2.4;
export const FLOOR_HEIGHT_PX = 70;

/** Horizontal tracking decay — `1 - exp(-rate * dt)`. Higher = snappier.
 *  Frame-rate independent. 0.025/ms ≈ 90% convergence in 100ms. */
export const HORIZONTAL_DECAY_PER_MS = 0.025;
/** Camera lerp — tightened in v0.4 so the climb body-locks to the
 *  worker. Previous 0.012 made the world scroll while the character
 *  hung mid-screen → floaty. */
export const CAMERA_DECAY_PER_MS = 0.022;

/** Landing-animation duration. Drives the keyframe squash-then-stretch
 *  curve in drawPlayer so every bounce reads as "compress, snap up". */
export const LAND_ANIM_MS = 260;

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
  /** Timestamp when the current landing-anim ends. Triggers the
   *  keyframed squash-then-stretch in drawPlayer. */
  landAnimUntil: number;
}

export type GameState = 'playing' | 'gameover' | 'cleared';

export interface RunStats {
  finalFloor: number;
  pickupsLatte: number;
  burnouts: number;
  isNewBest: boolean;
  cleared: boolean;       // reached TOP_FLOOR
}
