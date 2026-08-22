import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useAuth } from './AuthContext';
import {
  Button,
  Card,
  Empty,
  Field,
  Screen,
  SectionLabel,
  Subtitle,
  Title,
} from './ui';
import { colors, fonts, radius, space } from './theme';
import { LessonSlot, WEEK_DAYS, teacherLabel } from './types';
import { ScheduleSubParams } from './design/DersProgramiNavItem';

type ViewMode = 'view' | 'sendTeacher' | 'sendClass' | 'hub';

type DraftSlot = {
  key: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  subject: string;
  room: string;
  note: string;
  relatedClassId: string;
  relatedTeacherId: string;
};

function newDraft(day = 0): DraftSlot {
  return {
    key: `d_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    dayOfWeek: day,
    startTime: '09:00',
    endTime: '09:40',
    subject: '',
    room: '',
    note: '',
    relatedClassId: '',
    relatedTeacherId: '',
  };
}

function sortSlots(a: LessonSlot, b: LessonSlot) {
  if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
  return a.startTime.localeCompare(b.startTime);
}

export default function ScheduleScreen() {
  const route = useRoute();
  const {
    user,
    users,
    classes,
    lessonSchedules,
    saveLessonSchedule,
    isMuhasebe,
  } = useAuth();

  const teachers = useMemo(
    () =>
      users
        .filter((u) => u.role === 'teacher')
        .sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr')),
    [users]
  );

  const [view, setView] = useState<ViewMode>(isMuhasebe ? 'hub' : 'view');
  const [day, setDay] = useState((new Date().getDay() + 6) % 7);
  const [targetId, setTargetId] = useState('');
  const [title, setTitle] = useState('');
  const [drafts, setDrafts] = useState<DraftSlot[]>([newDraft()]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isMuhasebe) {
      setView('view');
      return;
    }
    const p = (route.params || {}) as Partial<ScheduleSubParams>;
    if (p.section === 'sendTeacher') {
      setView('sendTeacher');
      setTargetId('');
      setTitle('');
      setDrafts([newDraft()]);
      setError(null);
      setInfo(null);
      return;
    }
    if (p.section === 'sendClass') {
      setView('sendClass');
      setTargetId('');
      setTitle('');
      setDrafts([newDraft()]);
      setError(null);
      setInfo(null);
      return;
    }
    setView('hub');
  }, [route.params, isMuhasebe]);

  const mySchedule = useMemo(() => {
    if (!user) return null;
    if (user.role === 'teacher') {
      return (
        lessonSchedules.find((s) => s.targetType === 'teacher' && s.targetId === user.id) || null
      );
    }
    if (user.role === 'student' && user.classId) {
      return (
        lessonSchedules.find((s) => s.targetType === 'class' && s.targetId === user.classId) ||
        null
      );
    }
    return null;
  }, [user, lessonSchedules]);

  const daySlots = useMemo(() => {
    if (!mySchedule) return [];
    return mySchedule.slots.filter((s) => s.dayOfWeek === day).sort(sortSlots);
  }, [mySchedule, day]);

  const weekCounts = useMemo(() => {
    const map: Record<number, number> = {};
    for (const d of WEEK_DAYS) map[d.key] = 0;
    for (const s of mySchedule?.slots || []) {
      map[s.dayOfWeek] = (map[s.dayOfWeek] || 0) + 1;
    }
    return map;
  }, [mySchedule]);

  useEffect(() => {
    if (!targetId) return;
    const existing = lessonSchedules.find(
      (s) =>
        s.targetType === (view === 'sendTeacher' ? 'teacher' : 'class') &&
        s.targetId === targetId
    );
    if (!existing) {
      setDrafts([newDraft()]);
      setTitle('');
      return;
    }
    setTitle(existing.title || '');
    setDrafts(
      existing.slots.length
        ? existing.slots.map((s) => ({
            key: `e_${s.dayOfWeek}_${s.startTime}_${Math.random().toString(36).slice(2, 5)}`,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            subject: s.subject,
            room: s.room || '',
            note: s.note || '',
            relatedClassId: s.relatedClassId || '',
            relatedTeacherId: s.relatedTeacherId || '',
          }))
        : [newDraft()]
    );
  }, [targetId, view, lessonSchedules]);

  const submit = async () => {
    if (!targetId) {
      setError(view === 'sendTeacher' ? 'Öğretmen seçin.' : 'Sınıf seçin.');
      return;
    }
    const slots: LessonSlot[] = [];
    for (const d of drafts) {
      const subject = d.subject.trim();
      if (!subject) {
        setError('Her satırda ders adı gerekli.');
        return;
      }
      if (!d.startTime.trim() || !d.endTime.trim()) {
        setError('Başlangıç ve bitiş saati gerekli.');
        return;
      }
      const slot: LessonSlot = {
        dayOfWeek: d.dayOfWeek,
        startTime: d.startTime.trim(),
        endTime: d.endTime.trim(),
        subject,
        room: d.room.trim() || undefined,
        note: d.note.trim() || undefined,
      };
      if (view === 'sendTeacher' && d.relatedClassId) {
        const cls = classes.find((c) => c.id === d.relatedClassId);
        slot.relatedClassId = d.relatedClassId;
        slot.relatedClassName = cls?.name;
      }
      if (view === 'sendClass' && d.relatedTeacherId) {
        const t = teachers.find((u) => u.id === d.relatedTeacherId);
        slot.relatedTeacherId = d.relatedTeacherId;
        slot.relatedTeacherName = t ? teacherLabel(t) : undefined;
      }
      slots.push(slot);
    }
    setSaving(true);
    setError(null);
    const err = await saveLessonSchedule({
      targetType: view === 'sendTeacher' ? 'teacher' : 'class',
      targetId,
      title,
      slots,
    });
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setInfo('Ders programı kaydedildi.');
  };

  if (!user) return null;

  if (isMuhasebe && view === 'hub') {
    return (
      <Screen>
        <Title>Ders Programı</Title>
        <Subtitle>
          Sol menüden öğretmen veya sınıf için ders programı gönderme alt başlığını seçin.
        </Subtitle>
      </Screen>
    );
  }

  if (isMuhasebe && (view === 'sendTeacher' || view === 'sendClass')) {
    const toTeacher = view === 'sendTeacher';
    return (
      <Screen scroll>
        <Title>{toTeacher ? 'Ders programı gönder — Öğretmen' : 'Ders programı gönder — Sınıf'}</Title>
        <Subtitle>
          {toTeacher
            ? 'Öğretmen seçin, haftalık ders satırlarını ekleyin ve gönderin.'
            : 'Sınıf seçin, haftalık ders satırlarını ekleyin ve gönderin.'}
        </Subtitle>

        <SectionLabel>{toTeacher ? 'Öğretmen' : 'Sınıf'}</SectionLabel>
        <View style={styles.tabsWrap}>
          {(toTeacher ? teachers : classes).map((item) => {
            const id = item.id;
            const label = toTeacher
              ? teacherLabel(item as (typeof teachers)[0])
              : (item as (typeof classes)[0]).name;
            const on = targetId === id;
            return (
              <Pressable
                key={id}
                onPress={() => setTargetId(id)}
                style={[styles.tab, on && styles.tabOn]}
              >
                <Text style={[styles.tabText, on && styles.tabTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        {toTeacher && teachers.length === 0 ? <Empty text="Kayıtlı öğretmen yok." /> : null}
        {!toTeacher && classes.length === 0 ? <Empty text="Kayıtlı sınıf yok." /> : null}

        <Field
          label="Program başlığı (isteğe bağlı)"
          value={title}
          onChangeText={setTitle}
          placeholder="2026 Bahar"
        />

        <SectionLabel>Ders satırları ({drafts.length})</SectionLabel>
        {drafts.map((d, index) => (
          <Card key={d.key}>
            <Text style={styles.rowTitle}>Satır {index + 1}</Text>
            <Text style={styles.filterLabel}>Gün</Text>
            <View style={styles.tabsWrap}>
              {WEEK_DAYS.map((w) => {
                const on = d.dayOfWeek === w.key;
                return (
                  <Pressable
                    key={w.key}
                    onPress={() =>
                      setDrafts((prev) =>
                        prev.map((x) => (x.key === d.key ? { ...x, dayOfWeek: w.key } : x))
                      )
                    }
                    style={[styles.tabSm, on && styles.tabOn]}
                  >
                    <Text style={[styles.tabText, on && styles.tabTextOn]}>{w.short}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Başlangıç"
                  value={d.startTime}
                  onChangeText={(t) =>
                    setDrafts((prev) =>
                      prev.map((x) => (x.key === d.key ? { ...x, startTime: t } : x))
                    )
                  }
                  placeholder="09:00"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Bitiş"
                  value={d.endTime}
                  onChangeText={(t) =>
                    setDrafts((prev) =>
                      prev.map((x) => (x.key === d.key ? { ...x, endTime: t } : x))
                    )
                  }
                  placeholder="09:40"
                />
              </View>
            </View>
            <Field
              label="Ders"
              value={d.subject}
              onChangeText={(t) =>
                setDrafts((prev) =>
                  prev.map((x) => (x.key === d.key ? { ...x, subject: t } : x))
                )
              }
              placeholder="Matematik"
            />
            <Field
              label="Salon / oda (isteğe bağlı)"
              value={d.room}
              onChangeText={(t) =>
                setDrafts((prev) => prev.map((x) => (x.key === d.key ? { ...x, room: t } : x)))
              }
            />
            {toTeacher ? (
              <>
                <Text style={styles.filterLabel}>İlgili sınıf (isteğe bağlı)</Text>
                <View style={styles.tabsWrap}>
                  <Pressable
                    onPress={() =>
                      setDrafts((prev) =>
                        prev.map((x) => (x.key === d.key ? { ...x, relatedClassId: '' } : x))
                      )
                    }
                    style={[styles.tabSm, !d.relatedClassId && styles.tabOn]}
                  >
                    <Text style={[styles.tabText, !d.relatedClassId && styles.tabTextOn]}>Yok</Text>
                  </Pressable>
                  {classes.map((c) => {
                    const on = d.relatedClassId === c.id;
                    return (
                      <Pressable
                        key={c.id}
                        onPress={() =>
                          setDrafts((prev) =>
                            prev.map((x) =>
                              x.key === d.key ? { ...x, relatedClassId: c.id } : x
                            )
                          )
                        }
                        style={[styles.tabSm, on && styles.tabOn]}
                      >
                        <Text style={[styles.tabText, on && styles.tabTextOn]}>{c.name}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : (
              <>
                <Text style={styles.filterLabel}>Öğretmen (isteğe bağlı)</Text>
                <View style={styles.tabsWrap}>
                  <Pressable
                    onPress={() =>
                      setDrafts((prev) =>
                        prev.map((x) => (x.key === d.key ? { ...x, relatedTeacherId: '' } : x))
                      )
                    }
                    style={[styles.tabSm, !d.relatedTeacherId && styles.tabOn]}
                  >
                    <Text style={[styles.tabText, !d.relatedTeacherId && styles.tabTextOn]}>Yok</Text>
                  </Pressable>
                  {teachers.map((t) => {
                    const on = d.relatedTeacherId === t.id;
                    return (
                      <Pressable
                        key={t.id}
                        onPress={() =>
                          setDrafts((prev) =>
                            prev.map((x) =>
                              x.key === d.key ? { ...x, relatedTeacherId: t.id } : x
                            )
                          )
                        }
                        style={[styles.tabSm, on && styles.tabOn]}
                      >
                        <Text style={[styles.tabText, on && styles.tabTextOn]}>
                          {teacherLabel(t)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
            <Button
              title="Satırı sil"
              variant="ghost"
              onPress={() =>
                setDrafts((prev) => (prev.length <= 1 ? prev : prev.filter((x) => x.key !== d.key)))
              }
            />
          </Card>
        ))}

        <Button title="Satır ekle" variant="secondary" onPress={() => setDrafts((p) => [...p, newDraft(day)])} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}
        <Button title={saving ? 'Kaydediliyor...' : 'Programı gönder'} onPress={submit} disabled={saving} />
      </Screen>
    );
  }

  // teacher / student view
  return (
    <Screen scroll>
      <Title>Ders Programı</Title>
      <Subtitle>
        {user.role === 'teacher'
          ? 'Size gönderilen haftalık ders programı.'
          : user.role === 'student'
            ? 'Sınıfınıza gönderilen haftalık ders programı.'
            : 'Ders programı'}
      </Subtitle>

      {!mySchedule ? (
        <Empty text="Henüz size atanmış bir ders programı yok." />
      ) : (
        <>
          {mySchedule.title ? <Text style={styles.programTitle}>{mySchedule.title}</Text> : null}
          <Text style={styles.meta}>
            {mySchedule.targetName} · Son güncelleme:{' '}
            {new Date(mySchedule.updatedAt).toLocaleString('tr-TR')}
          </Text>

          <SectionLabel>Gün seçin</SectionLabel>
          <View style={styles.tabsWrap}>
            {WEEK_DAYS.map((w) => {
              const on = day === w.key;
              const count = weekCounts[w.key] || 0;
              return (
                <Pressable
                  key={w.key}
                  onPress={() => setDay(w.key)}
                  style={[styles.tab, on && styles.tabOn]}
                >
                  <Text style={[styles.tabText, on && styles.tabTextOn]}>
                    {w.short}
                    {count ? ` (${count})` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <SectionLabel>
            {WEEK_DAYS.find((w) => w.key === day)?.full} ({daySlots.length})
          </SectionLabel>
          {daySlots.length === 0 ? <Empty text="Bu gün için ders yok." /> : null}
          {daySlots.map((s, i) => (
            <View key={`${s.dayOfWeek}_${s.startTime}_${i}`} style={styles.slotCard}>
              <Text style={styles.slotTime}>
                {s.startTime} – {s.endTime}
              </Text>
              <Text style={styles.slotSubject}>{s.subject}</Text>
              {s.relatedClassName ? (
                <Text style={styles.meta}>Sınıf: {s.relatedClassName}</Text>
              ) : null}
              {s.relatedTeacherName ? (
                <Text style={styles.meta}>Öğretmen: {s.relatedTeacherName}</Text>
              ) : null}
              {s.room ? <Text style={styles.meta}>Salon: {s.room}</Text> : null}
              {s.note ? <Text style={styles.meta}>{s.note}</Text> : null}
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  tabsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space.md },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  tabSm: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  tabOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabText: { fontFamily: fonts.bodyBold, fontWeight: '700', color: colors.ink, fontSize: 13 },
  tabTextOn: { color: '#FFFFFF' },
  filterLabel: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: colors.muted,
    marginBottom: 6,
    marginTop: 4,
  },
  rowTitle: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    fontSize: 15,
    color: colors.ink,
    marginBottom: 8,
  },
  timeRow: { flexDirection: 'row', gap: 10 },
  error: { color: colors.danger, fontFamily: fonts.bodyBold, marginTop: 8 },
  info: { color: colors.success, fontFamily: fonts.bodyBold, marginTop: 8 },
  programTitle: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    fontSize: 18,
    color: colors.ink,
    marginBottom: 4,
  },
  meta: { fontFamily: fonts.body, color: colors.muted, marginTop: 4, lineHeight: 20 },
  slotCard: {
    padding: 14,
    marginBottom: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  slotTime: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: colors.brand,
    fontSize: 14,
  },
  slotSubject: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    fontSize: 17,
    color: colors.ink,
    marginTop: 4,
  },
});
