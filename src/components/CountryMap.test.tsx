// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { countries } from '../data/countries';
import geography from '../data/geography.json';
import { CountryMap } from './CountryMap';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;
const select = vi.fn();

beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  select.mockClear();
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
async function render(completedIds: string[] = [], incorrectId: string | null = null, disabled = false, revealedIds: string[] = [], focusCountryId: string | null = null) {
  await act(async () => root.render(<CountryMap completedIds={completedIds} incorrectId={incorrectId} disabled={disabled} revealedIds={revealedIds} focusCountryId={focusCountryId} onSelect={select} />));
}
function country(id: string) { return container.querySelector<SVGGElement>(`[data-country-id="${id}"]`)!; }
function viewport() { return container.querySelector<SVGSVGElement>('svg.country-map-viewport')!; }
function transform() { return viewport().firstElementChild!.getAttribute('transform'); }
function screenPosition(x: number, y: number) {
  const [, translateX, translateY, scale] = transform()!.match(/translate\((\S+) (\S+)\) scale\(([^)]+)\)/)!;
  return { x: x * Number(scale) + Number(translateX), y: y * Number(scale) + Number(translateY) };
}
async function click(element: Element, detail = 0) {
  await act(async () => element.dispatchEvent(new MouseEvent('click', { bubbles: true, detail })));
}
async function control(label: string) { await click(container.querySelector(`button[aria-label="${label}"]`)!); }
async function pointer(element: Element, type: string, x: number, y: number, id = 1) {
  await act(async () => element.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: id, button: 0, pointerType: 'touch' })));
}
function wheelEvent(deltaY: number, clientX: number, clientY: number) {
  const event = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
  // happy-dom's WheelEvent lacks inherited MouseEvent coordinates.
  Object.defineProperties(event, { clientX: { value: clientX }, clientY: { value: clientY } });
  return event;
}

describe('geographic coverage', () => {
  it('includes every atlas country exactly once, including all microstates', () => {
    const ids = geography.map((feature) => feature.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(countries.filter((country) => !ids.includes(country.id))).toEqual([]);
    for (const id of ['va', 'mc', 'sm', 'li', 'ad', 'nr', 'tv', 'ki', 'fm', 'mh', 'pw', 'sg']) {
      expect(geography.find((feature) => feature.id === id)?.point).toHaveLength(2);
    }
  });
  it('keeps disconnected polygons together and contains finite projected paths', () => {
    for (const id of ['ru', 'us', 'fr', 'id', 'ph', 'fj', 'au']) {
      expect(geography.find((feature) => feature.id === id)!.path.split('M').length).toBeGreaterThan(2);
    }
    expect(geography.every((feature) => feature.path.startsWith('M') && !/NaN|Infinity|undefined/.test(feature.path))).toBe(true);
  });
  it('keeps antimeridian pieces separate without world-spanning country edges', () => {
    for (const feature of geography) {
      for (const ring of feature.path.split('M').filter(Boolean)) {
        const points = ring.replace(/Z$/, '').split('L').map((point) => point.split(',').map(Number));
        for (let index = 0; index < points.length; index++) {
          const a = points[index];
          const b = points[(index + 1) % points.length];
          // Antarctica closes along the south pole; no inhabited country's
          // border should join opposite map edges across the visible world.
          if (Math.abs(a[0] - b[0]) > 480) expect([a[1], b[1]]).toEqual([480, 480]);
        }
      }
    }
  });
});

describe('CountryMap', () => {
  it('renders selectable boundaries with no visible country labels and marks results', async () => {
    await render(['fr'], 'mn');
    expect(container.querySelectorAll('[data-country-id]')).toHaveLength(195);
    expect(viewport().querySelectorAll('text, title')).toHaveLength(0);
    expect(country('fr').classList.contains('is-completed')).toBe(true);
    expect(country('mn').classList.contains('is-incorrect')).toBe(true);
    expect(country('va').querySelector('.map-country-dot')).not.toBeNull();
    await click(country('fr'));
    expect(select).toHaveBeenLastCalledWith('fr');
    await render(['fr'], null);
    expect(country('mn').classList.contains('is-incorrect')).toBe(false);
    expect(country('fr').classList.contains('is-completed')).toBe(true);
  });
  it('supports keyboard selection and stops guesses while disabled', async () => {
    await render();
    await act(async () => country('va').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(select).toHaveBeenLastCalledWith('va');
    await render([], null, true);
    select.mockClear();
    await click(country('mn'));
    await act(async () => country('mn').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })));
    expect(country('mn').getAttribute('tabindex')).toBe('-1');
    expect(select).not.toHaveBeenCalled();
  });
  it('zooms, pans with the keyboard, and resets', async () => {
    await render();
    expect(transform()).toBe('translate(0 0) scale(1)');
    await control('Zoom in');
    expect(transform()).toContain('scale(1.65)');
    const zoomed = transform();
    await act(async () => viewport().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true, cancelable: true })));
    expect(transform()).not.toBe(zoomed);
    await control('Reset map view');
    expect(transform()).toBe('translate(0 0) scale(1)');
  });
  it('zooms by wheel and consumes the wheel event', async () => {
    await render();
    const event = wheelEvent(-100, 400, 200);
    await act(async () => viewport().dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(transform()).not.toBe('translate(0 0) scale(1)');
    expect(transform()).not.toMatch(/NaN|Infinity/);
  });
  it('selects on a tap but suppresses guesses after a drag or pinch', async () => {
    await render();
    await pointer(country('fr').firstElementChild!, 'pointerdown', 450, 200);
    await pointer(viewport(), 'pointerup', 450, 200);
    await click(country('fr'), 1); // Browser click after pointerup must not double count.
    expect(select).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenLastCalledWith('fr');
    await control('Zoom in');
    select.mockClear();
    const zoomed = transform();
    await pointer(country('fr'), 'pointerdown', 450, 200);
    await pointer(viewport(), 'pointermove', 490, 220);
    await pointer(viewport(), 'pointerup', 490, 220);
    expect(transform()).not.toBe(zoomed);
    expect(select).not.toHaveBeenCalled();
    await pointer(country('fr'), 'pointerdown', 400, 200, 1);
    await pointer(viewport(), 'pointerdown', 600, 200, 2);
    const beforePinch = transform();
    await pointer(viewport(), 'pointermove', 700, 200, 2);
    expect(transform()).not.toBe(beforePinch);
    await pointer(viewport(), 'pointerup', 400, 200, 1);
    await pointer(viewport(), 'pointerup', 700, 200, 2);
    expect(select).not.toHaveBeenCalled();
  });
  it('lets players hide small-country targets without removing their boundaries', async () => {
    await render();
    expect(country('mc').querySelector('.map-country-dot')).not.toBeNull();
    const input = container.querySelector<HTMLInputElement>('.map-target-toggle input')!;
    await act(async () => input.click());
    expect(country('mc').querySelector('.map-country-dot')).toBeNull();
    expect(country('mc').querySelector('.map-country-shape')).not.toBeNull();
  });
  it('distinguishes revealed answers from countries correctly located', async () => {
    await render(['fr'], null, true, ['mn']);
    expect(country('fr').classList.contains('is-completed')).toBe(true);
    expect(country('fr').classList.contains('is-revealed')).toBe(false);
    expect(country('mn').classList.contains('is-revealed')).toBe(true);
    expect(country('mn').classList.contains('is-completed')).toBe(false);
    expect(country('mn').getAttribute('aria-description')).toBe('Revealed answer');
    expect(container.querySelector('.map-legend-revealed')?.parentElement?.textContent).toBe('Revealed');
    expect(select).not.toHaveBeenCalled();
  });
  it('focuses an offscreen microstate and shows its revealed dot with targets hidden', async () => {
    await render();
    await act(async () => container.querySelector<HTMLInputElement>('.map-target-toggle input')!.click());
    expect(country('va').querySelector('.map-country-dot')).toBeNull();
    await act(async () => viewport().dispatchEvent(wheelEvent(-1200, 0, 0)));
    const [x, y] = geography.find((feature) => feature.id === 'va')!.point!;
    expect(screenPosition(x, y).x, transform()!).toBeGreaterThan(960);
    await render([], null, true, ['va'], 'va');
    expect(country('va').querySelector('.map-country-dot')).not.toBeNull();
    expect(country('mc').querySelector('.map-country-dot')).toBeNull();
    expect(screenPosition(x, y).x).toBeCloseTo(480);
    expect(screenPosition(x, y).y).toBeCloseTo(240);
    expect(transform()).toContain('scale(16)');
    expect(select).not.toHaveBeenCalled();
    await control('Reset map view');
    expect(transform()).toBe('translate(0 0) scale(1)');
    await render([], null, true, ['va'], 'va');
    expect(transform()).toBe('translate(0 0) scale(1)');
    expect(country('va').classList.contains('is-revealed')).toBe(true);
    expect(select).not.toHaveBeenCalled();
  });
  it('focuses multipart countries without altering their full geographic highlighting', async () => {
    await render([], null, true, ['fr'], 'fr');
    const paris = screenPosition(486.27, 109.71);
    expect(paris.x).toBeGreaterThan(0);
    expect(paris.x).toBeLessThan(960);
    expect(paris.y).toBeGreaterThan(0);
    expect(paris.y).toBeLessThan(480);
    expect(transform()).not.toBe('translate(0 0) scale(1)');
    expect(country('fr').querySelector('.map-country-shape')?.getAttribute('d')).toBe(geography.find((feature) => feature.id === 'fr')!.path);
    const franceView = transform();
    await render([], null, true, ['fr', 'nr'], 'nr');
    expect(transform()).not.toBe(franceView);
    const [x, y] = geography.find((feature) => feature.id === 'nr')!.point!;
    const nauru = screenPosition(x, y);
    expect(nauru.x).toBeGreaterThan(0);
    expect(nauru.x).toBeLessThan(960);
    expect(nauru.y).toBeGreaterThan(0);
    expect(nauru.y).toBeLessThan(480);
    expect(select).not.toHaveBeenCalled();
  });
});
