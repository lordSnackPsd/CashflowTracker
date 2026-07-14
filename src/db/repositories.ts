// The only file in the app allowed to write SQL. Implements the frozen
// Repositories interface (team-build-package.md section 2.5). Converts
// snake_case rows to camelCase types on the way out and back on the way in —
// nobody else ever sees a snake_case field.

import type {
  Account,
  BalanceCorrection,
  Category,
  Client,
  Debt,
  Item,
  LoanPayment,
  MerchantRule,
  ScheduledPayment,
  Settings,
  Transaction,
} from '../types';
import { getDb, newId, nowIso } from './client';

type Row = Record<string, unknown>;

const bool = (v: unknown): boolean => v === 1 || v === true;
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const strOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

// ===== row mappers (snake_case -> camelCase) =====

function mapAccount(r: Row, runningBalance = 0): Account {
  return {
    id: String(r.id),
    name: String(r.name),
    type: String(r.type ?? ''),
    icon: String(r.icon ?? 'tag'),
    runningBalance,
    sortOrder: Number(r.sort_order ?? 0),
    isArchived: bool(r.is_archived),
    archivedAt: strOrNull(r.archived_at),
    createdAt: String(r.created_at),
  };
}

function mapTransaction(r: Row): Transaction {
  return {
    id: String(r.id),
    accountId: String(r.account_id),
    type: r.type as Transaction['type'],
    amount: Number(r.amount),
    date: String(r.date),
    categoryId: strOrNull(r.category_id),
    itemId: strOrNull(r.item_id),
    paymentMethodNote: strOrNull(r.payment_method_note),
    counterparty: strOrNull(r.counterparty),
    clientId: strOrNull(r.client_id),
    transferKind: (strOrNull(r.transfer_kind) as Transaction['transferKind']) ?? null,
    feeAmount: numOrNull(r.fee_amount),
    linkedTransactionId: strOrNull(r.linked_transaction_id),
    source: (r.source as Transaction['source']) ?? 'detailed',
    note: strOrNull(r.note),
    isArchived: bool(r.is_archived),
    archivedAt: strOrNull(r.archived_at),
  };
}

function mapCategory(r: Row): Category {
  return {
    id: String(r.id),
    name: String(r.name),
    emoji: String(r.emoji ?? ''),
    monthlyBudget: numOrNull(r.monthly_budget),
    lessSpendGoal: bool(r.less_spend_goal),
    isArchived: bool(r.is_archived),
    archivedAt: strOrNull(r.archived_at),
    createdAt: String(r.created_at),
  };
}

function mapItem(r: Row): Item {
  return {
    id: String(r.id),
    name: String(r.name),
    categoryId: String(r.category_id),
    lessSpendGoal: bool(r.less_spend_goal),
    emoji: String(r.emoji ?? ''),
    isArchived: bool(r.is_archived),
    archivedAt: strOrNull(r.archived_at),
    createdAt: String(r.created_at),
  };
}

function mapMerchantRule(r: Row): MerchantRule {
  return {
    id: String(r.id),
    patternText: String(r.pattern_text),
    categoryId: String(r.category_id),
    matchCount: Number(r.match_count ?? 0),
    lastUsed: String(r.last_used),
  };
}

function mapBalanceCorrection(r: Row): BalanceCorrection {
  return {
    id: String(r.id),
    accountId: String(r.account_id),
    expectedBalance: Number(r.expected_balance),
    actualBalance: Number(r.actual_balance),
    diff: Number(r.diff),
    date: String(r.date),
  };
}

function mapDebt(r: Row): Debt {
  return {
    id: String(r.id),
    name: String(r.name),
    debtType: r.debt_type as Debt['debtType'],
    linkedAccountId: strOrNull(r.linked_account_id),
    counterparty: strOrNull(r.counterparty),
    principalDisbursed: numOrNull(r.principal_disbursed),
    creditLimit: numOrNull(r.credit_limit),
    availableBalance: numOrNull(r.available_balance),
    totalInterestPaid: numOrNull(r.total_interest_paid),
    totalOwed: numOrNull(r.total_owed),
    monthlyAmount: numOrNull(r.monthly_amount),
    dueDate: strOrNull(r.due_date),
    sortOrder: numOrNull(r.sort_order),
    startDate: strOrNull(r.start_date),
    status: r.status as Debt['status'],
    isArchived: bool(r.is_archived),
    archivedAt: strOrNull(r.archived_at),
  };
}

function mapLoanPayment(r: Row): LoanPayment {
  return {
    id: String(r.id),
    debtId: String(r.debt_id),
    date: String(r.date),
    totalAmount: Number(r.total_amount),
    principalAmount: Number(r.principal_amount),
    interestAmount: Number(r.interest_amount ?? 0),
    feeAmount: Number(r.fee_amount ?? 0),
    sourceTransactionRef: strOrNull(r.source_transaction_ref),
  };
}

function mapClient(r: Row): Client {
  return {
    id: String(r.id),
    name: String(r.name),
    matriculeFiscal: strOrNull(r.matricule_fiscal),
    contactName: strOrNull(r.contact_name),
    email: strOrNull(r.email),
    phone: strOrNull(r.phone),
    logoPath: strOrNull(r.logo_path),
    isArchived: bool(r.is_archived),
    archivedAt: strOrNull(r.archived_at),
    createdAt: String(r.created_at),
  };
}

function mapScheduledPayment(r: Row): ScheduledPayment {
  const total = Number(r.total_amount);
  const received = Number(r.received_so_far ?? 0);
  return {
    id: String(r.id),
    clientId: String(r.client_id),
    totalAmount: total,
    receivedSoFar: received,
    remainingAmount: total - received, // computed on read, never stored
    dueDate: strOrNull(r.due_date),
    reminderTime: String(r.reminder_time ?? '11:00'),
    status: r.status as ScheduledPayment['status'],
    advanceTransactionId: strOrNull(r.advance_transaction_id),
    notificationId: strOrNull(r.notification_id),
    isArchived: bool(r.is_archived),
    archivedAt: strOrNull(r.archived_at),
  };
}

function mapSettings(r: Row): Settings {
  return {
    id: String(r.id),
    currency: String(r.currency ?? 'TND'),
    darkMode: bool(r.dark_mode),
    unloggedSpendingAlertMode:
      (strOrNull(r.unlogged_spending_alert_mode) as Settings['unloggedSpendingAlertMode']) ?? null,
    unloggedSpendingAlertValue: numOrNull(r.unlogged_spending_alert_value),
  };
}

// Signed amount: income/transfer_in add, expense/transfer_out subtract.
// Archived ("deleted") transactions never count toward a balance.
const BALANCE_SUM = `COALESCE(SUM(CASE
    WHEN t.type IN ('income','transfer_in') THEN t.amount
    ELSE -t.amount END), 0)`;

async function computeRunningBalance(accountId: string): Promise<number> {
  const res = await getDb().execute(
    `SELECT ${BALANCE_SUM} AS bal FROM transactions t
     WHERE t.account_id = ? AND t.is_archived = 0`,
    [accountId],
  );
  return Number(res.rows[0]?.bal ?? 0);
}

// ===== generic archive helpers =====

async function archiveRow(table: string, id: string): Promise<void> {
  await getDb().execute(
    `UPDATE ${table} SET is_archived = 1, archived_at = ? WHERE id = ?`,
    [nowIso(), id],
  );
}

async function restoreRow(table: string, id: string): Promise<void> {
  await getDb().execute(
    `UPDATE ${table} SET is_archived = 0, archived_at = NULL WHERE id = ?`,
    [id],
  );
}

// ===== interfaces (frozen contract) =====

export interface AccountsRepo {
  list(includeArchived?: boolean): Promise<Account[]>;
  get(id: string): Promise<Account | null>;
  create(input: Omit<Account, 'id' | 'runningBalance' | 'isArchived' | 'archivedAt' | 'createdAt'>): Promise<Account>;
  update(id: string, patch: Partial<Account>): Promise<Account>;
  archive(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  permanentDelete(id: string): Promise<{ blocked: boolean }>;
  reorder(orderedIds: string[]): Promise<void>;
}

export interface TransactionsRepo {
  list(filters?: {
    accountId?: string;
    categoryId?: string;
    dateFrom?: string;
    dateTo?: string;
    includeArchived?: boolean;
  }): Promise<Transaction[]>;
  get(id: string): Promise<Transaction | null>;
  create(input: Omit<Transaction, 'id' | 'isArchived' | 'archivedAt'>): Promise<Transaction>;
  createTransferPair(
    outbound: Omit<Transaction, 'id' | 'isArchived' | 'archivedAt' | 'linkedTransactionId'>,
    inbound: Omit<Transaction, 'id' | 'isArchived' | 'archivedAt' | 'linkedTransactionId'>,
  ): Promise<[Transaction, Transaction]>;
  update(id: string, patch: Partial<Transaction>): Promise<Transaction>;
  archive(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  permanentDelete(id: string): Promise<void>;
}

export interface CategoriesRepo {
  list(includeArchived?: boolean): Promise<Category[]>;
  get(id: string): Promise<Category | null>;
  create(input: Omit<Category, 'id' | 'isArchived' | 'archivedAt' | 'createdAt'>): Promise<Category>;
  update(id: string, patch: Partial<Category>): Promise<Category>;
  archive(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  permanentDelete(id: string): Promise<void>;
}

export interface ItemsRepo {
  list(includeArchived?: boolean): Promise<Item[]>;
  get(id: string): Promise<Item | null>;
  create(input: Omit<Item, 'id' | 'isArchived' | 'archivedAt' | 'createdAt'>): Promise<Item>;
  update(id: string, patch: Partial<Item>): Promise<Item>;
  archive(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  permanentDelete(id: string): Promise<void>;
}

export interface ClientsRepo {
  list(includeArchived?: boolean): Promise<Client[]>;
  get(id: string): Promise<Client | null>;
  create(input: Omit<Client, 'id' | 'isArchived' | 'archivedAt' | 'createdAt'>): Promise<Client>;
  update(id: string, patch: Partial<Client>): Promise<Client>;
  archive(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  permanentDelete(id: string): Promise<void>;
}

export interface ScheduledPaymentsRepo {
  list(includeArchived?: boolean): Promise<ScheduledPayment[]>;
  get(id: string): Promise<ScheduledPayment | null>;
  create(
    input: Omit<ScheduledPayment, 'id' | 'remainingAmount' | 'isArchived' | 'archivedAt'>,
  ): Promise<ScheduledPayment>;
  update(id: string, patch: Partial<ScheduledPayment>): Promise<ScheduledPayment>;
  archive(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  permanentDelete(id: string): Promise<void>;
  logPayment(id: string, amountReceived: number, accountId: string): Promise<ScheduledPayment>;
}

export interface DebtsRepo {
  list(includeArchived?: boolean): Promise<Debt[]>;
  get(id: string): Promise<Debt | null>;
  create(input: Omit<Debt, 'id' | 'isArchived' | 'archivedAt'>): Promise<Debt>;
  update(id: string, patch: Partial<Debt>): Promise<Debt>;
  archive(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  permanentDelete(id: string): Promise<void>;
  reorderRevolvingCredit(orderedIds: string[]): Promise<void>;
}

export interface LoanPaymentsRepo {
  listForDebt(debtId: string): Promise<LoanPayment[]>;
  create(input: Omit<LoanPayment, 'id'>): Promise<LoanPayment>;
}

export interface MerchantRulesRepo {
  findTextMatch(normalizedText: string): Promise<MerchantRule | null>;
  upsertOnConfirm(normalizedText: string, categoryId: string): Promise<MerchantRule>;
}

export interface BalanceCorrectionsRepo {
  listForAccount(accountId: string): Promise<BalanceCorrection[]>;
  create(input: Omit<BalanceCorrection, 'id'>): Promise<BalanceCorrection>;
}

export interface SettingsRepo {
  get(): Promise<Settings>;
  update(patch: Partial<Settings>): Promise<Settings>;
}

export interface Repositories {
  accounts: AccountsRepo;
  transactions: TransactionsRepo;
  categories: CategoriesRepo;
  items: ItemsRepo;
  debts: DebtsRepo;
  loanPayments: LoanPaymentsRepo;
  clients: ClientsRepo;
  scheduledPayments: ScheduledPaymentsRepo;
  merchantRules: MerchantRulesRepo;
  balanceCorrections: BalanceCorrectionsRepo;
  settings: SettingsRepo;
}

// ===== implementations =====

const accounts: AccountsRepo = {
  async list(includeArchived = false) {
    const res = await getDb().execute(
      `SELECT a.*, ${BALANCE_SUM} AS bal
       FROM accounts a
       LEFT JOIN transactions t ON t.account_id = a.id AND t.is_archived = 0
       ${includeArchived ? '' : 'WHERE a.is_archived = 0'}
       GROUP BY a.id
       ORDER BY a.sort_order ASC, a.created_at ASC`,
    );
    return res.rows.map(r => mapAccount(r, Number(r.bal ?? 0)));
  },

  async get(id) {
    const res = await getDb().execute('SELECT * FROM accounts WHERE id = ?', [id]);
    if (res.rows.length === 0) return null;
    return mapAccount(res.rows[0], await computeRunningBalance(id));
  },

  async create(input) {
    const id = newId();
    await getDb().execute(
      `INSERT INTO accounts (id, name, type, icon, sort_order, is_archived, archived_at, created_at)
       VALUES (?, ?, ?, ?, ?, 0, NULL, ?)`,
      [id, input.name, input.type, input.icon, input.sortOrder, nowIso()],
    );
    return (await accounts.get(id))!;
  },

  async update(id, patch) {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (patch.name !== undefined) { sets.push('name = ?'); params.push(patch.name); }
    if (patch.type !== undefined) { sets.push('type = ?'); params.push(patch.type); }
    if (patch.icon !== undefined) { sets.push('icon = ?'); params.push(patch.icon); }
    if (patch.sortOrder !== undefined) { sets.push('sort_order = ?'); params.push(patch.sortOrder); }
    if (sets.length > 0) {
      params.push(id);
      await getDb().execute(`UPDATE accounts SET ${sets.join(', ')} WHERE id = ?`, params as never);
    }
    return (await accounts.get(id))!;
  },

  archive: id => archiveRow('accounts', id),
  restore: id => restoreRow('accounts', id),

  async permanentDelete(id) {
    const res = await getDb().execute(
      'SELECT COUNT(*) AS n FROM transactions WHERE account_id = ?',
      [id],
    );
    if (Number(res.rows[0]?.n ?? 0) > 0) {
      return { blocked: true };
    }
    await getDb().execute('DELETE FROM balance_corrections WHERE account_id = ?', [id]);
    await getDb().execute('DELETE FROM accounts WHERE id = ?', [id]);
    return { blocked: false };
  },

  async reorder(orderedIds) {
    const db = getDb();
    for (let i = 0; i < orderedIds.length; i++) {
      // shared sortOrder pool with revolving-credit debts: the position index
      // is written to whichever table the id belongs to.
      await db.execute('UPDATE accounts SET sort_order = ? WHERE id = ?', [i, orderedIds[i]]);
      await db.execute('UPDATE debts SET sort_order = ? WHERE id = ?', [i, orderedIds[i]]);
    }
  },
};

const TX_COLUMNS = `id, account_id, type, amount, date, category_id, item_id,
  payment_method_note, counterparty, client_id, transfer_kind, fee_amount,
  linked_transaction_id, source, note, is_archived, archived_at`;

function txInsertParams(id: string, t: Omit<Transaction, 'id' | 'isArchived' | 'archivedAt'>, linkedId: string | null) {
  return [
    id, t.accountId, t.type, t.amount, t.date, t.categoryId, t.itemId,
    t.paymentMethodNote, t.counterparty, t.clientId, t.transferKind, t.feeAmount,
    linkedId, t.source, t.note,
  ];
}

const TX_INSERT = `INSERT INTO transactions (${TX_COLUMNS})
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`;

const transactions: TransactionsRepo = {
  async list(filters = {}) {
    const where: string[] = [];
    const params: unknown[] = [];
    if (!filters.includeArchived) where.push('is_archived = 0');
    if (filters.accountId) { where.push('account_id = ?'); params.push(filters.accountId); }
    if (filters.categoryId) { where.push('category_id = ?'); params.push(filters.categoryId); }
    if (filters.dateFrom) { where.push('date >= ?'); params.push(filters.dateFrom); }
    if (filters.dateTo) { where.push('date <= ?'); params.push(filters.dateTo); }
    const res = await getDb().execute(
      `SELECT * FROM transactions
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       ORDER BY date DESC, rowid DESC`,
      params as never,
    );
    return res.rows.map(mapTransaction);
  },

  async get(id) {
    const res = await getDb().execute('SELECT * FROM transactions WHERE id = ?', [id]);
    return res.rows.length ? mapTransaction(res.rows[0]) : null;
  },

  async create(input) {
    const id = newId();
    await getDb().execute(TX_INSERT, txInsertParams(id, input, input.linkedTransactionId) as never);
    return (await transactions.get(id))!;
  },

  async createTransferPair(outbound, inbound) {
    const outId = newId();
    const inId = newId();
    const db = getDb();
    await db.transaction(async tx => {
      await tx.execute(TX_INSERT, txInsertParams(outId, { ...outbound, linkedTransactionId: null }, inId) as never);
      await tx.execute(TX_INSERT, txInsertParams(inId, { ...inbound, linkedTransactionId: null }, outId) as never);
    });
    const out = (await transactions.get(outId))!;
    const inn = (await transactions.get(inId))!;
    return [out, inn];
  },

  async update(id, patch) {
    const colMap: Record<string, string> = {
      accountId: 'account_id', type: 'type', amount: 'amount', date: 'date',
      categoryId: 'category_id', itemId: 'item_id', paymentMethodNote: 'payment_method_note',
      counterparty: 'counterparty', clientId: 'client_id', transferKind: 'transfer_kind',
      feeAmount: 'fee_amount', linkedTransactionId: 'linked_transaction_id',
      source: 'source', note: 'note',
    };
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [key, col] of Object.entries(colMap)) {
      const v = (patch as Record<string, unknown>)[key];
      if (v !== undefined) { sets.push(`${col} = ?`); params.push(v); }
    }
    if (sets.length > 0) {
      params.push(id);
      await getDb().execute(`UPDATE transactions SET ${sets.join(', ')} WHERE id = ?`, params as never);
    }
    return (await transactions.get(id))!;
  },

  archive: id => archiveRow('transactions', id),
  restore: id => restoreRow('transactions', id),

  async permanentDelete(id) {
    await getDb().execute('DELETE FROM transactions WHERE id = ?', [id]);
  },
};

const categories: CategoriesRepo = {
  async list(includeArchived = false) {
    const res = await getDb().execute(
      `SELECT * FROM categories ${includeArchived ? '' : 'WHERE is_archived = 0'} ORDER BY name ASC`,
    );
    return res.rows.map(mapCategory);
  },

  async get(id) {
    const res = await getDb().execute('SELECT * FROM categories WHERE id = ?', [id]);
    return res.rows.length ? mapCategory(res.rows[0]) : null;
  },

  async create(input) {
    const id = newId();
    await getDb().execute(
      `INSERT INTO categories (id, name, emoji, monthly_budget, less_spend_goal, is_archived, archived_at, created_at)
       VALUES (?, ?, ?, ?, ?, 0, NULL, ?)`,
      [id, input.name, input.emoji, input.monthlyBudget, input.lessSpendGoal ? 1 : 0, nowIso()],
    );
    return (await categories.get(id))!;
  },

  async update(id, patch) {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (patch.name !== undefined) { sets.push('name = ?'); params.push(patch.name); }
    if (patch.emoji !== undefined) { sets.push('emoji = ?'); params.push(patch.emoji); }
    if (patch.monthlyBudget !== undefined) { sets.push('monthly_budget = ?'); params.push(patch.monthlyBudget); }
    if (patch.lessSpendGoal !== undefined) { sets.push('less_spend_goal = ?'); params.push(patch.lessSpendGoal ? 1 : 0); }
    if (sets.length > 0) {
      params.push(id);
      await getDb().execute(`UPDATE categories SET ${sets.join(', ')} WHERE id = ?`, params as never);
    }
    return (await categories.get(id))!;
  },

  archive: id => archiveRow('categories', id),
  restore: id => restoreRow('categories', id),

  async permanentDelete(id) {
    await getDb().execute('DELETE FROM categories WHERE id = ?', [id]);
  },
};

const items: ItemsRepo = {
  async list(includeArchived = false) {
    const res = await getDb().execute(
      `SELECT * FROM items ${includeArchived ? '' : 'WHERE is_archived = 0'} ORDER BY name ASC`,
    );
    return res.rows.map(mapItem);
  },

  async get(id) {
    const res = await getDb().execute('SELECT * FROM items WHERE id = ?', [id]);
    return res.rows.length ? mapItem(res.rows[0]) : null;
  },

  async create(input) {
    const id = newId();
    await getDb().execute(
      `INSERT INTO items (id, name, category_id, less_spend_goal, emoji, is_archived, archived_at, created_at)
       VALUES (?, ?, ?, ?, ?, 0, NULL, ?)`,
      [id, input.name, input.categoryId, input.lessSpendGoal ? 1 : 0, input.emoji, nowIso()],
    );
    return (await items.get(id))!;
  },

  async update(id, patch) {
    const sets: string[] = [];
    const params: unknown[] = [];
    if (patch.name !== undefined) { sets.push('name = ?'); params.push(patch.name); }
    if (patch.categoryId !== undefined) { sets.push('category_id = ?'); params.push(patch.categoryId); }
    if (patch.lessSpendGoal !== undefined) { sets.push('less_spend_goal = ?'); params.push(patch.lessSpendGoal ? 1 : 0); }
    if (patch.emoji !== undefined) { sets.push('emoji = ?'); params.push(patch.emoji); }
    if (sets.length > 0) {
      params.push(id);
      await getDb().execute(`UPDATE items SET ${sets.join(', ')} WHERE id = ?`, params as never);
    }
    return (await items.get(id))!;
  },

  archive: id => archiveRow('items', id),
  restore: id => restoreRow('items', id),

  async permanentDelete(id) {
    await getDb().execute('DELETE FROM items WHERE id = ?', [id]);
  },
};

const clients: ClientsRepo = {
  async list(includeArchived = false) {
    const res = await getDb().execute(
      `SELECT * FROM clients ${includeArchived ? '' : 'WHERE is_archived = 0'} ORDER BY name ASC`,
    );
    return res.rows.map(mapClient);
  },

  async get(id) {
    const res = await getDb().execute('SELECT * FROM clients WHERE id = ?', [id]);
    return res.rows.length ? mapClient(res.rows[0]) : null;
  },

  async create(input) {
    const id = newId();
    await getDb().execute(
      `INSERT INTO clients (id, name, matricule_fiscal, contact_name, email, phone, logo_path, is_archived, archived_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?)`,
      [id, input.name, input.matriculeFiscal, input.contactName, input.email, input.phone, input.logoPath, nowIso()],
    );
    return (await clients.get(id))!;
  },

  async update(id, patch) {
    const colMap: Record<string, string> = {
      name: 'name', matriculeFiscal: 'matricule_fiscal', contactName: 'contact_name',
      email: 'email', phone: 'phone', logoPath: 'logo_path',
    };
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [key, col] of Object.entries(colMap)) {
      const v = (patch as Record<string, unknown>)[key];
      if (v !== undefined) { sets.push(`${col} = ?`); params.push(v); }
    }
    if (sets.length > 0) {
      params.push(id);
      await getDb().execute(`UPDATE clients SET ${sets.join(', ')} WHERE id = ?`, params as never);
    }
    return (await clients.get(id))!;
  },

  archive: id => archiveRow('clients', id),
  restore: id => restoreRow('clients', id),

  async permanentDelete(id) {
    await getDb().execute('DELETE FROM clients WHERE id = ?', [id]);
  },
};

const scheduledPayments: ScheduledPaymentsRepo = {
  async list(includeArchived = false) {
    const res = await getDb().execute(
      `SELECT * FROM scheduled_payments ${includeArchived ? '' : 'WHERE is_archived = 0'}
       ORDER BY due_date IS NULL, due_date ASC`,
    );
    return res.rows.map(mapScheduledPayment);
  },

  async get(id) {
    const res = await getDb().execute('SELECT * FROM scheduled_payments WHERE id = ?', [id]);
    return res.rows.length ? mapScheduledPayment(res.rows[0]) : null;
  },

  async create(input) {
    const id = newId();
    await getDb().execute(
      `INSERT INTO scheduled_payments (id, client_id, total_amount, received_so_far, due_date, reminder_time, status, advance_transaction_id, notification_id, is_archived, archived_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
      [id, input.clientId, input.totalAmount, input.receivedSoFar, input.dueDate,
       input.reminderTime, input.status, input.advanceTransactionId, input.notificationId],
    );
    return (await scheduledPayments.get(id))!;
  },

  async update(id, patch) {
    const colMap: Record<string, string> = {
      clientId: 'client_id', totalAmount: 'total_amount', receivedSoFar: 'received_so_far',
      dueDate: 'due_date', reminderTime: 'reminder_time', status: 'status',
      advanceTransactionId: 'advance_transaction_id', notificationId: 'notification_id',
    };
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [key, col] of Object.entries(colMap)) {
      const v = (patch as Record<string, unknown>)[key];
      if (v !== undefined) { sets.push(`${col} = ?`); params.push(v); }
    }
    if (sets.length > 0) {
      params.push(id);
      await getDb().execute(`UPDATE scheduled_payments SET ${sets.join(', ')} WHERE id = ?`, params as never);
    }
    return (await scheduledPayments.get(id))!;
  },

  archive: id => archiveRow('scheduled_payments', id),
  restore: id => restoreRow('scheduled_payments', id),

  async permanentDelete(id) {
    await getDb().execute('DELETE FROM scheduled_payments WHERE id = ?', [id]);
  },

  async logPayment(id, amountReceived, accountId) {
    const sp = await scheduledPayments.get(id);
    if (!sp) throw new Error(`Scheduled payment ${id} not found`);
    // the received money is a normal client-tagged income transaction
    await transactions.create({
      accountId,
      type: 'income',
      amount: amountReceived,
      date: new Date().toISOString().slice(0, 10),
      categoryId: null,
      itemId: null,
      paymentMethodNote: null,
      counterparty: null,
      clientId: sp.clientId,
      transferKind: 'client',
      feeAmount: null,
      linkedTransactionId: null,
      source: 'detailed',
      note: null,
    });
    const received = sp.receivedSoFar + amountReceived;
    const status = received >= sp.totalAmount ? 'completed' : 'partially_paid';
    return scheduledPayments.update(id, { receivedSoFar: received, status });
  },
};

const debts: DebtsRepo = {
  async list(includeArchived = false) {
    const res = await getDb().execute(
      `SELECT * FROM debts ${includeArchived ? '' : 'WHERE is_archived = 0'}
       ORDER BY status ASC, name ASC`,
    );
    return res.rows.map(mapDebt);
  },

  async get(id) {
    const res = await getDb().execute('SELECT * FROM debts WHERE id = ?', [id]);
    return res.rows.length ? mapDebt(res.rows[0]) : null;
  },

  async create(input) {
    const id = newId();
    await getDb().execute(
      `INSERT INTO debts (id, name, debt_type, linked_account_id, counterparty, principal_disbursed,
        credit_limit, available_balance, total_interest_paid, total_owed, monthly_amount, due_date,
        sort_order, start_date, status, is_archived, archived_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`,
      [id, input.name, input.debtType, input.linkedAccountId, input.counterparty,
       input.principalDisbursed, input.creditLimit, input.availableBalance,
       input.totalInterestPaid, input.totalOwed, input.monthlyAmount, input.dueDate,
       input.sortOrder, input.startDate, input.status],
    );
    return (await debts.get(id))!;
  },

  async update(id, patch) {
    const colMap: Record<string, string> = {
      name: 'name', debtType: 'debt_type', linkedAccountId: 'linked_account_id',
      counterparty: 'counterparty', principalDisbursed: 'principal_disbursed',
      creditLimit: 'credit_limit', availableBalance: 'available_balance',
      totalInterestPaid: 'total_interest_paid', totalOwed: 'total_owed',
      monthlyAmount: 'monthly_amount', dueDate: 'due_date', sortOrder: 'sort_order',
      startDate: 'start_date', status: 'status',
    };
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [key, col] of Object.entries(colMap)) {
      const v = (patch as Record<string, unknown>)[key];
      if (v !== undefined) { sets.push(`${col} = ?`); params.push(v); }
    }
    if (sets.length > 0) {
      params.push(id);
      await getDb().execute(`UPDATE debts SET ${sets.join(', ')} WHERE id = ?`, params as never);
    }
    return (await debts.get(id))!;
  },

  archive: id => archiveRow('debts', id),
  restore: id => restoreRow('debts', id),

  async permanentDelete(id) {
    // loan_payments travel with their parent debt
    await getDb().execute('DELETE FROM loan_payments WHERE debt_id = ?', [id]);
    await getDb().execute('DELETE FROM debts WHERE id = ?', [id]);
  },

  reorderRevolvingCredit: orderedIds => accounts.reorder(orderedIds),
};

const loanPayments: LoanPaymentsRepo = {
  async listForDebt(debtId) {
    const res = await getDb().execute(
      'SELECT * FROM loan_payments WHERE debt_id = ? ORDER BY date DESC, rowid DESC',
      [debtId],
    );
    return res.rows.map(mapLoanPayment);
  },

  async create(input) {
    const id = newId();
    await getDb().execute(
      `INSERT INTO loan_payments (id, debt_id, date, total_amount, principal_amount, interest_amount, fee_amount, source_transaction_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, input.debtId, input.date, input.totalAmount, input.principalAmount,
       input.interestAmount, input.feeAmount, input.sourceTransactionRef],
    );
    const res = await getDb().execute('SELECT * FROM loan_payments WHERE id = ?', [id]);
    return mapLoanPayment(res.rows[0]);
  },
};

const merchantRules: MerchantRulesRepo = {
  async findTextMatch(normalizedText) {
    const res = await getDb().execute(
      'SELECT * FROM merchant_rules WHERE pattern_text = ?',
      [normalizedText],
    );
    return res.rows.length ? mapMerchantRule(res.rows[0]) : null;
  },

  async upsertOnConfirm(normalizedText, categoryId) {
    const db = getDb();
    const existing = await merchantRules.findTextMatch(normalizedText);
    if (existing) {
      await db.execute(
        'UPDATE merchant_rules SET match_count = match_count + 1, category_id = ?, last_used = ? WHERE id = ?',
        [categoryId, nowIso(), existing.id],
      );
      const res = await db.execute('SELECT * FROM merchant_rules WHERE id = ?', [existing.id]);
      return mapMerchantRule(res.rows[0]);
    }
    const id = newId();
    await db.execute(
      `INSERT INTO merchant_rules (id, pattern_text, category_id, match_count, last_used)
       VALUES (?, ?, ?, 1, ?)`,
      [id, normalizedText, categoryId, nowIso()],
    );
    const res = await db.execute('SELECT * FROM merchant_rules WHERE id = ?', [id]);
    return mapMerchantRule(res.rows[0]);
  },
};

const balanceCorrections: BalanceCorrectionsRepo = {
  async listForAccount(accountId) {
    const res = await getDb().execute(
      'SELECT * FROM balance_corrections WHERE account_id = ? ORDER BY date DESC, rowid DESC',
      [accountId],
    );
    return res.rows.map(mapBalanceCorrection);
  },

  async create(input) {
    const id = newId();
    await getDb().execute(
      `INSERT INTO balance_corrections (id, account_id, expected_balance, actual_balance, diff, date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.accountId, input.expectedBalance, input.actualBalance, input.diff, input.date],
    );
    const res = await getDb().execute('SELECT * FROM balance_corrections WHERE id = ?', [id]);
    return mapBalanceCorrection(res.rows[0]);
  },
};

const settings: SettingsRepo = {
  async get() {
    const res = await getDb().execute('SELECT * FROM settings LIMIT 1');
    return mapSettings(res.rows[0]);
  },

  async update(patch) {
    const current = await settings.get();
    const sets: string[] = [];
    const params: unknown[] = [];
    if (patch.currency !== undefined) { sets.push('currency = ?'); params.push(patch.currency); }
    if (patch.darkMode !== undefined) { sets.push('dark_mode = ?'); params.push(patch.darkMode ? 1 : 0); }
    if (patch.unloggedSpendingAlertMode !== undefined) {
      sets.push('unlogged_spending_alert_mode = ?');
      params.push(patch.unloggedSpendingAlertMode);
    }
    if (patch.unloggedSpendingAlertValue !== undefined) {
      sets.push('unlogged_spending_alert_value = ?');
      params.push(patch.unloggedSpendingAlertValue);
    }
    if (sets.length > 0) {
      params.push(current.id);
      await getDb().execute(`UPDATE settings SET ${sets.join(', ')} WHERE id = ?`, params as never);
    }
    return settings.get();
  },
};

export const repos: Repositories = {
  accounts,
  transactions,
  categories,
  items,
  debts,
  loanPayments,
  clients,
  scheduledPayments,
  merchantRules,
  balanceCorrections,
  settings,
};
