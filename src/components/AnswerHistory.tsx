import { useId } from 'react';
import { Check, X } from 'lucide-react';
import type { Result } from '../lib/game';

export function AnswerHistory({ history }: { history: Result[] }) {
  const headingId = useId();
  const groups = [
    {
      type: 'correct',
      title: 'Correct Answers',
      results: history.filter((result) => result.outcome === 'correct'),
      empty: 'Countries you identify will appear here.',
      Icon: Check,
    },
    {
      type: 'incorrect',
      title: 'Incorrect Answers',
      results: history.filter((result) => result.outcome !== 'correct'),
      empty: 'Revealed and skipped countries will appear here.',
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
                  <span>{country.name}</span>
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
