import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useAuth } from './AuthContext';
import {
  Button,
  Card,
  Chip,
  Empty,
  Field,
  Screen,
  Subtitle,
  Title,
} from './ui';
import { colors, fonts, space } from './theme';
import { WEEK_DAYS } from './types';

export default function StudyPlanScreen() {
  const { user, users, studyItems, addStudyItem, toggleStudyCompleted, isManager, myClasses } =
    useAuth();
  const students = useMemo(() => {
    const all = users.filter((u) => u.role === 'student');
    if (user?.role !== 'teacher' || isManager) return all;
    const allowed = new Set(myClasses.map((c) => c.id));
    return all.filter((s) => s.classId && allowed.has(s.classId));
  }, [users, user, isManager, myClasses]);

  const todayKey = (new Date().getDay() + 6) % 7; // JS Sun=0 → Pzt=0
  const [day, setDay] = useState(todayKey);
  const [studentId, setStudentId] = useState(
    user?.role === 'student' ? user.id : students[0]?.id || ''
  );
  const [lesson, setLesson] = useState('');
  const [topic, setTopic] = useState('');
  const [time, setTime] = useState('19:00');
  const [hours, setHours] = useState('1');
  const [showForm, setShowForm] = useState(false);

  const targetId = user?.role === 'student' ? user.id : studentId;

  const dayItems = useMemo(
    () =>
      studyItems
        .filter((s) => s.studentId === targetId && (s.dayOfWeek ?? 0) === day)
        .sort((a, b) => a.time.localeCompare(b.time)),
    [studyItems, targetId, day]
  );

  const weekCounts = useMemo(() => {
    const map: Record<number, number> = {};
    for (const d of WEEK_DAYS) map[d.key] = 0;
    for (const s of studyItems) {
      if (s.studentId === targetId) map[s.dayOfWeek ?? 0] = (map[s.dayOfWeek ?? 0] || 0) + 1;
    }
    return map;
  }, [studyItems, targetId]);

  return (
    <Screen>
      <Title>Çalışma programı</Title>
      <Subtitle>
        {user?.role === 'teacher'
          ? 'Öğrenci seçin, haftanın gününü seçin. O güne çalışma planı ekleyin; bitince işaretleyin.'
          : 'Haftanın gününü seçin. O güne ait çalışma planınız listelenir. Bitirdikçe işaretleyin.'}
      </Subtitle>

      {user?.role === 'teacher' ? (
        <View style={{ marginTop: space.sm }}>
          <FlatList
            horizontal
            data={students}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            style={{ maxHeight: 52 }}
            renderItem={({ item }) => (
              <View style={{ marginRight: 6 }}>
                <Button
                  title={item.fullName}
                  variant={studentId === item.id ? 'primary' : 'ghost'}
                  onPress={() => setStudentId(item.id)}
                />
              </View>
            )}
          />
        </View>
      ) : null}

      <View style={styles.dayRow}>
        {WEEK_DAYS.map((d) => {
          const active = day === d.key;
          return (
            <Button
              key={d.key}
              title={`${d.short}${weekCounts[d.key] ? ` (${weekCounts[d.key]})` : ''}`}
              variant={active ? 'primary' : 'ghost'}
              onPress={() => setDay(d.key)}
            />
          );
        })}
      </View>

      <Text style={styles.dayTitle}>{WEEK_DAYS.find((d) => d.key === day)?.full}</Text>

      <Button
        title={showForm ? 'Ekleme formunu kapat' : 'Bu güne çalışma ekle'}
        variant={showForm ? 'ghost' : 'secondary'}
        onPress={() => setShowForm((v) => !v)}
      />

      {showForm ? (
        <Card>
          <Field label="Ders" value={lesson} onChangeText={setLesson} placeholder="Fizik" />
          <Field label="Konu" value={topic} onChangeText={setTopic} placeholder="İş-Enerji" />
          <Field label="Saat" value={time} onChangeText={setTime} placeholder="19:00" />
          <Field
            label="Süre (saat)"
            value={hours}
            onChangeText={setHours}
            keyboardType="numeric"
          />
          <Button
            title="Ekle"
            onPress={async () => {
              if (!targetId || !lesson.trim()) return;
              await addStudyItem({
                studentId: targetId,
                lesson,
                topic,
                dayOfWeek: day,
                time,
                durationHours: Number(hours) || 1,
                createdBy: user?.role === 'teacher' ? 'teacher' : 'student',
              });
              setLesson('');
              setTopic('');
              setShowForm(false);
            }}
          />
        </Card>
      ) : null}

      <FlatList
        data={dayItems}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Empty text="Bu gün için kayıt yok. Yeni çalışma ekleyebilirsiniz." />}
        renderItem={({ item }) => (
          <Card>
            <View style={styles.row}>
              <Text style={styles.name}>
                {item.time} · {item.lesson}
              </Text>
              <Chip
                text={item.completed ? 'Tamam' : 'Bekliyor'}
                tone={item.completed ? 'ok' : 'default'}
              />
            </View>
            <Text style={styles.meta}>
              {item.topic} · {item.durationHours} sa ·{' '}
              {item.createdBy === 'teacher' ? 'Öğretmen' : 'Sen'}
            </Text>
            <Button
              title={item.completed ? 'Geri al' : 'Tamamlandı'}
              variant={item.completed ? 'ghost' : 'secondary'}
              onPress={() => toggleStudyCompleted(item.id)}
            />
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  dayRow: { marginTop: space.sm, gap: 4 },
  dayTitle: {
    marginTop: space.sm,
    marginBottom: 4,
    fontFamily: fonts.displaySemi,
    fontSize: 18,
    color: colors.ink,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink, flex: 1 },
  meta: { fontFamily: fonts.body, marginTop: 6, color: colors.muted },
});
