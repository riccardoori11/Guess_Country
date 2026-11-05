import { useEffect, useMemo, useReducer, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  Compass,
  Flag,
  Globe2,
  Heart,
  Lightbulb,
  MapPin,
  RotateCcw,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { CONTINENTS } from './data/countries';
import {
  createSequence,
  gameReducer,
  initialGame,
  type Preferences,
} from './lib/game';
import { loadPreferences, savePreferences } from './lib/preferences';
import {
  LETTERS,
  eligibleCountries,
  emptySelectionMessage,
} from './lib/filters';
import { GameCard } from './components/GameCard';
import { SettingsPanel } from './components/SettingsPanel';
import { JourneyHistory, ScorePanel } from './components/ScorePanel';
import { Modal } from './components/Modal';
import { ThemePicker } from './components/ThemePicker';

export default function App() {
  const [preferences, setPreferences] = useState(loadPreferences);
  const [draft, setDraft] = useState<Preferences>(preferences);
  const initialSequence = useMemo(() => createSequence(preferences), []);
  const [game, dispatch] = useReducer(
    gameReducer,
    initialSequence,
    initialGame,
  );
  const [modal, setModal] = useState<
    'help' | 'about' | 'settings' | 'restart' | null
  >(null);
  const [announcement, setAnnouncement] = useState('');
  const changed =
    draft.mode !== preferences.mode ||
    CONTINENTS.some(
      (continent) =>
        draft.continents.includes(continent) !==
        preferences.continents.includes(continent),
    ) ||
    LETTERS.some(
      (letter) =>
        draft.letters.includes(letter) !==
        preferences.letters.includes(letter),
    );
  const canStart =
    eligibleCountries(draft.continents, draft.letters).length > 0;

  useEffect(() => {
    savePreferences(draft);
  }, [draft]);

  function startRound(next = draft) {
    const sequence = createSequence(next);
    if (!sequence.length) return;
    setPreferences(next);
    setDraft(next);
    dispatch({ type: 'start', sequence });
    setModal(null);
    setAnnouncement(
      `New ${next.mode} round started with ${sequence.length} countries, ${next.continents.length === 6 ? 'all continents' : next.continents.join(', ')}, and ${next.letters.length === LETTERS.length ? 'all letters' : `letters ${next.letters.join(', ')}`}.`,
    );
  }
  function requestRestart() {
    if (!canStart) return;
    if (game.history.length || game.incorrectAttempts) setModal('restart');
    else startRound();
  }

  const settings = (
    <SettingsPanel
      preferences={draft}
      onChange={setDraft}
      onStart={() => startRound()}
      changed={changed}
    />
  );

  return (
    <>
      <a className="skip-link" href="#play">
        Skip to game
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#play" aria-label="Flag Atlas home">
            <span className="brand-mark">
              <Flag size={23} strokeWidth={1.8} />
            </span>
            <span>
              flag<span className="brand-atlas">atlas</span>
              <span className="brand-dot">.</span>
            </span>
          </a>
          <nav className="header-nav" aria-label="Main navigation">
            <a href="#play" className="nav-active">
              Let’s play
              <span />
            </a>
            <button onClick={() => setModal('help')}>How to play</button>
            <button onClick={() => setModal('about')}>
              About the atlas
            </button>
          </nav>
          <div className="header-actions">
            <ThemePicker />
            <button
              className="mobile-settings icon-button"
              onClick={() => setModal('settings')}
              aria-label="Open game settings"
            >
              <Settings2 size={19} />
            </button>
            <button
              className="new-round-button"
              aria-label="New round"
              onClick={requestRestart}
              disabled={!canStart}
            >
              <RotateCcw size={15} />
              <span>New round</span>
            </button>
          </div>
        </div>
      </header>
      <main id="play" tabIndex={-1} className="main-shell">
        <section className="intro">
          <div>
            <div className="intro-eyebrow">
              <span />A LITTLE CURIOSITY GOES A LONG WAY
            </div>
            <h1>
              A little flag. <span>A whole world.</span>
            </h1>
            <p>
              Test your knowledge. Find new favorites. See the world a
              little differently.
            </p>
          </div>
          <div className="intro-aside">
            <div className="mini-globe">
              <Globe2 size={43} strokeWidth={1} />
              <span className="orbit-dot" />
              <Sparkles size={16} className="globe-sparkle" />
            </div>
            <div>
              <span>YOUR PASSPORT TO DISCOVERY</span>
              <p>No timer. No pressure. Just explore.</p>
            </div>
          </div>
        </section>
        <div className="game-layout">
          <aside className="settings-column" aria-label="Game settings">
            {settings}
            <div className="good-to-know">
              <span className="tip-icon">
                <Lightbulb size={18} />
              </span>
              <div>
                <span className="eyebrow">A FRIENDLY LITTLE TIP</span>
                <p>
                  Short names work, too.
                  <br />
                  “USA”, “UK”, and “UAE” are all welcome here.
                </p>
              </div>
            </div>
          </aside>
          <div className="center-column">
            <GameCard
              game={game}
              mode={preferences.mode}
              dispatch={dispatch}
              onRestart={() => startRound()}
              restartDisabled={!canStart}
              emptyMessage={emptySelectionMessage(
                preferences.continents,
                preferences.letters,
                game.sequence.length,
              )}
              settingsOpen={modal !== null}
            />
            <div className="below-card-note">
              <Globe2 size={15} />
              <span>Every flag has a story. Let’s discover yours.</span>
            </div>
            <JourneyHistory game={game} />
          </div>
          <ScorePanel game={game} />
        </div>
        <section className="bottom-strip">
          <div>
            <Compass size={21} />
            <p>
              <strong>Go beyond the familiar.</strong> Your next favorite
              place might be a flag away.
            </p>
          </div>
          <span
            className="round-filters"
            aria-label="Active round filters"
          >
            <span className="small-status-dot" />
            {preferences.continents.length === 6
              ? 'All continents'
              : `${preferences.continents.length} ${preferences.continents.length === 1 ? 'continent' : 'continents'}`}
            {preferences.letters.length !== LETTERS.length && (
              <>
                <span className="strip-dot" aria-hidden="true">
                  ·
                </span>
                <span
                  className="active-letter-filter"
                  title={preferences.letters.join(', ')}
                >
                  {preferences.letters.length <= 4
                    ? `Letters ${preferences.letters.join(', ')}`
                    : `${preferences.letters.length} letters`}
                </span>
              </>
            )}
            <span className="strip-dot">·</span>
            <span>{game.sequence.length} countries in your round</span>
          </span>
        </section>
      </main>
      <footer className="site-footer">
        <div>
          <span>Made for curious minds, everywhere.</span>
          <Heart size={12} />
        </div>
        <div>
          <span>One planet. 195 countries.</span>
          <span className="footer-divider">/</span>
          <button onClick={() => setModal('help')}>How to play</button>
          <span className="footer-link-divider" aria-hidden="true">
            ·
          </span>
          <button onClick={() => setModal('about')}>
            About & credits
            <ArrowRight size={12} />
          </button>
        </div>
      </footer>
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
      {modal === 'settings' && (
        <Modal
          title="Your next adventure"
          className="settings-modal"
          onClose={() => setModal(null)}
        >
          {settings}
        </Modal>
      )}
      {modal === 'help' && (
        <Modal
          title="A world of flags. One simple idea."
          onClose={() => setModal(null)}
        >
          <p className="modal-intro">
            A tiny geography adventure, at your own pace.
          </p>
          <div className="help-steps">
            <div>
              <span>01</span>
              <div>
                <h3>Make the world your own</h3>
                <p>
                  Choose continents, starting letters, and a mode
                  independently. Random shuffles the eligible countries;
                  Linear takes you from A to Z. All filters must match a
                  country’s canonical name and continent. Empty selections
                  or combinations with no countries cannot start a round.
                  Edits update the available count immediately; starting a
                  new round applies them and resets your score. Your
                  current round continues until then.
                </p>
              </div>
            </div>
            <div>
              <span>02</span>
              <div>
                <h3>Recognize the flag</h3>
                <p>
                  Type the country’s name and press Enter or Check answer.
                  Capitalization, extra spaces, and accents don’t matter.
                  Common names and abbreviations work, too.
                </p>
              </div>
            </div>
            <div>
              <span>03</span>
              <div>
                <h3>Learn a little. Keep exploring.</h3>
                <p>
                  Try again after a wrong guess, ask for a continent hint,
                  reveal the answer, or skip. Select Next flag when you’re
                  ready. Every country appears once per round.
                </p>
              </div>
            </div>
          </div>
          <div className="modal-info">
            <Check size={18} />
            <p>
              Accuracy counts correct answers out of all guesses. Reveals
              and skips are tracked separately. A wrong guess, reveal, or
              skip ends your streak; a hint doesn’t.
            </p>
          </div>
          <button
            className="primary-button"
            onClick={() => setModal(null)}
          >
            Let’s explore
            <ArrowRight size={16} />
          </button>
        </Modal>
      )}
      {modal === 'about' && (
        <Modal
          title="A little more about the atlas"
          onClose={() => setModal(null)}
        >
          <p className="modal-intro">
            Built for the joy of knowing a little more about our world.
          </p>
          <div className="about-facts">
            <div>
              <Globe2 size={21} />
              <strong>195</strong>
              <span>countries</span>
            </div>
            <div>
              <MapPin size={21} />
              <strong>6</strong>
              <span>continents</span>
            </div>
            <div>
              <BookOpen size={21} />
              <strong>∞</strong>
              <span>little discoveries</span>
            </div>
          </div>
          <h3>What’s in the atlas?</h3>
          <p>
            All 193{' '}
            <a
              href="https://www.un.org/en/about-us/member-states"
              target="_blank"
              rel="noreferrer"
            >
              UN member states
            </a>
            , plus the two observer states: Palestine and the Holy See,
            represented by the Vatican City flag. Flags are local SVG
            assets from{' '}
            <a
              href="https://flagpedia.net"
              target="_blank"
              rel="noreferrer"
            >
              Flagpedia
            </a>
            .
          </p>
          <h3>One country, one continent</h3>
          <p>
            We use{' '}
            <a
              href="https://unstats.un.org/unsd/methodology/m49/"
              target="_blank"
              rel="noreferrer"
            >
              UN M49 geographic regions
            </a>
            , splitting the Americas into North America (including Central
            America and the Caribbean) and South America. Russia is in
            Europe; Türkiye, Cyprus, Armenia, Azerbaijan, Georgia,
            Kazakhstan, Indonesia, and Timor-Leste are in Asia. Egypt is in
            Africa.
          </p>
          <h3>Made for a little focus</h3>
          <p>
            No timer, no account, no leaderboard. Preferences stay in this
            browser. Your score lasts for the current round. Maps are
            adapted from public domain{' '}
            <a
              href="https://www.naturalearthdata.com/"
              target="_blank"
              rel="noreferrer"
            >
              Natural Earth
            </a>{' '}
            data; type is DM Sans.
          </p>
        </Modal>
      )}
      {modal === 'restart' && (
        <Modal
          title="Ready for a fresh adventure?"
          onClose={() => setModal(null)}
        >
          <p className="modal-intro">
            Starting a new round resets your current score and progress.{' '}
            {changed
              ? 'Your updated mode, continent, and letter selections will be applied.'
              : 'Your mode, continent, and letter selections will stay the same.'}
          </p>
          <div className="modal-actions">
            <button
              className="secondary-button"
              onClick={() => setModal(null)}
            >
              Keep exploring
            </button>
            <button
              className="primary-button"
              onClick={() => startRound()}
              disabled={!canStart}
            >
              Start new round
              <ArrowRight size={16} />
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
