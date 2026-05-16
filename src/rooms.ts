import type { LobbyView, Room, ServerPlayer } from './types';
import { dealPlayers } from './gameLogic';

const rooms = new Map<string, Room>();
const socketToRoom = new Map<string, string>();

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code: string;
  do {
    code = Array.from({ length: 4 }, () =>
      chars[Math.floor(Math.random() * chars.length)],
    ).join('');
  } while (rooms.has(code));
  return code;
}

const DUMMY_PLAYER = (): Omit<ServerPlayer, 'socketId' | 'name'> => ({
  answerCard: { suit: 'spades', rank: 1 },
  hand: [],
  playedClues: [],
  hasGuessed: false,
  isEliminated: false,
});

export function buildLobbyView(room: Room): LobbyView {
  return {
    roomCode: room.code,
    hostId: room.hostSocketId,
    players: room.players.map((p) => ({ id: p.socketId, name: p.name })),
    state: room.state,
  };
}

export function createRoom(socketId: string, playerName: string): { room: Room } {
  const code = generateCode();
  const room: Room = {
    code,
    hostSocketId: socketId,
    state: 'waiting',
    players: [{ socketId, name: playerName, ...DUMMY_PLAYER() }],
    deck: [],
    activePlayerIndex: 0,
    winners: [],
    actionLog: [],
  };
  rooms.set(code, room);
  socketToRoom.set(socketId, code);
  return { room };
}

export function joinRoom(
  socketId: string,
  roomCode: string,
  playerName: string,
): { room: Room } | { error: string } {
  const code = roomCode.toUpperCase();
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found. Check the code and try again.' };
  if (room.state !== 'waiting') return { error: 'Game has already started.' };
  if (room.players.length >= 6) return { error: 'Room is full (max 6 players).' };
  if (room.players.some((p) => p.socketId === socketId)) return { error: 'Already in this room.' };

  room.players.push({ socketId, name: playerName, ...DUMMY_PLAYER() });
  socketToRoom.set(socketId, code);
  return { room };
}

export function startRoom(
  socketId: string,
  roomCode: string,
): { room: Room } | { error: string } {
  const room = rooms.get(roomCode);
  if (!room) return { error: 'Room not found.' };
  if (room.hostSocketId !== socketId) return { error: 'Only the host can start.' };
  if (room.players.length < 2) return { error: 'Need at least 2 players to start.' };
  if (room.state !== 'waiting') return { error: 'Game already started.' };

  const { players, deck } = dealPlayers(
    room.players.map((p) => ({ socketId: p.socketId, name: p.name })),
  );
  room.players = players;
  room.deck = deck;
  room.state = 'playing';
  room.activePlayerIndex = 0;
  room.actionLog = [`Game started! ${room.players[0].name}'s turn.`];

  return { room };
}

export function leaveRoom(socketId: string): Room | null {
  const code = socketToRoom.get(socketId);
  if (!code) return null;
  socketToRoom.delete(socketId);

  const room = rooms.get(code);
  if (!room) return null;

  room.players = room.players.filter((p) => p.socketId !== socketId);

  if (room.players.length === 0) {
    rooms.delete(code);
    return null;
  }

  // Transfer host to next player if host left
  if (room.hostSocketId === socketId) {
    room.hostSocketId = room.players[0].socketId;
  }

  return room;
}

export function restartRoom(
  socketId: string,
  roomCode: string,
): { room: Room } | { error: string } {
  const room = rooms.get(roomCode);
  if (!room) return { error: 'Room not found.' };
  if (room.hostSocketId !== socketId) return { error: 'Only the host can start a new round.' };
  if (room.state !== 'finished') return { error: 'Game is not finished yet.' };

  room.state = 'waiting';
  room.winners = [];
  room.actionLog = [];
  room.deck = [];
  room.activePlayerIndex = 0;
  room.players = room.players.map((p) => ({
    ...DUMMY_PLAYER(),
    socketId: p.socketId,
    name: p.name,
  }));

  return { room };
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code);
}
