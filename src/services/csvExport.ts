import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import type { Transaction } from '../types';

export async function exportTransactionsToCSV(
  transactions: Transaction[],
  categories: { id: string; name: string }[],
  items: { id: string; name: string }[],
  accounts: { id: string; name: string }[]
): Promise<void> {
  const header = 'date,type,amount,category,item,account,note\n';
  
  const rows = transactions.map(t => {
    const cat = categories.find(c => c.id === t.categoryId)?.name ?? '';
    const item = items.find(i => i.id === t.itemId)?.name ?? '';
    const acc = accounts.find(a => a.id === t.accountId)?.name ?? '';
    
    // escape values containing commas, quotes, or newlines
    const escape = (str: string | null | undefined) => {
      if (str === null || str === undefined) return '';
      const escaped = str.replace(/"/g, '""');
      return escaped.includes(',') || escaped.includes('\n') || escaped.includes('"') ? `"${escaped}"` : escaped;
    };
    
    return [
      t.date,
      t.type,
      t.amount,
      escape(cat),
      escape(item),
      escape(acc),
      escape(t.note ?? '')
    ].join(',');
  }).join('\n');
  
  const csvContent = header + rows;
  const path = `${RNFS.DocumentDirectoryPath}/transactions_export.csv`;
  
  await RNFS.writeFile(path, csvContent, 'utf8');
  
  await Share.open({
    url: `file://${path}`,
    type: 'text/csv',
    filename: 'transactions_export',
    title: 'Export Transactions CSV',
  });
}
