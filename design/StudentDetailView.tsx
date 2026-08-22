import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../AuthContext';
import { Button, Card, Empty, Screen, SectionLabel, Subtitle, Title } from '../ui';
import { colors, fonts, space } from '../theme';
import { paymentTypeLabel } from '../paymentNotices';
import type { UserAccount } from '../types';

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  if (!y || !m || !d) return iso;
  return `${d}.${m}.${y}`;
}

type Props = {
  student: UserAccount;
  onBack: () => void;
  backLabel?: string;
};

/** Öğrenci detayı: bilgiler, geçmiş denemeler, devamsızlıklar */
export function StudentDetailView({ student, onBack, backLabel = '← Geri' }: Props) {
  const { denemes, attendances, homeworks, homeworkStatuses } = useAuth();

  const detailDenemes = useMemo(() => {
    return [...denemes]
      .filter((d) => d.studentId === student.id)
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [denemes, student.id]);

  const attendanceRows = useMemo(() => {
    const rows: {
      id: string;
      date: string;
      className: string;
      subject: string;
      teacherName: string;
      status: 'present' | 'absent';
      note?: string;
    }[] = [];
    for (const session of attendances || []) {
      const entry = session.entries?.find((e) => e.studentId === student.id);
      if (!entry) continue;
      rows.push({
        id: `${session.id}_${student.id}`,
        date: session.date,
        className: session.className,
        subject: session.subject,
        teacherName: session.teacherName,
        status: entry.status,
        note: entry.note,
      });
    }
    return rows.sort((a, b) => b.date.localeCompare(a.date));
  }, [attendances, student.id]);

  const absences = useMemo(
    () => attendanceRows.filter((r) => r.status === 'absent'),
    [attendanceRows]
  );

  const presentCount = attendanceRows.length - absences.length;

  const detailHomeworks = useMemo(() => {
    if (!student.classId) return [];
    return homeworks
      .filter((h) => h.classId === student.classId)
      .map((h) => {
        const st = homeworkStatuses.find(
          (x) => x.homeworkId === h.id && x.studentId === student.id
        );
        return { hw: h, status: st };
      })
      .sort((a, b) => b.hw.createdAt.localeCompare(a.hw.createdAt));
  }, [homeworks, homeworkStatuses, student.classId, student.id]);

  const denemeAvg =
    detailDenemes.length > 0
      ? detailDenemes.reduce((s, d) => s + d.net, 0) / detailDenemes.length
      : null;

  return (
    <Screen scroll>
      <Button title={backLabel} variant="ghost" onPress={onBack} />
      <Title>{student.fullName}</Title>
      <Subtitle>
        {student.className || 'Sınıf yok'} · Puan: {student.points}
      </Subtitle>

      <Card>
        <Text style={styles.meta}>T.C.: {student.loginId}</Text>
        <Text style={styles.meta}>Telefon: {student.phone || '—'}</Text>
        <Text style={styles.meta}>Veli: {student.parentName || '—'}</Text>
        <Text style={styles.meta}>Veli telefon: {student.parentPhone || '—'}</Text>
        <Text style={styles.meta}>
          Ücret: {student.feeAmount != null ? `${student.feeAmount} TL` : '—'} ·{' '}
          {paymentTypeLabel(student.paymentType, student.installmentCount)} · Ödeme günü:{' '}
          {student.paymentDay != null ? student.paymentDay : '—'}
        </Text>
      </Card>

      <Card style={{ marginTop: space.sm }}>
        <Text style={styles.summaryTitle}>Özet</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryItem}>
            Deneme: {detailDenemes.length}
            {denemeAvg != null ? ` · Ort. net ${denemeAvg.toFixed(1)}` : ''}
          </Text>
          <Text style={styles.summaryItem}>
            Yoklama: {attendanceRows.length} · Geldi {presentCount} · Devamsız {absences.length}
          </Text>
        </View>
      </Card>

      <SectionLabel>Geçmiş denemeler ({detailDenemes.length})</SectionLabel>
      {detailDenemes.length === 0 ? <Empty text="Henüz deneme kaydı yok." /> : null}
      {detailDenemes.map((d) => (
        <Card key={d.id}>
          <Text style={styles.name}>{d.title}</Text>
          <Text style={styles.meta}>
            {formatDate(d.date)} · Net: {d.net} · Puan: {d.score}
            {d.examType ? ` · ${d.examType}` : ''}
          </Text>
          {d.subjects?.length ? (
            <Text style={styles.meta}>
              Dersler:{' '}
              {d.subjects
                .slice(0, 8)
                .map((s) => `${s.subject} ${s.net}`)
                .join(' · ')}
            </Text>
          ) : null}
        </Card>
      ))}

      <SectionLabel>Devamsızlıklar ({absences.length})</SectionLabel>
      {absences.length === 0 ? (
        <Empty text="Kayıtlı devamsızlık yok." />
      ) : (
        absences.map((row) => (
          <Card key={row.id}>
            <Text style={styles.name}>
              {formatDate(row.date)} · {row.subject}
            </Text>
            <Text style={styles.meta}>
              {row.className} · {row.teacherName}
            </Text>
            <Text style={[styles.meta, styles.absent]}>
              Gelmedi
              {row.note ? ` · Not: ${row.note}` : ''}
            </Text>
          </Card>
        ))
      )}

      <SectionLabel>Ödev durumu ({detailHomeworks.length})</SectionLabel>
      {detailHomeworks.length === 0 ? <Empty text="Bu sınıfa ödev yok." /> : null}
      {detailHomeworks.map(({ hw, status }) => (
        <Card key={hw.id}>
          <Text style={styles.name}>
            {hw.lesson} · {hw.topic}
          </Text>
          <Text style={styles.meta}>{hw.className}</Text>
          <Text style={styles.meta}>
            {status?.done === true
              ? `Yaptı (+${status.pointsAwarded || 0} puan)`
              : status?.done === false
                ? 'Yapmadı'
                : 'Kontrol bekliyor'}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
    color: colors.ink,
    marginBottom: 4,
  },
  meta: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.muted,
    marginBottom: 2,
  },
  absent: { color: colors.danger, fontFamily: fonts.bodyBold },
  summaryTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 14,
    color: colors.ink,
    marginBottom: 6,
  },
  summaryRow: { gap: 4 },
  summaryItem: {
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.brandDeep,
  },
});
