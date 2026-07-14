import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight } from 'lucide-react-native';
import type { Account, Transaction } from '../../types';
import { colors, money, typeScale } from '../tokens';

interface TxRowProps {
  tx: Transaction;
  accounts?: Account[];
  showAccount?: boolean;
  /** Resolved display label (item/category name) — screens resolve ids to
   *  names since the Transaction row itself only carries foreign keys. */
  label?: string;
  currency?: string;
  onPress?: () => void;
}

/** One transaction list row: direction arrow, label + subtitle, amount in
 *  green (income), red (expense), or dim gray (transfer — de-emphasized,
 *  not real income/spending). */
export function TxRow({ tx, accounts, showAccount, label, currency = 'TND', onPress }: TxRowProps) {
  const isIncome = tx.type === 'income' || tx.type === 'transfer_in';
  const isTransfer = tx.type === 'transfer_in' || tx.type === 'transfer_out';
  const Icon = isIncome ? ArrowDownLeft : isTransfer ? ArrowLeftRight : ArrowUpRight;
  const accName = accounts?.find(a => a.id === tx.accountId)?.name;
  const subtitle = [showAccount ? accName : null, tx.counterparty]
    .filter(Boolean)
    .join(' · ');
  const display = label || tx.note || tx.counterparty || txTypeLabel(tx);

  return (
    <Pressable onPress={onPress} style={styles.row} disabled={!onPress}>
      <Icon size={16} color={colors.faint} />
      <View style={styles.middle}>
        <Text style={styles.label} numberOfLines={1}>
          {display}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Text
        style={[
          styles.amount,
          isTransfer ? styles.amountTransfer : isIncome ? styles.amountIn : styles.amountOut,
        ]}
      >
        {isIncome ? '+' : isTransfer ? '' : '-'}
        {money(tx.amount)} {currency}
      </Text>
    </Pressable>
  );
}

function txTypeLabel(tx: Transaction): string {
  switch (tx.type) {
    case 'income':
      return 'Income';
    case 'transfer_in':
      return 'Transfer in';
    case 'transfer_out':
      return 'Transfer out';
    default:
      return 'Expense';
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  middle: {
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: typeScale.lg,
    color: colors.text,
  },
  subtitle: {
    fontSize: typeScale.sm,
    color: colors.faint,
  },
  amount: {
    fontSize: typeScale.md,
    fontWeight: '500',
  },
  amountIn: {
    color: colors.green,
  },
  amountOut: {
    color: colors.red,
  },
  amountTransfer: {
    color: colors.dim,
  },
});
