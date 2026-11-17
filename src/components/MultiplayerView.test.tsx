// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MultiplayerView } from './MultiplayerView';
import {
  DEFAULT_SETTINGS,
  type ClientMessage,
  type RoomSnapshot,
  type ServerMessage,
} from '../multiplayer/protocol';

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

/** Minimal stand-in for the browser WebSocket that records what the UI sends. */
class FakeSocket {
  static OPEN = 1;
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: ClientMessage[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: ((event: { code: number }) => void) | null = null;
  constructor(url: URL) {
    this.url = url.toString();
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    if (data !== 'ping') this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
  }
  async open() {
    await act(async () => {
      this.readyState = 1;
      this.onopen?.();
    });
  }
  async receive(message: ServerMessage) {
    await act(async () => this.onmessage?.({ data: JSON.stringify(message) }));
  }
  async drop(code: number) {
    await act(async () => {
      this.readyState = 3;
      this.onclose?.({ code });
    });
  }
}

let root: Root;
let container: HTMLDivElement;

function room(overrides: Partial<RoomSnapshot> = {}): RoomSnapshot {
  return {
    code: 'K7QM2X',
    phase: 'lobby',
    leaderId: 'me',
    settings: DEFAULT_SETTINGS,
    round: 0,
    startsAt: 0,
    endsAt: 0,
    serverNow: Date.now(),
    players: [
      { id: 'me', name: 'Ada', connected: true, inMatch: false, score: 0 },
      { id: 'bo', name: 'Bo', connected: true, inMatch: false, score: 0 },
    ],
    results: null,
    ...overrides,
  };
}

function button(label: string) {
  const found = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (element) => element.textContent?.trim() === label,
  );
  if (!found) throw new Error(`Missing button: ${label}`);
  return found;
}
async function click(element: Element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}
async function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(async () => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function submit(form: HTMLFormElement) {
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
}

/** Renders, creates a room, and completes the join handshake as leader. */
async function joinAsLeader(snapshot = room()) {
  await act(async () => root.render(<MultiplayerView />));
  await type(container.querySelector<HTMLInputElement>('.mp-field input')!, '  Ada ');
  await click(button('Create a room'));
  const socket = FakeSocket.instances.at(-1)!;
  await socket.open();
  await socket.receive({ type: 'welcome', playerId: 'me', token: 'secret' });
  await socket.receive({ type: 'state', room: snapshot });
  return socket;
}

beforeEach(() => {
  FakeSocket.instances = [];
  vi.stubGlobal('WebSocket', FakeSocket);
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ code: 'K7QM2X' }), { status: 201 })),
  );
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

describe('multiplayer', () => {
  it('requires a name and a valid code before joining', async () => {
    await act(async () => root.render(<MultiplayerView />));
    await click(button('Create a room'));
    expect(container.textContent).toContain('Choose a name');
    await type(container.querySelector<HTMLInputElement>('.mp-field input')!, 'Ada');
    await type(container.querySelector<HTMLInputElement>('.mp-join input')!, 'abc');
    await submit(container.querySelector<HTMLFormElement>('.mp-join')!);
    expect(container.textContent).toContain('Room codes are 6 letters and numbers');
    expect(FakeSocket.instances).toHaveLength(0);
  });

  it('creates a room, joins it, and lets the leader change settings and start', async () => {
    const socket = await joinAsLeader();
    expect(socket.url).toMatch(/\/api\/rooms\/K7QM2X\/ws$/);
    expect(socket.sent[0]).toEqual({ type: 'join', name: 'Ada' });
    expect(sessionStorage.getItem('flag-atlas:room-token:K7QM2X')).toBe('secret');
    expect(localStorage.getItem('flag-atlas:player-name:v1')).toBe('Ada');
    expect(window.location.search).toBe('?room=K7QM2X');
    expect(container.querySelector('.mp-code')?.textContent).toBe('K7QM2X');

    await click(button('30 sec'));
    expect(socket.sent.at(-1)).toEqual({
      type: 'settings',
      settings: { ...DEFAULT_SETTINGS, duration: 30 },
    });
    await click(button('Make leader'));
    expect(socket.sent.at(-1)).toEqual({ type: 'transfer', playerId: 'bo' });
    await click(button('Start 1 min match'));
    expect(socket.sent.at(-1)).toEqual({ type: 'start' });
  });

  it('shows settings read-only to players who are not the leader', async () => {
    await joinAsLeader(room({ leaderId: 'bo' }));
    expect(container.querySelector('fieldset')?.disabled).toBe(true);
    expect(container.textContent).toContain('Waiting for Bo to start the match');
    expect(container.textContent).not.toContain('Make leader');
  });

  it('plays a timed round: shows the question, sends answers, and reports feedback', async () => {
    const now = Date.now();
    const socket = await joinAsLeader();
    const players = room().players.map((player) => ({ ...player, inMatch: true }));
    await socket.receive({
      type: 'state',
      room: room({ phase: 'playing', round: 1, startsAt: now - 1000, endsAt: now + 59_000, serverNow: now, players }),
    });
    await socket.receive({ type: 'question', question: { round: 1, number: 1, countryId: 'fr' } });
    expect(container.querySelector('[role="timer"]')?.textContent).toMatch(/0:59|1:00/);
    expect(container.querySelector<HTMLImageElement>('.country-flag')?.src).toContain('fr');

    const input = container.querySelector<HTMLInputElement>('#mp-answer')!;
    await type(input, 'Spain');
    await submit(container.querySelector<HTMLFormElement>('.mp-answer')!);
    expect(socket.sent.at(-1)).toEqual({ type: 'answer', round: 1, countryId: 'fr', value: 'Spain' });
    await socket.receive({ type: 'feedback', round: 1, countryId: 'fr', outcome: 'incorrect', value: 'Spain' });
    expect(container.textContent).toContain('Not quite');

    await click(button('Skip'));
    expect(socket.sent.at(-1)).toEqual({ type: 'skip', round: 1, countryId: 'fr' });
    await socket.receive({ type: 'feedback', round: 1, countryId: 'fr', outcome: 'skipped' });
    await socket.receive({ type: 'question', question: { round: 1, number: 2, countryId: 'fi' } });
    expect(container.textContent).toContain('Skipped. It was France.');
    expect(container.querySelector<HTMLInputElement>('#mp-answer')?.value).toBe('');
  });

  it('shows results after a match', async () => {
    await joinAsLeader(room({
      results: [
        { id: 'bo', name: 'Bo', rank: 1, score: 7, wrong: 1, skipped: 0 },
        { id: 'me', name: 'Ada', rank: 2, score: 5, wrong: 0, skipped: 2 },
      ],
    }));
    expect(container.textContent).toContain('Bo wins with 7 correct!');
    expect(container.textContent).toContain('You placed #2.');
  });

  it('explains when a room does not exist', async () => {
    const socket = await joinAsLeader();
    await socket.drop(4004);
    expect(container.textContent).toContain('That room doesn’t exist or has expired');
    expect(sessionStorage.getItem('flag-atlas:room-token:K7QM2X')).toBeNull();
    await click(button('Back to multiplayer'));
    expect(window.location.search).toBe('');
  });
});
