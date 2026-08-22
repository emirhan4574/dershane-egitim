import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRoute } from '@react-navigation/native';
import { useAuth } from './AuthContext';
import { Button, Card, Empty, Field, Screen, SectionLabel, Subtitle, Title } from './ui';
import { colors, fonts, radius, space } from './theme';
import {
  ClassListFilter,
  ClassPicker,
  classMatchesDims,
  dimsLabel,
  emptyClassDims,
  type ClassDims,
} from './design/ClassPicker';
import { StudentDetailView } from './design/StudentDetailView';
import { WizardSteps, wizardStepTitle } from './design/WizardSteps';
import { StudentSubParams } from './design/StudentsNavItem';
import { INSTALLMENT_OPTIONS } from './paymentNotices';
import type { PaymentType } from './types';

type ViewMode = 'hub' | 'list' | 'create' | 'search' | 'detail';

const STUDENT_STEPS = ['Kimlik', 'Veli', 'Ödeme', 'Sınıf'];

export default function StudentsScreen() {
  const route = useRoute();
  const {
    users,
    classes,
    myClasses,
    isManager,
    addStudent,
    updateStudent,
    removeStudent,
    seedUzelStudents,
  } = useAuth();

  const classOptions = isManager ? classes : myClasses;

  const students = useMemo(() => {
    const all = users.filter((u) => u.role === 'student');
    if (isManager) return all;
    const allowed = new Set(classOptions.map((c) => c.id));
    return all.filter((s) => s.classId && allowed.has(s.classId));
  }, [users, isManager, classOptions]);

  const [view, setView] = useState<ViewMode>('hub');
  const [listDims, setListDims] = useState<ClassDims>(emptyClassDims());

  const [tc, setTc] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [paymentType, setPaymentType] = useState<PaymentType | ''>('');
  const [installmentCount, setInstallmentCount] = useState<number | null>(null);
  const [paymentDay, setPaymentDay] = useState('');
  const [classId, setClassId] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [detailStudentId, setDetailStudentId] = useState<string | null>(null);
  const [detailReturnView, setDetailReturnView] = useState<ViewMode>('search');
  const [step, setStep] = useState(0);

  const resetForm = () => {
    setTc('');
    setFullName('');
    setPhone('');
    setParentName('');
    setParentPhone('');
    setFeeAmount('');
    setPaymentType('');
    setInstallmentCount(null);
    setPaymentDay('');
    setClassId('');
    setEditId(null);
    setStep(0);
  };

  useEffect(() => {
    const p = (route.params || {}) as Partial<StudentSubParams>;
    if (p.section === 'create') {
      setView('create');
      resetForm();
      setError(null);
      setInfo(null);
      setDetailStudentId(null);
      return;
    }
    if (p.section === 'list') {
      setView('list');
      setListDims(emptyClassDims());
      setEditId(null);
      setError(null);
      setInfo(null);
      setDetailStudentId(null);
      return;
    }
    if (p.section === 'search') {
      setView('search');
      setSearchQuery('');
      setDetailStudentId(null);
      setError(null);
      setInfo(null);
      return;
    }
    if (p.section === 'hub') {
      setView('hub');
      setDetailStudentId(null);
    }
  }, [route.params]);

  const filteredStudents = useMemo(() => {
    return students
      .filter((s) => {
        if (!listDims.grade && !listDims.section && !listDims.track) return true;
        const cls = classOptions.find((c) => c.id === s.classId) || classes.find((c) => c.id === s.classId);
        if (!cls) return false;
        return classMatchesDims(cls, listDims);
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr'));
  }, [students, listDims, classOptions, classes]);

  const startEdit = (id: string) => {
    const s = students.find((x) => x.id === id);
    if (!s) return;
    setEditId(id);
    setTc(s.loginId);
    setFullName(s.fullName);
    setPhone(s.phone || '');
    setParentName(s.parentName || '');
    setParentPhone(s.parentPhone || '');
    setFeeAmount(s.feeAmount != null ? String(s.feeAmount) : '');
    setPaymentType((s.paymentType as PaymentType) || '');
    setInstallmentCount(s.installmentCount != null ? Number(s.installmentCount) : null);
    setPaymentDay(s.paymentDay != null ? String(s.paymentDay) : '');
    setClassId(s.classId || '');
    setError(null);
    setInfo(null);
    setStep(0);
    setView('create');
  };

  const validateStep = (s: number): string | null => {
    if (s === 0) {
      if (!editId && !tc.trim()) return 'T.C. Kimlik No girin.';
      if (!fullName.trim()) return 'İsim soyisim girin.';
    }
    if (s === 1) {
      if (!parentName.trim()) return 'Veli adı soyadı gerekli.';
      if (!editId && !parentPhone.trim()) return 'Veli telefonu gerekli.';
    }
    if (s === 2) {
      if (!feeAmount.trim() || !(Number(feeAmount) > 0)) return 'Alınacak ücret giriniz.';
      if (!paymentType) return 'Ödeme tipi seçiniz.';
      if (paymentType === 'installment' && (!installmentCount || installmentCount < 2)) {
        return 'Taksit sayısını seçiniz.';
      }
      const day = Number(paymentDay);
      if (!Number.isFinite(day) || day < 1 || day > 28) {
        return 'Ödeme günü 1–28 arasında olmalı.';
      }
    }
    if (s === 3 && !classId) return 'Öğrencinin sınıfını seçip atayın.';
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
    setStep((x) => Math.min(x + 1, STUDENT_STEPS.length - 1));
  };

  const goBack = () => {
    setError(null);
    setInfo(null);
    setStep((x) => Math.max(x - 1, 0));
  };

  const submit = async () => {
    setError(null);
    setInfo(null);
    for (let s = 0; s < STUDENT_STEPS.length; s++) {
      const err = validateStep(s);
      if (err) {
        setError(err);
        setStep(s);
        return;
      }
    }
    if (editId) {
      const err = await updateStudent({
        studentId: editId,
        fullName,
        phone,
        parentName,
        parentPhone,
        classId,
        feeAmount: Number(feeAmount),
        paymentType: paymentType as PaymentType,
        installmentCount: paymentType === 'installment' ? installmentCount! : undefined,
        paymentDay: Number(paymentDay),
      });
      if (err) {
        setError(err);
        return;
      }
      setInfo('Öğrenci güncellendi.');
      resetForm();
      setView('list');
      return;
    }
    const err = await addStudent({
      tc,
      fullName,
      phone,
      parentName,
      parentPhone,
      classId,
      feeAmount: Number(feeAmount),
      paymentType: paymentType as PaymentType,
      installmentCount: paymentType === 'installment' ? installmentCount! : undefined,
      paymentDay: Number(paymentDay),
    });
    if (err) {
      setError(err);
      return;
    }
    setInfo('Öğrenci eklendi. Giriş: T.C. / Şifre: T.C. son 6 hane');
    resetForm();
  };

  const searchHits = useMemo(() => {
    const q = searchQuery.trim().toLocaleLowerCase('tr');
    if (!q) return [];
    const parts = q.split(/\s+/).filter(Boolean);
    return students
      .filter((s) => {
        const name = (s.fullName || '').toLocaleLowerCase('tr');
        const tcVal = (s.loginId || '').toLocaleLowerCase('tr');
        const cls = (s.className || '').toLocaleLowerCase('tr');
        const hay = `${name} ${tcVal} ${cls}`;
        return parts.every((p) => hay.includes(p));
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'tr'))
      .slice(0, 40);
  }, [students, searchQuery]);

  const detailStudent = useMemo(
    () => students.find((s) => s.id === detailStudentId) || null,
    [students, detailStudentId]
  );

  const openStudentDetail = (studentId: string, from: ViewMode = 'search') => {
    setDetailStudentId(studentId);
    setDetailReturnView(from);
    setView('detail');
    setError(null);
    setInfo(null);
  };

  const closeStudentDetail = () => {
    setDetailStudentId(null);
    setView(detailReturnView === 'detail' ? 'search' : detailReturnView);
  };

  if (view === 'hub') {
    return (
      <Screen>
        <Title>Öğrenciler</Title>
        <Subtitle>
          Sol menüden Kayıtlı öğrenciler, Öğrenci ekle veya Öğrenci ara alt başlığını seçin.
        </Subtitle>
      </Screen>
    );
  }

  if (view === 'detail' && !detailStudent) {
    return (
      <Screen>
        <Button title="← Geri" variant="ghost" onPress={closeStudentDetail} />
        <Empty text="Öğrenci bulunamadı." />
      </Screen>
    );
  }

  if (view === 'detail' && detailStudent) {
    const backLabel =
      detailReturnView === 'list'
        ? '← Öğrenci listesine dön'
        : detailReturnView === 'search'
          ? '← Aramaya dön'
          : '← Geri';
    return (
      <StudentDetailView
        student={detailStudent}
        onBack={closeStudentDetail}
        backLabel={backLabel}
      />
    );
  }

  if (view === 'search') {
    return (
      <Screen scroll>
        <Title>Öğrenci ara</Title>
        <Subtitle>Ad soyad (veya T.C. / sınıf) yazın; çıkan kayda dokununca detay açılır.</Subtitle>
        <Field
          label="Ad soyad"
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Örn: Bora Çolak"
        />
        <SectionLabel>
          {searchQuery.trim()
            ? `Sonuçlar (${searchHits.length})`
            : 'Aramak için yazmaya başlayın'}
        </SectionLabel>
        {searchQuery.trim() && searchHits.length === 0 ? (
          <Empty text="Eşleşen öğrenci bulunamadı." />
        ) : null}
        {searchHits.map((s) => (
          <Pressable key={s.id} onPress={() => openStudentDetail(s.id, 'search')} style={styles.searchCard}>
            <Text style={styles.name}>{s.fullName}</Text>
            <Text style={styles.meta}>
              {s.className || 'Sınıf yok'} · T.C.: {s.loginId}
            </Text>
            <Text style={styles.tapHint}>Detaylar →</Text>
          </Pressable>
        ))}
      </Screen>
    );
  }

  if (view === 'list') {
    return (
      <Screen>
        <Title>Kayıtlı öğrenciler</Title>
        <Subtitle>
          Sınıf / şube / bölüme göre filtreleyin. Detayda deneme ve devamsızlık geçmişi görünür.
        </Subtitle>

        {isManager ? (
          <Button
            title="Test: dershane uzel — her sınıfa 15 öğrenci (liste)"
            variant="secondary"
            onPress={async () => {
              setError(null);
              setInfo(null);
              const err = await seedUzelStudents();
              if (err) setError(err);
              else setInfo('Öğrenciler eklendi / sınıflar 15’e tamamlandı.');
            }}
          />
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {info ? <Text style={styles.info}>{info}</Text> : null}

        <ClassListFilter
          classes={classOptions}
          value={listDims}
          onChange={setListDims}
        />

        <SectionLabel>
          {dimsLabel(listDims)} ({filteredStudents.length})
        </SectionLabel>
        <FlatList
          data={filteredStudents}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={<Empty text="Bu filtrede kayıtlı öğrenci yok." />}
          renderItem={({ item }) => (
            <Card>
              <Text style={styles.name}>{item.fullName}</Text>
              <Text style={styles.meta}>T.C.: {item.loginId}</Text>
              <Text style={styles.meta}>Sınıf: {item.className || '—'}</Text>
              <Text style={styles.meta}>
                Tel: {item.phone || '—'} · Veli: {item.parentName || item.parentPhone || '—'}
              </Text>
              <View style={styles.actions}>
                <Button
                  title="Detay"
                  variant="secondary"
                  onPress={() => openStudentDetail(item.id, 'list')}
                />
                <Button title="Düzenle" variant="secondary" onPress={() => startEdit(item.id)} />
                <Button
                  title="Öğrenciyi çıkar"
                  variant="danger"
                  onPress={async () => {
                    const err = await removeStudent(item.id);
                    if (err) setError(err);
                  }}
                />
              </View>
            </Card>
          )}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <Title>{editId ? 'Öğrenciyi düzenle' : 'Öğrenci ekle'}</Title>
      <Subtitle>{wizardStepTitle(STUDENT_STEPS, step)}</Subtitle>

      <WizardSteps steps={STUDENT_STEPS} current={step} />

      <Card>
        {step === 0 ? (
          <>
            {!editId ? (
              <Field
                label="T.C. Kimlik No"
                value={tc}
                onChangeText={setTc}
                keyboardType="numeric"
              />
            ) : (
              <Text style={styles.meta}>T.C.: {tc}</Text>
            )}
            <Field label="İsim Soyisim" value={fullName} onChangeText={setFullName} />
            <Field
              label="Telefon"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Field label="Veli adı soyadı" value={parentName} onChangeText={setParentName} />
            <Field
              label="Veli telefon"
              value={parentPhone}
              onChangeText={setParentPhone}
              keyboardType="phone-pad"
            />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Field
              label="Alınacak ücret (TL)"
              value={feeAmount}
              onChangeText={setFeeAmount}
              keyboardType="numeric"
            />
            <Text style={styles.label}>Ödeme tipi</Text>
            <View style={styles.chipGrid}>
              {(
                [
                  ['cash', 'Nakit'],
                  ['installment', 'Taksitli'],
                  ['credit_card', 'Kredi kartı'],
                ] as const
              ).map(([key, label]) => {
                const on = paymentType === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      setPaymentType(key);
                      if (key !== 'installment') setInstallmentCount(null);
                    }}
                    style={[styles.pick, on && styles.pickOn]}
                  >
                    <Text style={[styles.pickText, on && styles.pickTextOn]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {paymentType === 'installment' ? (
              <>
                <Text style={styles.label}>Taksit sayısı</Text>
                <View style={styles.chipGrid}>
                  {INSTALLMENT_OPTIONS.map((n) => {
                    const on = installmentCount === n;
                    return (
                      <Pressable
                        key={n}
                        onPress={() => setInstallmentCount(n)}
                        style={[styles.pick, on && styles.pickOn]}
                      >
                        <Text style={[styles.pickText, on && styles.pickTextOn]}>{n}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
            <Field
              label="Ödeme günü (ayın kaçı, 1–28)"
              value={paymentDay}
              onChangeText={setPaymentDay}
              keyboardType="numeric"
              placeholder="Örn: 15"
            />
          </>
        ) : null}

        {step === 3 ? (
          classOptions.length === 0 ? (
            <Text style={styles.warn}>Önce sınıf gerekli.</Text>
          ) : (
            <ClassPicker
              classes={classOptions}
              value={classId}
              onChange={setClassId}
              label="Sınıf ata"
              hint="Sınıf, şube ve bölümü seçip eşleşeni atayın."
              emptyText="Önce sınıf gerekli."
            />
          )
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
          {step < STUDENT_STEPS.length - 1 ? (
            <Button title="Devam et →" onPress={goNext} />
          ) : (
            <Button title={editId ? 'Kaydet' : 'Öğrenciyi kaydet'} onPress={submit} />
          )}
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { fontFamily: fonts.bodyBold, fontWeight: '800', fontSize: 16, color: colors.ink },
  meta: { fontFamily: fonts.bodySemi, fontWeight: '600', color: colors.muted, marginTop: 4 },
  label: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    color: colors.ink,
    marginBottom: 4,
    marginTop: 10,
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
  warn: { color: colors.warning, fontFamily: fonts.bodyBold, fontWeight: '800', marginBottom: 8 },
  searchCard: {
    padding: 14,
    marginBottom: 10,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.line,
  },
  tapHint: {
    marginTop: 8,
    fontFamily: fonts.bodyBold,
    fontWeight: '700',
    color: colors.brand,
    fontSize: 14,
  },
});
