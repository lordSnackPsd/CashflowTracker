// ===== Enums =====
export type DebtType = 'term_loan' | 'revolving_credit' | 'friend_loan';
export type DebtStatus = 'active' | 'paid'; // revolving_credit never reaches 'paid'
export type TransactionType = 'expense' | 'income' | 'transfer_in' | 'transfer_out';
export type TransferKind = 'client' | 'personal' | null;
export type TransactionSource = 'quick_add' | 'detailed';
export type ScheduledPaymentStatus = 'pending' | 'partially_paid' | 'completed' | 'overdue';
export type UnloggedAlertMode = 'percentage' | 'monthly_allowance' | 'daily_allowance' | null;

// ===== Core entities (camelCase — this is what every screen/module sees) =====

export interface Account {
  id: string;
  name: string;
  type: string;               // free text, no enum
  icon: string;
  runningBalance: number;     // computed: sum of linked transactions
  sortOrder: number;          // shared ordering pool with revolving-credit debts
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string;
}

export interface Transaction {
  id: string;
  accountId: string;          // FK -> accounts.id, OR a debt's id if paid via revolving credit
  type: TransactionType;
  amount: number;
  date: string;
  categoryId: string | null;
  itemId: string | null;
  paymentMethodNote: string | null;
  counterparty: string | null;      // free text "who", for non-client income
  clientId: string | null;          // set only when transferKind === 'client'
  transferKind: TransferKind;
  feeAmount: number | null;
  linkedTransactionId: string | null; // links the two legs of a transfer
  source: TransactionSource;
  note: string | null;
  isArchived: boolean;
  archivedAt: string | null;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;               // may hold multiple emoji chars, free text
  monthlyBudget: number | null;
  lessSpendGoal: boolean;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string;
}

export interface Item {
  id: string;
  name: string;
  categoryId: string;
  lessSpendGoal: boolean;       // independent of the category's own flag
  emoji: string;
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string;
}

export interface MerchantRule {
  id: string;
  patternText: string;          // normalized: lowercase, punctuation stripped
  categoryId: string;
  matchCount: number;           // >=3 promotes to "learned" / strong match
  lastUsed: string;
}

export interface BalanceCorrection {
  id: string;
  accountId: string;
  expectedBalance: number;      // from transaction log at time of correction
  actualBalance: number;        // user-entered
  diff: number;                 // unbilled spending/income since last correction
  date: string;
}

export interface Debt {
  id: string;
  name: string;
  debtType: DebtType;
  linkedAccountId: string | null;
  counterparty: string | null;        // friend_loan only
  principalDisbursed: number | null;  // term_loan only — the payoff target
  creditLimit: number | null;         // revolving_credit only — reference number, drives no math
  availableBalance: number | null;    // revolving_credit only — THE number that matters, floored at 0
  totalInterestPaid: number | null;   // revolving_credit only — lifetime accumulator, never resets
  totalOwed: number | null;           // friend_loan only — the payoff target
  monthlyAmount: number | null;       // informational only, any type, never drives math
  dueDate: string | null;             // informational only, any type
  sortOrder: number | null;           // revolving_credit only — shares accounts.sortOrder pool
  startDate: string | null;
  endDate: string | null;             // term_loan — expected payoff date
  interestRate: number | null;        // term_loan — annual interest rate %
  interestType: 'fixed' | 'variable' | null; // term_loan — fixe/variable
  status: DebtStatus;
  isArchived: boolean;
  archivedAt: string | null;
}

export interface LoanPayment {
  id: string;
  debtId: string;
  date: string;
  totalAmount: number;
  principalAmount: number;      // see logic contract for how this is derived per debt type
  interestAmount: number;       // term_loan + revolving_credit only; always 0 for friend_loan
  feeAmount: number;            // term_loan only (late fees); always 0 for the other two types
  sourceTransactionRef: string | null; // FK -> transactions.id (the expense row this generated)
}

export interface Client {
  id: string;
  name: string;
  matriculeFiscal: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  logoPath: string | null;      // local file path, not a remote URL
  isArchived: boolean;
  archivedAt: string | null;
  createdAt: string;
}

export interface ScheduledPayment {
  id: string;
  clientId: string;
  totalAmount: number;
  receivedSoFar: number;
  remainingAmount: number;      // computed: totalAmount - receivedSoFar
  dueDate: string | null;
  reminderTime: string;         // default "11:00"
  status: ScheduledPaymentStatus;
  advanceTransactionId: string | null;
  notificationId: string | null; // local scheduled-notification handle
  isArchived: boolean;
  archivedAt: string | null;
}

export interface Settings {
  id: string;                  // single row
  currency: string;             // default "TND"
  darkMode: boolean;            // default true, light mode not implemented
  unloggedSpendingAlertMode: UnloggedAlertMode;
  unloggedSpendingAlertValue: number | null;
}
