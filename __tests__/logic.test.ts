import {
  calcTermLoanRemaining,
  calcTermLoanProgress,
  calcRevolvingCreditPayment,
  calcFriendLoanRemaining,
  suggestTermLoanPaymentFields,
} from '../src/logic/debtMath';
import { calcBankFeeSplit } from '../src/logic/bankFeeSplit';
import { calcUnbilledSpending } from '../src/logic/unbilledSpending';
import { normalizePattern, matchByAmount } from '../src/logic/merchantLearning';
import type { LoanPayment, Transaction } from '../src/types';

const lp = (principal: number, interest = 0, fee = 0): LoanPayment => ({
  id: 'x',
  debtId: 'd',
  date: '2026-01-01',
  totalAmount: principal + interest + fee,
  principalAmount: principal,
  interestAmount: interest,
  feeAmount: fee,
  sourceTransactionRef: null,
});

describe('revolving credit payment (spec worked example)', () => {
  it('80 available, 47.5 deducted, 120 new available → 40 principal / 7.5 interest, balance set to 120', () => {
    const r = calcRevolvingCreditPayment({
      availableBefore: 80,
      totalAmount: 47.5,
      newAvailableAmount: 120,
    });
    expect(r.principalAmount).toBe(40);
    expect(r.interestAmount).toBe(7.5);
    expect(r.newAvailableBalance).toBe(120); // direct set, not an increment
  });
});

describe('term loan math', () => {
  it('remaining and progress', () => {
    const payments = [lp(385, 116.47), lp(381, 120.47)];
    expect(calcTermLoanRemaining(15000, payments)).toBe(15000 - 766);
    expect(calcTermLoanProgress(15000, payments)).toBeCloseTo(766 / 15000);
  });

  it('autofill rule 1: total + principal → interest', () => {
    const r = suggestTermLoanPaymentFields({ total: 501.47, principal: 385 });
    expect(r.interest).toBeCloseTo(116.47);
  });

  it('autofill rule 2: total exceeding principal+interest → fee', () => {
    const r = suggestTermLoanPaymentFields({ total: 520, principal: 385, interest: 116.47 });
    expect(r.fee).toBeCloseTo(18.53);
  });

  it('autofill rule 3: principal+interest+fee → total', () => {
    const r = suggestTermLoanPaymentFields({ principal: 385, interest: 116.47, fee: 10 });
    expect(r.total).toBeCloseTo(511.47);
  });

  it('never suggests fee when total equals principal+interest', () => {
    const r = suggestTermLoanPaymentFields({ total: 501.47, principal: 385, interest: 116.47 });
    expect(r.fee).toBeUndefined();
  });
});

describe('friend loan math', () => {
  it('remaining after backdated pre-app history', () => {
    expect(calcFriendLoanRemaining(7800, [lp(2400)])).toBe(5400);
  });
});

describe('bank fee split', () => {
  it('derives fee from resulting balance', () => {
    // balance 100, receive 500 gross, bank shows 590 → fee 10, net 490
    const r = calcBankFeeSplit({ currentBalance: 100, amountReceived: 500, newBalance: 590 });
    expect(r.fee).toBe(10);
    expect(r.netIncome).toBe(490);
    expect(r.discrepancy).toBe(false);
  });

  it('flags discrepancy when fee <= 0 (bank never hands out free money)', () => {
    const r = calcBankFeeSplit({ currentBalance: 100, amountReceived: 500, newBalance: 605 });
    expect(r.discrepancy).toBe(true);
  });
});

describe('unbilled spending', () => {
  it('diff = expected − actual', () => {
    expect(calcUnbilledSpending({ expectedBalance: 340, actualBalance: 306 }).diff).toBe(34);
  });
});

describe('merchant learning', () => {
  it('normalizes text: lowercase, punctuation stripped', () => {
    expect(normalizePattern('  Achat/CARREFOUR, TUNIS!  ')).toBe('achatcarrefour tunis');
  });

  const tx = (amount: number, itemId: string): Transaction => ({
    id: 'x',
    accountId: 'a',
    type: 'expense',
    amount,
    date: '2026-01-01',
    categoryId: null,
    itemId,
    paymentMethodNote: null,
    counterparty: null,
    clientId: null,
    transferKind: null,
    feeAmount: null,
    linkedTransactionId: null,
    source: 'quick_add',
    note: null,
    isArchived: false,
    archivedAt: null,
  });

  it('matches by amount within ±10%, ranked by frequency', () => {
    const past = [tx(3.5, 'coffee'), tx(3.4, 'coffee'), tx(3.6, 'coffee'), tx(3.5, 'tea')];
    expect(matchByAmount(3.5, past)).toEqual({ itemId: 'coffee', frequency: 3 });
  });

  it('returns null when nothing is in the tolerance band', () => {
    expect(matchByAmount(100, [tx(3.5, 'coffee')])).toBeNull();
  });
});
