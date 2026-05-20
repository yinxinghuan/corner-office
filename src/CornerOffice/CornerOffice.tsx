import { useCallback, useState } from 'react';
import { useCornerOffice } from './hooks/useCornerOffice';
import { EndScreen } from './components/EndScreen';
import { TutorialOverlay } from './components/TutorialOverlay';
import { SplashCard } from './components/SplashCard';
import { Leaderboard, useGameScore } from '@shared/leaderboard';
import { t } from './i18n';
import alteruLogo from './img/alteru.svg';
import './CornerOffice.less';

const POSTER_MODE = new URLSearchParams(window.location.search).get('poster') === '1';

export default function CornerOffice() {
  const {
    canvasRef, stageRef, gameState, floorDisplay, best, stats, hasInteracted,
    restart, handlePointerDown, handlePointerMove, handlePointerUp,
  } = useCornerOffice();

  const [showLeaderboard, setShowLeaderboard] = useState(false);

  const score = useGameScore('corner-office');

  // Submit final score when run ends.
  // useEffect intentionally inlined as a function — we want it to fire each
  // time the stats object changes (i.e. once per run end).
  if (stats && !showLeaderboard) {
    // Cheap idempotency: stash the last submitted floor on window.
    const win = window as any;
    const key = '__co_lastSubmitted';
    if (win[key] !== stats.finalFloor) {
      win[key] = stats.finalFloor;
      score.submitScore(stats.finalFloor);
    }
  }

  const onAgain = useCallback(() => {
    (window as any).__co_lastSubmitted = -1;
    restart();
    setShowLeaderboard(false);
  }, [restart]);

  if (POSTER_MODE) {
    return (
      <div className="co-root co-root--poster">
        <SplashCard />
      </div>
    );
  }

  return (
    <div className="co-root">
      <div
        ref={stageRef}
        className="co-stage"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <canvas ref={canvasRef} className="co-canvas" />

        {/* Tagline ribbon */}
        <div className="co-tagline">{t('tagline')}</div>

        {/* AlterU watermark */}
        <img className="co-watermark" src={alteruLogo} alt="AlterU" />

        {/* Live floor label is drawn on canvas; keep DOM clean. */}
        {floorDisplay > 0 && floorDisplay % 10 === 0 && (
          <div className="co-floor-ping" key={floorDisplay}>
            {t('floor_n', { n: floorDisplay })}
          </div>
        )}

        {/* Tutorial loop until first pointer-down */}
        {!hasInteracted && gameState === 'playing' && <TutorialOverlay />}
      </div>

      {gameState !== 'playing' && stats && (
        <EndScreen
          stats={stats}
          best={best}
          onAgain={onAgain}
          onOpenLeaderboard={() => setShowLeaderboard(true)}
        />
      )}

      {showLeaderboard && (
        <Leaderboard
          gameName="Corner Office"
          isInAigram={score.isInAigram}
          onClose={() => setShowLeaderboard(false)}
          fetchGlobal={score.fetchGlobalLeaderboard}
          fetchFriends={score.fetchFriendsLeaderboard}
        />
      )}
    </div>
  );
}
