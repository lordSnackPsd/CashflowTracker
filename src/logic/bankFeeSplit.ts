// Bank fee split on deposit (spec section 7) — asked instead of making the
// user do mental math: they give amount received (gross) and the resulting
// balance the bank shows; we derive the fee.

export interface BankFeeSplitResult {
  fee: number;
  netIncome: number;
  /** true when fee <= 0 (frozen contract) — a real bank never hands out free
   *  money, so this means a mistyped balance or stale currentBalance. The
   *  caller surfaces it back to the user instead of logging the fee. */
  discrepancy: boolean;
}

export function calcBankFeeSplit(input: {
  currentBalance: number;
  amountReceived: number;
  newBalance: number;
}): BankFeeSplitResult {
  const fee = round2(input.currentBalance + input.amountReceived - input.newBalance);
  if (fee <= 0) {
    return { fee, netIncome: input.amountReceived, discrepancy: true };
  }
  return { fee, netIncome: round2(input.amountReceived - fee), discrepancy: false };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
