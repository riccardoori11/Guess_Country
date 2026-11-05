import { useId } from 'react';
import {
  ArrowDownAZ,
  ArrowRight,
  Check,
  Compass,
  Globe2,
  Info,
  Shuffle,
  SlidersHorizontal,
} from 'lucide-react';
import {
  CONTINENTS,
  continentCounts,
  type Continent,
} from '../data/countries';
import type { Preferences } from '../lib/game';
import {
  LETTERS,
  eligibleCountries,
  emptySelectionMessage,
  type Letter,
} from '../lib/filters';

interface Props {
  preferences: Preferences;
  onChange: (preferences: Preferences) => void;
  onStart: () => void;
  changed: boolean;
}
export function SettingsPanel({
  preferences,
  onChange,
  onStart,
  changed,
}: Props) {
  const id = useId();
  const count = eligibleCountries(
    preferences.continents,
    preferences.letters,
  ).length;
  const emptyMessage = emptySelectionMessage(
    preferences.continents,
    preferences.letters,
    count,
  );
  function toggle(continent: Continent) {
    onChange({
      ...preferences,
      continents: preferences.continents.includes(continent)
        ? preferences.continents.filter((value) => value !== continent)
        : [...preferences.continents, continent],
    });
  }
  function toggleLetter(letter: Letter) {
    onChange({
      ...preferences,
      letters: preferences.letters.includes(letter)
        ? preferences.letters.filter((value) => value !== letter)
        : [...preferences.letters, letter],
    });
  }
  return (
    <section
      className="settings-panel panel"
      aria-labelledby={`${id}-settings-title`}
    >
      <div className="panel-title">
        <SlidersHorizontal size={17} />
        <h2 id={`${id}-settings-title`}>Make it your own</h2>
      </div>
      <div className="setting-section">
        <label className="eyebrow" id={`${id}-mode-label`}>
          GAME MODE
        </label>
        <div
          className="mode-switch"
          role="group"
          aria-labelledby={`${id}-mode-label`}
        >
          <button
            aria-pressed={preferences.mode === 'random'}
            className={preferences.mode === 'random' ? 'selected' : ''}
            onClick={() => onChange({ ...preferences, mode: 'random' })}
          >
            <Shuffle size={15} />
            Random
          </button>
          <button
            aria-pressed={preferences.mode === 'linear'}
            className={preferences.mode === 'linear' ? 'selected' : ''}
            onClick={() => onChange({ ...preferences, mode: 'linear' })}
          >
            <ArrowDownAZ size={16} />
            Linear
          </button>
        </div>
        <p className="setting-description">
          {preferences.mode === 'random'
            ? 'A little surprise with every flag.'
            : 'An A–Z journey, one country at a time.'}
        </p>
      </div>
      <div className="setting-section continents-section">
        <div className="section-label">
          <span className="eyebrow" id={`${id}-continents-label`}>
            EXPLORE CONTINENTS
          </span>
          <Globe2 size={15} />
        </div>
        <div className="selection-actions">
          <button
            aria-label="Select all continents"
            onClick={() =>
              onChange({ ...preferences, continents: [...CONTINENTS] })
            }
          >
            Select all
          </button>
          <span>·</span>
          <button
            aria-label="Deselect all continents"
            onClick={() => onChange({ ...preferences, continents: [] })}
          >
            Deselect all
          </button>
        </div>
        <div
          className="continent-list"
          role="group"
          aria-labelledby={`${id}-continents-label`}
        >
          {CONTINENTS.map((continent) => (
            <label
              className={`continent-option ${preferences.continents.includes(continent) ? 'is-selected' : ''}`}
              key={continent}
            >
              <input
                type="checkbox"
                checked={preferences.continents.includes(continent)}
                onChange={() => toggle(continent)}
              />
              <span className="custom-checkbox" aria-hidden="true">
                <Check size={12} strokeWidth={3} />
              </span>
              <span>{continent}</span>
              <span className="continent-count">
                {continentCounts[continent]}
              </span>
            </label>
          ))}
        </div>
      </div>
      <section
        className="setting-section letter-section"
        aria-labelledby={`${id}-letters-label`}
      >
        <div className="section-label">
          <h3 className="eyebrow" id={`${id}-letters-label`}>
            Filter by Letter
          </h3>
          <span
            className="letter-selection-count"
            aria-label={`${preferences.letters.length} of 26 letters selected`}
          >
            {preferences.letters.length}/26
          </span>
        </div>
        <div className="selection-actions">
          <button
            type="button"
            aria-label="Select all letters"
            onClick={() =>
              onChange({ ...preferences, letters: [...LETTERS] })
            }
          >
            Select all
          </button>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            aria-label="Deselect all letters"
            onClick={() => onChange({ ...preferences, letters: [] })}
          >
            Deselect all
          </button>
        </div>
        <div
          className="letter-grid"
          role="group"
          aria-labelledby={`${id}-letters-label`}
          aria-describedby={`${id}-letters-note`}
        >
          {LETTERS.map((letter) => (
            <button
              type="button"
              className={`letter-option ${preferences.letters.includes(letter) ? 'is-selected' : ''}`}
              aria-pressed={preferences.letters.includes(letter)}
              aria-label={`Countries starting with ${letter}`}
              key={letter}
              onClick={() => toggleLetter(letter)}
            >
              {letter}
            </button>
          ))}
        </div>
        <p className="letter-note" id={`${id}-letters-note`}>
          Uses country names, not answer aliases. Both game modes work with
          any letters.
        </p>
      </section>
      <div
        className={`country-pool ${!count ? 'empty-pool' : ''}`}
        aria-live="polite"
      >
        <Compass size={18} />
        <span>
          <strong>{count} countries</strong> to discover
        </span>
      </div>
      {emptyMessage && (
        <p className="empty-selection" role="status">
          <Info size={14} />
          {emptyMessage}
        </p>
      )}
      <button className="start-button" onClick={onStart} disabled={!count}>
        {changed ? 'Apply & start round' : 'Start a new round'}
        <ArrowRight size={16} />
      </button>
      <p className="settings-note">
        {changed
          ? 'Apply to reset your score and start a fresh round. Your current round continues until then.'
          : 'Settings save automatically. New rounds apply your filters.'}
      </p>
    </section>
  );
}
