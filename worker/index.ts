// FlagAtlas Worker: static assets plus multiplayer rooms.
//
//   POST /api/rooms              -> { code }   creates a room
//   GET  /api/rooms/:code/ws     -> WebSocket  joins a room
//
// Each room is one Durable Object (addressed by its code) that owns all room
// state and checks every answer. Game rules live in src/multiplayer/room.ts.
import { DurableObject } from 'cloudflare:workers';
import {
  CLOSE_CODES,
  MAX_PLAYERS,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  isRoomCode,
  parseClientMessage,
  type ServerMessage,
} from '../src/multiplayer/protocol';
import {
  createRoom,
  disconnectPlayer,
  finishIfDue,
  isExpired,
  joinRoom,
  leaveRoom,
  nextWake,
  questionFor,
  questionMessages,
  skipQuestion,
  snapshot,
  startMatch,
  submitAnswer,
  transferLeader,
  updateSettings,
  type RoomRecord,
  type Update,
} from '../src/multiplayer/room';

interface Env {
  ROOMS: DurableObjectNamespace<RoomObject>;
  ASSETS: Fetcher;
}

interface Attachment {
  playerId: string | null;
}

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...headers },
  });
}

/**
 * Browsers always send Origin on WebSocket handshakes and cross-site POSTs.
 * Requiring it to match the host blocks other websites from opening rooms
 * with a visitor's browser. (Non-browser clients can still connect; the room
 * itself validates and rate-limits everything they send.)
 */
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  const host = request.headers.get('Host') ?? new URL(request.url).host;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function randomRoomCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ROOM_CODE_LENGTH));
  return Array.from(bytes, (byte) => ROOM_CODE_ALPHABET[byte % ROOM_CODE_ALPHABET.length]).join('');
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/rooms') {
      if (request.method !== 'POST')
        return json({ error: 'method-not-allowed' }, 405, { Allow: 'POST' });
      if (!isSameOrigin(request)) return json({ error: 'forbidden' }, 403);
      // 32^6 ≈ 1 billion codes, so a collision (and retry) is very unlikely.
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = randomRoomCode();
        const room = env.ROOMS.get(env.ROOMS.idFromName(code));
        if (await room.initialize(code)) return json({ code }, 201);
      }
      return json({ error: 'unavailable' }, 503);
    }
    const match = /^\/api\/rooms\/([^/]+)\/ws$/.exec(url.pathname);
    if (match) {
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
        return json({ error: 'upgrade-required' }, 426);
      if (!isSameOrigin(request)) return json({ error: 'forbidden' }, 403);
      if (!isRoomCode(match[1])) return json({ error: 'not-found' }, 404);
      return env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(request);
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'not-found' }, 404);
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

function attachment(socket: WebSocket): Attachment {
  return (socket.deserializeAttachment() as Attachment | null) ?? { playerId: null };
}

function send(socket: WebSocket, message: ServerMessage) {
  try {
    socket.send(JSON.stringify(message));
  } catch {
    // The socket closed in the meantime; its close handler cleans up.
  }
}

export class RoomObject extends DurableObject<Env> {
  private room: RoomRecord | null = null;
  private scheduledFor: number | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Keep-alive pings are answered without waking a hibernating room.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    void ctx.blockConcurrencyWhile(async () => {
      this.room = (await ctx.storage.get<RoomRecord>('room')) ?? null;
    });
  }

  /** Called once by the Worker when a room is created. False if the code is taken. */
  async initialize(code: string): Promise<boolean> {
    if (this.room) return false;
    this.room = createRoom(code, Date.now());
    await this.commit({ broadcast: false, messages: [] });
    return true;
  }

  async fetch(): Promise<Response> {
    const { 0: client, 1: server } = new WebSocketPair();
    const refuse = (code: number, reason: string) => {
      // Accept-then-close lets the browser see why it could not join.
      server.accept();
      server.close(code, reason);
      return new Response(null, { status: 101, webSocket: client });
    };
    if (!this.room || isExpired(this.room, Date.now()))
      return refuse(CLOSE_CODES.notFound, 'Room not found');
    // Room for every player plus a few connections still in the join handshake.
    if (this.ctx.getWebSockets().length >= MAX_PLAYERS + 4)
      return refuse(CLOSE_CODES.full, 'Room is full');
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ playerId: null } satisfies Attachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, data: string | ArrayBuffer) {
    const room = this.room;
    if (!room) {
      socket.close(CLOSE_CODES.notFound, 'Room not found');
      return;
    }
    const message = parseClientMessage(data);
    if (!message) {
      send(socket, { type: 'error', code: 'invalid-message', message: 'Unrecognised message.' });
      return;
    }
    const now = Date.now();
    const ended = finishIfDue(room, now);
    const { playerId } = attachment(socket);

    if (message.type === 'join') {
      if (playerId) {
        send(socket, { type: 'error', code: 'invalid-message', message: 'Already joined.' });
        return;
      }
      const result = joinRoom(room, message, now, {
        id: crypto.randomUUID(),
        token: crypto.randomUUID(),
      });
      if (!result.ok) {
        send(socket, { type: 'error', code: result.code, message: result.message });
        if (result.code === 'room-full') socket.close(CLOSE_CODES.full, 'Room is full');
        await this.commit({ broadcast: ended, messages: [] });
        return;
      }
      const { player } = result;
      // One live connection per player, e.g. when a tab is duplicated.
      for (const other of this.ctx.getWebSockets()) {
        if (other !== socket && attachment(other).playerId === player.id) {
          other.serializeAttachment({ playerId: null } satisfies Attachment);
          other.close(CLOSE_CODES.replaced, 'Opened in another tab');
        }
      }
      socket.serializeAttachment({ playerId: player.id } satisfies Attachment);
      send(socket, { type: 'welcome', playerId: player.id, token: player.token });
      await this.commit({
        broadcast: true,
        messages: [
          { to: player.id, message: { type: 'question', question: questionFor(room, player.id, now) } },
        ],
      });
      return;
    }

    if (!playerId) {
      send(socket, { type: 'error', code: 'not-joined', message: 'Join the room first.' });
      return;
    }
    let update: Update;
    switch (message.type) {
      case 'settings':
        update = updateSettings(room, playerId, message.settings, now);
        break;
      case 'start':
        update = startMatch(room, playerId, now);
        break;
      case 'transfer':
        update = transferLeader(room, playerId, message.playerId, now);
        break;
      case 'answer':
        update = submitAnswer(room, playerId, message, now);
        break;
      case 'skip':
        update = skipQuestion(room, playerId, message, now);
        break;
      case 'leave':
        update = leaveRoom(room, playerId, now);
        socket.serializeAttachment({ playerId: null } satisfies Attachment);
        socket.close(CLOSE_CODES.left, 'Left the room');
        break;
    }
    await this.commit(update, ended);
  }

  async webSocketClose(socket: WebSocket) {
    await this.dropSocket(socket);
  }

  async webSocketError(socket: WebSocket) {
    await this.dropSocket(socket);
  }

  async alarm() {
    this.scheduledFor = null;
    const room = this.room;
    if (!room) return;
    const now = Date.now();
    if (isExpired(room, now)) {
      for (const socket of this.ctx.getWebSockets())
        socket.close(CLOSE_CODES.expired, 'Room expired');
      this.room = null;
      await this.ctx.storage.deleteAll();
      return;
    }
    const ended = finishIfDue(room, now);
    // The countdown is over: hand out the first questions.
    const started = room.phase === 'playing' && now >= room.startsAt;
    await this.commit({
      broadcast: ended,
      messages: started ? questionMessages(room, now) : [],
    });
  }

  private async dropSocket(socket: WebSocket) {
    const { playerId } = attachment(socket);
    if (!playerId || !this.room) return;
    const stillConnected = this.ctx
      .getWebSockets()
      .some(
        (other) =>
          other !== socket &&
          other.readyState === WebSocket.OPEN &&
          attachment(other).playerId === playerId,
      );
    if (stillConnected) return;
    const now = Date.now();
    const ended = finishIfDue(this.room, now);
    await this.commit(disconnectPlayer(this.room, playerId, now), ended);
  }

  /** Persist, deliver messages, and make sure the next alarm is scheduled. */
  private async commit(update: Update, broadcast = false) {
    const room = this.room;
    if (!room) return;
    // Durable Object output gates hold these messages until the write is durable.
    await this.ctx.storage.put('room', room);
    const sockets = this.ctx.getWebSockets();
    for (const { to, message } of update.messages)
      for (const socket of sockets)
        if (attachment(socket).playerId === to) send(socket, message);
    if (update.broadcast || broadcast) {
      const state: ServerMessage = { type: 'state', room: snapshot(room, Date.now()) };
      for (const socket of sockets) if (attachment(socket).playerId) send(socket, state);
    }
    const wake = nextWake(room, Date.now());
    if (wake !== this.scheduledFor) {
      await this.ctx.storage.setAlarm(wake);
      this.scheduledFor = wake;
    }
  }
}
