import React from 'react';
import { Text } from 'react-native';

interface EmojiProps {
  char?: string | null;
  size?: number;
}

/** Renders one or more emoji characters (categories/items allow multi-emoji
 *  strings like "☕🚬"). */
export function Emoji({ char, size = 20 }: EmojiProps) {
  return <Text style={{ fontSize: size, lineHeight: size + 4 }}>{char || '🏷️'}</Text>;
}
