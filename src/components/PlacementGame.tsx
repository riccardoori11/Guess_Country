import { useEffect, useRef, useState, type Dispatch } from 'react';
import { ArrowRight, Check, Eye, Globe2, MapPin, Shuffle, Trophy, X } from 'lucide-react';
import { countries } from '../data/countries';
import { getAccuracy, type GameAction, type GameMode, type GameState } from '../lib/game';
import { CountryMap } from './CountryMap';
import './placement-game.css';

interface Props {
  game: GameState;
  mode: GameMode;
  dispatch: Dispatch<GameAction>;
  onRestart: () => void;
  restartDisabled: boolean;
  emptyMessage?: string;
  settingsOpen: boolean;
  autoAdvance: boolean;
}

export function PlacementGame({ game, mode, dispatch, onRestart, restartDisabled, emptyMessage, settingsOpen, autoAdvance }: Props) {
  const country = game.sequence[game.index];
  const complete = game.status === 'complete';
  const playing = game.status === 'playing';
  const targetRef = useRef<HTMLHeadingElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const completionRef = useRef<HTMLHeadingElement>(null);
  const [incorrectId, setIncorrectId] = useState<string | null>(null);
  const completedIds = game.history.filter((result) => result.outcome === 'correct').map((result) => result.country.id);
  const revealedIds = game.history.filter((result) => result.outcome === 'revealed').map((result) => result.country.id);
  const lastSelection = countries.find((value) => value.id === game.currentSelections.at(-1));
  const progress = game.sequence.length ? (game.history.length / game.sequence.length) * 100 : 0;

  useEffect(() => {
    setIncorrectId(playing ? game.currentSelections.at(-1) ?? null : null);
    const timeout = window.setTimeout(() => setIncorrectId(null), 1600);
    return () => window.clearTimeout(timeout);
  }, [game.currentSelections, game.sequence, playing]);

  useEffect(() => {
    // Unmounting, a new round, a settings dialog, or turning this option off
    // cancels the pending advance; the reducer also rejects stale target IDs.
    if (!autoAdvance || settingsOpen || game.status !== 'correct' || !country) return;
    const timeout = window.setTimeout(() => dispatch({ type: 'next', countryId: country.id }), 1200);
    return () => window.clearTimeout(timeout);
  }, [autoAdvance, settingsOpen, game.status, country, game.sequence, dispatch]);

  useEffect(() => {
    // Keep keyboard play at the map and announce the next target after either
    // manual or automatic advancement. Hidden cards and dialogs keep focus.
    if (playing && !settingsOpen)
      targetRef.current?.focus({ preventScroll: true });
  }, [country?.id, game.sequence, playing, settingsOpen]);

  useEffect(() => {
    if (settingsOpen) return;
    if (complete) completionRef.current?.focus({ preventScroll: true });
    else if (game.status === 'revealed' || (game.status === 'correct' && !autoAdvance)) nextRef.current?.focus({ preventScroll: true });
  }, [complete, game.status, autoAdvance, settingsOpen]);

  if (!game.sequence.length) return (
    <section className="game-card empty-game panel" aria-label="Place the Country">
      <Globe2 size={48} />
      <span className="eyebrow">YOUR NEXT ADVENTURE</span>
      <h2>A whole world awaits.</h2>
      <p>{emptyMessage} Update your game settings to begin.</p>
    </section>
  );

  return (
    <section className="game-card placement-game panel" aria-label="Place the Country">
      <div className="game-topline">
        <span><MapPin size={14} /> THE COUNTRY CHALLENGE</span>
        <span className="game-mode-badge">
          {mode === 'random' ? <Shuffle size={12} /> : <span className="az-mark">A–Z</span>}
          {mode === 'random' ? 'Randomized' : 'Sequential'}
        </span>
      </div>
      <div className="round-progress">
        <div>
          <span><strong>{game.correct}</strong> / {game.sequence.length} countries located{game.revealed > 0 && ` · ${game.revealed} revealed`}</span>
          <span>{game.sequence.length - game.history.length} to go</span>
        </div>
        <div className="progress-track" role="progressbar" aria-label="Round progress" aria-valuemin={0} aria-valuemax={game.sequence.length} aria-valuenow={game.history.length} aria-valuetext={`${game.correct} located, ${game.revealed} revealed, ${game.sequence.length} total`}>
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="placement-prompt">
        {complete ? <>
          <span className="eyebrow"><Trophy size={14} /> ROUND COMPLETE</span>
          <h2 id="placement-completion-title" ref={completionRef} tabIndex={-1}>A world well explored.</h2>
          <p>You explored all {game.sequence.length} countries. {game.correct} located{game.revealed > 0 && `, ${game.revealed} revealed`}. Your completed map is below.</p>
        </> : <>
          <span className="eyebrow">FIND YOUR PLACE IN THE WORLD</span>
          <h2 id="placement-target" ref={targetRef} tabIndex={-1}>Locate: <span>{country.name}</span></h2>
          <p>Choose the country on the map. Zoom in to explore smaller places.</p>
        </>}
      </div>
      <CountryMap completedIds={completedIds} revealedIds={revealedIds} focusCountryId={game.status === 'revealed' ? country.id : null} incorrectId={incorrectId} disabled={!playing || settingsOpen} onSelect={(selectedId) => {
        if (country && playing && !settingsOpen) dispatch({ type: 'place', countryId: country.id, selectedId });
      }} />
      {complete ? (
        <div className="placement-summary">
          <p><strong>{getAccuracy(game)}% accuracy</strong> · {game.incorrectAttempts} incorrect {game.incorrectAttempts === 1 ? 'attempt' : 'attempts'}{game.revealed > 0 && ` · ${game.revealed} revealed`} · Best streak: {game.bestStreak}</p>
          <button className="primary-button" onClick={onRestart} disabled={restartDisabled}>Explore again <ArrowRight size={17} /></button>
          {restartDisabled && <p role="status">Choose filters that include at least one country before starting a new round.</p>}
        </div>
      ) : (
        <div className="placement-answer">
          <div className={`placement-feedback ${game.status === 'correct' ? 'correct' : game.status === 'revealed' ? 'revealed' : game.feedback === 'incorrect' ? 'incorrect' : ''}`} role="status" aria-live="polite" aria-atomic="true">
            {game.status === 'correct' ? <><Check size={19} /><span><strong>That’s right! {country.name} located.</strong>{autoAdvance && <small>Next country in a moment…</small>}</span></> : game.status === 'revealed' ? <><Eye size={19} /><span><strong>{country.name} is highlighted in amber.</strong><small>Answer shown. This country is recorded as revealed.</small></span></> : lastSelection ? <><X size={18} /><span>You selected <strong>{lastSelection.name}</strong>. Try again.</span></> : <><MapPin size={17} /><span>Click a country to make your guess.</span></>}
          </div>
          {playing && <button className="secondary-button show-answer-button" disabled={settingsOpen} onClick={() => dispatch({ type: 'reveal', countryId: country.id })}>
            <Eye size={16} /> Show answer
          </button>}
          {(game.status === 'correct' || game.status === 'revealed') && <button className="primary-button" ref={nextRef} onClick={() => dispatch({ type: 'next', countryId: country.id })} onKeyDown={(event) => { if (event.key === 'Enter' && event.repeat) event.preventDefault(); }}>
            {game.index === game.sequence.length - 1 ? 'See your results' : 'Next Country'}<ArrowRight size={17} />
          </button>}
        </div>
      )}
    </section>
  );
}
