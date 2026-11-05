import { useState } from 'react';
import { ImageOff, RotateCcw } from 'lucide-react';
import type { Country } from '../data/countries';

export function FlagImage({
  country,
  revealed,
}: {
  country: Country;
  revealed: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return failed ? (
    <div className="flag-error" role="status">
      <ImageOff size={34} strokeWidth={1.4} />
      <strong>This flag couldn’t load</strong>
      <span>Try again, or skip to keep exploring.</span>
      <button
        onClick={() => {
          setAttempt((value) => value + 1);
          setFailed(false);
        }}
      >
        <RotateCcw size={14} />
        Retry image
      </button>
    </div>
  ) : (
    <img
      className="country-flag"
      src={`${country.flag}${attempt ? `?retry=${attempt}` : ''}`}
      alt={revealed ? `Flag of ${country.name}` : 'Mystery country flag'}
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
}
