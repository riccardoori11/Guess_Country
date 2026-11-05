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
import { CONTINENTS, continentCounts, type Continent } from '../data/countries';
import { eligibleCountries, type Preferences } from '../lib/game';

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
  const count = eligibleCountries(preferences.continents).length;
  function toggle(continent: Continent) {
    onChange({
      ...preferences,
      continents: preferences.continents.includes(continent)
        ? preferences.continents.filter((value) => value !== continent)
        : [...preferences.continents, continent],
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
            onClick={() =>
              onChange({ ...preferences, continents: [...CONTINENTS] })
            }
          >
            Select all
          </button>
          <span>·</span>
          <button onClick={() => onChange({ ...preferences, continents: [] })}>
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
      <div
        className={`country-pool ${!count ? 'empty-pool' : ''}`}
        aria-live="polite"
      >
        <Compass size={18} />
        <span>
          <strong>{count} countries</strong> to discover
        </span>
      </div>
      {!count && (
        <p className="empty-selection" role="status">
          <Info size={14} />
          Choose at least one continent to start a round.
        </p>
      )}
      <button className="start-button" onClick={onStart} disabled={!count}>
        {changed ? 'Apply & start round' : 'Start a new round'}
        <ArrowRight size={16} />
      </button>
      <p className="settings-note">
        {changed
          ? 'Your changes will start a fresh round.'
          : 'Your preferences are saved automatically.'}
      </p>
    </section>
  );
}
