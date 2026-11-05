import {
  Check,
  CircleHelp,
  Flame,
  Globe2,
  Minus,
  Target,
  TrendingUp,
  X,
} from 'lucide-react';
import { getAccuracy, type GameState } from '../lib/game';

export function ScorePanel({ game }: { game: GameState }) {
  const accuracy = getAccuracy(game);
  const attempts = game.correct + game.incorrectAttempts;
  const explored = game.history.length;
  return (
    <aside className="score-column" aria-label="Round statistics">
      <section className="score-panel panel">
        <div className="panel-title">
          <TrendingUp size={17} />
          <h2>Your journey</h2>
          <span className="live-dot" title="Current round" />
        </div>
        <div className="accuracy-wrap">
          <div
            className="accuracy-ring"
            style={{ '--accuracy': `${accuracy}%` } as React.CSSProperties}
          >
            <div>
              <strong>
                {accuracy}
                <span>%</span>
              </strong>
              <span>ACCURACY</span>
            </div>
          </div>
          <p>
            {!attempts
              ? 'Every expert starts somewhere.'
              : accuracy >= 80
                ? 'Look at you, world explorer.'
                : 'A little more world, a little wiser.'}
          </p>
        </div>
        <div className="score-details">
          <div>
            <span>
              <i className="stat-icon correct-icon">
                <Check size={14} />
              </i>
              Correct answers
            </span>
            <strong data-testid="correct-count">{game.correct}</strong>
          </div>
          <div>
            <span>
              <i className="stat-icon incorrect-icon">
                <X size={14} />
              </i>
              Incorrect attempts
            </span>
            <strong data-testid="incorrect-count">
              {game.incorrectAttempts}
            </strong>
          </div>
          <div>
            <span>
              <i className="stat-icon skipped-icon">
                <Minus size={14} />
              </i>
              Skipped
            </span>
            <strong>{game.skipped}</strong>
          </div>
          {game.revealed > 0 && (
            <div>
              <span>
                <i className="stat-icon skipped-icon">
                  <CircleHelp size={14} />
                </i>
                Revealed
              </span>
              <strong>{game.revealed}</strong>
            </div>
          )}
        </div>
        <div className="streak-box">
          <div>
            <Flame size={20} />
            <span>
              <strong>{game.streak}</strong> current streak
            </span>
          </div>
          <span>
            Best: <strong>{game.bestStreak}</strong>
          </span>
        </div>
      </section>
      <section className="world-panel panel">
        <span className="eyebrow">ONE FLAG AT A TIME</span>
        <div className="world-map">
          <img src="/world-map.svg" alt="" />
          <span className="map-pin pin-one" />
          <span className="map-pin pin-two" />
          <span className="map-pin pin-three" />
          <span className="map-pin pin-four" />
        </div>
        <h3>The world is your playground.</h3>
        <p>
          {explored ? (
            <>
              <strong>{explored}</strong>{' '}
              {explored === 1 ? 'country' : 'countries'} explored. Keep
              your curiosity going.
            </>
          ) : (
            <>
              195 countries. Countless stories.
              <br />
              How many will you recognize?
            </>
          )}
        </p>
        <div className="world-caption">
          <Globe2 size={13} />
          <span>A small challenge. A wider world.</span>
        </div>
      </section>
      <p className="accuracy-note">
        <Target size={13} />
        <span>Accuracy = correct answers ÷ all guesses.</span>
      </p>
    </aside>
  );
}
