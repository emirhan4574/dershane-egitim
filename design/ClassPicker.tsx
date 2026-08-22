import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  ClassGrade,
  ClassRoom,
  ClassTrack,
  gradeLabel,
  isOrtaokulGrade,
  trackLabel,
} from '../types';
import { colors, fonts, radius, space } from '../theme';

function matchesQuery(label: string, query: string) {
  const q = query.trim().toLocaleLowerCase('tr');
  if (!q) return true;
  return label.toLocaleLowerCase('tr').includes(q);
}

export type ClassDims = {
  grade: ClassGrade | null;
  section: string | null;
  track: ClassTrack | null;
};

export function emptyClassDims(): ClassDims {
  return { grade: null, section: null, track: null };
}

export function dimsLabel(d: ClassDims): string {
  const parts: string[] = [];
  if (d.grade != null) parts.push(gradeLabel(d.grade));
  if (d.section) parts.push(`Şube ${d.section}`);
  if (d.track && d.track !== 'ortaokul') parts.push(trackLabel(d.track));
  return parts.length ? parts.join(' · ') : 'Tümü';
}

export function classMatchesDims(c: ClassRoom, d: ClassDims): boolean {
  if (d.grade != null && c.grade !== d.grade) return false;
  if (d.section && (c.section || '').toUpperCase() !== d.section.toUpperCase()) return false;
  if (d.track) {
    if (d.track === 'ortaokul') {
      return c.track === 'ortaokul' || !c.track || (c.grade != null && isOrtaokulGrade(c.grade));
    }
    return c.track === d.track;
  }
  return true;
}

function parseGradeKey(key: string | null): ClassGrade | null {
  if (key == null) return null;
  if (key === 'mezun') return 'mezun';
  const n = Number(key);
  if (!Number.isNaN(n)) return n as ClassGrade;
  return null;
}

function gradeSortKey(g: ClassGrade): number {
  if (g === 'mezun') return 100;
  return typeof g === 'number' ? g : 0;
}

function uniqueGrades(classes: ClassRoom[]): ClassGrade[] {
  const set = new Set<ClassGrade>();
  for (const c of classes) {
    if (c.grade != null) set.add(c.grade);
  }
  return [...set].sort((a, b) => gradeSortKey(b) - gradeSortKey(a));
}

function uniqueSections(classes: ClassRoom[], grade: ClassGrade | null): string[] {
  const set = new Set<string>();
  for (const c of classes) {
    if (grade != null && c.grade !== grade) continue;
    const s = (c.section || '').toUpperCase();
    if (s) set.add(s);
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'tr'));
}

function uniqueTracks(classes: ClassRoom[], grade: ClassGrade | null): ClassTrack[] {
  const set = new Set<ClassTrack>();
  for (const c of classes) {
    if (grade != null && c.grade !== grade) continue;
    if (!c.track || c.track === 'ortaokul') continue;
    set.add(c.track);
  }
  return [...set].sort((a, b) => trackLabel(a).localeCompare(trackLabel(b), 'tr'));
}

function PickList({
  title,
  items,
  selectedKey,
  onSelect,
  allowAll,
  listMaxHeight = 160,
  mode = 'list',
}: {
  title: string;
  items: { key: string; label: string }[];
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  allowAll?: boolean;
  listMaxHeight?: number;
  /** chip = yatay sarmal butonlar (filtre için); list = kaydırılabilir liste */
  mode?: 'chip' | 'list';
}) {
  const [query, setQuery] = useState('');
  const useChips = mode === 'chip' || items.length <= 12;
  const filtered = useMemo(
    () => items.filter((it) => matchesQuery(it.label, query)),
    [items, query]
  );
  const showSearch = !useChips || items.length > 10;

  if (useChips) {
    return (
      <View style={styles.block}>
        <Text style={styles.chipSectionTitle}>{title}</Text>
        {showSearch ? (
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={`${title} ara…`}
            placeholderTextColor={colors.muted}
            style={styles.slimSearch}
          />
        ) : null}
        <View style={styles.chipWrap}>
          {allowAll ? (
            <Pressable
              onPress={() => onSelect(null)}
              style={[styles.chip, selectedKey == null && styles.chipOn]}
            >
              <Text style={[styles.chipText, selectedKey == null && styles.chipTextOn]}>Tümü</Text>
            </Pressable>
          ) : null}
          {filtered.map((it) => {
            const on = selectedKey === it.key;
            return (
              <Pressable
                key={it.key}
                onPress={() => onSelect(it.key)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{it.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.block}>
      <Text style={styles.chipSectionTitle}>{title}</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={`${title} ara…`}
        placeholderTextColor={colors.muted}
        style={styles.slimSearch}
      />
      <ScrollView
        style={[styles.list, { maxHeight: listMaxHeight }]}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {allowAll ? (
          <Pressable
            onPress={() => onSelect(null)}
            style={[styles.row, selectedKey == null && styles.rowOn]}
          >
            <Text style={[styles.rowText, selectedKey == null && styles.rowTextOn]}>Tümü</Text>
            <Text style={[styles.mark, selectedKey == null && styles.markOn]}>
              {selectedKey == null ? '✓' : ''}
            </Text>
          </Pressable>
        ) : null}
        {filtered.length === 0 ? (
          <Text style={styles.emptyRow}>Eşleşen yok</Text>
        ) : (
          filtered.map((it) => {
            const on = selectedKey === it.key;
            return (
              <Pressable
                key={it.key}
                onPress={() => onSelect(it.key)}
                style={[styles.row, on && styles.rowOn]}
              >
                <Text style={[styles.rowText, on && styles.rowTextOn]} numberOfLines={1}>
                  {it.label}
                </Text>
                <Text style={[styles.mark, on && styles.markOn]}>{on ? '✓' : ''}</Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

/** Çoklu şube / sınıf işaretleme listesi */
function MultiCheckList({
  title,
  items,
  selectedKeys,
  onToggle,
  onSelectAll,
  onClearVisible,
  listMaxHeight = 220,
}: {
  title: string;
  items: { key: string; label: string }[];
  selectedKeys: Set<string>;
  onToggle: (key: string) => void;
  onSelectAll?: () => void;
  onClearVisible?: () => void;
  listMaxHeight?: number;
}) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(
    () => items.filter((it) => matchesQuery(it.label, query)),
    [items, query]
  );
  const allOn =
    filtered.length > 0 && filtered.every((it) => selectedKeys.has(it.key));

  return (
    <View style={styles.block}>
      <Text style={styles.chipSectionTitle}>{title}</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={`${title} ara…`}
        placeholderTextColor={colors.muted}
        style={styles.slimSearch}
      />
      {filtered.length > 0 && (onSelectAll || onClearVisible) ? (
        <View style={styles.bulkRow}>
          {onSelectAll ? (
            <Pressable onPress={onSelectAll} style={styles.bulkBtn}>
              <Text style={styles.bulkBtnText}>{allOn ? 'Görünenleri bırak' : 'Görünenleri seç'}</Text>
            </Pressable>
          ) : null}
          {onClearVisible ? (
            <Pressable onPress={onClearVisible} style={styles.bulkBtnGhost}>
              <Text style={styles.bulkBtnGhostText}>Bu listedekileri kaldır</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <ScrollView
        style={[styles.list, { maxHeight: listMaxHeight }]}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
      >
        {filtered.length === 0 ? (
          <Text style={styles.emptyRow}>Eşleşen yok</Text>
        ) : (
          filtered.map((it) => {
            const on = selectedKeys.has(it.key);
            return (
              <Pressable
                key={it.key}
                onPress={() => onToggle(it.key)}
                style={[styles.row, on && styles.rowOn]}
              >
                <Text style={[styles.rowText, on && styles.rowTextOn]} numberOfLines={2}>
                  {it.label}
                </Text>
                <Text style={[styles.mark, on && styles.markOn]}>{on ? '✓' : '☐'}</Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

type SingleProps = {
  mode?: 'single';
  classes: ClassRoom[];
  value: string;
  onChange: (classId: string) => void;
  label?: string;
  hint?: string;
  emptyText?: string;
};

type MultiProps = {
  mode: 'multi';
  classes: ClassRoom[];
  value: string[];
  onChange: (classIds: string[]) => void;
  label?: string;
  hint?: string;
  emptyText?: string;
};

export type ClassPickerProps = SingleProps | MultiProps;

/** Sınıf / şube / bölüm listelerinden seçim (tekli veya çoklu) */
export function ClassPicker(props: ClassPickerProps) {
  const {
    classes,
    label = 'Sınıf',
    hint,
    emptyText = 'Kayıtlı sınıf yok.',
  } = props;
  const multi = props.mode === 'multi';

  const [grade, setGrade] = useState<ClassGrade | null>(null);
  const [section, setSection] = useState<string | null>(null);
  const [track, setTrack] = useState<ClassTrack | null>(null);

  const grades = useMemo(() => uniqueGrades(classes), [classes]);
  const sections = useMemo(() => uniqueSections(classes, grade), [classes, grade]);
  const needsTrack = grade != null && !isOrtaokulGrade(grade);
  const tracks = useMemo(() => uniqueTracks(classes, grade), [classes, grade]);

  /** Çoklu: seviye (+ bölüm) filtresindeki tüm sınıflar — şube çoklu seçilir */
  const multiCandidates = useMemo(() => {
    if (!multi || grade == null) return [];
    if (needsTrack && !track) return [];
    return classes
      .filter((c) => {
        if (c.grade !== grade) return false;
        if (needsTrack) return c.track === track;
        return c.track === 'ortaokul' || !c.track || isOrtaokulGrade(c.grade!);
      })
      .sort((a, b) => {
        const sa = (a.section || '').localeCompare(b.section || '', 'tr');
        if (sa) return sa;
        return a.name.localeCompare(b.name, 'tr');
      });
  }, [multi, classes, grade, track, needsTrack]);

  const matched = useMemo(() => {
    if (multi) return [];
    if (grade == null || !section) return [];
    if (needsTrack && !track) return [];
    return classes.filter((c) => {
      if (c.grade !== grade) return false;
      if ((c.section || '').toUpperCase() !== section.toUpperCase()) return false;
      if (needsTrack) return c.track === track;
      return c.track === 'ortaokul' || !c.track || isOrtaokulGrade(c.grade!);
    });
  }, [multi, classes, grade, section, track, needsTrack]);

  const selectedNames = useMemo(() => {
    if (multi) {
      return classes
        .filter((c) => props.value.includes(c.id))
        .map((c) => c.name)
        .sort((a, b) => a.localeCompare(b, 'tr'));
    }
    return classes.filter((c) => c.id === props.value).map((c) => c.name);
  }, [classes, multi, props]);

  const selectedSet = useMemo(
    () => (multi ? new Set(props.value) : new Set<string>()),
    [multi, props]
  );

  const onPickGrade = (key: string | null) => {
    setGrade(parseGradeKey(key));
    setSection(null);
    setTrack(null);
  };

  const toggleClassId = (id: string) => {
    if (!multi) return;
    const next = props.value.includes(id)
      ? props.value.filter((x) => x !== id)
      : [...props.value, id];
    props.onChange(next);
  };

  const selectAllVisible = () => {
    if (!multi) return;
    const ids = multiCandidates.map((c) => c.id);
    const allOn = ids.length > 0 && ids.every((id) => props.value.includes(id));
    if (allOn) {
      props.onChange(props.value.filter((id) => !ids.includes(id)));
    } else {
      const set = new Set(props.value);
      ids.forEach((id) => set.add(id));
      props.onChange([...set]);
    }
  };

  const clearVisible = () => {
    if (!multi) return;
    const ids = new Set(multiCandidates.map((c) => c.id));
    props.onChange(props.value.filter((id) => !ids.has(id)));
  };

  const applyMatch = (id: string) => {
    if (multi) {
      toggleClassId(id);
      return;
    }
    props.onChange(id);
  };

  const defaultHint = multi
    ? 'Sınıf ve (gerekirse) bölüm seçin; sonra birden fazla şubeyi işaretleyin. Örn: 12 → Sayısal → A ve B.'
    : 'Sınıf, şube ve (gerekirse) bölümü listeden seçin.';

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.hint}>{hint || defaultHint}</Text>

      {selectedNames.length > 0 ? (
        <View style={styles.selectedBox}>
          <Text style={styles.selected}>
            Seçili ({selectedNames.length}): {selectedNames.join(', ')}
          </Text>
          {multi ? (
            <Pressable onPress={() => props.onChange([])} style={styles.clearAll}>
              <Text style={styles.clearAllText}>Tüm seçimi temizle</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <Text style={styles.meta}>Henüz sınıf seçilmedi.</Text>
      )}

      {classes.length === 0 ? (
        <Text style={styles.warn}>{emptyText}</Text>
      ) : multi ? (
        <>
          <PickList
            title="1. Sınıf seviyesi"
            items={grades.map((g) => ({ key: String(g), label: gradeLabel(g) }))}
            selectedKey={grade != null ? String(grade) : null}
            onSelect={onPickGrade}
            listMaxHeight={140}
          />
          {needsTrack ? (
            <PickList
              title="2. Bölüm"
              items={tracks.map((t) => ({ key: t, label: trackLabel(t) }))}
              selectedKey={track}
              onSelect={(k) => setTrack((k as ClassTrack) || null)}
              listMaxHeight={140}
            />
          ) : grade != null ? (
            <Text style={styles.meta}>Ortaokul için bölüm seçilmez.</Text>
          ) : null}

          {grade != null && (!needsTrack || track) ? (
            <MultiCheckList
              title={needsTrack ? '3. Şubeler / sınıflar (çoklu)' : '2. Şubeler / sınıflar (çoklu)'}
              items={multiCandidates.map((c) => ({
                key: c.id,
                label: c.name || `${gradeLabel(c.grade!)}-${c.section || '?'}`,
              }))}
              selectedKeys={selectedSet}
              onToggle={toggleClassId}
              onSelectAll={selectAllVisible}
              onClearVisible={clearVisible}
              listMaxHeight={260}
            />
          ) : (
            <Text style={styles.meta}>
              Önce sınıf seviyesini{needsTrack ? ' ve bölümü' : ''} seçin; sonra şubeleri işaretleyin.
            </Text>
          )}
        </>
      ) : (
        <>
          <PickList
            title="Sınıf"
            items={grades.map((g) => ({ key: String(g), label: gradeLabel(g) }))}
            selectedKey={grade != null ? String(grade) : null}
            onSelect={onPickGrade}
          />
          <PickList
            title="Şube"
            items={sections.map((s) => ({ key: s, label: s }))}
            selectedKey={section}
            onSelect={setSection}
          />
          {needsTrack ? (
            <PickList
              title="Bölüm"
              items={tracks.map((t) => ({ key: t, label: trackLabel(t) }))}
              selectedKey={track}
              onSelect={(k) => setTrack((k as ClassTrack) || null)}
            />
          ) : grade != null ? (
            <Text style={styles.meta}>Ortaokul için bölüm seçilmez.</Text>
          ) : null}

          {grade != null && section && (!needsTrack || track) ? (
            <View style={styles.matchBox}>
              <Text style={styles.subLabel}>Eşleşen sınıf</Text>
              {matched.length === 0 ? (
                <Text style={styles.warn}>Bu seçime uygun kayıtlı sınıf yok.</Text>
              ) : (
                matched.map((c) => {
                  const on = props.value === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => applyMatch(c.id)}
                      style={[styles.row, on && styles.rowOn]}
                    >
                      <Text style={[styles.rowText, on && styles.rowTextOn]}>{c.name}</Text>
                      <Text style={[styles.mark, on && styles.markOn]}>{on ? '✓' : 'Ata'}</Text>
                    </Pressable>
                  );
                })
              )}
            </View>
          ) : (
            <Text style={styles.meta}>Sınıf ve şubeyi (gerekirse bölümü) seçin.</Text>
          )}
        </>
      )}
    </View>
  );
}

/** Liste ekranları: sınıf / şube / bölüm — net chip filtre */
export function ClassListFilter({
  classes,
  value,
  onChange,
  label = 'Sınıf filtresi',
}: {
  classes: ClassRoom[];
  value: ClassDims;
  onChange: (next: ClassDims) => void;
  label?: string;
}) {
  const grades = useMemo(() => uniqueGrades(classes), [classes]);
  const sections = useMemo(() => uniqueSections(classes, value.grade), [classes, value.grade]);
  const needsTrack = value.grade != null && !isOrtaokulGrade(value.grade);
  const tracks = useMemo(() => uniqueTracks(classes, value.grade), [classes, value.grade]);

  const setGrade = (key: string | null) => {
    onChange({
      grade: parseGradeKey(key),
      section: null,
      track: null,
    });
  };

  const hasFilter = value.grade != null || !!value.section || !!value.track;

  return (
    <View style={styles.filterCard}>
      <View style={styles.filterHead}>
        <Text style={styles.filterTitle}>{label}</Text>
        {hasFilter ? (
          <Pressable onPress={() => onChange(emptyClassDims())} hitSlop={8}>
            <Text style={styles.filterClear}>Temizle</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.filterSummary}>{dimsLabel(value)}</Text>

      <PickList
        title="Sınıf"
        mode="chip"
        items={grades.map((g) => ({ key: String(g), label: gradeLabel(g) }))}
        selectedKey={value.grade != null ? String(value.grade) : null}
        onSelect={setGrade}
        allowAll
      />
      <PickList
        title="Şube"
        mode="chip"
        items={sections.map((s) => ({ key: s, label: s }))}
        selectedKey={value.section}
        onSelect={(section) =>
          onChange({ ...value, section, track: needsTrack ? value.track : null })
        }
        allowAll
      />
      {needsTrack ? (
        <PickList
          title="Bölüm"
          mode="chip"
          items={tracks.map((t) => ({ key: t, label: trackLabel(t) }))}
          selectedKey={value.track}
          onSelect={(key) => onChange({ ...value, track: (key as ClassTrack) || null })}
          allowAll
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.sm, marginBottom: space.sm },
  block: { marginBottom: space.md },
  filterCard: {
    marginTop: space.sm,
    marginBottom: space.md,
    padding: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
  },
  filterHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  filterTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.ink,
  },
  filterClear: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.brand,
  },
  filterSummary: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.brandDeep,
    marginBottom: space.md,
  },
  chipSectionTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.muted,
    marginBottom: 8,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: colors.panel,
    borderWidth: 1.5,
    borderColor: colors.line,
  },
  chipOn: {
    backgroundColor: colors.brand,
    borderColor: colors.brandDeep,
  },
  chipText: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
  },
  chipTextOn: {
    color: '#fff',
  },
  slimSearch: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.ink,
    backgroundColor: colors.panel,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
    marginBottom: 4,
  },
  subLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    color: colors.muted,
    marginBottom: 4,
  },
  hint: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginBottom: 8 },
  selected: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.brandDeep,
    marginBottom: 4,
  },
  selectedBox: { marginBottom: 8 },
  clearAll: { alignSelf: 'flex-start', marginBottom: 4 },
  clearAllText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.danger,
  },
  bulkRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  bulkBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: colors.brandMist,
    borderWidth: 1,
    borderColor: colors.brand,
  },
  bulkBtnText: {
    fontFamily: fonts.bodyBold,
    fontSize: 12,
    color: colors.brandDeep,
  },
  bulkBtnGhost: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  bulkBtnGhostText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.muted,
  },
  meta: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginBottom: 8 },
  warn: { fontFamily: fonts.body, color: colors.danger, marginBottom: 8 },
  emptyRow: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    padding: 12,
  },
  list: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  matchBox: {
    marginTop: space.sm,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  rowOn: { backgroundColor: colors.brandMist },
  rowText: { flex: 1, fontFamily: fonts.body, fontSize: 14, color: colors.ink, paddingRight: 8 },
  rowTextOn: { fontFamily: fonts.bodyBold, color: colors.brandDeep },
  mark: { fontFamily: fonts.bodyBold, color: colors.muted, fontSize: 14 },
  markOn: { color: colors.brand },
});
