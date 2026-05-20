import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GAME_W, PLAYER_W, PLAYER_H,
  GRAVITY, JUMP_V_BASE, JUMP_V_SPRING,
  MAX_FALL_SPEED, FLOOR_HEIGHT_PX,
  TOP_FLOOR, BURNOUT_PENALTY_FLOORS,
  type GameState, type RunStats, type Player, type Platform,
} from '../types';
import {
  drawBackground, drawFloorMarkers, drawLobbySilhouette,
  drawPlatform, drawPickup, drawHazard,
  drawPlayer, drawHUD, drawRedTint, drawFloatToast,
} from '../utils/draw';
import {
  seedDemoOnly, populateAbove, pruneBelow, type WorldChunk,
} from '../utils/world';
import {
  unlockAudio, sfxBounce, sfxSpring, sfxLatte,
  sfxBurnout, sfxGameOver, sfxCleared, startAmbient, stopAmbient,
} from '../utils/audio';

const BEST_KEY = 'corner_office_best_v1';
const GRACE_MS = 1200;

interface Toast {
  id: number;
  text: string;
  x: number;
  yWorld: number;
  born: number;
  life: number;
  color: string;
}

export function useCornerOffice() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const [gameState, setGameState] = useState<GameState>('playing');
  const [floorDisplay, setFloorDisplay] = useState(0);
  const [best, setBest] = useState<number>(() => Number(localStorage.getItem(BEST_KEY) || 0));
  const [stats, setStats] = useState<RunStats | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  // ─── Mutable refs ────────────────────────────────────────────────────
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(performance.now());
  const startedAtRef = useRef<number>(performance.now());
  const worldRef = useRef<WorldChunk | null>(null);
  const playerRef = useRef<Player | null>(null);
  const cameraYRef = useRef<number>(0);
  const startWorldYRef = useRef<number>(0);
  const maxFloorRef = useRef<number>(0);
  const stateRef = useRef<GameState>('playing');
  const sizeRef = useRef<{ w: number; h: number; scale: number }>({ w: 360, h: 640, scale: 1 });
  const dragRef = useRef<{ active: boolean }>({ active: false });
  const toastsRef = useRef<Toast[]>([]);
  const nextToastId = useRef(1);
  const interactedRef = useRef(false);
  const runStatsRef = useRef({ pickupsLatte: 0, burnouts: 0 });

  // ─── Canvas fit ──────────────────────────────────────────────────────
  const fitCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = stage.getBoundingClientRect();
    const cssW = rect.width;
    const cssH = rect.height;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    sizeRef.current = { w: cssW, h: cssH, scale: cssW / GAME_W };
  }, []);

  // ─── World setup ─────────────────────────────────────────────────────
  const initWorld = useCallback(() => {
    const { h: cssH, scale } = sizeRef.current;
    const logicalH = cssH / scale;
    const startWorldY = logicalH * 0.55;
    startWorldYRef.current = startWorldY;
    cameraYRef.current = 0;
    maxFloorRef.current = 0;
    runStatsRef.current = { pickupsLatte: 0, burnouts: 0 };
    toastsRef.current = [];

    playerRef.current = {
      x: GAME_W / 2,
      y: startWorldY,
      vx: 0,
      vy: 0,
      targetX: GAME_W / 2,
      hitUntil: 0,
    };
    worldRef.current = seedDemoOnly(startWorldY);
    setFloorDisplay(0);
    setStats(null);
    stateRef.current = 'playing';
    setGameState('playing');
    startedAtRef.current = performance.now();
    lastTickRef.current = performance.now();
  }, []);

  // ─── Input — direct-tracking ─────────────────────────────────────────
  //
  // While the pointer is down, the player's target x becomes the touch
  // x in logical coords. Tracking happens in the tick (fast lerp).
  // When the pointer lifts, the target stays put so the player coasts
  // to a stop instead of snapping back.

  const localXFromEvent = (e: PointerEvent | React.PointerEvent): number => {
    const canvas = canvasRef.current;
    if (!canvas) return GAME_W / 2;
    const rect = canvas.getBoundingClientRect();
    const cssX = (e as PointerEvent).clientX - rect.left;
    const { scale } = sizeRef.current;
    return cssX / scale;
  };

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (stateRef.current !== 'playing') return;
    if (!interactedRef.current) {
      interactedRef.current = true;
      setHasInteracted(true);
      unlockAudio();
      startAmbient();
      if (worldRef.current) {
        populateAbove(worldRef.current, startWorldYRef.current - 200, startWorldYRef.current);
      }
      startedAtRef.current = performance.now();
    }
    dragRef.current.active = true;
    const lx = localXFromEvent(e);
    if (playerRef.current) playerRef.current.targetX = lx;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const lx = localXFromEvent(e);
    if (playerRef.current) playerRef.current.targetX = lx;
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current.active = false;
    // freeze target at current player position so they don't drift
    if (playerRef.current) playerRef.current.targetX = playerRef.current.x;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
  }, []);

  // ─── Game loop ───────────────────────────────────────────────────────
  const tick = useCallback((now: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let dt = now - lastTickRef.current;
    lastTickRef.current = now;
    if (dt > 48) dt = 48;
    if (dt < 1) dt = 1;

    const { w: cssW, h: cssH, scale } = sizeRef.current;
    const logicalH = cssH / scale;

    const player = playerRef.current;
    const world = worldRef.current;
    if (!player || !world) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }

    const isPlaying = stateRef.current === 'playing';

    if (isPlaying) {
      // ── Horizontal: snappy direct tracking ──
      // Per-frame lerp factor: when dragging, 30% per frame (≈300 ms to
      // converge). When not dragging, 0 so the player holds station.
      const lerp = dragRef.current.active ? 0.30 : 0;
      const dx = player.targetX - player.x;
      const altDx = dx > 0 ? dx - GAME_W : dx + GAME_W;
      const useDx = Math.abs(altDx) < Math.abs(dx) ? altDx : dx;
      const step = useDx * lerp;
      player.vx = step / Math.max(dt, 1);  // expose for tilt/animation
      player.x += step;
      if (player.x < -PLAYER_W / 2) player.x += GAME_W + PLAYER_W;
      if (player.x > GAME_W + PLAYER_W / 2) player.x -= GAME_W + PLAYER_W;

      // ── Vertical: gravity + landing ──
      player.vy = Math.min(MAX_FALL_SPEED, player.vy + GRAVITY * dt);
      const prevY = player.y;
      player.y += player.vy * dt;
      if (player.vy > 0) {
        for (const p of world.platforms) {
          if (prevY <= p.y && player.y >= p.y) {
            if (Math.abs(player.x - p.x) <= p.w / 2 + PLAYER_W * 0.28) {
              landOn(p, player, now);
              break;
            }
          }
        }
      }

      // ── Moving platforms ──
      for (const p of world.platforms) {
        if (p.kind === 'moving' && p.vx) {
          p.x += p.vx * dt;
          if (p.x - p.w / 2 < 6 || p.x + p.w / 2 > GAME_W - 6) p.vx = -p.vx;
        }
      }

      // ── Hazards ──
      for (const h of world.hazards) {
        h.x = h.baseX + Math.sin(now / 700 + h.phase) * 22;
        if (now > player.hitUntil) {
          const dxh = h.x - player.x;
          const dyh = h.y - (player.y - PLAYER_H / 2);
          if (dxh * dxh + dyh * dyh < (20 + 16) * (20 + 16) * 0.36) {
            handleBurnout(player, now);
          }
        }
      }

      // ── Pickups ──
      for (const pk of world.pickups) {
        if (pk.taken) continue;
        const dxp = pk.x - player.x;
        const dyp = pk.y - (player.y - PLAYER_H / 2);
        if (dxp * dxp + dyp * dyp < 22 * 22) {
          pk.taken = true;
          runStatsRef.current.pickupsLatte += 1;
          sfxLatte();
          pushToast('+LATTE', pk.x, pk.y, '#f4ecd8', now);
        }
      }

      if (interactedRef.current) {
        // Camera follow
        const targetCameraY = player.y - logicalH * 0.55;
        if (targetCameraY < cameraYRef.current) cameraYRef.current = targetCameraY;

        // Floor score
        const newFloor = Math.min(TOP_FLOOR,
          Math.floor((startWorldYRef.current - cameraYRef.current - logicalH * 0.55) / FLOOR_HEIGHT_PX));
        if (newFloor > maxFloorRef.current) {
          maxFloorRef.current = newFloor;
          setFloorDisplay(newFloor);
        }

        // Win check (player is standing on the top floor)
        if (maxFloorRef.current >= TOP_FLOOR && player.vy >= -0.05) {
          finishRun(true);
        }

        // Death check (after grace)
        const grace = now - startedAtRef.current < GRACE_MS;
        if (!grace && player.y > cameraYRef.current + logicalH + 80) {
          finishRun(false);
        }

        populateAbove(world, cameraYRef.current - 200, startWorldYRef.current);
        pruneBelow(world, cameraYRef.current + logicalH + 200);
      }
    }

    // ── Render ─────────────────────────────────────────────────────────
    const floor = maxFloorRef.current;
    const redness = Math.min(0.95, floor / 70);
    drawBackground(ctx, cssW, cssH, redness);
    drawLobbySilhouette(ctx, cssW, cssH, startWorldYRef.current, cameraYRef.current, scale);
    drawFloorMarkers(ctx, cssW, cssH, startWorldYRef.current, cameraYRef.current, scale);

    const worldToScreenY = (wy: number) => (wy - cameraYRef.current) * scale;

    for (const p of world.platforms) {
      const sy = worldToScreenY(p.y);
      if (sy < -40 || sy > cssH + 40) continue;
      drawPlatform(ctx, p, sy, scale, now);
    }
    for (const pk of world.pickups) {
      if (pk.taken) continue;
      const sy = worldToScreenY(pk.y);
      if (sy < -30 || sy > cssH + 30) continue;
      drawPickup(ctx, pk, sy, scale, now);
    }
    for (const h of world.hazards) {
      const sy = worldToScreenY(h.y);
      if (sy < -40 || sy > cssH + 40) continue;
      drawHazard(ctx, h, sy, scale, now);
    }

    drawPlayer(ctx, player, worldToScreenY(player.y), scale, now);

    toastsRef.current = toastsRef.current.filter(t => now - t.born < t.life);
    for (const ts of toastsRef.current) {
      drawFloatToast(ctx, ts.text, ts.x * scale, worldToScreenY(ts.yWorld),
        now - ts.born, ts.life, ts.color);
    }

    drawRedTint(ctx, cssW, cssH, redness);
    drawHUD(ctx, cssW, floor);

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  // ─── Game events ────────────────────────────────────────────────────
  const landOn = (p: Platform, player: Player, now: number) => {
    player.y = p.y;
    if (p.kind === 'spring') { player.vy = JUMP_V_SPRING; sfxSpring(); }
    else { player.vy = JUMP_V_BASE; sfxBounce(); }
    p.squishUntil = now + 200;
  };

  const handleBurnout = (player: Player, now: number) => {
    runStatsRef.current.burnouts += 1;
    sfxBurnout();
    player.y += BURNOUT_PENALTY_FLOORS * FLOOR_HEIGHT_PX;
    player.vy = 0.4;
    player.hitUntil = now + 700;
    pushToast(`-${BURNOUT_PENALTY_FLOORS} FLOORS`, player.x, player.y - PLAYER_H, '#ff7a5c', now);
  };

  const pushToast = (text: string, x: number, y: number, color: string, now: number) => {
    toastsRef.current.push({
      id: nextToastId.current++,
      text, x, yWorld: y, born: now, life: 750, color,
    });
  };

  const finishRun = (cleared: boolean) => {
    if (stateRef.current !== 'playing') return;
    stateRef.current = cleared ? 'cleared' : 'gameover';
    setGameState(stateRef.current);
    const finalFloor = maxFloorRef.current;
    const prevBest = Number(localStorage.getItem(BEST_KEY) || 0);
    const isNewBest = finalFloor > prevBest;
    if (isNewBest) {
      localStorage.setItem(BEST_KEY, String(finalFloor));
      setBest(finalFloor);
    }
    setStats({
      finalFloor,
      pickupsLatte: runStatsRef.current.pickupsLatte,
      burnouts: runStatsRef.current.burnouts,
      isNewBest,
      cleared,
    });
    stopAmbient();
    if (cleared) sfxCleared(); else sfxGameOver();
  };

  // ─── Lifecycle ───────────────────────────────────────────────────────
  useEffect(() => {
    fitCanvas();
    initWorld();
    rafRef.current = requestAnimationFrame(tick);
    const onResize = () => fitCanvas();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      stopAmbient();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restart = useCallback(() => {
    initWorld();
    if (interactedRef.current) {
      unlockAudio();
      startAmbient();
      // Skip the demo gate on retry — the user already knows the game.
      // But re-arm the climb by seeding above immediately.
      if (worldRef.current) {
        populateAbove(worldRef.current, startWorldYRef.current - 200, startWorldYRef.current);
      }
    }
  }, [initWorld]);

  return {
    canvasRef,
    stageRef,
    gameState,
    floorDisplay,
    best,
    stats,
    hasInteracted,
    restart,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
