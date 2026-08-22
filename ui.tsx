import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { colors, fonts, radius, space } from './theme';
import { Icon } from './icons';
import { useLayout } from './design/LayoutContext';
import { mobileScreenPad, mobileStatWidth } from './design/mobile/styles';
import { desktopScreenPad, desktopStatWidth } from './design/desktop/styles';

export function Screen({
  children,
  style,
  scroll = true,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  scroll?: boolean;
}) {
  const { isMobile } = useLayout();
  const pad = isMobile ? mobileScreenPad : desktopScreenPad;

  if (scroll) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[pad, style]}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }
  return <View style={[styles.screen, pad, style]}>{children}</View>;
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.headerRow}>
      <View style={styles.headerText}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headerSub}>{subtitle}</Text> : null}
      </View>
      {action ? <View style={styles.headerAction}>{action}</View> : null}
    </View>
  );
}

export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: React.ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function Card({
  children,
  style,
  onPress,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}) {
  const inner = <View style={styles.cardInner}>{children}</View>;
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.card, style, pressed && { opacity: 0.92 }]}
      >
        {inner}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{inner}</View>;
}

export function ActionTile({
  title,
  hint,
  onPress,
}: {
  title: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && { borderColor: colors.brand }]}
    >
      <Text style={styles.tileTitle}>{title}</Text>
      <Text style={styles.tileHint}>{hint}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'numeric' | 'phone-pad';
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        multiline={multiline}
        style={[styles.input, multiline && styles.inputMulti]}
      />
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        variant === 'primary' && styles.btnPrimary,
        variant === 'secondary' && styles.btnSecondary,
        variant === 'danger' && styles.btnDanger,
        variant === 'ghost' && styles.btnGhost,
        (pressed || disabled) && { opacity: 0.7 },
      ]}
    >
      <Text
        style={[
          styles.btnText,
          variant === 'secondary' && { color: colors.brand },
          variant === 'ghost' && { color: colors.ink },
          variant === 'danger' && { color: '#fff' },
        ]}
        numberOfLines={2}
        // @ts-expect-error web-only
        translate="no"
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function Segmented({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <View style={styles.seg}>
      {options.map((opt) => {
        const on = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            style={[styles.segItem, on && styles.segOn]}
          >
            <Text style={[styles.segText, on && styles.segTextOn]} numberOfLines={1}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.brand} size="large" />
      <Text style={styles.loadingText}>Yükleniyor...</Text>
    </View>
  );
}

export function Chip({
  text,
  tone = 'default',
}: {
  text: string;
  tone?: 'default' | 'ok' | 'bad' | 'gold' | 'blue';
}) {
  return (
    <View
      style={[
        styles.chip,
        tone === 'ok' && { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' },
        tone === 'bad' && { backgroundColor: '#FEE2E2', borderColor: '#FECACA' },
        tone === 'gold' && { backgroundColor: colors.brandMist, borderColor: colors.brandSoft },
        tone === 'blue' && { backgroundColor: '#DBEAFE', borderColor: '#93C5FD' },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          tone === 'ok' && { color: colors.success },
          tone === 'bad' && { color: colors.danger },
          tone === 'gold' && { color: colors.brandDeep },
          tone === 'blue' && { color: '#1D4ED8' },
        ]}
        numberOfLines={1}
      >
        {text}
      </Text>
    </View>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.section}>{children}</Text>;
}

export function StatBox({
  label,
  value,
  tone = 'purple',
  icon = 'stats-chart',
}: {
  label: string;
  value: string | number;
  tone?: 'purple' | 'green' | 'pink' | 'orange' | 'gold';
  icon?: string;
}) {
  const { isMobile } = useLayout();
  const top =
    tone === 'green'
      ? colors.statGreen
      : tone === 'pink'
        ? colors.statPink
        : tone === 'orange'
          ? colors.statOrange
          : tone === 'gold'
            ? colors.statGold
            : colors.brand;

  return (
    <View
      style={[
        styles.stat,
        { borderTopColor: top, width: isMobile ? mobileStatWidth : desktopStatWidth },
      ]}
      // @ts-expect-error web-only
      translate="no"
    >
      <View style={styles.statRow}>
        <View style={[styles.statIconWrap, { backgroundColor: `${top}22` }]}>
          <Icon name={icon} size={isMobile ? 28 : 26} color={top} />
        </View>
        <Text style={styles.statValue}>{value}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 8,
  },
  headerText: { flex: 1, minWidth: 160 },
  headerAction: { flexShrink: 0 },
  headerTitle: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    fontSize: 22,
    color: colors.ink,
  },
  headerSub: {
    fontFamily: fonts.bodySemi,
    fontWeight: '600',
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
    lineHeight: 18,
  },

  title: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    fontSize: 22,
    color: colors.ink,
  },
  subtitle: {
    fontFamily: fonts.bodySemi,
    fontWeight: '600',
    fontSize: 13,
    color: colors.muted,
    marginTop: 2,
    marginBottom: 8,
    lineHeight: 18,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 8,
    shadowColor: '#111827',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardInner: { padding: 10 },

  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 96,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    marginBottom: 8,
    justifyContent: 'space-between',
  },
  tileTitle: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 16,
    color: colors.ink,
  },
  tileHint: {
    fontFamily: fonts.bodySemi,
    fontWeight: '600',
    fontSize: 13,
    color: colors.muted,
    marginTop: 8,
    lineHeight: 18,
  },

  field: { marginBottom: 8 },
  fieldLabel: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 14,
    color: colors.ink,
    marginBottom: 6,
  },
  input: {
    fontFamily: fonts.bodySemi,
    fontWeight: '600',
    fontSize: 16,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },

  btn: {
    minHeight: 46,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  btnPrimary: { backgroundColor: colors.brand },
  btnSecondary: {
    backgroundColor: colors.brandMist,
    borderWidth: 1,
    borderColor: colors.brandSoft,
  },
  btnDanger: { backgroundColor: colors.danger },
  btnGhost: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
  },
  btnText: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    fontSize: 15,
    color: '#FFFFFF',
    textAlign: 'center',
  },

  seg: {
    flexDirection: 'row',
    backgroundColor: colors.panel,
    borderRadius: radius.sm,
    padding: 3,
    gap: 3,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: colors.line,
  },
  segItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm - 2,
    alignItems: 'center',
  },
  segOn: { backgroundColor: colors.brand },
  segText: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 14,
    color: colors.muted,
  },
  segTextOn: {
    color: '#FFFFFF',
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
  },

  empty: {
    padding: 14,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    marginTop: 6,
  },
  emptyText: {
    fontFamily: fonts.bodySemi,
    fontWeight: '600',
    textAlign: 'center',
    color: colors.muted,
    lineHeight: 20,
  },

  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    gap: 12,
  },
  loadingText: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: colors.muted,
  },

  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    maxWidth: '100%',
  },
  chipText: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    fontSize: 13,
    color: colors.ink,
  },

  section: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    fontSize: 15,
    color: colors.ink,
    marginTop: 10,
    marginBottom: 6,
  },

  stat: {
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderTopWidth: 4,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 13,
    color: colors.muted,
    marginTop: 8,
  },
  statValue: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    fontSize: 28,
    color: colors.ink,
    letterSpacing: -0.5,
  },
});
