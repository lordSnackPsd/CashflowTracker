// SQLite schema — spec section 3.2, snake_case columns, TEXT uuid PKs.
// Booleans are INTEGER 0/1; money is REAL; dates are ISO-8601 TEXT.

export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT '',
    icon TEXT NOT NULL DEFAULT 'tag',
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    archived_at TEXT,
    created_at TEXT NOT NULL
  )`,
  // running_balance is intentionally NOT a stored column — computed on read.

  `CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    date TEXT NOT NULL,
    category_id TEXT,
    item_id TEXT,
    payment_method_note TEXT,
    counterparty TEXT,
    client_id TEXT,
    transfer_kind TEXT,
    fee_amount REAL,
    linked_transaction_id TEXT,
    source TEXT NOT NULL DEFAULT 'detailed',
    note TEXT,
    is_archived INTEGER NOT NULL DEFAULT 0,
    archived_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date)`,
  `CREATE INDEX IF NOT EXISTS idx_transactions_client ON transactions(client_id)`,

  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    emoji TEXT NOT NULL DEFAULT '',
    monthly_budget REAL,
    less_spend_goal INTEGER NOT NULL DEFAULT 0,
    is_archived INTEGER NOT NULL DEFAULT 0,
    archived_at TEXT,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category_id TEXT NOT NULL,
    less_spend_goal INTEGER NOT NULL DEFAULT 0,
    emoji TEXT NOT NULL DEFAULT '',
    is_archived INTEGER NOT NULL DEFAULT 0,
    archived_at TEXT,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS merchant_rules (
    id TEXT PRIMARY KEY,
    pattern_text TEXT NOT NULL,
    category_id TEXT NOT NULL,
    match_count INTEGER NOT NULL DEFAULT 1,
    last_used TEXT NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_rules_pattern ON merchant_rules(pattern_text)`,

  `CREATE TABLE IF NOT EXISTS balance_corrections (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    expected_balance REAL NOT NULL,
    actual_balance REAL NOT NULL,
    diff REAL NOT NULL,
    date TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_balance_corrections_account ON balance_corrections(account_id)`,

  `CREATE TABLE IF NOT EXISTS debts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    debt_type TEXT NOT NULL,
    linked_account_id TEXT,
    counterparty TEXT,
    principal_disbursed REAL,
    credit_limit REAL,
    available_balance REAL,
    total_interest_paid REAL,
    total_owed REAL,
    monthly_amount REAL,
    due_date TEXT,
    sort_order INTEGER,
    start_date TEXT,
    end_date TEXT,
    interest_rate REAL,
    status TEXT NOT NULL DEFAULT 'active',
    is_archived INTEGER NOT NULL DEFAULT 0,
    archived_at TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS loan_payments (
    id TEXT PRIMARY KEY,
    debt_id TEXT NOT NULL,
    date TEXT NOT NULL,
    total_amount REAL NOT NULL,
    principal_amount REAL NOT NULL,
    interest_amount REAL NOT NULL DEFAULT 0,
    fee_amount REAL NOT NULL DEFAULT 0,
    source_transaction_ref TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_loan_payments_debt ON loan_payments(debt_id)`,

  `CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    matricule_fiscal TEXT,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    logo_path TEXT,
    is_archived INTEGER NOT NULL DEFAULT 0,
    archived_at TEXT,
    created_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS scheduled_payments (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    total_amount REAL NOT NULL,
    received_so_far REAL NOT NULL DEFAULT 0,
    due_date TEXT,
    reminder_time TEXT NOT NULL DEFAULT '11:00',
    status TEXT NOT NULL DEFAULT 'pending',
    advance_transaction_id TEXT,
    notification_id TEXT,
    is_archived INTEGER NOT NULL DEFAULT 0,
    archived_at TEXT
  )`,
  // remaining_amount is intentionally NOT stored — computed on read.

  `CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY,
    currency TEXT NOT NULL DEFAULT 'TND',
    dark_mode INTEGER NOT NULL DEFAULT 1,
    unlogged_spending_alert_mode TEXT,
    unlogged_spending_alert_value REAL
  )`,
];
