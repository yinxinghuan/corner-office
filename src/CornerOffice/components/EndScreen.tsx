import { useMemo } from 'react';
import { t } from '../i18n';
import type { RunStats } from '../types';

// Random flavor — re-rolled every time a fresh EndScreen mounts.
const FIRED_LEAD = ['PINK SLIP', 'TERMINATION', 'EXIT MEMO', 'HR NOTICE', 'OFFBOARDING'];
const FIRED_TAIL = ['SECURITY ESCORTED', 'BOX OF DESK ITEMS', 'BENEFITS REVOKED', 'BURNT OUT', 'SEE YOU NEVER'];
const PROMO_LEAD = ['LIFETIME AWARD', 'CAREER SUMMIT', 'EXECUTIVE FILE', 'GOLDEN HANDSHAKE', 'OBITUARY'];
const PROMO_TAIL = ['CORNER OFFICE EARNED', 'COFFIN OPENED', 'STOCK FULLY VESTED', 'NO ONE REMEMBERS', 'WORTH IT?'];
const FIRED_STAMPS = ['FIRED', 'VOID', 'OUT', 'BURNT', 'NOPE', 'PIP\'D'];
const PROMO_STAMPS = ['CEO', 'C-SUITE', 'A++', 'EXEC', 'TOP DOG', 'GOLD'];

function pickOne<T>(xs: T[]): T { return xs[Math.floor(Math.random() * xs.length)]; }

function strongTilt(min: number, max: number): number {
  const sign = Math.random() < 0.5 ? -1 : 1;
  return sign * (min + Math.random() * (max - min));
}

interface Props {
  stats: RunStats;
  best: number;
  onAgain: () => void;
  onOpenLeaderboard: () => void;
}

export function EndScreen({ stats, best, onAgain, onOpenLeaderboard }: Props) {
  const cleared = stats.cleared;

  const flavor = useMemo(() => ({
    lead:       pickOne(cleared ? PROMO_LEAD : FIRED_LEAD),
    tail:       pickOne(cleared ? PROMO_TAIL : FIRED_TAIL),
    stampWord:  pickOne(cleared ? PROMO_STAMPS : FIRED_STAMPS),
    tilt:       strongTilt(4, 7).toFixed(2),
    stampX:     64 + Math.random() * 22,
    stampY:     56 + Math.random() * 22,
    stampAngle: strongTilt(12, 24).toFixed(1),
    serial:     String(1000 + Math.floor(Math.random() * 8999)).padStart(4, '0'),
  }), [cleared]);

  return (
    <div className="co-overlay co-overlay--end">
      <div
        className="co-overlay__inner"
        style={{ transform: `rotate(${flavor.tilt}deg)` }}
      >
        <span className="co-overlay__notch co-overlay__notch--tl" aria-hidden />
        <span className="co-overlay__notch co-overlay__notch--tr" aria-hidden />
        <span className="co-overlay__notch co-overlay__notch--bl" aria-hidden />
        <span className="co-overlay__notch co-overlay__notch--br" aria-hidden />

        <div className="co-stamp-bar">
          <span>{flavor.lead}</span>
          <span>NO. {flavor.serial}</span>
          <span>{flavor.tail}</span>
        </div>

        <div
          className={`co-ink-stamp ${cleared ? 'co-ink-stamp--good' : 'co-ink-stamp--bad'}`}
          style={{
            left: `${flavor.stampX}%`,
            top: `${flavor.stampY}%`,
            transform: `translate(-50%, -50%) rotate(${flavor.stampAngle}deg)`,
          }}
          aria-hidden
        >
          {flavor.stampWord}
        </div>

        <div className="co-end__header">
          {cleared ? (
            <>
              <div className="co-end__title">{t('cleared')}</div>
              <div className="co-end__sub">{t('cleared_sub')}</div>
            </>
          ) : (
            <>
              <div className="co-end__title">{t('fired')}</div>
              <div className="co-end__sub">{t('fired_sub')}</div>
            </>
          )}
        </div>

        {stats.isNewBest && <div className="co-new-best">{t('new_best')}</div>}

        <div className="co-final">
          <div className="co-final__label">{t('final_floor')}</div>
          <div className="co-final__value">{stats.finalFloor}</div>
        </div>

        <div className="co-stats co-stats--3">
          <div className="co-stats__cell">
            <div className="co-stats__label">{t('best')}</div>
            <div className="co-stats__value">{best}</div>
          </div>
          <div className="co-stats__cell">
            <div className="co-stats__label">{t('pickups')}</div>
            <div className="co-stats__value">
              {stats.pickupsLatte + stats.pickupsVest + stats.pickupsAdderall}
            </div>
          </div>
          <div className="co-stats__cell">
            <div className="co-stats__label">{t('burnouts')}</div>
            <div className="co-stats__value">{stats.burnouts}</div>
          </div>
        </div>

        <div className="co-buttons">
          <button className="co-btn co-btn--primary" onPointerDown={onAgain}>{t('again')}</button>
          <button className="co-btn co-btn--ghost" onPointerDown={onOpenLeaderboard}>{t('leaderboard')}</button>
        </div>
      </div>
    </div>
  );
}
