import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../icons';
import { colors, fonts, radius } from '../theme';
import { NAV_ICONS } from './nav';

export type HomeworkSubParams =
  | { section: 'send' }
  | { section: 'check' }
  | { section: 'hub' };

export const HOMEWORK_SUBMENU: { key: string; label: string; params: HomeworkSubParams }[] = [
  { key: 'send', label: 'Ödev Gönder', params: { section: 'send' } },
  { key: 'check', label: 'Ödev kontrol', params: { section: 'check' } },
];

export function homeworkSubActiveKey(params?: HomeworkSubParams | object | null): string | null {
  if (!params || typeof params !== 'object') return null;
  const p = params as Partial<HomeworkSubParams>;
  if (p.section === 'send') return 'send';
  if (p.section === 'check') return 'check';
  return null;
}

type Props = {
  focused: boolean;
  compact?: boolean;
  activeKey?: string | null;
  onNavigate: (params: HomeworkSubParams) => void;
};

export function HomeworkNavItem({ focused, compact, activeKey, onNavigate }: Props) {
  const [open, setOpen] = useState(focused);

  useEffect(() => {
    if (focused) setOpen(true);
  }, [focused]);

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={[styles.parent, focused && styles.parentOn]}
      >
        <Icon
          name={NAV_ICONS.Homework || 'clipboard'}
          size={compact ? 26 : 22}
          color={focused ? '#FFFFFF' : colors.railMuted}
        />
        <Text style={[styles.parentText, focused && styles.parentTextOn]} numberOfLines={1}>
          Ödevler
        </Text>
        <Text style={[styles.chevron, focused && styles.parentTextOn]}>{open ? '▾' : '▸'}</Text>
      </Pressable>

      {open ? (
        <View style={styles.subList}>
          {HOMEWORK_SUBMENU.map((item) => {
            const on = activeKey === item.key;
            return (
              <Pressable
                key={item.key}
                onPress={() => onNavigate(item.params)}
                style={[styles.subItem, on && styles.subItemOn]}
              >
                <Text style={[styles.subDot, on && styles.subDotOn]}>·</Text>
                <Text style={[styles.subText, on && styles.subTextOn]} numberOfLines={2}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  parent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
  },
  parentOn: { backgroundColor: colors.brand },
  parentText: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 15,
    color: colors.railMuted,
    flex: 1,
  },
  parentTextOn: { color: '#FFFFFF', fontWeight: '800' },
  chevron: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    fontSize: 14,
    color: colors.railMuted,
  },
  subList: {
    marginLeft: 14,
    marginTop: 4,
    marginBottom: 6,
    borderLeftWidth: 2,
    borderLeftColor: '#334155',
    paddingLeft: 8,
    gap: 3,
  },
  subItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
  },
  subItemOn: {
    backgroundColor: '#1E3A5F',
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  subDot: {
    color: colors.brandSoft,
    fontSize: 20,
    fontWeight: '800',
    width: 12,
  },
  subDotOn: { color: '#38BDF8' },
  subText: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 15,
    color: '#E2E8F0',
    lineHeight: 20,
  },
  subTextOn: { color: '#FFFFFF', fontWeight: '800' },
});
