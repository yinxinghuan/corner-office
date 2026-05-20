import { t } from '../i18n';

/**
 * Title splash for `?poster=1` mode — locks the canvas-built game behind
 * a printable card so puppeteer/headless can screenshot a clean poster.
 * Aspect mirrors the in-list tile (portrait ~3:5).
 */
export function SplashCard() {
  return (
    <div className="co-splash">
      <div className="co-splash__tower" aria-hidden>
        {/* Stylized tower silhouette w/ lit windows */}
        <svg viewBox="0 0 200 320" preserveAspectRatio="xMidYMax meet">
          <defs>
            <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#280611" />
              <stop offset="1" stopColor="#0a0d18" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="200" height="320" fill="url(#sky)" />
          {/* tower body */}
          <rect x="44" y="40" width="112" height="280" fill="#161b29" />
          <rect x="52" y="48" width="96" height="270" fill="#10131f" />
          {/* windows */}
          {Array.from({ length: 18 }).map((_, r) => (
            <g key={r}>
              {Array.from({ length: 5 }).map((_, c) => {
                const lit = ((r * 5 + c) * 73856093) % 7 < 3;
                return (
                  <rect
                    key={c}
                    x={58 + c * 18}
                    y={54 + r * 14}
                    width={12}
                    height={9}
                    fill={lit ? '#ffc46e' : '#1f2638'}
                    opacity={lit ? 0.85 : 1}
                  />
                );
              })}
            </g>
          ))}
          {/* spire */}
          <rect x="92" y="22" width="16" height="20" fill="#161b29" />
          <rect x="98" y="2" width="4" height="20" fill="#161b29" />
        </svg>
      </div>

      <div className="co-splash__title">{t('title')}</div>
      <div className="co-splash__tagline">{t('tagline')}</div>

      <div className="co-splash__chip">AlterU AFTER DARK</div>
    </div>
  );
}
