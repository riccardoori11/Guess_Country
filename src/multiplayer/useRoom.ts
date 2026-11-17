import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CLOSE_CODES,
  type ClientMessage,
  type ErrorCode,
  type Question,
  type RoomSnapshot,
  type ServerMessage,
} from './protocol';

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

export interface Feedback {
  /** Increments per message so repeated identical feedback still re-renders. */
  seq: number;
  countryId: string;
  outcome: 'correct' | 'incorrect' | 'skipped';
  value?: string;
}

export interface RoomClientState {
  status: ConnectionStatus;
  closedReason: string | null;
  playerId: string | null;
  room: RoomSnapshot | null;
  /** Add to Date.now() to estimate the server clock. */
  clockOffset: number;
  question: Question | null;
  feedback: Feedback | null;
  error: { seq: number; code: ErrorCode; message: string } | null;
}

const INITIAL: RoomClientState = {
  status: 'idle',
  closedReason: null,
  playerId: null,
  room: null,
  clockOffset: 0,
  question: null,
  feedback: null,
  error: null,
};

const MAX_RECONNECTS = 6;
const PING_INTERVAL_MS = 25_000;

const tokenKey = (code: string) => `flag-atlas:room-token:${code}`;
// Per-tab storage: each tab is its own player, and a refresh reclaims the seat.
function readToken(code: string) {
  try {
    return sessionStorage.getItem(tokenKey(code)) ?? undefined;
  } catch {
    return undefined;
  }
}
function writeToken(code: string, token: string | null) {
  try {
    if (token) sessionStorage.setItem(tokenKey(code), token);
    else sessionStorage.removeItem(tokenKey(code));
  } catch {
    // Storage can be unavailable (private mode); reconnects then join fresh.
  }
}

function finalCloseReason(code: number): string | null {
  switch (code) {
    case CLOSE_CODES.notFound:
      return 'That room doesn’t exist or has expired. Check the code and try again.';
    case CLOSE_CODES.full:
      return 'That room is full.';
    case CLOSE_CODES.replaced:
      return 'You opened this room in another tab.';
    case CLOSE_CODES.expired:
      return 'This room closed after an hour without activity.';
    case CLOSE_CODES.left:
      return 'You left the room.';
    default:
      return null;
  }
}

export async function requestNewRoom(): Promise<string> {
  const response = await fetch('/api/rooms', { method: 'POST' });
  const body = (await response.json().catch(() => null)) as { code?: unknown } | null;
  if (!response.ok || typeof body?.code !== 'string')
    throw new Error('Could not create a room right now. Please try again.');
  return body.code;
}

export function useRoom(code: string | null, name: string) {
  const [state, setState] = useState<RoomClientState>(INITIAL);
  const socketRef = useRef<WebSocket | null>(null);
  const nameRef = useRef(name);
  nameRef.current = name;

  useEffect(() => {
    if (!code) {
      setState(INITIAL);
      return;
    }
    let disposed = false;
    let attempts = 0;
    let seq = 0;
    let retryTimer: number | undefined;
    let pingTimer: number | undefined;

    const handle = (message: ServerMessage) => {
      seq += 1;
      setState((current) => {
        switch (message.type) {
          case 'welcome':
            writeToken(code, message.token);
            return { ...current, playerId: message.playerId };
          case 'state':
            return {
              ...current,
              room: message.room,
              clockOffset: message.room.serverNow - Date.now(),
              question: message.room.phase === 'lobby' ? null : current.question,
              feedback: message.room.phase === 'lobby' ? null : current.feedback,
            };
          case 'question':
            return { ...current, question: message.question };
          case 'feedback':
            return { ...current, feedback: { seq, ...message } };
          case 'error':
            return { ...current, error: { seq, code: message.code, message: message.message } };
        }
      });
    };

    function connect() {
      const url = new URL(`/api/rooms/${code}/ws`, window.location.href);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(url);
      socketRef.current = socket;
      socket.onopen = () => {
        attempts = 0;
        setState((current) => ({ ...current, status: 'open' }));
        socket.send(
          JSON.stringify({ type: 'join', name: nameRef.current, token: readToken(code!) } satisfies ClientMessage),
        );
        window.clearInterval(pingTimer);
        pingTimer = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send('ping');
        }, PING_INTERVAL_MS);
      };
      socket.onmessage = (event) => {
        if (typeof event.data !== 'string' || event.data === 'pong') return;
        try {
          handle(JSON.parse(event.data) as ServerMessage);
        } catch {
          // Ignore anything that is not a protocol message.
        }
      };
      socket.onclose = (event) => {
        window.clearInterval(pingTimer);
        if (disposed || socketRef.current !== socket) return;
        socketRef.current = null;
        const reason = finalCloseReason(event.code);
        if (reason || attempts >= MAX_RECONNECTS) {
          if (event.code !== CLOSE_CODES.replaced) writeToken(code!, null);
          setState((current) => ({
            ...current,
            status: 'closed',
            closedReason: reason ?? 'We lost the connection to the room.',
          }));
          return;
        }
        setState((current) => ({ ...current, status: 'reconnecting' }));
        retryTimer = window.setTimeout(connect, Math.min(500 * 2 ** attempts, 8000));
        attempts += 1;
      };
    }

    setState({ ...INITIAL, status: 'connecting' });
    connect();
    return () => {
      disposed = true;
      window.clearTimeout(retryTimer);
      window.clearInterval(pingTimer);
      socketRef.current?.close(1000);
      socketRef.current = null;
    };
  }, [code]);

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current;
    if (socket?.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  }, []);

  const leave = useCallback(() => {
    send({ type: 'leave' });
    if (code) writeToken(code, null);
  }, [code, send]);

  return { state, send, leave };
}
