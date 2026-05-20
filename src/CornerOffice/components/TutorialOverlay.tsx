import { TouchAppIcon } from './TouchAppIcon';
import { t } from '../i18n';

/**
 * Looping ghost-finger demo for the drag-to-move gesture. Lives over the
 * live game until the player's first pointer-down. Loop is mandatory:
 * Aigram preloads tiles, so a one-shot demo would already be over by the
 * time the user lands on the tile.
 *
 * pointer-events disabled so it never absorbs a real swipe.
 */
export function TutorialOverlay() {
  return (
    <div className="co-tutorial" aria-hidden>
      <svg className="co-tutorial__svg" viewBox="0 0 360 600" preserveAspectRatio="xMidYMid meet">
        <path
          className="co-tutorial__trail"
          d="M 80 460 L 280 460"
          fill="none"
          stroke="#fff"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </svg>
      <div className="co-tutorial__finger">
        <TouchAppIcon className="co-tutorial__finger-icon" />
      </div>
      <div className="co-tutorial__label">
        <span className="co-tutorial__label-line">{t('tut_line1')}</span>
      </div>
    </div>
  );
}
