import { useId } from 'react';
import { Check, Eye, X } from 'lucide-react';
import type { Result } from '../lib/game';
import { countries } from '../data/countries';
import { capitalsByCountry } from '../data/capitals';

export function AnswerHistory({ history, placement = false, capital = false }: { history: Result[]; placement?: boolean; capital?: boolean }) {
  const headingId = useId();
  if (placement) return (
    <section className="answer-history placement-history" aria-labelledby={headingId}>
      <h2 className="history-label" id={headingId}>Recent placements</h2>
      {history.length ? <ol className="placement-results">
        {history.slice(-6).reverse().map((result) => (
          <li key={result.country.id} className={result.outcome}>
            {result.outcome === 'revealed'
              ? <Eye size={16} aria-hidden="true" />
              : <Check size={16} aria-hidden="true" />}
            <div>
              <strong>Locate: {result.country.name}</strong>
              <p>{result.incorrectSelections.length
                ? `You selected ${result.incorrectSelections.map((id) => countries.find((country) => country.id === id)?.name ?? id).join(', ')}. `
                : result.outcome === 'correct' ? 'Correct on your first try. ' : ''}
                {result.outcome === 'revealed' && 'Answer shown. '}
                Correct answer: {result.country.name}.
              </p>
            </div>
          </li>
        ))}
      </ol> : <p className="history-empty">Your located countries and incorrect selections will appear here.</p>}
    </section>
  );
  const groups = [
    {
      type: 'correct',
      title: capital ? 'Correct Capitals' : 'Correct Answers',
      results: history.filter((result) => result.outcome === 'correct'),
      empty: capital ? 'Capitals you identify will appear here.' : 'Countries you identify will appear here.',
      Icon: Check,
    },
    {
      type: 'incorrect',
      title: 'Incorrect Answers',
      results: history.filter((result) => result.outcome !== 'correct'),
      empty: capital ? 'Revealed and skipped capitals will appear here.' : 'Revealed and skipped countries will appear here.',
      Icon: X,
    },
  ];

  return (
    <section className="answer-history" aria-label="Answer history">
      {groups.map(({ type, title, results, empty, Icon }) => (
        <section
          className={`history-group history-group--${type}`}
          aria-labelledby={`${headingId}-${type}`}
          key={type}
        >
          <h2 className="history-label" id={`${headingId}-${type}`}>
            <Icon size={14} aria-hidden="true" />
            {title}
            <span className="history-count">{results.length}</span>
          </h2>
          {results.length ? (
            <ul className="history-list" role="list">
              {results.map(({ country }) => (
                <li className={`history-chip ${type}`} key={country.id}>
                  <img
                    src={country.flag}
                    alt=""
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.visibility = 'hidden';
                    }}
                  />
                  <span>{country.name}{capital && ` — ${capitalsByCountry[country.id].name}`}</span>
                  <Icon size={12} aria-hidden="true" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="history-empty">{empty}</p>
          )}
        </section>
      ))}
    </section>
  );
}
