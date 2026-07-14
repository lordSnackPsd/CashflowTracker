import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { getDb } from '../db/client';

const TABLES = [
  'settings',
  'accounts',
  'categories',
  'items',
  'debts',
  'transactions',
  'merchant_rules',
  'balance_corrections',
  'loan_payments',
  'clients',
  'scheduled_payments',
];

export async function exportBackup(): Promise<void> {
  const db = getDb();
  const backupData: Record<string, any[]> = {};

  for (const table of TABLES) {
    const res = await db.execute(`SELECT * FROM ${table}`);
    const rows = [];
    if (res.rows) {
      for (let i = 0; i < res.rows.length; i++) {
        rows.push(res.rows[i]);
      }
    }
    backupData[table] = rows;
  }

  const jsonStr = JSON.stringify(backupData, null, 2);
  const path = `${RNFS.DocumentDirectoryPath}/cashflow_backup.json`;
  
  await RNFS.writeFile(path, jsonStr, 'utf8');

  await Share.open({
    url: `file://${path}`,
    type: 'application/json',
    filename: 'cashflow_backup',
    title: 'Export Cashflow Database Backup',
  });
}

export async function importBackup(filePath: string): Promise<void> {
  const db = getDb();
  const jsonStr = await RNFS.readFile(filePath, 'utf8');
  const backupData = JSON.parse(jsonStr) as Record<string, any[]>;

  // Verify format basic checks
  for (const table of TABLES) {
    if (!Array.isArray(backupData[table])) {
      throw new Error(`Invalid backup file: missing table ${table}`);
    }
  }

  // Clear tables and insert data inside a manual transaction/batch
  // Since op-sqlite has execute, we can execute each statement or run inside transaction
  await db.execute('BEGIN TRANSACTION');
  try {
    for (const table of TABLES) {
      await db.execute(`DELETE FROM ${table}`);
      const rows = backupData[table];
      if (rows.length === 0) continue;

      // Build parameterized insert query
      const columns = Object.keys(rows[0]);
      const colStr = columns.join(', ');
      const placeholders = columns.map(() => '?').join(', ');
      const sql = `INSERT INTO ${table} (${colStr}) VALUES (${placeholders})`;

      for (const row of rows) {
        const values = columns.map(col => row[col]);
        await db.execute(sql, values);
      }
    }
    await db.execute('COMMIT');
  } catch (err) {
    await db.execute('ROLLBACK');
    throw err;
  }
}
