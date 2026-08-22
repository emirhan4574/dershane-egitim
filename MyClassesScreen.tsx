import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useAuth } from './AuthContext';
import { Button, Card, Chip, Empty, Screen, SectionLabel, Subtitle, Title } from './ui';
import { colors, fonts, space } from './theme';
import { teacherLabel } from './types';
import { StudentDetailView } from './design/StudentDetailView';

export default function MyClassesScreen() {
  const { myClasses, users, messages, homeworks } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailStudentId, setDetailStudentId] = useState<string | null>(null);

  const selected = myClasses.find((c) => c.id === selectedId) || null;

  const detail = useMemo(() => {
    if (!selected) return null;
    const students = users.filter((u) => u.role === 'student' && u.classId === selected.id);
    const teachers = users.filter(
      (u) => u.role === 'teacher' && (selected.teacherIds || []).includes(u.id)
    );
    const msgCount = messages.filter((m) => m.classId === selected.id).length;
    const hwCount = homeworks.filter((h) => h.classId === selected.id).length;
    return { students, teachers, msgCount, hwCount };
  }, [selected, users, messages, homeworks]);

  const detailStudent = useMemo(
    () => users.find((u) => u.id === detailStudentId && u.role === 'student') || null,
    [users, detailStudentId]
  );

  if (selected && detailStudent) {
    return (
      <StudentDetailView
        student={detailStudent}
        onBack={() => setDetailStudentId(null)}
        backLabel="← Sınıf öğrencilerine dön"
      />
    );
  }

  if (selected && detail) {
    return (
      <Screen>
        <Button
          title="← Sınıflarıma dön"
          variant="ghost"
          onPress={() => {
            setDetailStudentId(null);
            setSelectedId(null);
          }}
        />
        <Title>{selected.name}</Title>
        <Subtitle>Öğrenciye dokunun — deneme ve devamsızlık detayı açılır</Subtitle>

        <Card style={{ marginTop: space.md }}>
          <Text style={styles.meta}>Mesaj: {detail.msgCount} · Ödev: {detail.hwCount}</Text>
        </Card>

        <SectionLabel>Öğretmenler</SectionLabel>
        {detail.teachers.map((t) => (
          <Card key={t.id}>
            <Text style={styles.name}>{teacherLabel(t)}</Text>
          </Card>
        ))}

        <SectionLabel>Öğrenciler ({detail.students.length})</SectionLabel>
        <FlatList
          data={detail.students}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Empty text="Bu sınıfta öğrenci yok." />}
          renderItem={({ item }) => (
            <Card onPress={() => setDetailStudentId(item.id)}>
              <Text style={styles.name}>{item.fullName}</Text>
              <Text style={styles.meta}>T.C.: {item.loginId} · Puan: {item.points}</Text>
              <Text style={styles.tap}>Detay →</Text>
            </Card>
          )}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Sınıflarım</Title>
      <Subtitle>
        Size verilen sınıflar burada. Yeni sınıf açma yetkisi yalnızca yönetici öğretmendedir.
      </Subtitle>

      <FlatList
        style={{ marginTop: space.md }}
        data={myClasses}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Empty text="Henüz sınıfınız yok. Yönetici öğretmen atama yapmalı." />}
        renderItem={({ item }) => {
          const count = users.filter((u) => u.role === 'student' && u.classId === item.id).length;
          return (
            <Card
              onPress={() => {
                setDetailStudentId(null);
                setSelectedId(item.id);
              }}
            >
              <View style={styles.row}>
                <Text style={styles.name}>{item.name}</Text>
                <Chip text={`${count} öğrenci`} />
              </View>
              <Text style={styles.tap}>Detayı görmek için seçin →</Text>
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontFamily: fonts.bodyBold, fontSize: 16, color: colors.ink },
  meta: { fontFamily: fonts.body, color: colors.muted, marginTop: 4 },
  tap: { marginTop: 8, color: colors.brandSoft, fontFamily: fonts.bodyBold, fontSize: 12 },
});
