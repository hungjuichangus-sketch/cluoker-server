import type { Card, Rank } from './types';

function isAdjacentOrEqual(a: Rank, b: Rank): boolean {
  if (a === b) return true;
  const d = Math.abs(a - b);
  return d === 1 || d === 12; // 12 = 13-1 for A↔K wrap-around
}

export function isClue(played: Card, answer: Card): boolean {
  return played.suit === answer.suit || isAdjacentOrEqual(played.rank, answer.rank);
}
