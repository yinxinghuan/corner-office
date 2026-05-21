import { t } from '../i18n';
import workerSrc from '../img/worker.svg';

/**
 * Title splash for `?poster=1` mode — re-themed for the photocopy
 * aesthetic. Cream paper field, the worker sticker as centerpiece,
 * stamped red title, FILE COPY rubber stamp, coffee ring, hole-punch
 * line. Aspect mirrors the in-list tile (1:1 / portrait-friendly).
 */
export function SplashCard() {
  return (
    <div className="co-splash">
      {/* Paper-grain hatch is on .co-root--poster via CSS */}

      {/* 3-hole punch along the left */}
      <div className="co-splash__holes" aria-hidden>
        <span /><span /><span />
      </div>

      {/* horizontal smudges */}
      <div className="co-splash__smudge co-splash__smudge--a" aria-hidden />
      <div className="co-splash__smudge co-splash__smudge--b" aria-hidden />

      {/* FILE COPY tilted red rubber stamp (top-right) */}
      <div className="co-splash__stamp" aria-hidden>
        FILE COPY
      </div>

      {/* Worker centerpiece */}
      <img className="co-splash__worker" src={workerSrc} alt="" aria-hidden draggable={false} />

      {/* Title — stamped red ink */}
      <div className="co-splash__title">{t('title')}</div>
      <div className="co-splash__tagline">{t('tagline')}</div>

      {/* Coffee ring */}
      <div className="co-splash__coffee" aria-hidden />

      {/* AlterU AFTER DARK chip at bottom */}
      <div className="co-splash__chip">AlterU AFTER DARK</div>
    </div>
  );
}
