// Merchant-learning engine (spec section 8) — pure frequency-based, no ML.
// Text matching itself is a merchant_rules repository lookup (matchCount >= 3
// = strong match); these are the pure helpers around it. When both text and
// amount signals exist, text wins — the caller arbitrates.

import type { Transaction } from '../types';

/** Normalizes description text for rule matching: lowercase, punctuation stripped. */
export function normalizePattern(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** A rule with matchCount >= 3 is a strong ("learned") match. */
export const STRONG_MATCH_THRESHOLD = 3;

export interface AmountMatch {
  itemId: string;
  frequency: number;
}

/**
 * Amount matching: for a pure numeric entry with no description text, look at
 * past expense transactions within ±tolerancePct of the amount, ranked by
 * frequency of item, and return the most common itemId (or null).
 */
export function matchByAmount(
  amount: number,
  pastExpenses: Transaction[],
  tolerancePct = 0.1,
): AmountMatch | null {
  if (amount <= 0) return null;
  const lo = amount * (1 - tolerancePct);
  const hi = amount * (1 + tolerancePct);

  const freq = new Map<string, number>();
  for (const tx of pastExpenses) {
    if (tx.type !== 'expense' || !tx.itemId) continue;
    if (tx.amount < lo || tx.amount > hi) continue;
    freq.set(tx.itemId, (freq.get(tx.itemId) ?? 0) + 1);
  }

  let best: AmountMatch | null = null;
  for (const [itemId, frequency] of freq) {
    if (!best || frequency > best.frequency) {
      best = { itemId, frequency };
    }
  }
  return best;
}
