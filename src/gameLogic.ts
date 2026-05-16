import type { Card, OpponentView, PlayerView, Room, ServerPlayer } from './types';
import { cardLabel, createShuffledDeck } from './deck';
import { isClue } from './rules';

export function cardsEqual(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

function drawOne(deck: Card[], hand: Card[]): { hand: Card[]; deck: Card[] } {
  if (!deck.length) return { hand, deck };
  const [top, ...rest] = deck;
  return { hand: [...hand, top], deck: rest };
}

function nextNonEliminated(players: ServerPlayer[], from: number): number {
  const n = players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (from + step) % n;
    if (!players[idx].isEliminated) return idx;
  }
  return from;
}

function appendLog(room: Room, entry: string): void {
  room.actionLog.push(entry);
  if (room.actionLog.length > 20) room.actionLog.shift();
}

function checkOnlyOneAlive(room: Room): boolean {
  const alive = room.players.filter((p) => !p.isEliminated);
  if (alive.length === 1) {
    room.state = 'finished';
    room.winners = [alive[0].socketId];
    appendLog(room, `${alive[0].name} is the last one standing — wins!`);
    return true;
  }
  return false;
}

export function dealPlayers(
  sockets: Array<{ socketId: string; name: string }>,
): { players: ServerPlayer[]; deck: Card[] } {
  const deck = createShuffledDeck();
  const answerCards = deck.splice(0, sockets.length);
  const hands = sockets.map(() => deck.splice(0, 3));

  const players: ServerPlayer[] = sockets.map((s, i) => ({
    socketId: s.socketId,
    name: s.name,
    answerCard: answerCards[i],
    hand: hands[i],
    playedClues: [],
    hasGuessed: false,
    isEliminated: false,
  }));

  return { players, deck };
}

export function buildPlayerView(room: Room, socketId: string): PlayerView {
  const player = room.players.find((p) => p.socketId === socketId)!;

  const opponents: OpponentView[] = room.players
    .filter((p) => p.socketId !== socketId)
    .map((p) => ({
      id: p.socketId,
      name: p.name,
      answerCard: p.answerCard,
      playedClues: p.playedClues,
      hasGuessed: p.hasGuessed,
      isEliminated: p.isEliminated,
    }));

  const activePlayer =
    room.state === 'playing' ? room.players[room.activePlayerIndex] : null;

  return {
    phase: room.state,
    playerId: socketId,
    playerName: player.name,
    isHost: room.hostSocketId === socketId,
    roomCode: room.code,
    myHand: player.hand,
    myPlayedClues: player.playedClues,
    myHasGuessed: player.hasGuessed,
    myIsEliminated: player.isEliminated,
    myAnswerCard: room.state === 'finished' ? player.answerCard : undefined,
    opponents,
    activePlayerId: activePlayer?.socketId ?? null,
    deckCount: room.deck.length,
    winners: room.winners,
    winnerNames: room.winners
      .map((wid) => room.players.find((p) => p.socketId === wid)?.name ?? '')
      .filter(Boolean),
    actionLog: room.actionLog.slice(-5),
  };
}

export function processPlayClue(
  room: Room,
  socketId: string,
  cardIndex: number,
): { error: string } | { ok: true } {
  if (room.state !== 'playing') return { error: 'Game is not in progress.' };
  const playerIdx = room.players.findIndex((p) => p.socketId === socketId);
  if (playerIdx === -1) return { error: 'Player not found.' };
  if (playerIdx !== room.activePlayerIndex) return { error: 'Not your turn.' };

  const player = room.players[playerIdx];
  if (cardIndex < 0 || cardIndex >= player.hand.length) return { error: 'Invalid card.' };

  const played = player.hand[cardIndex];
  const result: 'yes' | 'no' = isClue(played, player.answerCard) ? 'yes' : 'no';

  player.playedClues.push({ card: played, result });
  player.hand = player.hand.filter((_, i) => i !== cardIndex);
  const drawn = drawOne(room.deck, player.hand);
  player.hand = drawn.hand;
  room.deck = drawn.deck;

  appendLog(room, `${player.name} played ${cardLabel(played)} → ${result === 'yes' ? '✓ Yes' : '✗ No'}`);

  if (!checkOnlyOneAlive(room)) {
    room.activePlayerIndex = nextNonEliminated(room.players, playerIdx);
  }

  return { ok: true };
}

export function processMakeGuess(
  room: Room,
  socketId: string,
  guess: Card,
): { error: string } | { ok: true } {
  if (room.state !== 'playing') return { error: 'Game is not in progress.' };
  const playerIdx = room.players.findIndex((p) => p.socketId === socketId);
  if (playerIdx === -1) return { error: 'Player not found.' };
  if (playerIdx !== room.activePlayerIndex) return { error: 'Not your turn.' };

  const player = room.players[playerIdx];
  if (player.hasGuessed) return { error: 'You have already used your guess.' };

  player.hasGuessed = true;
  const correct = cardsEqual(guess, player.answerCard);

  if (correct) {
    room.state = 'finished';
    room.winners = [socketId];
    appendLog(room, `${player.name} guessed ${cardLabel(guess)} → Correct! Wins!`);
  } else {
    player.isEliminated = true;
    appendLog(room, `${player.name} guessed ${cardLabel(guess)} → Wrong! Eliminated.`);
    if (!checkOnlyOneAlive(room)) {
      room.activePlayerIndex = nextNonEliminated(room.players, playerIdx);
    }
  }

  return { ok: true };
}
