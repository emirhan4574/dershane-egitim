import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useAuth } from './AuthContext';
import { Button, Card, Empty, Screen, SectionLabel, Subtitle, Title } from './ui';
import { colors, fonts, radius, space } from './theme';
import {
  CLASS_GRADES,
  CLASS_GRADES_LISE,
  CLASS_GRADES_ORTAOKUL,
  CLASS_SECTIONS,
  CLASS_TRACKS_LISE,
  CLASS_TRACKS_MEZUN,
  ClassGrade,
  ClassListCategory,
  ClassRoom,
  ClassTrack,
  classCategoryLabel,
  classListCategory,
  gradeLabel,
  isLiseTrackCategory,
  isOrtaokulGrade,
  trackLabel,
} from './types';
import { ClassSubParams } from './design/ClassesNavItem';
import { StudentDetailView } from './design/StudentDetailView';

type ViewMode = 'hub' | 'list' | 'create' | 'detail';

export default function ClassesScreen() {
  const route = useRoute();
  const { classes, users, addClass } = useAuth();

  const [view, setView] = useState<ViewMode>('hub');
  const [listCat, setListCat] = useState<ClassListCategory>('sayisal');
  const [mezunTab, setMezunTab] = useState<ClassTrack>('sayisal');
  const [liseGradeTab, setLiseGradeTab] = useState<ClassGrade>(9);
  const [ortaGradeTab, setOrtaGradeTab] = useState<ClassGrade>(5);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [detailStudentId, setDetailStudentId] = useState<string | null>(null);

  const [grade, setGrade] = useState<ClassGrade>(4);
  const [section, setSection] = useState<string>('A');
  const [track, setTrack] = useState<ClassTrack>('ortaokul');
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const p = (route.params || {}) as Partial<ClassSubParams>;
    if (p.section === 'create') {
      setView('create');
      setSelectedClassId(null);
      setError(null);
      setInfo(null);
      return;
    }
    if (p.section === 'list' && p.category) {
      setListCat(p.category);
      setView('list');
      setSelectedClassId(null);
      if (p.category === 'mezun') setMezunTab('sayisal');
      if (isLiseTrackCategory(p.category)) setLiseGradeTab(9);
      if (p.category === 'ortaokul') setOrtaGradeTab(5);
      return;
    }
    if (p.section === 'hub') {
      setView('hub');
      setSelectedClassId(null);
    }
  }, [route.params]);

  const needsTrack = grade === 'mezun' || !isOrtaokulGrade(grade);
  const trackOptions = grade === 'mezun' ? CLASS_TRACKS_MEZUN : CLASS_TRACKS_LISE;

  const filtered = useMemo(() => {
    const base = classes.filter((c) => classListCategory(c) === listCat);
    if (listCat === 'mezun') {
      return base.filter((c) => (c.track || 'sayisal') === mezunTab);
    }
    if (isLiseTrackCategory(listCat)) {
      return base.filter((c) => c.grade === liseGradeTab);
    }
    if (listCat === 'ortaokul') {
      return base.filter((c) => c.grade === ortaGradeTab);
    }
    return base;
  }, [classes, listCat, mezunTab, liseGradeTab, ortaGradeTab]);

  const selectedClass: ClassRoom | null = useMemo(
    () => classes.find((c) => c.id === selectedClassId) || null,
    [classes, selectedClassId]
  );

  const classStudents = useMemo(() => {
    if (!selectedClassId) return [];
    return users
      .filter((u) => u.role === 'student' && u.classId === selectedClassId)
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr'));
  }, [users, selectedClassId]);

  const openDetail = (cls: ClassRoom) => {
    setSelectedClassId(cls.id);
    setDetailStudentId(null);
    setView('detail');
  };

  const detailStudent = useMemo(
    () => users.find((u) => u.id === detailStudentId && u.role === 'student') || null,
    [users, detailStudentId]
  );

  const onPickGrade = (g: ClassGrade) => {
    setGrade(g);
    if (isOrtaokulGrade(g)) setTrack('ortaokul');
    else if (g === 'mezun') setTrack('sayisal');
    else if (track === 'ortaokul' || !CLASS_TRACKS_LISE.includes(track)) setTrack('sayisal');
  };

  const submit = async () => {
    setError(null);
    setInfo(null);
    const finalTrack = isOrtaokulGrade(grade) ? 'ortaokul' : track;
    if (needsTrack && finalTrack === 'ortaokul') {
      setError('Lise veya mezun için alan seçin.');
      return;
    }
    if (grade === 'mezun' && !CLASS_TRACKS_MEZUN.includes(finalTrack)) {
      setError('Mezun için Sayısal, Eşit Ağırlık veya Sözel seçin.');
      return;
    }
    const err = await addClass({ grade, section, track: finalTrack });
    if (err) {
      setError(err);
      return;
    }
    setInfo('Sınıf kaydedildi.');
  };

  if (view === 'hub') {
    return (
      <Screen>
        <Title>Sınıflar</Title>
        <Subtitle>
          Sol menüde Sınıflar’a tıklayın; açılan alt başlıklardan seçim yapın.
        </Subtitle>
      </Screen>
    );
  }

  if (view === 'detail' && selectedClass && detailStudent) {
    return (
      <StudentDetailView
        student={detailStudent}
        onBack={() => setDetailStudentId(null)}
        backLabel="← Sınıf öğrencilerine dön"
      />
    );
  }

  if (view === 'detail' && selectedClass) {
    return (
      <Screen>
        <Button
          title="← Sınıf listesine dön"
          variant="ghost"
          onPress={() => {
            setDetailStudentId(null);
            setView('list');
          }}
        />
        <Title>{selectedClass.name}</Title>
        <Subtitle>Öğrenciye dokunun — deneme ve devamsızlık detayı açılır</Subtitle>

        <Card>
          <Text style={styles.detailLine}>
            Seviye: {selectedClass.grade != null ? gradeLabel(selectedClass.grade) : '—'}
          </Text>
          <Text style={styles.detailLine}>
            Şube: {selectedClass.section || '—'}
          </Text>
          <Text style={styles.detailLine}>
            Alan: {selectedClass.track ? trackLabel(selectedClass.track) : '—'}
          </Text>
          <Text style={styles.detailLine}>Öğrenci sayısı: {classStudents.length}</Text>
        </Card>

        <SectionLabel>Öğrenciler ({classStudents.length})</SectionLabel>
        <FlatList
          data={classStudents}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Empty text="Bu sınıfa henüz öğrenci kaydı yok." />}
          renderItem={({ item, index }) => (
            <Card onPress={() => setDetailStudentId(item.id)}>
              <View style={styles.row}>
                <Text style={styles.studentIndex}>{index + 1}.</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.fullName}</Text>
                  <Text style={styles.meta}>T.C.: {item.loginId}</Text>
                  {item.phone ? <Text style={styles.meta}>Telefon: {item.phone}</Text> : null}
                  <Text style={styles.tapHint}>Detay →</Text>
                </View>
                <Text style={styles.count}>{item.points} puan</Text>
              </View>
            </Card>
          )}
        />
      </Screen>
    );
  }

  if (view === 'list') {
    return (
      <Screen>
        <Title>{classCategoryLabel(listCat)}</Title>
        <Subtitle>Bu gruptaki kayıtlı sınıflar ve öğrenci sayıları.</Subtitle>

        {listCat === 'mezun' ? (
          <View style={styles.tabs}>
            {CLASS_TRACKS_MEZUN.map((t) => {
              const on = mezunTab === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setMezunTab(t)}
                  style={[styles.tab, on && styles.tabOn]}
                >
                  <Text style={[styles.tabText, on && styles.tabTextOn]}>{trackLabel(t)}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {isLiseTrackCategory(listCat) ? (
          <View style={styles.tabs}>
            {CLASS_GRADES_LISE.map((g) => {
              const on = liseGradeTab === g;
              return (
                <Pressable
                  key={String(g)}
                  onPress={() => setLiseGradeTab(g)}
                  style={[styles.tab, on && styles.tabOn]}
                >
                  <Text style={[styles.tabText, on && styles.tabTextOn]}>{gradeLabel(g)}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {listCat === 'ortaokul' ? (
          <View style={styles.tabs}>
            {CLASS_GRADES_ORTAOKUL.map((g) => {
              const on = ortaGradeTab === g;
              return (
                <Pressable
                  key={String(g)}
                  onPress={() => setOrtaGradeTab(g)}
                  style={[styles.tab, on && styles.tabOn]}
                >
                  <Text style={[styles.tabText, on && styles.tabTextOn]}>{gradeLabel(g)}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <SectionLabel>Toplam: {filtered.length}</SectionLabel>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Empty
              text={
                listCat === 'mezun'
                  ? `Bu mezun grubunda (${trackLabel(mezunTab)}) henüz sınıf yok.`
                  : isLiseTrackCategory(listCat)
                    ? `${gradeLabel(liseGradeTab)} için henüz sınıf yok.`
                    : listCat === 'ortaokul'
                      ? `${gradeLabel(ortaGradeTab)} için henüz sınıf yok.`
                      : 'Bu grupta henüz sınıf yok.'
              }
            />
          }
          renderItem={({ item }) => {
            const count = users.filter((u) => u.role === 'student' && u.classId === item.id).length;
            return (
              <Card onPress={() => openDetail(item)}>
                <View style={styles.row}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.count}>{count} öğrenci</Text>
                </View>
                <Text style={styles.meta}>
                  {item.grade != null ? gradeLabel(item.grade) : '—'}
                  {item.section ? ` · Şube ${item.section}` : ''}
                  {item.track ? ` · ${trackLabel(item.track)}` : ''}
                </Text>
                <Text style={styles.tapHint}>Detay ve öğrenciler →</Text>
              </Card>
            );
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Yeni sınıf ekle</Title>
      <Subtitle>Sınıf seviyesini, şubeyi ve (lise/mezun için) alanı seçin.</Subtitle>

      <Card style={{ marginTop: space.sm }}>
        <Text style={styles.label}>Sınıf seviyesi</Text>
        <View style={styles.wrap}>
          {CLASS_GRADES.map((g) => (
            <Button
              key={String(g)}
              title={gradeLabel(g)}
              variant={grade === g ? 'primary' : 'ghost'}
              onPress={() => onPickGrade(g)}
            />
          ))}
        </View>

        <Text style={styles.label}>Şube</Text>
        <View style={styles.wrap}>
          {CLASS_SECTIONS.map((s) => (
            <Button
              key={s}
              title={s}
              variant={section === s ? 'primary' : 'ghost'}
              onPress={() => setSection(s)}
            />
          ))}
        </View>

        {needsTrack ? (
          <>
            <Text style={styles.label}>
              {grade === 'mezun' ? 'Mezun alanı' : 'Alan (bölüm)'}
            </Text>
            <View style={styles.wrap}>
              {trackOptions.map((t) => (
                <Button
                  key={t}
                  title={trackLabel(t)}
                  variant={track === t ? 'primary' : 'ghost'}
                  onPress={() => setTrack(t)}
                />
              ))}
            </View>
          </>
        ) : (
          <Text style={styles.meta}>Ortaokul sınıflarında alan seçilmez (otomatik: Ortaokul).</Text>
        )}

        <Text style={styles.preview}>
          Kayıt adı:{' '}
          <Text style={styles.previewStrong}>
            {isOrtaokulGrade(grade)
              ? `${grade}-${section}`
              : grade === 'mezun'
                ? `Mezun-${section} ${trackLabel(
                    CLASS_TRACKS_MEZUN.includes(track) ? track : 'sayisal'
                  )}`
                : `${grade}-${section} ${trackLabel(track === 'ortaokul' ? 'sayisal' : track)}`}
          </Text>
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}
        <Button title="Sınıfı kaydet" onPress={submit} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
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
    fontSize: 15,
    color: colors.muted,
  },
  tabTextOn: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontFamily: fonts.bodyBold, fontWeight: '800', fontSize: 16, color: colors.ink, flex: 1 },
  count: { color: colors.brand, fontFamily: fonts.bodyBold, fontWeight: '800' },
  meta: { fontFamily: fonts.bodySemi, fontWeight: '600', marginTop: 6, color: colors.muted },
  tapHint: {
    marginTop: 8,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 13,
    color: colors.brand,
  },
  detailLine: {
    fontFamily: fonts.bodySemi,
    fontWeight: '600',
    fontSize: 14,
    color: colors.ink,
    marginBottom: 4,
  },
  studentIndex: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    fontSize: 15,
    color: colors.muted,
    width: 28,
  },
  label: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 6,
    marginTop: 10,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  preview: {
    marginTop: 14,
    fontFamily: fonts.bodySemi,
    fontWeight: '600',
    color: colors.muted,
  },
  previewStrong: { fontFamily: fonts.bodyBold, fontWeight: '800', color: colors.ink },
  info: { color: colors.success, fontFamily: fonts.bodyBold, fontWeight: '800', marginTop: 8 },
  error: { color: colors.danger, fontFamily: fonts.bodyBold, fontWeight: '800', marginTop: 8 },
});
