import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useAuth } from './AuthContext';
import { Button, Card, Chip, Empty, Field, Screen, SectionLabel, Subtitle, Title } from './ui';
import { colors, fonts, radius, space } from './theme';
import { ClassPicker } from './design/ClassPicker';
import { WizardSteps, wizardStepTitle } from './design/WizardSteps';
import {
  TEACHER_SUBJECTS,
  TeacherSubject,
  normalizeTeacherSubject,
  teacherHasSubject,
  teacherLabel,
} from './types';
import { TeacherSubParams } from './design/TeachersNavItem';

type ViewMode = 'hub' | 'list' | 'create';

const TEACHER_STEPS = ['Kimlik', 'Dersler', 'Sınıflar', 'Yetki'];

export default function TeachersScreen() {
  const route = useRoute();
  const { users, classes, addTeacher, removeTeacher, updateTeacher } = useAuth();
  const teachers = useMemo(() => users.filter((u) => u.role === 'teacher'), [users]);

  const [view, setView] = useState<ViewMode>('hub');
  const [subjectFilter, setSubjectFilter] = useState<TeacherSubject>(TEACHER_SUBJECTS[0]);
  const [step, setStep] = useState(0);

  const [fullName, setFullName] = useState('');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [classIds, setClassIds] = useState<string[]>([]);
  const [asManager, setAsManager] = useState(false);
  const [asMuhasebe, setAsMuhasebe] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const p = (route.params || {}) as Partial<TeacherSubParams>;
    if (p.section === 'create') {
      setView('create');
      setStep(0);
      setFullName('');
      setLoginId('');
      setPassword('');
      setSubjects([]);
      setClassIds([]);
      setAsManager(false);
      setAsMuhasebe(false);
      setEditId(null);
      setError(null);
      setInfo(null);
      return;
    }
    if (p.section === 'list') {
      setView('list');
      setSubjectFilter(TEACHER_SUBJECTS[0]);
      setEditId(null);
      setError(null);
      setInfo(null);
      return;
    }
    if (p.section === 'hub') {
      setView('hub');
    }
  }, [route.params]);

  const filteredTeachers = useMemo(
    () =>
      teachers
        .filter((t) => teacherHasSubject(t, subjectFilter))
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr')),
    [teachers, subjectFilter]
  );

  const toggleSubject = (s: string) => {
    setSubjects((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const resetForm = () => {
    setFullName('');
    setLoginId('');
    setPassword('');
    setSubjects([]);
    setClassIds([]);
    setAsManager(false);
    setAsMuhasebe(false);
    setEditId(null);
    setStep(0);
  };

  const startEdit = (id: string) => {
    const t = teachers.find((x) => x.id === id);
    if (!t) return;
    setEditId(id);
    setFullName(t.fullName);
    setLoginId(t.loginId);
    setPassword('');
    setSubjects((t.subjects || []).map(normalizeTeacherSubject).filter(Boolean));
    setClassIds(classes.filter((c) => (c.teacherIds || []).includes(t.id)).map((c) => c.id));
    setAsManager(!!t.isManager);
    setAsMuhasebe(!!t.isMuhasebe);
    setError(null);
    setInfo(null);
    setStep(0);
    setView('create');
  };

  const validateStep = (s: number): string | null => {
    if (s === 0) {
      if (!fullName.trim()) return 'Ad soyad girin.';
      if (!editId) {
        if (!loginId.trim()) return 'Kullanıcı adı girin.';
        if (!password.trim()) return 'Şifre girin.';
      }
    }
    if (s === 1 && subjects.length === 0) return 'En az bir ders seçin.';
    return null;
  };

  const goNext = () => {
    setError(null);
    setInfo(null);
    const err = validateStep(step);
    if (err) {
      setError(err);
      return;
    }
    setStep((x) => Math.min(x + 1, TEACHER_STEPS.length - 1));
  };

  const goBack = () => {
    setError(null);
    setInfo(null);
    setStep((x) => Math.max(x - 1, 0));
  };

  const submit = async () => {
    setError(null);
    setInfo(null);
    for (let s = 0; s < TEACHER_STEPS.length - 1; s++) {
      const err = validateStep(s);
      if (err) {
        setError(err);
        setStep(s);
        return;
      }
    }
    const normalized = subjects.map(normalizeTeacherSubject);
    if (editId) {
      const err = await updateTeacher({
        teacherId: editId,
        subjects: normalized,
        classIds,
        isManager: asManager,
        isMuhasebe: asMuhasebe,
      });
      if (err) {
        setError(err);
        return;
      }
      setInfo('Öğretmen güncellendi.');
      resetForm();
      setView('list');
      return;
    }
    const err = await addTeacher({
      fullName,
      loginId,
      password,
      subjects: normalized,
      classIds,
      isManager: asManager,
      isMuhasebe: asMuhasebe,
    });
    if (err) {
      setError(err);
      return;
    }
    setInfo('Öğretmen eklendi.');
    resetForm();
  };

  if (view === 'hub') {
    return (
      <Screen>
        <Title>Öğretmenler</Title>
        <Subtitle>
          Sol menüde Öğretmenler’e tıklayın; kayıtlı öğretmenler veya öğretmen ekle alt başlığını
          seçin.
        </Subtitle>
      </Screen>
    );
  }

  if (view === 'list') {
    return (
      <Screen>
        <Title>Kayıtlı öğretmenler</Title>
        <Subtitle>Ders filtresine göre kurumdaki öğretmenler.</Subtitle>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll}>
          <View style={styles.tabs}>
            {TEACHER_SUBJECTS.map((s) => {
              const on = subjectFilter === s;
              return (
                <Pressable
                  key={s}
                  onPress={() => setSubjectFilter(s)}
                  style={[styles.tab, on && styles.tabOn]}
                >
                  <Text style={[styles.tabText, on && styles.tabTextOn]}>{s}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <SectionLabel>
          {subjectFilter} ({filteredTeachers.length})
        </SectionLabel>
        <FlatList
          data={filteredTeachers}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Empty text={`Bu derste kayıtlı öğretmen yok.`} />}
          renderItem={({ item }) => {
            const assigned = classes.filter((c) => (c.teacherIds || []).includes(item.id));
            return (
              <Card>
                <View style={styles.row}>
                  <Text style={styles.name}>{teacherLabel(item)}</Text>
                  {item.isManager ? <Chip text="Yönetici" tone="gold" /> : null}
                  {item.isMuhasebe ? <Chip text="Muhasebe" tone="ok" /> : null}
                </View>
                <Text style={styles.meta}>Kullanıcı adı: {item.loginId}</Text>
                <Text style={styles.meta}>
                  Dersler:{' '}
                  {(item.subjects || []).map(normalizeTeacherSubject).filter(Boolean).join(', ') ||
                    '—'}
                </Text>
                <Text style={styles.meta}>
                  Sorumlu sınıflar:{' '}
                  {assigned.length ? assigned.map((c) => c.name).join(', ') : 'Henüz atanmadı'}
                </Text>
                <View style={styles.actions}>
                  <Button title="Düzenle" variant="secondary" onPress={() => startEdit(item.id)} />
                  <Button
                    title="Öğretmeni sil"
                    variant="danger"
                    onPress={async () => {
                      const err = await removeTeacher(item.id);
                      if (err) setError(err);
                    }}
                  />
                </View>
              </Card>
            );
          }}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Title>{editId ? 'Öğretmeni düzenle' : 'Öğretmen ekle'}</Title>
      <Subtitle>{wizardStepTitle(TEACHER_STEPS, step)}</Subtitle>

      <WizardSteps steps={TEACHER_STEPS} current={step} />

      <Card>
        {step === 0 ? (
          <>
            <Field
              label="Ad soyad"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Anıl Yılmaz"
            />
            {!editId ? (
              <>
                <Field
                  label="Kullanıcı adı"
                  value={loginId}
                  onChangeText={setLoginId}
                  placeholder="anil"
                />
                <Field
                  label="Şifre"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </>
            ) : (
              <Text style={styles.meta}>Kullanıcı: {loginId}</Text>
            )}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={styles.label}>Sorumlu olduğu ders(ler)</Text>
            <Text style={styles.hint}>Bir veya daha fazla ders seçin.</Text>
            <View style={styles.chipGrid}>
              {TEACHER_SUBJECTS.map((s) => {
                const on = subjects.includes(s);
                return (
                  <Pressable
                    key={s}
                    onPress={() => toggleSubject(s)}
                    style={[styles.pick, on && styles.pickOn]}
                  >
                    <Text style={[styles.pickText, on && styles.pickTextOn]}>{s}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}

        {step === 2 ? (
          classes.length === 0 ? (
            <Text style={styles.meta}>
              Henüz sınıf yok — devam edebilirsiniz; sonra atama yapılabilir.
            </Text>
          ) : (
            <ClassPicker
              mode="multi"
              classes={classes}
              value={classIds}
              onChange={setClassIds}
              label="Sorumlu olduğu sınıflar"
              hint="Örn: 12 → Sayısal → A ve B’yi birlikte işaretleyin."
              emptyText="Önce sınıf oluşturun."
            />
          )
        ) : null}

        {step === 3 ? (
          <>
            <Text style={styles.label}>Özet</Text>
            <Text style={styles.meta}>Ad: {fullName || '—'}</Text>
            <Text style={styles.meta}>Kullanıcı: {loginId || '—'}</Text>
            <Text style={styles.meta}>
              Dersler: {subjects.length ? subjects.join(', ') : '—'}
            </Text>
            <Text style={styles.meta}>
              Sınıflar:{' '}
              {classIds.length
                ? classes
                    .filter((c) => classIds.includes(c.id))
                    .map((c) => c.name)
                    .join(', ')
                : 'Atanmadı'}
            </Text>
            <Text style={styles.label}>Yetkiler</Text>
            <Button
              title={asManager ? 'Yönetici öğretmen: Evet' : 'Yönetici öğretmen: Hayır'}
              variant={asManager ? 'secondary' : 'ghost'}
              onPress={() => setAsManager((v) => !v)}
            />
            <Button
              title={asMuhasebe ? 'Muhasebe yetkisi: Evet' : 'Muhasebe yetkisi: Hayır'}
              variant={asMuhasebe ? 'secondary' : 'ghost'}
              onPress={() => setAsMuhasebe((v) => !v)}
            />
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}

        <View style={styles.wizardNav}>
          {step > 0 ? (
            <Button title="← Geri" variant="ghost" onPress={goBack} />
          ) : editId ? (
            <Button
              title="İptal"
              variant="ghost"
              onPress={() => {
                resetForm();
                setView('list');
              }}
            />
          ) : (
            <View />
          )}
          {step < TEACHER_STEPS.length - 1 ? (
            <Button title="Devam et →" onPress={goNext} />
          ) : (
            <Button title={editId ? 'Kaydet' : 'Öğretmeni kaydet'} onPress={submit} />
          )}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabsScroll: { marginTop: space.md, marginBottom: space.sm, flexGrow: 0 },
  tabs: { flexDirection: 'row', gap: 8, paddingVertical: 4, paddingRight: 8 },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tabOn: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  tabText: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 14,
    color: colors.ink,
  },
  tabTextOn: { color: '#FFFFFF', fontWeight: '800' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { fontFamily: fonts.bodyBold, fontWeight: '800', fontSize: 16, color: colors.ink, flex: 1 },
  meta: { fontFamily: fonts.bodySemi, fontWeight: '600', color: colors.muted, marginTop: 4 },
  label: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 4,
    marginTop: 10,
  },
  hint: {
    fontFamily: fonts.bodySemi,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: 8,
    fontSize: 13,
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  pick: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
  },
  pickOn: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  pickText: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 14,
    color: colors.ink,
  },
  pickTextOn: { color: '#FFFFFF', fontWeight: '800' },
  actions: { marginTop: 8, gap: 4 },
  wizardNav: {
    marginTop: space.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  error: { color: colors.danger, fontFamily: fonts.bodyBold, fontWeight: '800', marginTop: 4 },
  info: { color: colors.success, fontFamily: fonts.bodyBold, fontWeight: '800', marginTop: 4 },
});
