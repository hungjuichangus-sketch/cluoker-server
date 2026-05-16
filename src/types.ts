export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface Card {
  suit: Suit;
  rank: Rank;
}

export interface PlayedClue {
  card: Card;
  result: 'yes' | 'no';
}

export interface ServerPlayer {
  socketId: string;
  name: string;
  answerCard: Card;
  hand: Card[];
  playedClues: PlayedClue[];
  hasGuessed: boolean;
  isEliminated: boolean;
}

export interface Room {
  code: string;
  hostSocketId: string;
  state: 'waiting' | 'playing' | 'finished';
  players: ServerPlayer[];
  deck: Card[];
  activePlayerIndex: number;
  winners: string[];     // socketIds
  actionLog: string[];
}

export interface OpponentView {
  id: string;
  name: string;
  answerCard: Card;
  playedClues: PlayedClue[];
  hasGuessed: boolean;
  isEliminated: boolean;
}

export interface PlayerView {
  phase: 'waiting' | 'playing' | 'finished';
  playerId: string;
  playerName: string;
  isHost: boolean;
  roomCode: string;
  myHand: Card[];
  myPlayedClues: PlayedClue[];
  myHasGuessed: boolean;
  myIsEliminated: boolean;
  myAnswerCard?: Card;     // only set when phase === 'finished'
  opponents: OpponentView[];
  activePlayerId: string | null;
  deckCount: number;
  winners: string[];
  winnerNames: string[];
  actionLog: string[];
}

export interface LobbyView {
  roomCode: string;
  hostId: string;
  players: Array<{ id: string; name: string }>;
  state: 'waiting' | 'playing' | 'finished';
}
