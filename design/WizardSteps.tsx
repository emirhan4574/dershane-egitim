import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, space } from '../theme';

export function WizardSteps({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <View style={styles.wrap}>
      {steps.map((label, i) => {
        const on = i === current;
        const done = i < current;
        return (
          <View key={label} style={styles.item}>
            <View style={[styles.dot, (on || done) && styles.dotOn]}>
              <Text style={[styles.dotText, (on || done) && styles.dotTextOn]}>
                {done ? '✓' : i + 1}
              </Text>
            </View>
            <Text style={[styles.label, on && styles.labelOn]} numberOfLines={1}>
              {label}
            </Text>
            {i < steps.length - 1 ? <View style={[styles.line, done && styles.lineOn]} /> : null}
          </View>
        );
      })}
    </View>
  );
}

export function wizardStepTitle(steps: string[], current: number) {
  return `Adım ${current + 1}/${steps.length}: ${steps[current]}`;
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: space.md,
    marginTop: space.sm,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    position: 'relative',
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  dotOn: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  dotText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.muted,
  },
  dotTextOn: { color: '#fff' },
  label: {
    marginTop: 6,
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.muted,
    textAlign: 'center',
  },
  labelOn: {
    fontFamily: fonts.bodyBold,
    color: colors.brandDeep,
  },
  line: {
    position: 'absolute',
    top: 14,
    left: '55%',
    right: '-45%',
    height: 2,
    backgroundColor: colors.line,
    zIndex: 0,
  },
  lineOn: { backgroundColor: colors.brandSoft },
});
