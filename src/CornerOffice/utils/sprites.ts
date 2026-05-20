// SVG sprite preloader. Vite resolves the import path to a URL at build
// time; we kick off Image loads so the game can synchronously
// `ctx.drawImage(sprite.worker, ...)` once everything is ready.
//
// All sprites are vector — they upscale cleanly at any device-pixel-
// ratio, no premade PNG pyramid required.

import workerUrl from '../img/worker.svg';
import deskUrl   from '../img/desk.svg';
import printerUrl from '../img/printer.svg';
import chairUrl  from '../img/chair.svg';

export interface Sprites {
  worker:  HTMLImageElement;
  desk:    HTMLImageElement;
  printer: HTMLImageElement;
  chair:   HTMLImageElement;
}

function load(url: string): HTMLImageElement {
  const img = new Image();
  img.src = url;
  return img;
}

let cached: Sprites | null = null;

export function getSprites(): Sprites {
  if (cached) return cached;
  cached = {
    worker:  load(workerUrl),
    desk:    load(deskUrl),
    printer: load(printerUrl),
    chair:   load(chairUrl),
  };
  return cached;
}

/** Are all sprites loaded enough to draw? `naturalWidth > 0` flips on
 *  decode, so we can fall back to the old programmatic renderer until
 *  the SVGs have hydrated. */
export function spritesReady(s: Sprites): boolean {
  return s.worker.naturalWidth > 0
    && s.desk.naturalWidth > 0
    && s.printer.naturalWidth > 0
    && s.chair.naturalWidth > 0;
}
