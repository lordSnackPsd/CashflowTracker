import React from 'react';
import {
  Wallet,
  Smartphone,
  Landmark,
  PiggyBank,
  Home,
  CreditCard,
  Tag,
} from 'lucide-react-native';
import { colors } from '../tokens';

const ICONS = {
  cash: Wallet,
  mobile: Smartphone,
  bank: Landmark,
  savings: PiggyBank,
  home: Home,
  card: CreditCard,
  tag: Tag,
} as const;

export type AccountIconName = keyof typeof ICONS;

export const ACCOUNT_ICON_NAMES = Object.keys(ICONS) as AccountIconName[];

interface AccountIconProps {
  name: string; // free text from accounts.icon — falls back to a tag glyph
  size?: number;
  color?: string;
}

/** Maps an account's icon string to a lucide glyph. */
export function AccountIcon({ name, size = 18, color = colors.dim }: AccountIconProps) {
  const Icon = ICONS[name as AccountIconName] ?? Tag;
  return <Icon size={size} color={color} />;
}
