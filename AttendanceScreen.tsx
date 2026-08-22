import React, { useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useAuth } from './AuthContext';
import { Button, Card, Empty, Field, Screen, SectionLabel, Subtitle, Title } from './ui';
import { colors, fonts, radius, space } from './theme';
import { ClassPicker } from './design/ClassPicker';
import { AttendanceEntry, AttendanceSession } from './types';
import { YoklamaSubParams } from './design/YoklamaNavItem';

type ViewMode = 'hub' | 'take' | 'details' | 'session';

type MarkState = Record<
  string,
  { status: 'present' | 'absent'; note?: string; parentMessage?: string }
>;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function formatTrDate(isoDate: string) {
  const [y, m, d] = isoDate.split('-');
  if (!y || !m || !d) return isoDate;
  return `${d}.${m}.${y}`;
}

function buildParentMessage(input: {
  studentName: string;
  className: string;
  date: string;
  teacherName: string;
  subject: string;
}) {
  return (
    `Sayın Veli,\n\n` +
    `${formatTrDate(input.date)} tarihinde ${input.className} sınıfında ` +
    `${input.subject} dersinde öğrenciniz ${input.studentName} derse katılmamıştır.\n\n` +
    `Dersi veren öğretmen: ${input.teacherName}\n\n` +
    `Bilginize sunarız.\nDershane Yönetimi`
  );
}

async function copyText(text: string) {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  return false;
}

export default function AttendanceScreen() {
  const route = useRoute();
  const {
    user,
    users,
    classes,
    isManager,
    attendances,
    saveAttendanceSession,
  } = useAuth();

  const availableClasses = useMemo(() => {
    if (user?.role !== 'teacher') return [];
    // Yoklamada kurumdaki tüm sınıflar görünür (öğrenci atanmış sınıf kaçmasın)
    return classes;
  }, [user, classes]);

  const [view, setView] = useState<ViewMode>('hub');
  const [pickClassId, setPickClassId] = useState('');
  const [activeClassId, setActiveClassId] = useState<string | null>(null);
  const [marks, setMarks] = useState<MarkState>({});
  const [sessionDate] = useState(todayStr());
  const [subject, setSubject] = useState(user?.subjects?.[0] || '');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [absentModalStudentId, setAbsentModalStudentId] = useState<string | null>(null);
  const [absentNote, setAbsentNote] = useState('');
  const [absentMessage, setAbsentMessage] = useState('');
  const [copyInfo, setCopyInfo] = useState<string | null>(null);

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'teacher') return;
    const p = (route.params || {}) as Partial<YoklamaSubParams>;
    if (p.section === 'take') {
      setView('take');
      setPickClassId('');
      setActiveClassId(null);
      setMarks({});
      setError(null);
      setInfo(null);
      setSubject(user?.subjects?.[0] || '');
      return;
    }
    if (p.section === 'details') {
      setView('details');
      setSelectedSessionId(null);
      return;
    }
    setView('hub');
  }, [route.params, user?.role, user?.subjects]);

  const classStudents = useMemo(() => {
    if (!activeClassId) return [];
    return users
      .filter((u) => u.role === 'student' && u.classId === activeClassId)
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr'));
  }, [users, activeClassId]);

  const openClassById = (classId: string) => {
    setError(null);
    setInfo(null);
    setActiveClassId(classId);
    setMarks({});
  };

  const activeClass = availableClasses.find((c) => c.id === activeClassId);
  const pickedClass = availableClasses.find((c) => c.id === pickClassId);

  const teacherName = user?.fullName || 'Öğretmen';
  const lessonSubject = subject.trim() || user?.subjects?.[0] || 'Ders';

  const markPresent = (studentId: string) => {
    setMarks((prev) => ({
      ...prev,
      [studentId]: { status: 'present' },
    }));
  };

  const openAbsentModal = (studentId: string) => {
    const st = classStudents.find((s) => s.id === studentId);
    if (!st || !activeClass) return;
    const msg = buildParentMessage({
      studentName: st.fullName,
      className: activeClass.name,
      date: sessionDate,
      teacherName,
      subject: lessonSubject,
    });
    setAbsentModalStudentId(studentId);
    setAbsentNote('');
    setAbsentMessage(msg);
    setCopyInfo(null);
  };

  const confirmAbsent = () => {
    if (!absentModalStudentId) return;
    setMarks((prev) => ({
      ...prev,
      [absentModalStudentId]: {
        status: 'absent',
        note: absentNote.trim() || undefined,
        parentMessage: absentMessage.trim(),
      },
    }));
    setAbsentModalStudentId(null);
  };

  const markedCount = classStudents.filter((s) => marks[s.id]?.status).length;
  const absentCount = classStudents.filter((s) => marks[s.id]?.status === 'absent').length;
  const allMarked = classStudents.length > 0 && markedCount === classStudents.length;

  const saveSession = async () => {
    if (!activeClassId) return;
    if (!allMarked) {
      setError('Tüm öğrenciler için Geldi / Gelmedi seçin.');
      return;
    }
    setSaving(true);
    setError(null);
    const entries: AttendanceEntry[] = classStudents.map((s) => {
      const m = marks[s.id];
      return {
        studentId: s.id,
        studentName: s.fullName,
        status: m.status,
        note: m.note,
        parentMessage: m.parentMessage,
      };
    });
    const err = await saveAttendanceSession({
      classId: activeClassId,
      date: sessionDate,
      subject: lessonSubject,
      entries,
    });
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setInfo('Yoklama kaydedildi.');
    setMarks({});
    setActiveClassId(null);
    setPickClassId('');
  };

  const sessions = useMemo(() => {
    const list = [...(attendances || [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (user?.role === 'teacher' && !isManager) {
      return list.filter((s) => s.teacherId === user.id);
    }
    return list;
  }, [attendances, user, isManager]);

  const selectedSession: AttendanceSession | null = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) || null,
    [sessions, selectedSessionId]
  );

  const absentModalStudent = classStudents.find((s) => s.id === absentModalStudentId);

  if (user?.role !== 'teacher') {
    return (
      <Screen>
        <Title>Yoklama</Title>
        <Subtitle>Yoklama yalnızca öğretmenler tarafından alınır.</Subtitle>
      </Screen>
    );
  }

  if (view === 'hub') {
    return (
      <Screen>
        <Title>Yoklama</Title>
        <Subtitle>
          Sol menüden Yoklama al veya Yoklama detayları alt başlığını seçin.
        </Subtitle>
      </Screen>
    );
  }

  if (view === 'session' && selectedSession) {
    const absents = selectedSession.entries.filter((e) => e.status === 'absent');
    const presents = selectedSession.entries.filter((e) => e.status === 'present');
    return (
      <Screen scroll>
        <Button
          title="← Detay listesine dön"
          variant="ghost"
          onPress={() => {
            setSelectedSessionId(null);
            setView('details');
          }}
        />
        <Title>{selectedSession.className}</Title>
        <Subtitle>
          {formatTrDate(selectedSession.date)} · {selectedSession.subject} ·{' '}
          {selectedSession.teacherName}
        </Subtitle>
        <SectionLabel>
          Gelmedi ({absents.length}) · Geldi ({presents.length})
        </SectionLabel>
        {absents.length === 0 ? <Empty text="Bu yoklamada gelmeyen yok." /> : null}
        {absents.map((e) => (
          <Card key={e.studentId}>
            <Text style={styles.studentName}>{e.studentName}</Text>
            {e.note ? <Text style={styles.meta}>Not: {e.note}</Text> : null}
            {e.parentMessage ? (
              <>
                <Text style={styles.msgLabel}>Veli mesajı</Text>
                <Text style={styles.msgBody}>{e.parentMessage}</Text>
                <Button
                  title="Metni kopyala"
                  variant="secondary"
                  onPress={async () => {
                    const ok = await copyText(e.parentMessage || '');
                    setCopyInfo(ok ? 'Kopyalandı.' : 'Kopyalanamadı — metni seçip alın.');
                  }}
                />
              </>
            ) : null}
          </Card>
        ))}
        {copyInfo ? <Text style={styles.info}>{copyInfo}</Text> : null}
      </Screen>
    );
  }

  if (view === 'details') {
    return (
      <Screen scroll>
        <Title>Yoklama detayları</Title>
        <Subtitle>Kayıtlı yoklamalar ve gelmeyen öğrenci mesajları.</Subtitle>
        {sessions.length === 0 ? <Empty text="Henüz yoklama kaydı yok." /> : null}
        {sessions.map((s) => {
          const abs = s.entries.filter((e) => e.status === 'absent').length;
          return (
            <Pressable
              key={s.id}
              onPress={() => {
                setSelectedSessionId(s.id);
                setView('session');
              }}
              style={styles.sessionCard}
            >
              <Text style={styles.studentName}>{s.className}</Text>
              <Text style={styles.meta}>
                {formatTrDate(s.date)} · {s.subject}
              </Text>
              <Text style={styles.meta}>
                {s.teacherName} · {abs} gelmedi / {s.entries.length} öğrenci
              </Text>
              <Text style={styles.tap}>Detay →</Text>
            </Pressable>
          );
        })}
      </Screen>
    );
  }

  // take view
  if (activeClassId && activeClass) {
    return (
      <Screen scroll>
        <Button
          title="← Sınıf seçimine dön"
          variant="ghost"
          onPress={() => {
            setActiveClassId(null);
            setMarks({});
            setError(null);
          }}
        />
        <Title>{activeClass.name}</Title>
        <Subtitle>
          {formatTrDate(sessionDate)} · {lessonSubject} · {teacherName}
        </Subtitle>
        <Text style={styles.progress}>
          İşaretlenen: {markedCount}/{classStudents.length} · Gelmedi: {absentCount}
        </Text>

        <Field
          label="Ders (veli mesajında görünür)"
          value={subject}
          onChangeText={setSubject}
          placeholder={user?.subjects?.[0] || 'Matematik'}
        />

        {classStudents.length === 0 ? (
          <Empty text="Bu sınıfta öğrenci yok." />
        ) : (
          classStudents.map((s, idx) => {
            const m = marks[s.id];
            const isPresent = m?.status === 'present';
            const isAbsent = m?.status === 'absent';
            return (
              <View key={s.id} style={styles.rowCard}>
                <Text style={styles.rowIndex}>{idx + 1}</Text>
                <View style={styles.rowMid}>
                  <Text style={styles.studentName} numberOfLines={2}>
                    {s.fullName}
                  </Text>
                  {isAbsent ? <Text style={styles.absentTag}>Gelmedi</Text> : null}
                  {isPresent ? <Text style={styles.presentTag}>Geldi</Text> : null}
                </View>
                <View style={styles.btnCol}>
                  <Pressable
                    onPress={() => markPresent(s.id)}
                    style={[styles.bigBtn, styles.btnPresent, isPresent && styles.btnPresentOn]}
                  >
                    <Text style={[styles.bigBtnText, isPresent && styles.bigBtnTextOn]}>Geldi</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => openAbsentModal(s.id)}
                    style={[styles.bigBtn, styles.btnAbsent, isAbsent && styles.btnAbsentOn]}
                  >
                    <Text style={[styles.bigBtnText, isAbsent && styles.bigBtnTextOn]}>Gelmedi</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}
        <Button
          title={saving ? 'Kaydediliyor...' : 'Yoklamayı kaydet'}
          disabled={saving || !allMarked}
          onPress={saveSession}
        />

        <Modal
          visible={!!absentModalStudentId}
          animationType="slide"
          transparent
          onRequestClose={() => setAbsentModalStudentId(null)}
        >
          <View style={styles.modalWrap}>
            <View style={styles.modalCard}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>Gelmedi — veli mesajı</Text>
                <Text style={styles.meta}>
                  {absentModalStudent?.fullName} · {formatTrDate(sessionDate)}
                </Text>
                <Text style={styles.meta}>
                  Öğretmen: {teacherName} · Ders: {lessonSubject}
                </Text>
                <Field
                  label="Ek açıklama (isteğe bağlı)"
                  value={absentNote}
                  onChangeText={setAbsentNote}
                  placeholder="Örn: sağlık nedeniyle"
                  multiline
                />
                <Field
                  label="Veliye gidecek metin"
                  value={absentMessage}
                  onChangeText={setAbsentMessage}
                  multiline
                />
                <Button
                  title="Metni kopyala"
                  variant="secondary"
                  onPress={async () => {
                    const ok = await copyText(absentMessage);
                    setCopyInfo(ok ? 'Mesaj panoya kopyalandı.' : 'Kopyalanamadı.');
                  }}
                />
                {absentModalStudent?.parentPhone ? (
                  <Button
                    title="SMS uygulamasını aç"
                    variant="ghost"
                    onPress={() => {
                      const phone = String(absentModalStudent.parentPhone).replace(/\s/g, '');
                      const url =
                        Platform.OS === 'ios'
                          ? `sms:${phone}&body=${encodeURIComponent(absentMessage)}`
                          : `sms:${phone}?body=${encodeURIComponent(absentMessage)}`;
                      Linking.openURL(url).catch(() => undefined);
                    }}
                  />
                ) : null}
                {copyInfo ? <Text style={styles.info}>{copyInfo}</Text> : null}
                <Button title="Gelmedi olarak kaydet" onPress={confirmAbsent} />
                <Button
                  title="İptal"
                  variant="ghost"
                  onPress={() => setAbsentModalStudentId(null)}
                />
              </ScrollView>
            </View>
          </View>
        </Modal>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Title>Yoklama al</Title>
      <Subtitle>
        Sınıfı arayıp seçin; ardından öğrenci listesinde Geldi / Gelmedi ile işaretleyin.
      </Subtitle>

      <ClassPicker
        classes={availableClasses}
        value={pickClassId}
        onChange={(id) => {
          setPickClassId(id);
          setError(null);
        }}
        label="Yoklama sınıfı"
        hint="Sınıf, şube ve bölümü listeden seçin."
        emptyText="Kurumda kayıtlı sınıf yok."
      />

      {pickedClass ? (
        <Card>
          <Text style={styles.studentName}>{pickedClass.name}</Text>
          <Text style={styles.meta}>Tarih: {formatTrDate(sessionDate)}</Text>
          <Text style={styles.meta}>Öğretmen: {teacherName}</Text>
          <Button title="Sınıf listesini aç" onPress={() => openClassById(pickedClass.id)} />
        </Card>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: colors.brand,
    marginBottom: space.sm,
    fontSize: 15,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  rowIndex: {
    width: 28,
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    fontSize: 16,
    color: colors.muted,
  },
  rowMid: { flex: 1, gap: 4 },
  studentName: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    fontSize: 16,
    color: colors.ink,
  },
  presentTag: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 12,
    color: colors.success,
  },
  absentTag: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 12,
    color: colors.danger,
  },
  btnCol: { gap: 8 },
  bigBtn: {
    minWidth: 92,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  btnPresent: { borderColor: colors.success, backgroundColor: '#F0FDF4' },
  btnPresentOn: { backgroundColor: colors.success, borderColor: colors.success },
  btnAbsent: { borderColor: colors.danger, backgroundColor: '#FEF2F2' },
  btnAbsentOn: { backgroundColor: colors.danger, borderColor: colors.danger },
  bigBtnText: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    fontSize: 15,
    color: colors.ink,
  },
  bigBtnTextOn: { color: '#FFFFFF' },
  meta: {
    fontFamily: fonts.bodySemi,
    fontWeight: '600',
    color: colors.muted,
    marginTop: 4,
    lineHeight: 20,
  },
  sessionCard: {
    padding: 16,
    marginBottom: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tap: {
    marginTop: 8,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: colors.brand,
    fontSize: 14,
  },
  modalWrap: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '92%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    paddingBottom: 28,
  },
  modalTitle: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    fontSize: 20,
    color: colors.ink,
    marginBottom: 6,
  },
  msgLabel: {
    marginTop: 10,
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    color: colors.ink,
  },
  msgBody: {
    marginTop: 6,
    marginBottom: 8,
    fontFamily: fonts.body,
    color: colors.ink,
    lineHeight: 22,
    backgroundColor: colors.panel,
    padding: 12,
    borderRadius: radius.sm,
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    marginTop: 8,
  },
  info: {
    color: colors.success,
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    marginTop: 8,
  },
});
