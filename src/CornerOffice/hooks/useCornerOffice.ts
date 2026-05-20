import { useCallback, useEffect, useRef, useState } from 'react';
import {
  GAME_W, PLAYER_W, PLAYER_H,
  GRAVITY, JUMP_V_BASE, JUMP_V_SPRING, JUMP_V_ADDERALL,
  HORIZONTAL_LERP, MAX_FALL_SPEED, FLOOR_HEIGHT_PX,
  TOP_FLOOR, BURNOUT_PENALTY_FLOORS,
  type GameState, type RunStats, type Player, type Platform,
} from '../types';
import {
  drawBackground, drawWindows, drawPlatform, drawPickup, drawHazard,
  drawPlayer, drawHUD, drawRedTint, drawFloatToast,
} from '../utils/draw';
import {
  seedDemoOnly, populateAbove, pruneBelow, type WorldChunk,
} from '../utils/world';
import {
  unlockAudio, sfxBounce, sfxSpring, sfxLatte, sfxVest, sfxAdderall,
  sfxBurnout, sfxGameOver, sfxCleared, startAmbient, stopAmbient,
} from '../utils/audio';

const BEST_KEY = 'corner_office_best_v1';
const GRACE_MS = 1500;             // start buffer (no death checks)

interface Toast {
  id: number;
  text: string;
  x: number;
  /** World y at spawn. */
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

  // ─── Mutable refs (live across renders) ─────────────────────────────
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
  const dragRef = useRef<{ active: boolean; lastX: number }>({ active: false, lastX: 0 });
  const toastsRef = useRef<Toast[]>([]);
  const nextToastId = useRef(1);
  const interactedRef = useRef(false);
  const runStatsRef = useRef({
    pickupsLatte: 0, pickupsVest: 0, pickupsAdderall: 0, burnouts: 0,
  });

  // ─── Geometry: fit canvas into the host (portrait) ──────────────────
  const fitCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = stage.getBoundingClientRect();
    // Stage is square-ish on phones; let the canvas use its full size and
    // we scale the logical world (GAME_W=360) to the canvas width.
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
    // World height we care about: top of screen is camera.y, bottom is camera.y + cssH/scale.
    const logicalH = cssH / scale;
    const startWorldY = logicalH * 0.55;        // player feet start ~55% down logical screen
    startWorldYRef.current = startWorldY;
    cameraYRef.current = 0;                      // top of screen at world y = 0
    maxFloorRef.current = 0;
    runStatsRef.current = { pickupsLatte: 0, pickupsVest: 0, pickupsAdderall: 0, burnouts: 0 };
    toastsRef.current = [];

    playerRef.current = {
      x: GAME_W / 2,
      y: startWorldY,
      vx: 0,
      vy: 0,
      targetX: GAME_W / 2,
      facing: 1,
      vested: false,
      adderallNext: false,
      hitUntil: 0,
    };
    // Demo state: only the safe starter desk. Climb begins on first input.
    worldRef.current = seedDemoOnly(startWorldY);
    setFloorDisplay(0);
    setStats(null);
    stateRef.current = 'playing';
    setGameState('playing');
    startedAtRef.current = performance.now();
    lastTickRef.current = performance.now();
  }, []);

  // ─── Input handlers (drag) ───────────────────────────────────────────
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
      // Begin the climb: seed real platforms above the demo desk, reset grace.
      if (worldRef.current) {
        populateAbove(worldRef.current, startWorldYRef.current - 200, startWorldYRef.current);
      }
      startedAtRef.current = performance.now();
    }
    dragRef.current.active = true;
    const lx = localXFromEvent(e);
    dragRef.current.lastX = lx;
    if (playerRef.current) playerRef.current.targetX = lx;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    const lx = localXFromEvent(e);
    dragRef.current.lastX = lx;
    if (playerRef.current) playerRef.current.targetX = lx;
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    dragRef.current.active = false;
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
    // Clamp dt so a backgrounded tab doesn't teleport the player on resume.
    if (dt > 48) dt = 48;
    if (dt < 1) dt = 1;

    const { w: cssW, h: cssH, scale } = sizeRef.current;
    const logicalH = cssH / scale;

    const player = playerRef.current;
    const world = worldRef.current;
    if (!player || !world) return;

    const isPlaying = stateRef.current === 'playing';

    // ─── Physics ──────────────────────────────────────────────────────
    if (isPlaying) {
      // Horizontal: lerp toward target x with wrap
      const dx = player.targetX - player.x;
      // Detect wrap shortcut (if target is on the far side, sometimes going around is shorter)
      const altDx = dx > 0 ? dx - GAME_W : dx + GAME_W;
      const useDx = Math.abs(altDx) < Math.abs(dx) ? altDx : dx;
      player.vx = useDx * HORIZONTAL_LERP * 0.06;        // soft pursuit (px/ms)
      player.x += player.vx * dt;
      if (player.x < -PLAYER_W / 2) player.x += GAME_W + PLAYER_W;
      if (player.x > GAME_W + PLAYER_W / 2) player.x -= GAME_W + PLAYER_W;
      player.facing = useDx >= 0 ? 1 : -1;

      // Vertical: gravity + landing detection (only when falling)
      player.vy = Math.min(MAX_FALL_SPEED, player.vy + GRAVITY * dt);
      const prevY = player.y;
      player.y += player.vy * dt;

      if (player.vy > 0) {
        for (const p of world.platforms) {
          // Bound box: player feet at player.y; platform top at p.y
          if (prevY <= p.y && player.y >= p.y) {
            if (Math.abs(player.x - p.x) <= p.w / 2 + PLAYER_W * 0.30) {
              // bounce
              landOn(p, player, now);
              break;
            }
          }
        }
      }

      // Move moving platforms
      for (const p of world.platforms) {
        if (p.kind === 'moving_desk' && p.vx) {
          p.x += p.vx * dt;
          if (p.x - p.w / 2 < 6 || p.x + p.w / 2 > GAME_W - 6) p.vx = -p.vx;
        }
      }

      // Hazards: oscillate + collide
      for (const h of world.hazards) {
        h.x = h.baseX + Math.sin(now / 700 + h.phase) * 22;
        if (now > player.hitUntil) {
          const dxh = h.x - player.x;
          const dyh = h.y - (player.y - PLAYER_H / 2);
          if (dxh * dxh + dyh * dyh < (20 + 16) * (20 + 16) * 0.36) {
            // hit
            handleBurnout(player, now);
          }
        }
      }

      // Pickups
      for (const pk of world.pickups) {
        if (pk.taken) continue;
        const dxp = pk.x - player.x;
        const dyp = pk.y - (player.y - PLAYER_H / 2);
        if (dxp * dxp + dyp * dyp < 20 * 20) {
          collectPickup(pk, player, now);
        }
      }

      // Camera follow — only after first interaction so preload tile never
      // auto-climbs and dies before the user lands on it.
      if (interactedRef.current) {
        const targetCameraY = player.y - logicalH * 0.55;
        if (targetCameraY < cameraYRef.current) cameraYRef.current = targetCameraY;
      }

      // Score / floor
      const newFloor = Math.min(
        TOP_FLOOR,
        Math.floor((startWorldYRef.current - cameraYRef.current - logicalH * 0.55) / FLOOR_HEIGHT_PX),
      );
      if (newFloor > maxFloorRef.current) {
        maxFloorRef.current = newFloor;
        setFloorDisplay(newFloor);
      }

      // Win check — player landed on coffin
      if (maxFloorRef.current >= TOP_FLOOR) {
        // Check if standing on the coffin
        const onCoffin = world.platforms.find(
          p => p.kind === 'coffin' &&
            Math.abs(player.y - p.y) < 6 &&
            Math.abs(player.x - p.x) < p.w / 2,
        );
        if (onCoffin && player.vy >= -0.05) {
          finishRun(true);
        }
      }

      // Death check + spawn/prune only after the climb has begun.
      if (interactedRef.current) {
        const grace = now - startedAtRef.current < GRACE_MS;
        if (!grace && player.y > cameraYRef.current + logicalH + 80) {
          finishRun(false);
        }
        populateAbove(world, cameraYRef.current - 200, startWorldYRef.current);
        pruneBelow(world, cameraYRef.current + logicalH + 200);
      }
    }

    // ─── Render ───────────────────────────────────────────────────────
    const floor = maxFloorRef.current;
    const redness = Math.min(0.95, floor / 80);
    drawBackground(ctx, cssW, cssH, redness);
    drawWindows(ctx, cssW, cssH, cameraYRef.current, redness);

    // World-to-screen helper:
    const worldToScreenY = (wy: number) => (wy - cameraYRef.current) * scale;
    const worldToScreenX = (wx: number) => wx * scale;

    // Draw platforms
    for (const p of world.platforms) {
      const sy = worldToScreenY(p.y);
      if (sy < -40 || sy > cssH + 40) continue;
      ctx.save();
      ctx.translate(0, 0);
      // platform drawer expects coordinates in CSS pixels; rebuild a tmp.
      const scaled: Platform = { ...p, x: worldToScreenX(p.x), w: p.w * scale, h: p.h * scale };
      drawPlatform(ctx, scaled, sy, now);
      ctx.restore();
    }

    // Draw pickups
    for (const pk of world.pickups) {
      if (pk.taken) continue;
      const sy = worldToScreenY(pk.y);
      if (sy < -20 || sy > cssH + 20) continue;
      const scaledPickup = { ...pk, x: worldToScreenX(pk.x) };
      drawPickup(ctx, scaledPickup, sy, now);
    }

    // Draw hazards
    for (const h of world.hazards) {
      const sy = worldToScreenY(h.y);
      if (sy < -30 || sy > cssH + 30) continue;
      const scaledHaz = { ...h, x: worldToScreenX(h.x) };
      drawHazard(ctx, scaledHaz, sy, now);
    }

    // Draw player
    {
      const scaledPlayer: Player = { ...player, x: worldToScreenX(player.x) };
      drawPlayer(ctx, scaledPlayer, worldToScreenY(player.y), now);
    }

    // Toasts
    toastsRef.current = toastsRef.current.filter(t => now - t.born < t.life);
    for (const ts of toastsRef.current) {
      const sy = worldToScreenY(ts.yWorld);
      drawFloatToast(ctx, ts.text, worldToScreenX(ts.x), sy, now - ts.born, ts.life, ts.color);
    }

    // Red tint + HUD
    drawRedTint(ctx, cssW, cssH, redness);
    drawHUD(ctx, cssW, floor, best, redness);

    rafRef.current = requestAnimationFrame(tick);
  }, [best]);

  // ─── Helpers used inside tick ───────────────────────────────────────
  const landOn = (p: Platform, player: Player, now: number) => {
    player.y = p.y;
    let v = JUMP_V_BASE;
    if (p.kind === 'kombucha') { v = JUMP_V_SPRING; sfxSpring(); }
    else if (p.kind === 'coffin') { v = JUMP_V_BASE * 0.5; sfxBounce(); }
    else { sfxBounce(); }
    if (player.adderallNext) {
      v = JUMP_V_ADDERALL;
      player.adderallNext = false;
    }
    player.vy = v;
    p.squishUntil = now + 220;
  };

  const collectPickup = (pk: any, player: Player, now: number) => {
    pk.taken = true;
    if (pk.kind === 'latte') {
      runStatsRef.current.pickupsLatte += 1;
      sfxLatte();
      pushToast('+LATTE', pk.x, pk.y, '#f4ecd8', now);
    } else if (pk.kind === 'vest') {
      player.vested = true;
      runStatsRef.current.pickupsVest += 1;
      sfxVest();
      pushToast('+VEST', pk.x, pk.y, '#9bc0ec', now);
    } else if (pk.kind === 'adderall') {
      player.adderallNext = true;
      runStatsRef.current.pickupsAdderall += 1;
      sfxAdderall();
      pushToast('+ADDERALL', pk.x, pk.y, '#e87b2f', now);
    }
  };

  const handleBurnout = (player: Player, now: number) => {
    runStatsRef.current.burnouts += 1;
    if (player.vested) {
      player.vested = false;
      sfxVest();
      pushToast('SAVED', player.x, player.y - PLAYER_H, '#9bc0ec', now);
      player.hitUntil = now + 900;
      return;
    }
    sfxBurnout();
    // drop N floors and lose adderall buff
    player.y += BURNOUT_PENALTY_FLOORS * FLOOR_HEIGHT_PX;
    player.vy = 0.4;
    player.adderallNext = false;
    player.hitUntil = now + 700;
    pushToast(`-${BURNOUT_PENALTY_FLOORS} FLOORS`, player.x, player.y - PLAYER_H, '#ff7a5c', now);
  };

  const pushToast = (text: string, x: number, y: number, color: string, now: number) => {
    toastsRef.current.push({
      id: nextToastId.current++,
      text, x, yWorld: y, born: now, life: 700, color,
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
      pickupsVest: runStatsRef.current.pickupsVest,
      pickupsAdderall: runStatsRef.current.pickupsAdderall,
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
    // resume audio only if user previously interacted
    if (interactedRef.current) {
      unlockAudio();
      startAmbient();
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
