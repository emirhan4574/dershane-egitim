import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppDatabase } from './types';

const DB_KEY = 'dershane_db_v3';
const SESSION_KEY = 'dershane_session_v1';
const OLD_KEYS = ['dershane_db_v1', 'dershane_db_v2'];

function uid(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function seed(): AppDatabase {
  const now = new Date().toISOString();
  return {
    institutions: [],
    users: [
      {
        id: uid('usr'),
        role: 'superadmin',
        fullName: 'Platform Admin',
        loginId: 'admin',
        password: 'admin123',
        points: 0,
        createdAt: now,
      },
    ],
    classes: [],
    messages: [],
    denemes: [],
    homeworks: [],
    homeworkStatuses: [],
    studyItems: [],
    attendances: [],
    lessonSchedules: [],
    paymentNotices: [],
  };
}

function migrate(raw: AppDatabase): AppDatabase {
  return {
    ...raw,
    classes: (raw.classes || []).map((c) => ({
      ...c,
      teacherIds: c.teacherIds || [],
    })),
    users: (raw.users || []).map((u) => ({
      ...u,
      isManager: u.isManager ?? (u.role === 'teacher' ? false : undefined),
      isMuhasebe: u.isMuhasebe ?? (u.role === 'muhasebe' ? true : u.role === 'teacher' ? false : undefined),
      subjects: u.subjects || [],
    })),
    institutions: (raw.institutions || []).map((i) => ({
      ...i,
      paymentOverdueIntervalDays: i.paymentOverdueIntervalDays ?? 7,
    })),
    denemes: (raw.denemes || []).map((d) => ({
      ...d,
      source: d.source || 'institution',
      subjects: d.subjects || [],
    })),
    studyItems: (raw.studyItems || []).map((s) => ({
      ...s,
      dayOfWeek: typeof s.dayOfWeek === 'number' ? s.dayOfWeek : 0,
    })),
    messages: (raw.messages || []).map((m) => ({
      ...m,
      attachments: m.attachments || [],
    })),
    attendances: raw.attendances || [],
    lessonSchedules: raw.lessonSchedules || [],
    paymentNotices: raw.paymentNotices || [],
  };
}

export async function loadDb(): Promise<AppDatabase> {
  for (const key of OLD_KEYS) {
    await AsyncStorage.removeItem(key);
  }
  const raw = await AsyncStorage.getItem(DB_KEY);
  if (!raw) {
    // v2'den taşımayı dene
    const v2 = await AsyncStorage.getItem('dershane_db_v2');
    if (v2) {
      const migrated = migrate(JSON.parse(v2) as AppDatabase);
      // ilk öğretmenleri yönetici yap
      migrated.users = migrated.users.map((u) =>
        u.role === 'teacher' ? { ...u, isManager: true } : u
      );
      await AsyncStorage.setItem(DB_KEY, JSON.stringify(migrated));
      await AsyncStorage.removeItem('dershane_db_v2');
      return migrated;
    }
    const initial = seed();
    await AsyncStorage.setItem(DB_KEY, JSON.stringify(initial));
    return initial;
  }
  return migrate(JSON.parse(raw) as AppDatabase);
}

export async function saveDb(db: AppDatabase): Promise<void> {
  await AsyncStorage.setItem(DB_KEY, JSON.stringify(db));
}

export async function saveSession(userId: string): Promise<void> {
  await AsyncStorage.setItem(SESSION_KEY, userId);
}

export async function loadSession(): Promise<string | null> {
  return AsyncStorage.getItem(SESSION_KEY);
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(SESSION_KEY);
}

export { uid };
