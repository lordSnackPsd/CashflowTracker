// Unbilled spending (spec section 4): on manual "Update total", compare the
// account's expected balance (from the transaction log since the last
// correction) against the actual balance the user typed in. Purely a
// subtraction — the caller supplies both numbers and decides storage/display.

export function calcUnbilledSpending(input: {
  expectedBalance: number;
  actualBalance: number;
}): { diff: number } {
  return { diff: round2(input.expectedBalance - input.actualBalance) };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
