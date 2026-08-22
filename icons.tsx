import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, fonts } from './theme';

/** Metro’da @expo/vector-icons bozulduğu için yerel büyük simgeler */
const MAP: Record<string, string> = {
  menu: '☰',
  close: '✕',
  home: '⌂',
  business: '🏢',
  school: '🎓',
  people: '👥',
  person: '👤',
  'person-circle': '👤',
  chatbubbles: '💬',
  'document-text': '📄',
  clipboard: '📋',
  calendar: '📅',
  settings: '⚙',
  star: '★',
  notifications: '🔔',
  'alert-circle': '⚠',
  'chevron-forward': '›',
  'log-out-outline': '⎋',
  ellipse: '●',
  'stats-chart': '▮',
};

export function Icon({
  name,
  size = 28,
  color = colors.ink,
  style,
}: {
  name: string;
  size?: number;
  color?: string;
  style?: ViewStyle;
}) {
  const glyph = MAP[name] || '●';
  return (
    <View style={[styles.wrap, { width: size + 4, height: size + 4 }, style]}>
      <Text style={{ fontSize: size * 0.85, color, fontFamily: fonts.bodyBold, lineHeight: size + 2 }}>
        {glyph}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
