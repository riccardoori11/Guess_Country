import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type FormEvent,
} from 'react';
import {
  ArrowRight,
  Check,
  ChevronRight,
  CornerDownLeft,
  Eye,
  Flag,
  Globe2,
  Lightbulb,
  MapPin,
  Shuffle,
  SkipForward,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import { FlagImage } from './FlagImage';
import {
  getAccuracy,
  type GameAction,
  type GameMode,
  type GameState,
} from '../lib/game';

interface Props {
  game: GameState;
  mode: GameMode;
  dispatch: Dispatch<GameAction>;
  onRestart: () => void;
  settingsOpen: boolean;
}
export function GameCard({
  game,
  mode,
  dispatch,
  onRestart,
  settingsOpen,
}: Props) {
  const [answer, setAnswer] = useState('');
  const [hint, setHint] = useState(false);
  const answerRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const completionRef = useRef<HTMLHeadingElement>(null);
  const lastAction = useRef(0);
  const country = game.sequence[game.index];
  const resolved = game.status !== 'playing';
  const progress = game.sequence.length
    ? (game.history.length / game.sequence.length) * 100
    : 0;

  useEffect(() => {
    setAnswer('');
    setHint(false);
    if (!settingsOpen && game.status === 'playing')
      answerRef.current?.focus({ preventScroll: true });
  }, [country?.id, game.sequence, settingsOpen]);
  useEffect(() => {
    if (game.status === 'complete')
      completionRef.current?.focus({ preventScroll: true });
    else if (resolved) nextRef.current?.focus({ preventScroll: true });
  }, [resolved, game.status]);

  function act(action: GameAction) {
    const now = Date.now();
    if (now - lastAction.current < 350) return;
    lastAction.current = now;
    dispatch(action);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!country || resolved) return;
    act({ type: 'guess', value: answer, countryId: country.id });
    if (answer.trim()) answerRef.current?.select();
  }

  if (!game.sequence.length)
    return (
      <section className="game-card empty-game panel">
        <Globe2 size={48} />
        <span className="eyebrow">YOUR NEXT ADVENTURE</span>
        <h2>A whole world awaits.</h2>
        <p>
          Choose at least one continent in game settings, then start your round.
        </p>
      </section>
    );
  if (game.status === 'complete')
    return (
      <section
        className="game-card completion-card panel"
        aria-labelledby="completion-title"
      >
        <div className="completion-globe">
          <Trophy size={43} strokeWidth={1.5} />
          <Sparkles size={23} className="sparkle-one" />
          <Sparkles size={16} className="sparkle-two" />
        </div>
        <span className="eyebrow">ROUND COMPLETE</span>
        <h2 id="completion-title" ref={completionRef} tabIndex={-1}>
          What a world of discovery.
        </h2>
        <p>
          You’ve explored all {game.sequence.length} countries in this round.
          <br />
          There’s always another adventure waiting.
        </p>
        <div className="completion-stats">
          <div>
            <strong>
              {game.correct}
              <small>/{game.sequence.length}</small>
            </strong>
            <span>Countries guessed</span>
          </div>
          <div>
            <strong>
              {getAccuracy(game)}
              <small>%</small>
            </strong>
            <span>Guess accuracy</span>
          </div>
          <div>
            <strong>{game.bestStreak}</strong>
            <span>Best streak</span>
          </div>
        </div>
        <p className="completion-breakdown">
          {game.incorrectAttempts} incorrect{' '}
          {game.incorrectAttempts === 1 ? 'attempt' : 'attempts'} ·{' '}
          {game.skipped} skipped · {game.revealed} revealed
        </p>
        <button className="primary-button" onClick={onRestart}>
          Explore again
          <ArrowRight size={17} />
        </button>
        <details className="round-review">
          <summary>
            Review all {game.history.length} countries
            <ChevronRight size={15} />
          </summary>
          <div>
            {game.history.map((result) => (
              <div className="review-row" key={result.country.id}>
                <img src={result.country.flag} alt="" />
                <span>{result.country.name}</span>
                <span className={`outcome ${result.outcome}`}>
                  {result.outcome}
                </span>
              </div>
            ))}
          </div>
        </details>
      </section>
    );

  return (
    <section className="game-card panel" aria-label="Guess the flag">
      <div className="game-topline">
        <span>
          <Flag size={14} />
          THE FLAG CHALLENGE
        </span>
        <span className="game-mode-badge">
          {mode === 'random' ? (
            <Shuffle size={12} />
          ) : (
            <span className="az-mark">A–Z</span>
          )}
          {mode === 'random' ? 'Random mode' : 'Linear mode'}
        </span>
      </div>
      <div className="round-progress">
        <div>
          <span>
            Flag <strong>{game.index + 1}</strong>
            <span className="progress-total"> / {game.sequence.length}</span>
          </span>
          <span>{game.sequence.length - game.history.length} to go</span>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-label="Round progress"
          aria-valuemin={0}
          aria-valuemax={game.sequence.length}
          aria-valuenow={game.history.length}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="flag-stage" key={country.id}>
        <div className="stage-coordinate coordinate-top">
          EXPLORING PLANET EARTH
        </div>
        <span className="stage-cross cross-one" />
        <span className="stage-cross cross-two" />
        <span className="stage-cross cross-three" />
        <span className="stage-cross cross-four" />
        <div className="flag-image-wrap">
          <FlagImage key={country.id} country={country} revealed={resolved} />
        </div>
        <span className="stage-coordinate coordinate-bottom">
          <span className="tiny-dot" />
          {hint || resolved
            ? country.continent.toUpperCase()
            : 'A WORLD WAITING TO BE RECOGNIZED'}
        </span>
      </div>
      <div className="answer-section">
        <h2>
          {resolved
            ? game.status === 'correct'
              ? 'You know your flags.'
              : 'A new country to remember.'
            : 'Which country is this?'}
        </h2>
        <p className="answer-subtitle">
          {resolved
            ? 'Another little piece of the world, discovered.'
            : 'A familiar sight, or a new discovery? Take your best guess.'}
        </p>
        {!resolved ? (
          <form
            onSubmit={submit}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && event.repeat) event.preventDefault();
            }}
          >
            <label className="sr-only" htmlFor="country-answer">
              Country name
            </label>
            <div
              className={`answer-input-wrap ${game.feedback === 'incorrect' ? 'input-incorrect' : ''}`}
            >
              <MapPin size={19} />
              <input
                id="country-answer"
                ref={answerRef}
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="Country name…"
                autoComplete="off"
                autoCapitalize="words"
                spellCheck={false}
                aria-describedby="answer-feedback"
                aria-invalid={game.feedback === 'incorrect'}
              />
              <kbd aria-hidden="true">↵</kbd>
            </div>
            <div
              className={`answer-feedback ${game.feedback}`}
              id="answer-feedback"
              aria-live="polite"
            >
              {game.feedback === 'incorrect' ? (
                <>
                  <X size={14} />
                  Not quite.{' '}
                  {hint
                    ? `Try a country in ${country.continent}.`
                    : 'Give it another try — you’ve got this.'}
                </>
              ) : game.feedback === 'empty' ? (
                <>
                  <MapPin size={14} />
                  Type a country name to make your guess.
                </>
              ) : hint ? (
                <>
                  <Globe2 size={14} />A little nudge: this country is in{' '}
                  {country.continent}.
                </>
              ) : (
                <>
                  <CornerDownLeft size={12} />
                  Press Enter to check your answer
                </>
              )}
            </div>
            <button className="primary-button check-answer" type="submit">
              Check answer
              <ArrowRight size={17} />
            </button>
          </form>
        ) : (
          <div className="resolved-answer">
            <div className={`result-message ${game.status}`} role="status">
              <span className="result-symbol">
                {game.status === 'correct' ? (
                  <Check size={20} />
                ) : (
                  <Eye size={19} />
                )}
              </span>
              <div>
                <span>
                  {game.status === 'correct'
                    ? 'THAT’S RIGHT!'
                    : game.status === 'skipped'
                      ? 'SKIPPED — NOW YOU KNOW'
                      : 'MEET YOUR NEW DISCOVERY'}
                </span>
                <strong>{country.name}</strong>
              </div>
              {game.status === 'correct' && (
                <Sparkles size={20} className="result-sparkles" />
              )}
            </div>
            <button
              className="primary-button next-button"
              ref={nextRef}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && event.repeat)
                  event.preventDefault();
              }}
              onClick={() => act({ type: 'next', countryId: country.id })}
            >
              {game.index === game.sequence.length - 1
                ? 'See your results'
                : 'Next flag'}
              <ArrowRight size={17} />
            </button>
          </div>
        )}
      </div>
      <div className="game-secondary-actions">
        <button onClick={() => setHint(true)} disabled={resolved || hint}>
          <Lightbulb size={15} />
          {hint ? 'Hint shown' : 'Need a hint?'}
        </button>
        <span className="action-divider" />
        <button
          onClick={() => act({ type: 'reveal', countryId: country.id })}
          disabled={resolved}
        >
          <Eye size={15} />
          Reveal answer
        </button>
        <button
          className="skip-button"
          onClick={() => act({ type: 'skip', countryId: country.id })}
          disabled={resolved}
        >
          Skip
          <SkipForward size={14} />
        </button>
      </div>
    </section>
  );
}
