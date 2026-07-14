import { open, type DB } from '@op-engineering/op-sqlite';
import uuid from 'react-native-uuid';
import { SCHEMA_STATEMENTS } from './schema';

let db: DB | null = null;

export function getDb(): DB {
  if (!db) {
    db = open({ name: 'cashflow.sqlite' });
  }
  return db;
}

export function newId(): string {
  return uuid.v4() as string;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Runs schema creation (idempotent) and seeds the single settings row. */
export async function initDb(): Promise<void> {
  const database = getDb();
  for (const stmt of SCHEMA_STATEMENTS) {
    await database.execute(stmt);
  }
  const existing = await database.execute('SELECT id FROM settings LIMIT 1');
  if (existing.rows.length === 0) {
    await database.execute(
      `INSERT INTO settings (id, currency, dark_mode, unlogged_spending_alert_mode, unlogged_spending_alert_value)
       VALUES (?, 'TND', 1, NULL, NULL)`,
      [newId()],
    );
  }

  // Migrations — ALTER TABLE is idempotent via try/catch (SQLite throws on duplicate column)
  const migrations = [
    `ALTER TABLE debts ADD COLUMN end_date TEXT`,
    `ALTER TABLE debts ADD COLUMN interest_rate REAL`,
    `ALTER TABLE debts ADD COLUMN interest_type TEXT`,
  ];
  for (const m of migrations) {
    try { await database.execute(m); } catch (_) { /* column already exists */ }
  }
}

/** Test/backup hook — closes the connection so the file can be replaced. */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
