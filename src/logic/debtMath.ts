// Pure debt calculations — no SQLite, no UI, no side effects.
// Contract: team-build-package.md section 2.6 / spec section 6.4.

import type { LoanPayment } from '../types';

/** Term loan: remaining = principalDisbursed − sum(principal paid). */
export function calcTermLoanRemaining(principalDisbursed: number, payments: LoanPayment[]): number {
  const paid = payments.reduce((s, p) => s + p.principalAmount, 0);
  return principalDisbursed - paid;
}

/** Term loan payoff progress, 0..1. */
export function calcTermLoanProgress(principalDisbursed: number, payments: LoanPayment[]): number {
  if (principalDisbursed <= 0) return 0;
  const paid = payments.reduce((s, p) => s + p.principalAmount, 0);
  return Math.max(0, Math.min(1, paid / principalDisbursed));
}

export interface TermLoanPaymentFields {
  total?: number;
  principal?: number;
  interest?: number;
  fee?: number;
}

/**
 * Bidirectional auto-fill for the term-loan payment sheet, in priority order
 * (spec 6.4). Returns the input with any derivable field suggested; existing
 * user-entered values are never overwritten — a suggestion is a starting
 * point, not a lock.
 *
 * 1. total + one of (principal/interest) filled → suggest the other as
 *    total − (the one entered).
 * 2. principal + interest + total all filled and total exceeds their sum →
 *    suggest fee = total − principal − interest.
 * 3. principal + interest + fee filled (total empty) → suggest
 *    total = principal + interest + fee.
 */
export function suggestTermLoanPaymentFields(input: TermLoanPaymentFields): TermLoanPaymentFields {
  const out: TermLoanPaymentFields = { ...input };
  const has = (v: number | undefined): v is number => v !== undefined && !Number.isNaN(v);

  // Rule 1
  if (has(out.total) && has(out.principal) && !has(out.interest)) {
    out.interest = round2(out.total - out.principal);
  } else if (has(out.total) && has(out.interest) && !has(out.principal)) {
    out.principal = round2(out.total - out.interest);
  }

  // Rule 2
  if (
    has(out.total) && has(out.principal) && has(out.interest) && !has(input.fee) &&
    out.total > out.principal + out.interest
  ) {
    out.fee = round2(out.total - out.principal - out.interest);
  }

  // Rule 3
  if (!has(out.total) && has(out.principal) && has(out.interest) && has(out.fee)) {
    out.total = round2(out.principal + out.interest + out.fee);
  }

  return out;
}

export interface RevolvingCreditPaymentResult {
  principalAmount: number;
  interestAmount: number;
  newAvailableBalance: number;
}

/**
 * Revolving credit payment math, exactly per the bank's own reporting:
 *   principalAmount   = newAvailableAmount − availableBefore
 *   interestAmount    = totalAmount − principalAmount   (the bank's cut)
 *   newAvailableBalance = newAvailableAmount            (a direct SET, never an increment)
 *
 * Worked example: available 80, bank deducts 47.5, new available 120 →
 * principal 40, interest 7.5, balance set straight to 120.
 */
export function calcRevolvingCreditPayment(input: {
  availableBefore: number;
  totalAmount: number;
  newAvailableAmount: number;
}): RevolvingCreditPaymentResult {
  const principalAmount = round2(input.newAvailableAmount - input.availableBefore);
  const interestAmount = round2(input.totalAmount - principalAmount);
  return {
    principalAmount,
    interestAmount,
    newAvailableBalance: input.newAvailableAmount,
  };
}

/** Friend loan: remaining = totalOwed − sum(principal paid). Never interest, never fees. */
export function calcFriendLoanRemaining(totalOwed: number, payments: LoanPayment[]): number {
  const paid = payments.reduce((s, p) => s + p.principalAmount, 0);
  return totalOwed - paid;
}

/** Friend loan payoff progress, 0..1. */
export function calcFriendLoanProgress(totalOwed: number, payments: LoanPayment[]): number {
  if (totalOwed <= 0) return 0;
  const paid = payments.reduce((s, p) => s + p.principalAmount, 0);
  return Math.max(0, Math.min(1, paid / totalOwed));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
