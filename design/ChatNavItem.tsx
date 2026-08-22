import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../AuthContext';
import { Icon } from '../icons';
import { colors, fonts, radius } from '../theme';
import { isLiseGrade, isOrtaokulGrade, ClassGrade } from '../types';
import { NAV_ICONS } from './nav';

export type ChatCategory = 'mezun' | 'lise' | 'ortaokul';

export type ChatSubParams =
  | { section: 'list'; category: ChatCategory }
  | { section: 'hub' };

export const CHAT_SUBMENU: { key: ChatCategory; label: string; params: ChatSubParams }[] = [
  { key: 'mezun', label: 'Mezun Sohbet', params: { section: 'list', category: 'mezun' } },
  { key: 'lise', label: 'Lise Sohbet', params: { section: 'list', category: 'lise' } },
  { key: 'ortaokul', label: 'Ortaokul Sohbet', params: { section: 'list', category: 'ortaokul' } },
];

export function chatSubActiveKey(params?: ChatSubParams | object | null): string | null {
  if (!params || typeof params !== 'object') return null;
  const p = params as Partial<ChatSubParams>;
  if (p.section === 'list' && p.category) return p.category;
  return null;
}

export function classInChatCategory(
  grade: ClassGrade | undefined | null,
  category: ChatCategory
): boolean {
  if (grade == null) return false;
  if (category === 'mezun') return grade === 'mezun';
  if (category === 'lise') return isLiseGrade(grade);
  return isOrtaokulGrade(grade);
}

type Props = {
  focused: boolean;
  compact?: boolean;
  activeKey?: string | null;
  onNavigate: (params: ChatSubParams) => void;
};

/** Kenar menüde Sınıf Sohbeti + Mezun / Lise / Ortaokul */
export function ChatNavItem({ focused, compact, activeKey, onNavigate }: Props) {
  const { user, classes, myClasses, isManager } = useAuth();
  const [open, setOpen] = useState(focused);

  useEffect(() => {
    if (focused) setOpen(true);
  }, [focused]);

  const available = useMemo(() => {
    if (user?.role !== 'teacher') return [];
    return isManager ? classes : myClasses;
  }, [user?.role, isManager, classes, myClasses]);

  const visibleMenu = useMemo(() => {
    return CHAT_SUBMENU.filter((item) =>
      available.some((c) => classInChatCategory(c.grade, item.key))
    );
  }, [available]);

  const menu = visibleMenu.length > 0 ? visibleMenu : CHAT_SUBMENU;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={[styles.parent, focused && styles.parentOn]}
      >
        <Icon
          name={NAV_ICONS.Chat}
          size={compact ? 26 : 22}
          color={focused ? '#FFFFFF' : colors.railMuted}
        />
        <Text style={[styles.parentText, focused && styles.parentTextOn]} numberOfLines={1}>
          Sınıf Sohbeti
        </Text>
        <Text style={[styles.chevron, focused && styles.parentTextOn]}>{open ? '▾' : '▸'}</Text>
      </Pressable>

      {open ? (
        <View style={styles.subList}>
          {menu.map((item) => {
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
  parentTextOn: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
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
  subTextOn: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
