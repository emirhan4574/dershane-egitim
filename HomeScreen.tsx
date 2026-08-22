import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from './AuthContext';
import { Button, Chip, PageHeader, Screen, StatBox } from './ui';
import { Icon } from './icons';
import { colors, fonts, radius } from './theme';
import { useLayout } from './design/LayoutContext';
import { mobileQuickWidth } from './design/mobile/styles';
import { desktopQuickWidth } from './design/desktop/styles';

type QuickItem = {
  label: string;
  route: string;
  icon: string;
};

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { isMobile } = useLayout();
  const {
    user,
    institution,
    institutions,
    users,
    classes,
    homeworks,
    denemes,
    messages,
    isManager,
    isMuhasebe,
    paymentNotices,
  } = useAuth();

  const students = useMemo(() => users.filter((u) => u.role === 'student'), [users]);
  const teachers = useMemo(() => users.filter((u) => u.role === 'teacher'), [users]);

  const stats = useMemo(() => {
    if (!user) return [];
    if (user.role === 'superadmin') {
      return [
        { label: 'Kurum', value: String(institutions.length), tone: 'green' as const, icon: 'business' as const },
        { label: 'Öğretmen', value: String(teachers.length), tone: 'pink' as const, icon: 'people' as const },
        { label: 'Öğrenci', value: String(students.length), tone: 'orange' as const, icon: 'person' as const },
        { label: 'Deneme', value: String(denemes.length), tone: 'gold' as const, icon: 'document-text' as const },
      ];
    }
    if (user.role === 'teacher') {
      return [
        { label: 'Öğrenci', value: String(students.length), tone: 'green' as const, icon: 'people' as const },
        { label: 'Sınıf', value: String(classes.length), tone: 'pink' as const, icon: 'school' as const },
        { label: 'Ödev', value: String(homeworks.length), tone: 'orange' as const, icon: 'clipboard' as const },
        { label: 'Deneme', value: String(denemes.length), tone: 'gold' as const, icon: 'document-text' as const },
      ];
    }
    if (user.role === 'muhasebe') {
      return [
        { label: 'Öğretmen', value: String(teachers.length), tone: 'green' as const, icon: 'people' as const },
        { label: 'Sınıf', value: String(classes.length), tone: 'pink' as const, icon: 'school' as const },
        { label: 'Öğrenci', value: String(students.length), tone: 'orange' as const, icon: 'person' as const },
        { label: 'Program', value: '—', tone: 'gold' as const, icon: 'calendar' as const },
      ];
    }
    const myHw = homeworks.filter((h) => h.classId === user.classId).length;
    const myDen = denemes.filter((d) => d.studentId === user.id).length;
    const classChat = messages.filter((m) => m.classId === user.classId).length;
    return [
      { label: 'Puanım', value: String(user.points), tone: 'green' as const, icon: 'star' as const },
      { label: 'Ödev', value: String(myHw), tone: 'pink' as const, icon: 'clipboard' as const },
      { label: 'Sohbet', value: String(classChat), tone: 'orange' as const, icon: 'chatbubbles' as const },
      { label: 'Deneme', value: String(myDen), tone: 'gold' as const, icon: 'document-text' as const },
    ];
  }, [user, institutions, teachers, students, classes, homeworks, denemes, messages]);

  const table = useMemo(() => {
    if (!user) return { title: '', columns: [] as string[], rows: [] as string[][] };

    if (user.role === 'superadmin') {
      const rows = [...institutions]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 6)
        .map((inst) => {
          const tCount = teachers.filter((t) => t.institutionId === inst.id).length;
          const sCount = students.filter((s) => s.institutionId === inst.id).length;
          return [inst.name, inst.code, String(tCount), String(sCount), 'Aktif'];
        });
      return {
        title: 'Son kurumlar',
        columns: ['Kurum', 'Kod', 'Öğrt.', 'Öğr.', 'Durum'],
        rows,
        empty: 'Henüz kurum yok.',
        seeAll: () => navigation.navigate('Institutions'),
      };
    }

    if (user.role === 'teacher') {
      const rows = [...students]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 6)
        .map((s) => {
          const denCount = denemes.filter((d) => d.studentId === s.id).length;
          const last = denemes
            .filter((d) => d.studentId === s.id)
            .sort((a, b) => b.date.localeCompare(a.date))[0];
          return [
            s.fullName,
            s.className || '—',
            String(denCount),
            last ? String(last.score) : '—',
            'Aktif',
          ];
        });
      return {
        title: 'Son öğrenciler',
        columns: ['Öğrenci', 'Sınıf', 'Deneme', 'Puan', 'Durum'],
        rows,
        empty: 'Henüz öğrenci yok.',
        seeAll: () => navigation.navigate(isManager ? 'Students' : 'MyClasses'),
      };
    }

    const rows = denemes
      .filter((d) => d.studentId === user.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6)
      .map((d) => [
        d.title,
        d.date,
        String(d.net),
        String(d.score),
        d.source === 'institution' ? 'Kurum' : 'Kendi',
      ]);
    return {
      title: 'Son denemelerim',
      columns: ['Deneme', 'Tarih', 'Net', 'Puan', 'Kaynak'],
      rows,
      empty: 'Henüz deneme yok.',
      seeAll: () => navigation.navigate('Deneme'),
    };
  }, [user, institutions, teachers, students, denemes, navigation, isManager]);

  const notices = useMemo(() => {
    if (!user) return [];
    const list: { text: string; route: string }[] = [];

    const payRows = (paymentNotices || [])
      .filter((n) =>
        user.role === 'student'
          ? n.studentId === user.id
          : user.role === 'teacher' || user.role === 'muhasebe' || isMuhasebe
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 6);
    for (const n of payRows) {
      const st = users.find((u) => u.id === n.studentId);
      const who = user.role === 'student' ? '' : st ? `${st.fullName}: ` : '';
      list.push({
        text: `${who}${n.message}`,
        route: user.role === 'student' ? 'Profile' : 'Students',
      });
    }

    if (user.role === 'teacher') {
      if (students.length === 0) {
        list.push({ text: 'Henüz öğrenci eklenmemiş. Öğrenci kaydı yapın.', route: 'Students' });
      }
      if (homeworks.length === 0) {
        list.push({ text: 'Henüz ödev yok. Sınıfa ilk ödevi yazabilirsiniz.', route: 'Homework' });
      }
      if (denemes.length === 0) {
        list.push({ text: 'Deneme sonucu yok. Belge veya net listesi yükleyin.', route: 'Deneme' });
      }
      const recentMsg = [...messages].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (recentMsg) {
        list.push({
          text: `Son duyuru (${recentMsg.senderName}): ${recentMsg.text.slice(0, 70)}`,
          route: 'Chat',
        });
      }
    } else if (user.role === 'student') {
      const classHw = homeworks.filter((h) => h.classId === user.classId).length;
      if (classHw > 0) {
        list.push({ text: `Size verilen ${classHw} ödev var.`, route: 'Homework' });
      }
      list.push({ text: 'Deneme sonuçlarınıza bakın.', route: 'Deneme' });
      list.push({ text: 'Ders programınızı kontrol edin.', route: 'Schedule' });
    } else if (user.role === 'muhasebe' || isMuhasebe) {
      list.push({
        text: 'Öğretmen veya sınıf için ders programı gönderebilirsiniz.',
        route: 'Schedule',
      });
    } else {
      if (institutions.length === 0) {
        list.push({ text: 'Başlamak için ilk kurumu oluşturun.', route: 'Institutions' });
      } else {
        list.push({
          text: `Sistemde ${institutions.length} kurum var.`,
          route: 'Institutions',
        });
      }
    }
    return list.slice(0, 8);
  }, [user, students, homeworks, denemes, messages, institutions, paymentNotices, users, isMuhasebe]);

  if (!user) return null;

  const quick: QuickItem[] =
    user.role === 'teacher'
      ? [
          { label: 'Denemeler', route: 'Deneme', icon: 'document-text' },
          { label: 'Ödevler', route: 'Homework', icon: 'clipboard' },
          { label: 'Program', route: 'Schedule', icon: 'calendar' },
          { label: 'Öğrenciler', route: isManager ? 'Students' : 'MyClasses', icon: 'people' },
        ]
      : user.role === 'superadmin'
        ? [
            { label: 'Kurumlar', route: 'Institutions', icon: 'business' },
            { label: 'Hesabım', route: 'Profile', icon: 'settings' },
          ]
        : user.role === 'muhasebe'
          ? [
              { label: 'Ders Programı', route: 'Schedule', icon: 'calendar' },
              { label: 'Hesabım', route: 'Profile', icon: 'settings' },
            ]
          : [
              { label: 'Denemeler', route: 'Deneme', icon: 'document-text' },
              { label: 'Ödevler', route: 'Homework', icon: 'clipboard' },
              { label: 'Program', route: 'Schedule', icon: 'calendar' },
              { label: 'Sohbet', route: 'Chat', icon: 'chatbubbles' },
            ];

  return (
    <Screen scroll>
      <PageHeader
        title="Ana sayfa"
        subtitle={`Merhaba ${user.fullName}`}
        action={
          user.role === 'superadmin' ? (
            <Button title="+ Kurum" onPress={() => navigation.navigate('Institutions')} />
          ) : user.role === 'teacher' && isManager ? (
            <Button title="+ Öğrenci" onPress={() => navigation.navigate('Students')} />
          ) : user.role === 'teacher' ? (
            <Button title="+ Deneme" onPress={() => navigation.navigate('Deneme')} />
          ) : (
            <Button title="Denemeler" onPress={() => navigation.navigate('Deneme')} />
          )
        }
      />

      {institution ? (
        <View style={styles.metaRow}>
          <Chip text={institution.name} tone="blue" />
          <Chip text={institution.code} tone="gold" />
        </View>
      ) : null}

      <View style={styles.stats}>
        {stats.map((s) => (
          <StatBox key={s.label} label={s.label} value={s.value} tone={s.tone} icon={s.icon} />
        ))}
      </View>

      <Text style={styles.section}>Hızlı menü</Text>
      <View style={styles.quickRow}>
        {quick.map((q) => (
          <Pressable
            key={q.route}
            style={[styles.quick, isMobile ? styles.quickMobile : styles.quickDesktop]}
            onPress={() => navigation.navigate(q.route)}
          >
            <Icon name={q.icon} size={isMobile ? 32 : 26} color={colors.brandDeep} />
            <Text style={styles.quickText}>{q.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHead}>
          <Text style={styles.panelTitle}>{table.title}</Text>
          <Pressable onPress={table.seeAll} style={styles.linkRow}>
            <Text style={styles.link}>Tümü</Text>
            <Icon name="chevron-forward" size={18} color={colors.brand} />
          </Pressable>
        </View>

        <View style={styles.tableHead}>
          {table.columns.map((c) => (
            <Text key={c} style={styles.th}>
              {c}
            </Text>
          ))}
        </View>

        {table.rows.length === 0 ? (
          <Text style={styles.empty}>{table.empty}</Text>
        ) : (
          table.rows.map((row, i) => (
            <Pressable
              key={`${row[0]}-${i}`}
              style={[styles.tr, i % 2 === 1 && styles.trAlt]}
              onPress={table.seeAll}
            >
              {row.map((cell, j) => (
                <Text
                  key={`${i}-${j}`}
                  style={[styles.td, j === 0 && styles.tdStrong, j === row.length - 1 && styles.tdStatus]}
                  numberOfLines={1}
                >
                  {cell}
                </Text>
              ))}
            </Pressable>
          ))
        )}
      </View>

      <View style={styles.panel}>
        <View style={styles.panelHead}>
          <Text style={styles.panelTitle}>Bildirimler</Text>
          <Icon name="notifications" size={22} color={colors.brand} />
        </View>
        {notices.length === 0 ? (
          <Text style={styles.empty}>Bekleyen bildirim yok.</Text>
        ) : (
          notices.map((n, i) => (
            <Pressable key={i} style={styles.notice} onPress={() => navigation.navigate(n.route)}>
              <Icon name="alert-circle" size={22} color={colors.brand} />
              <Text style={styles.noticeText}>{n.text}</Text>
              <Icon name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ))
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
    justifyContent: 'space-between',
  },
  section: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    fontSize: 15,
    color: colors.ink,
    marginBottom: 6,
    marginTop: 2,
  },

  panel: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 10,
    marginBottom: 8,
  },
  panelHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  panelTitle: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    fontSize: 15,
    color: colors.ink,
  },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  link: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    fontSize: 13,
    color: colors.brand,
  },

  tableHead: {
    flexDirection: 'row',
    backgroundColor: colors.panel,
    borderRadius: radius.sm,
    paddingVertical: 7,
    paddingHorizontal: 6,
    marginBottom: 2,
  },
  th: {
    flex: 1,
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    fontSize: 11,
    color: colors.muted,
  },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  trAlt: { backgroundColor: '#FAFAFA' },
  td: {
    flex: 1,
    fontFamily: fonts.bodySemi,
    fontWeight: '600',
    fontSize: 12,
    color: colors.ink,
  },
  tdStrong: { fontFamily: fonts.bodyBold, fontWeight: '800' },
  tdStatus: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    color: colors.success,
  },
  empty: {
    fontFamily: fonts.bodySemi,
    fontWeight: '600',
    color: colors.muted,
    paddingVertical: 10,
    textAlign: 'center',
    fontSize: 13,
  },

  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineSoft,
  },
  noticeText: {
    flex: 1,
    fontFamily: fonts.bodySemi,
    fontWeight: '600',
    fontSize: 13,
    color: colors.ink,
    lineHeight: 18,
  },

  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
    justifyContent: 'space-between',
  },
  quick: {
    backgroundColor: colors.brandMist,
    borderWidth: 1,
    borderColor: colors.brandSoft,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 6,
  },
  quickMobile: {
    width: mobileQuickWidth,
  },
  quickDesktop: {
    width: desktopQuickWidth,
    flexGrow: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 16,
    minWidth: 140,
  },
  quickText: {
    fontFamily: fonts.bodyBold,
    fontWeight: '800',
    fontSize: 14,
    color: colors.brandDeep,
  },
});
