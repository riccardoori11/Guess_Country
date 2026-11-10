// @vitest-environment happy-dom
import { act, useReducer } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { countries, type Country } from '../data/countries';
import { gameReducer, initialGame } from '../lib/game';
import { PlacementGame } from './PlacementGame';

vi.mock('./CountryMap', () => ({
  CountryMap: ({ completedIds, revealedIds, focusCountryId, incorrectId, disabled, onSelect }: { completedIds: string[]; revealedIds: string[]; focusCountryId: string | null; incorrectId: string | null; disabled?: boolean; onSelect: (id: string) => void }) => (
    <div data-testid="map" data-completed={completedIds.join(',')} data-revealed={revealedIds.join(',')} data-focus={focusCountryId} data-incorrect={incorrectId}>
      {['fi', 'fr', 'se', 'mn'].map((id) => <button key={id} disabled={disabled} onClick={() => onSelect(id)}>Select {id}</button>)}
    </div>
  ),
}));

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
const sequence = ['fi', 'fr'].map((id) => countries.find((country) => country.id === id)!);
let container: HTMLDivElement;
let root: Root;

function Harness({ autoAdvance = false, settingsOpen = false, pool = sequence }: { autoAdvance?: boolean; settingsOpen?: boolean; pool?: Country[] }) {
  const [game, dispatch] = useReducer(gameReducer, pool, initialGame);
  return <>
    <button onClick={() => dispatch({ type: 'start', sequence: pool })}>Restart test round</button>
    <PlacementGame game={game} dispatch={dispatch} mode="linear" onRestart={() => dispatch({ type: 'start', sequence: pool })} restartDisabled={false} settingsOpen={settingsOpen} autoAdvance={autoAdvance} emptyMessage="No countries match these filters." />
  </>;
}

async function render(props: Parameters<typeof Harness>[0] = {}) {
  await act(async () => root.render(<Harness {...props} />));
}
async function click(text: string) {
  const button = [...container.querySelectorAll('button')].find((element) => element.textContent?.trim() === text)!;
  expect(button, `Missing button ${text}`).toBeTruthy();
  await act(async () => button.click());
}
async function advance(ms: number) {
  await act(async () => vi.advanceTimersByTime(ms));
}
const map = () => container.querySelector<HTMLElement>('[data-testid="map"]')!;

beforeEach(() => {
  vi.useFakeTimers();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('placement rounds', () => {
  it('shows an answer without correct credit and waits for Next Country even with automatic advancement', async () => {
    await render({ autoAdvance: true });
    await click('Select mn');
    await click('Show answer');
    expect(container.querySelector('.placement-feedback')?.textContent).toContain('Finland is highlighted in amber.');
    expect(map().dataset.revealed).toBe('fi');
    expect(map().dataset.focus).toBe('fi');
    expect(map().dataset.completed).toBe('');
    expect(map().hasAttribute('data-incorrect')).toBe(false);
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('1');
    expect(container.querySelector('.round-progress')?.textContent).toContain('0 / 2 countries located · 1 revealed');
    expect(document.activeElement?.textContent).toContain('Next Country');
    expect([...container.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Show answer')).toBeUndefined();
    await advance(3000);
    expect(container.querySelector('#placement-target')?.textContent).toContain('Finland');
    await click('Next Country');
    expect(container.querySelector('#placement-target')?.textContent).toContain('France');
    expect(map().dataset.revealed).toBe('fi');
    expect(map().hasAttribute('data-focus')).toBe(false);
    await click('Show answer');
    await click('See your results');
    expect(container.querySelector('.placement-summary')?.textContent).toContain('0% accuracy');
    expect(container.querySelector('.placement-summary')?.textContent).toContain('1 incorrect attempt');
    expect(container.querySelector('.placement-summary')?.textContent).toContain('2 revealed');
    expect(container.querySelector('.placement-prompt p')?.textContent).toContain('0 located, 2 revealed');
    await click('Explore again');
    expect(map().dataset.revealed).toBe('');
  });

  it('announces each new target through heading focus and preserves focus while settings are open', async () => {
    await render();
    expect(document.activeElement).toBe(container.querySelector('#placement-target'));
    await click('Select fi');
    expect(document.activeElement?.textContent).toContain('Next Country');
    await click('Next Country');
    expect(document.activeElement).toBe(container.querySelector('#placement-target'));
    expect(document.activeElement?.textContent).toBe('Locate: France');

    const settingsControl = container.querySelector<HTMLButtonElement>('button')!;
    settingsControl.focus();
    await render({ settingsOpen: true });
    expect(document.activeElement).toBe(settingsControl);
    await click('Restart test round');
    expect(document.activeElement).toBe(settingsControl);
    await render();
    expect(document.activeElement).toBe(container.querySelector('#placement-target'));
    expect(document.activeElement?.textContent).toBe('Locate: Finland');

    await render({ autoAdvance: true });
    await click('Select fi');
    await advance(1200);
    expect(document.activeElement).toBe(container.querySelector('#placement-target'));
    expect(document.activeElement?.textContent).toBe('Locate: France');
  });

  it('retries multiple mistakes, briefly marks the wrong choice, and requires manual advance by default', async () => {
    await render();
    expect(container.querySelector('#placement-target')?.textContent).toBe('Locate: Finland');
    await click('Select mn');
    expect(container.querySelector('.placement-feedback')?.textContent).toContain('You selected Mongolia. Try again.');
    expect(map().dataset.incorrect).toBe('mn');
    await advance(1600);
    expect(map().hasAttribute('data-incorrect')).toBe(false);
    expect(container.querySelector('.placement-feedback')?.textContent).toContain('Mongolia');
    await click('Select se');
    expect(map().dataset.incorrect).toBe('se');
    await click('Select fi');
    expect(container.querySelector('.placement-feedback')?.textContent).toContain('Finland located');
    expect(map().dataset.completed).toBe('fi');
    expect(map().hasAttribute('data-incorrect')).toBe(false);
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('1');
    await advance(3000);
    expect(container.querySelector('#placement-target')?.textContent).toBe('Locate: Finland');
    await click('Next Country');
    expect(container.querySelector('#placement-target')?.textContent).toBe('Locate: France');
    expect(container.querySelector('.placement-feedback')?.textContent).not.toContain('Sweden');
    expect(map().dataset.completed).toBe('fi');
  });

  it('automatically advances and keeps the completed map visible after the whole pool is exhausted', async () => {
    await render({ autoAdvance: true });
    await click('Select fi');
    await advance(1199);
    expect(container.querySelector('#placement-target')?.textContent).toContain('Finland');
    await advance(1);
    expect(container.querySelector('#placement-target')?.textContent).toContain('France');
    await click('Select fr');
    await advance(1200);
    expect(container.querySelector('#placement-completion-title')).not.toBeNull();
    expect(map().dataset.completed).toBe('fi,fr');
    expect(container.querySelector('.placement-summary')?.textContent).toContain('100% accuracy');
    expect(container.querySelector('.placement-summary')?.textContent).toContain('0 incorrect attempts');
    await click('Explore again');
    expect(container.querySelector('#placement-target')?.textContent).toContain('Finland');
    expect(map().dataset.completed).toBe('');
  });

  it('cancels automatic advance while a settings dialog is open or the option is disabled', async () => {
    await render({ autoAdvance: true });
    await click('Select fi');
    await render({ autoAdvance: true, settingsOpen: true });
    await advance(3000);
    expect(container.querySelector('#placement-target')?.textContent).toContain('Finland');
    await render({ autoAdvance: false });
    await advance(3000);
    expect(container.querySelector('#placement-target')?.textContent).toContain('Finland');
    await click('Next Country');
    expect(container.querySelector('#placement-target')?.textContent).toContain('France');
  });

  it('cancels a pending automatic advance on restart even when the same target comes first', async () => {
    await render({ autoAdvance: true });
    await click('Select fi');
    await advance(1000);
    await click('Restart test round');
    await advance(1000);
    expect(container.querySelector('#placement-target')?.textContent).toContain('Finland');
    expect(container.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('0');
  });

  it('explains an empty filtered pool without rendering a playable map', async () => {
    await render({ pool: [] });
    expect(container.textContent).toContain('No countries match these filters.');
    expect(map()).toBeNull();
  });
});
