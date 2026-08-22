import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useAuth } from './AuthContext';
import {
  Button,
  Card,
  Chip,
  Empty,
  Field,
  Screen,
  SectionLabel,
  Subtitle,
  Title,
} from './ui';
import { colors, fonts, radius, space } from './theme';
import { Homework, HomeworkAttachment } from './types';
import { pickAnyFile, pickImage, toHomeworkAttachment } from './filePick';
import { HomeworkSubParams } from './design/HomeworkNavItem';

type ViewMode = 'hub' | 'send' | 'check' | 'detail';

function formatTrDateTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}.${mm}.${yyyy} ${hh}:${mi}`;
}

export default function HomeworkScreen() {
  const route = useRoute();
  const {
    user,
    users,
    classes,
    myClasses,
    isManager,
    homeworks,
    homeworkStatuses,
    addHomework,
    setHomeworkCheck,
  } = useAuth();

  const classOptions = user?.role === 'teacher' ? (isManager ? classes : myClasses) : [];

  const [view, setView] = useState<ViewMode>('hub');
  const [classId, setClassId] = useState(classOptions[0]?.id || '');
  const [lesson, setLesson] = useState('');
  const [topic, setTopic] = useState('');
  const [purpose, setPurpose] = useState('');
  const [attachments, setAttachments] = useState<HomeworkAttachment[]>([]);
  const [link, setLink] = useState('');
  const [points, setPoints] = useState('10');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [detailHwId, setDetailHwId] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'teacher') return;
    const p = (route.params || {}) as Partial<HomeworkSubParams>;
    if (p.section === 'send') {
      setView('send');
      setDetailHwId(null);
      setError(null);
      setInfo(null);
      return;
    }
    if (p.section === 'check') {
      setView('check');
      setDetailHwId(null);
      setError(null);
      setInfo(null);
      return;
    }
    setView('hub');
    setDetailHwId(null);
  }, [route.params, user?.role]);

  useEffect(() => {
    if (!classId && classOptions[0]?.id) setClassId(classOptions[0].id);
  }, [classId, classOptions]);

  const sentByMe = useMemo(() => {
    if (!user || user.role !== 'teacher') return [];
    return homeworks
      .filter((h) => h.createdBy === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [homeworks, user]);

  const detailHw: Homework | null = useMemo(
    () => sentByMe.find((h) => h.id === detailHwId) || null,
    [sentByMe, detailHwId]
  );

  const detailStudents = useMemo(() => {
    if (!detailHw) return [];
    return users
      .filter((u) => u.role === 'student' && u.classId === detailHw.classId)
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr'));
  }, [users, detailHw]);

  const studentList = useMemo(() => {
    if (user?.role !== 'student') return [];
    return homeworks
      .filter((h) => h.classId === user.classId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [homeworks, user]);

  const mark = async (homeworkId: string, studentId: string, done: boolean) => {
    const key = `${homeworkId}_${studentId}`;
    setBusyKey(key);
    setError(null);
    try {
      await setHomeworkCheck(homeworkId, studentId, done, done ? Number(points) || 0 : 0);
    } catch {
      setError('İşaretleme kaydedilemedi.');
    } finally {
      setBusyKey(null);
    }
  };

  const openDetail = (hwId: string) => {
    setDetailHwId(hwId);
    setView('detail');
    setError(null);
    setInfo(null);
  };

  if (user?.role === 'student') {
    return (
      <Screen scroll>
        <Title>Ödevlerim</Title>
        <Subtitle>Size verilen ödevler. Eki açmak için adına dokunun.</Subtitle>
        <SectionLabel>Ödev listesi ({studentList.length})</SectionLabel>
        {studentList.length === 0 ? <Empty text="Ödev yok." /> : null}
        {studentList.map((item) => {
          const status = homeworkStatuses.find(
            (s) => s.homeworkId === item.id && s.studentId === user.id
          );
          return (
            <Card key={item.id}>
              <View style={styles.row}>
                <Text style={styles.name}>
                  {item.lesson} · {item.topic}
                </Text>
                <Chip text={item.className} />
              </View>
              <Text style={styles.meta}>{item.purpose}</Text>
              <Text style={styles.meta}>{formatTrDateTime(item.createdAt)}</Text>
              {item.attachments.map((a, idx) => (
                <Button
                  key={`${item.id}_${idx}`}
                  title={a.label}
                  variant="secondary"
                  onPress={() => Linking.openURL(a.uri).catch(() => undefined)}
                />
              ))}
              <View style={{ marginTop: 8 }}>
                {status?.done === true ? (
                  <Chip text={`Yaptı · +${status.pointsAwarded} puan`} tone="ok" />
                ) : null}
                {status?.done === false ? <Chip text="Yapmadı" tone="bad" /> : null}
                {!status || status.done === null ? <Chip text="Kontrol bekliyor" /> : null}
              </View>
            </Card>
          );
        })}
      </Screen>
    );
  }

  if (user?.role !== 'teacher') {
    return (
      <Screen>
        <Title>Ödevler</Title>
        <Subtitle>Bu bölüm öğretmen ve öğrenciler içindir.</Subtitle>
      </Screen>
    );
  }

  if (view === 'hub') {
    return (
      <Screen>
        <Title>Ödevler</Title>
        <Subtitle>Sol menüden Ödev Gönder veya Ödev kontrol alt başlığını seçin.</Subtitle>
      </Screen>
    );
  }

  if (view === 'detail' && detailHw) {
    const doneCount = detailStudents.filter((s) => {
      const st = homeworkStatuses.find((x) => x.homeworkId === detailHw.id && x.studentId === s.id);
      return st?.done === true;
    }).length;
    const notDoneCount = detailStudents.filter((s) => {
      const st = homeworkStatuses.find((x) => x.homeworkId === detailHw.id && x.studentId === s.id);
      return st?.done === false;
    }).length;

    return (
      <Screen scroll>
        <Button
          title="← Ödev kontrol listesine dön"
          variant="ghost"
          onPress={() => {
            setDetailHwId(null);
            setView('check');
          }}
        />
        <Title>
          {detailHw.lesson} · {detailHw.topic}
        </Title>
        <Subtitle>
          {detailHw.className} · {formatTrDateTime(detailHw.createdAt)}
        </Subtitle>
        {detailHw.purpose ? <Text style={styles.meta}>{detailHw.purpose}</Text> : null}

        {detailHw.attachments.length ? (
          <>
            <SectionLabel>Ekler</SectionLabel>
            {detailHw.attachments.map((a, idx) => (
              <Button
                key={`${detailHw.id}_att_${idx}`}
                title={a.label}
                variant="secondary"
                onPress={() => Linking.openURL(a.uri).catch(() => undefined)}
              />
            ))}
          </>
        ) : null}

        <Field
          label="Yaptı işaretinde verilecek puan"
          value={points}
          onChangeText={setPoints}
          keyboardType="numeric"
        />

        <SectionLabel>
          Sınıf listesi ({detailStudents.length}) · Yaptı {doneCount} · Yapmadı {notDoneCount}
        </SectionLabel>
        {detailStudents.length === 0 ? <Empty text="Bu sınıfta öğrenci yok." /> : null}
        {detailStudents.map((s, index) => {
          const st = homeworkStatuses.find(
            (x) => x.homeworkId === detailHw.id && x.studentId === s.id
          );
          const key = `${detailHw.id}_${s.id}`;
          const doneOn = st?.done === true;
          const absentOn = st?.done === false;
          return (
            <View key={s.id} style={styles.rowCard}>
              <Text style={styles.rowIndex}>{index + 1}</Text>
              <View style={styles.rowMid}>
                <Text style={styles.name}>{s.fullName}</Text>
                {doneOn ? (
                  <Text style={styles.presentTag}>Yaptı (+{st?.pointsAwarded || 0})</Text>
                ) : null}
                {absentOn ? <Text style={styles.absentTag}>Yapmadı</Text> : null}
                {!doneOn && !absentOn ? <Text style={styles.waitTag}>Bekliyor</Text> : null}
              </View>
              <View style={styles.btnCol}>
                <Pressable
                  disabled={busyKey === key}
                  onPress={() => mark(detailHw.id, s.id, true)}
                  style={[styles.bigBtn, styles.btnPresent, doneOn && styles.btnPresentOn]}
                >
                  <Text style={[styles.bigBtnText, doneOn && styles.bigBtnTextOn]}>
                    {busyKey === key ? '...' : 'Yaptı'}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={busyKey === key}
                  onPress={() => mark(detailHw.id, s.id, false)}
                  style={[styles.bigBtn, styles.btnAbsent, absentOn && styles.btnAbsentOn]}
                >
                  <Text style={[styles.bigBtnText, absentOn && styles.bigBtnTextOn]}>
                    {busyKey === key ? '...' : 'Yapmadı'}
                  </Text>
                </Pressable>
              </View>
            </View>
          );
        })}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Screen>
    );
  }

  if (view === 'check') {
    return (
      <Screen scroll>
        <Title>Ödev kontrol</Title>
        <Subtitle>Sizin gönderdiğiniz ödevler. Detaya dokununca sınıf listesi açılır.</Subtitle>
        <SectionLabel>Gönderilen ödevler ({sentByMe.length})</SectionLabel>
        {sentByMe.length === 0 ? <Empty text="Henüz gönderdiğiniz ödev yok." /> : null}
        {sentByMe.map((item) => {
          const students = users.filter((u) => u.role === 'student' && u.classId === item.classId);
          const checked = students.filter((s) => {
            const st = homeworkStatuses.find(
              (x) => x.homeworkId === item.id && x.studentId === s.id
            );
            return st?.done === true || st?.done === false;
          }).length;
          return (
            <Pressable key={item.id} onPress={() => openDetail(item.id)} style={styles.sessionCard}>
              <Text style={styles.name}>
                {item.lesson} · {item.topic}
              </Text>
              <Text style={styles.meta}>{item.className}</Text>
              <Text style={styles.meta}>{formatTrDateTime(item.createdAt)}</Text>
              <Text style={styles.meta}>
                Kontrol: {checked}/{students.length} öğrenci
              </Text>
              <Text style={styles.tap}>Detaylar →</Text>
            </Pressable>
          );
        })}
      </Screen>
    );
  }

  // send
  return (
    <Screen scroll>
      <Title>Ödev Gönder</Title>
      <Subtitle>Sınıfa ödev verin. Dosya veya bağlantı ekleyebilirsiniz.</Subtitle>

      <SectionLabel>Hedef sınıf</SectionLabel>
      {classOptions.length === 0 ? (
        <Empty text="Ödev gönderebileceğiniz sınıf yok." />
      ) : (
        <View style={styles.tabsWrap}>
          {classOptions.map((c) => {
            const on = classId === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => setClassId(c.id)}
                style={[styles.tab, on && styles.tabOn]}
              >
                <Text style={[styles.tabText, on && styles.tabTextOn]}>{c.name}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Field label="Ders" value={lesson} onChangeText={setLesson} placeholder="Matematik" />
      <Field label="Konu" value={topic} onChangeText={setTopic} placeholder="Türev" />
      <Field label="Ödev amacı" value={purpose} onChangeText={setPurpose} multiline />

      <SectionLabel>Ekler</SectionLabel>
      {attachments.map((a, i) => (
        <View key={`${a.uri}_${i}`} style={styles.attachRow}>
          <Chip text={`${a.type}: ${a.label}`} tone="blue" />
          <Button
            title="Sil"
            variant="ghost"
            onPress={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
          />
        </View>
      ))}
      <Button
        title="Dosya / PDF ekle"
        variant="ghost"
        onPress={async () => {
          const file = await pickAnyFile();
          if (!file) return;
          setAttachments((prev) => [...prev, toHomeworkAttachment(file)]);
        }}
      />
      <Button
        title="Görsel ekle"
        variant="ghost"
        onPress={async () => {
          const file = await pickImage();
          if (!file) return;
          setAttachments((prev) => [...prev, toHomeworkAttachment(file)]);
        }}
      />
      <Field label="Link ekle" value={link} onChangeText={setLink} placeholder="https://..." />
      <Button
        title="Linki ekle"
        variant="ghost"
        onPress={() => {
          if (!link.trim()) return;
          setAttachments((prev) => [...prev, { type: 'link', label: 'Link', uri: link.trim() }]);
          setLink('');
        }}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {info ? <Text style={styles.info}>{info}</Text> : null}
      <Button
        title="Ödev Gönder"
        onPress={async () => {
          const err = await addHomework({ classId, lesson, topic, purpose, attachments });
          if (err) {
            setError(err);
            setInfo(null);
            return;
          }
          setLesson('');
          setTopic('');
          setPurpose('');
          setAttachments([]);
          setError(null);
          setInfo('Ödev gönderildi. Ödev kontrol menüsünden işaretleyebilirsiniz.');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { fontFamily: fonts.bodyBold, fontWeight: '800', fontSize: 16, color: colors.ink, flex: 1 },
  meta: { fontFamily: fonts.body, marginTop: 6, color: colors.muted, lineHeight: 20 },
  attachRow: { marginBottom: 4 },
  error: { color: colors.danger, fontFamily: fonts.bodyBold, marginTop: 8 },
  info: { color: colors.success, fontFamily: fonts.bodyBold, marginTop: 8 },
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
  tabsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space.md },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  tabOn: { backgroundColor: colors.brand, borderColor: colors.brand },
  tabText: { fontFamily: fonts.bodyBold, fontWeight: '700', color: colors.ink, fontSize: 14 },
  tabTextOn: { color: '#FFFFFF' },
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
  waitTag: {
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    fontSize: 12,
    color: colors.muted,
  },
  btnCol: { gap: 8 },
  bigBtn: {
    minWidth: 92,
    minHeight: 44,
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
});
