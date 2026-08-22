import React, { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from './AuthContext';
import {
  Button,
  Card,
  Chip,
  Empty,
  Field,
  Screen,
  SectionLabel,
  StatBox,
  Subtitle,
  Title,
} from './ui';
import { colors, fonts, radius, space } from './theme';
import { teacherLabel } from './types';

export default function InstitutionsScreen() {
  const {
    institutions,
    users,
    classes,
    denemes,
    homeworks,
    createInstitution,
    setTeacherManager,
    setTeacherMuhasebe,
    resetAllExceptAdmin,
    seedDenemeDershanesi,
  } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [adminFullName, setAdminFullName] = useState('');
  const [adminLoginId, setAdminLoginId] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [seedingDeneme, setSeedingDeneme] = useState(false);

  const rows = useMemo(
    () =>
      institutions.map((inst) => {
        const teachers = users.filter((u) => u.institutionId === inst.id && u.role === 'teacher');
        const students = users.filter((u) => u.institutionId === inst.id && u.role === 'student');
        return {
          ...inst,
          teachers,
          students,
          teacherCount: teachers.length,
          studentCount: students.length,
          classCount: classes.filter((c) => c.institutionId === inst.id).length,
          denemeCount: denemes.filter((d) => d.institutionId === inst.id).length,
          homeworkCount: homeworks.filter((h) => h.institutionId === inst.id).length,
        };
      }),
    [institutions, users, classes, denemes, homeworks]
  );

  const selected = rows.find((r) => r.id === selectedId) || null;

  const submit = async () => {
    setError(null);
    setInfo(null);
    const err = await createInstitution({
      name,
      code,
      adminFullName,
      adminLoginId,
      adminPassword,
    });
    if (err) {
      setError(err);
      return;
    }
    setInfo('Kurum oluşturuldu. İlk hesap yönetici öğretmen olarak açıldı.');
    setName('');
    setCode('');
    setAdminFullName('');
    setAdminLoginId('');
    setAdminPassword('');
    setShowCreate(false);
  };

  if (selected) {
    return (
      <Screen>
        <Button title="← Kurum listesine dön" variant="ghost" onPress={() => setSelectedId(null)} />
        <View style={styles.detailHero}>
          <Text style={styles.detailKicker}>KURUM DETAYI</Text>
          <Text style={styles.detailName}>{selected.name}</Text>
          <Chip text={`Kod: ${selected.code}`} tone="gold" />
        </View>

        <View style={styles.statGrid}>
          <StatBox label="Öğretmen" value={selected.teacherCount} />
          <StatBox label="Öğrenci" value={selected.studentCount} />
          <StatBox label="Sınıf" value={selected.classCount} />
          <StatBox label="Deneme" value={selected.denemeCount} />
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <SectionLabel>Öğretmenler ve yönetici yetkisi</SectionLabel>
          {selected.teachers.map((t) => (
            <Card key={t.id}>
              <View style={styles.row}>
                <Text style={styles.name}>{teacherLabel(t)}</Text>
                {t.isManager ? <Chip text="Yönetici" tone="gold" /> : <Chip text="Öğretmen" />}
                {t.isMuhasebe ? <Chip text="Muhasebe" tone="ok" /> : null}
              </View>
              <Text style={styles.meta}>Kullanıcı: {t.loginId}</Text>
              <Button
                title={t.isManager ? 'Yönetici yetkisini kaldır' : 'Yönetici öğretmen yap'}
                variant={t.isManager ? 'ghost' : 'secondary'}
                onPress={() => setTeacherManager(t.id, !t.isManager)}
              />
              <Button
                title={t.isMuhasebe ? 'Muhasebe yetkisini kaldır' : 'Muhasebe yetkisi ver'}
                variant={t.isMuhasebe ? 'ghost' : 'secondary'}
                onPress={() => setTeacherMuhasebe(t.id, !t.isMuhasebe)}
              />
            </Card>
          ))}

          <SectionLabel>Öğrenciler ({selected.students.length})</SectionLabel>
          {selected.students.length === 0 ? (
            <Empty text="Öğrenci yok." />
          ) : (
            selected.students.map((s) => (
              <Card key={s.id}>
                <Text style={styles.name}>{s.fullName}</Text>
                <Text style={styles.meta}>
                  T.C.: {s.loginId} · {s.className || 'Sınıf yok'}
                </Text>
              </Card>
            ))
          )}
        </ScrollView>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Kurumlar</Title>
      <Subtitle>
        Yeni bir dershane (kurum) açın. Her kurumun kendine özel kodu olur. İlk hesap otomatik
        yönetici öğretmen olur. Diğer öğretmenler kendi hesaplarıyla giriş yapar.
      </Subtitle>

      <Button
        title={showCreate ? 'Oluşturma formunu kapat' : 'Yeni kurum oluştur'}
        variant={showCreate ? 'ghost' : 'secondary'}
        onPress={() => setShowCreate((v) => !v)}
      />

      <Button
        title={
          seedingDeneme
            ? 'Deneme dershanesi kuruluyor...'
            : 'Deneme dershanesi kur (öğretmen + sınıf + öğrenci)'
        }
        variant="secondary"
        disabled={seedingDeneme || resetting}
        onPress={async () => {
          setError(null);
          setInfo(null);
          setSeedingDeneme(true);
          const err = await seedDenemeDershanesi();
          setSeedingDeneme(false);
          if (err) {
            setError(err);
            return;
          }
          setInfo(
            'Deneme Dershanesi yenilendi. Kod: deneme · Yönetici: yonetici / 1234 · Öğretmen: matematik1 / 1234 · Öğrenci şifresi hep: 123456 (T.C. listede). Liste: deneme-ogrenci-listesi.csv'
          );
        }}
      />

      <Button
        title={resetting ? 'Sıfırlanıyor...' : 'Tüm verileri sil (yalnızca admin kalsın)'}
        variant="danger"
        disabled={resetting}
        onPress={async () => {
          setError(null);
          setInfo(null);
          setResetting(true);
          const err = await resetAllExceptAdmin();
          setResetting(false);
          if (err) {
            setError(err);
            return;
          }
          setSelectedId(null);
          setShowCreate(false);
          setInfo('Kurum, öğretmen, öğrenci ve tüm içerik silindi. Yalnızca admin kaldı.');
        }}
      />

      {showCreate ? (
        <Card>
          <Text style={styles.block}>Yeni kurum ve ilk yönetici öğretmen</Text>
          <Field label="Kurum adı" value={name} onChangeText={setName} placeholder="A Dershanesi" />
          <Field label="Kurum kodu" value={code} onChangeText={setCode} placeholder="dershane-a" />
          <Field
            label="Yönetici öğretmen adı soyadı"
            value={adminFullName}
            onChangeText={setAdminFullName}
          />
          <Field
            label="Yönetici öğretmen kullanıcı adı"
            value={adminLoginId}
            onChangeText={setAdminLoginId}
          />
          <Field
            label="Yönetici öğretmen şifresi"
            value={adminPassword}
            onChangeText={setAdminPassword}
            secureTextEntry
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {info ? <Text style={styles.info}>{info}</Text> : null}
          <Button title="Kurumu kaydet" onPress={submit} />
        </Card>
      ) : null}

      <SectionLabel>Kayıtlı kurumlar ({rows.length})</SectionLabel>
      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={<Empty text="Henüz kurum yok." />}
        renderItem={({ item }) => (
          <Card onPress={() => setSelectedId(item.id)}>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>
                  {item.teacherCount} öğretmen · {item.studentCount} öğrenci
                </Text>
              </View>
              <View style={styles.codeBox}>
                <Text style={styles.code}>{item.code}</Text>
              </View>
            </View>
            <Text style={styles.tapHint}>Detay ve yönetici yetkisi için seçin →</Text>
          </Card>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { fontFamily: fonts.bodyBold, fontSize: 15, color: colors.ink, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  name: { fontFamily: fonts.bodyBold, fontSize: 17, color: colors.ink, flex: 1 },
  codeBox: {
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  code: { fontFamily: fonts.bodyBold, color: colors.ink, fontSize: 12 },
  meta: { fontFamily: fonts.body, color: colors.muted, marginTop: 4 },
  tapHint: { marginTop: 10, color: colors.muted, fontFamily: fonts.bodyBold, fontSize: 12 },
  error: { color: colors.danger, fontFamily: fonts.bodyBold, marginTop: 4 },
  info: { color: colors.success, fontFamily: fonts.bodyBold, marginTop: 4 },
  detailHero: {
    backgroundColor: colors.rail,
    padding: space.lg,
    marginTop: space.sm,
    marginBottom: space.md,
    borderBottomWidth: 6,
    borderBottomColor: colors.accent,
  },
  detailKicker: {
    color: colors.railMuted,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.5,
  },
  detailName: { color: colors.accent, fontSize: 30, fontFamily: fonts.display, marginVertical: 8 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space.sm },
});
