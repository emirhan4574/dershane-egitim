import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AttendanceEntry,
  AttendanceSession,
  AppDatabase,
  ChatAttachment,
  ChatMessage,
  ClassGrade,
  ClassRoom,
  ClassTrack,
  DenemeResult,
  DenemeSubjectScore,
  Homework,
  HomeworkAttachment,
  HomeworkStatus,
  Institution,
  LessonSchedule,
  LessonSlot,
  StudyItem,
  UserAccount,
  buildClassName,
  isOrtaokulGrade,
  CLASS_TRACKS_MEZUN,
  PaymentType,
  PaymentNotice,
} from './types';
import { buildPaymentNoticeDraft } from './paymentNotices';
import { loadDb, saveDb, uid, loadSession, saveSession, clearSession } from './db';
import { ensureUzelClassStudents } from './seedUzelStudents';
import { ensureDenemeDershanesi } from './seedDenemeDershanesi';
import {
  apiBootstrap,
  apiHealth,
  apiLogin,
  apiLogout,
  apiRequest,
  getToken,
  setToken,
} from './apiClient';

type AuthContextValue = {
  ready: boolean;
  user: UserAccount | null;
  institution: Institution | null;
  institutions: Institution[];
  users: UserAccount[];
  classes: ClassRoom[];
  messages: ChatMessage[];
  denemes: DenemeResult[];
  homeworks: Homework[];
  homeworkStatuses: HomeworkStatus[];
  studyItems: StudyItem[];
  attendances: AttendanceSession[];
  lessonSchedules: LessonSchedule[];
  isManager: boolean;
  isMuhasebe: boolean;
  myClasses: ClassRoom[];
  paymentNotices: PaymentNotice[];
  login: (
    institutionCode: string,
    loginId: string,
    password: string,
    asRole?: 'superadmin' | 'teacher' | 'student',
    remember?: boolean
  ) => Promise<string | null>;
  logout: () => void;
  /** Süper admin: kurum/öğretmen/öğrenci ve tüm içerik silinir; yalnızca admin kalır */
  resetAllExceptAdmin: () => Promise<string | null>;
  /** dershane uzel: her sınıfa listeden 15 öğrenci (eksikse tamamlar) */
  seedUzelStudents: () => Promise<string | null>;
  /** Deneme dershanesi: branş×2 öğretmen + 9–12 A/B/C×bölüm + 10 öğrenci */
  seedDenemeDershanesi: () => Promise<string | null>;
  createInstitution: (input: {
    name: string;
    code: string;
    adminFullName: string;
    adminLoginId: string;
    adminPassword: string;
  }) => Promise<string | null>;
  setTeacherManager: (teacherId: string, isManager: boolean) => Promise<string | null>;
  setTeacherMuhasebe: (teacherId: string, isMuhasebe: boolean) => Promise<string | null>;
  updateInstitutionSettings: (input: {
    paymentOverdueIntervalDays: number;
    classPlacementSize?: number;
  }) => Promise<string | null>;
  addTeacher: (input: {
    fullName: string;
    loginId: string;
    password: string;
    subjects: string[];
    classIds: string[];
    isManager?: boolean;
    isMuhasebe?: boolean;
  }) => Promise<string | null>;
  removeTeacher: (teacherId: string) => Promise<string | null>;
  updateTeacher: (input: {
    teacherId: string;
    subjects: string[];
    classIds: string[];
    isManager?: boolean;
    isMuhasebe?: boolean;
  }) => Promise<string | null>;
  addStudent: (input: {
    tc: string;
    fullName: string;
    phone: string;
    parentName: string;
    parentPhone: string;
    classId: string;
    feeAmount: number;
    paymentType: PaymentType;
    installmentCount?: number;
    paymentDay: number;
    password?: string;
  }) => Promise<string | null>;
  updateStudent: (input: {
    studentId: string;
    fullName: string;
    phone: string;
    parentName: string;
    parentPhone: string;
    classId: string;
    feeAmount?: number;
    paymentType?: PaymentType;
    installmentCount?: number;
    paymentDay?: number;
  }) => Promise<string | null>;
  reassignStudentClasses: (
    updates: { studentId: string; classId: string }[]
  ) => Promise<{ ok: number; error: string | null }>;
  removeStudent: (studentId: string) => Promise<string | null>;
  addClass: (input: {
    grade: ClassGrade;
    section: string;
    track: ClassTrack;
  }) => Promise<string | null>;
  sendClassMessage: (
    classId: string,
    text: string,
    attachments?: ChatAttachment[],
    isHomeworkNotice?: boolean
  ) => Promise<string | null>;
  addDeneme: (input: {
    studentId: string;
    title: string;
    date: string;
    net: number;
    score: number;
    note?: string;
    source: 'institution' | 'student';
    documentUri?: string;
    documentName?: string;
    subjects?: DenemeSubjectScore[];
    studentName?: string;
    examType?: string;
    averageScore?: number;
    ranks?: import('./types').DenemeRank[];
    classGrade?: import('./types').ClassGrade;
    classSection?: string;
    classTrack?: import('./types').ClassTrack;
  }) => Promise<string | null>;
  addDenemesBulk: (
    items: {
      studentId: string;
      title: string;
      date: string;
      net: number;
      score: number;
      note?: string;
      documentUri?: string;
      documentName?: string;
      subjects?: DenemeSubjectScore[];
      studentName?: string;
      examType?: string;
      averageScore?: number;
      ranks?: import('./types').DenemeRank[];
      classGrade?: import('./types').ClassGrade;
      classSection?: string;
      classTrack?: import('./types').ClassTrack;
    }[]
  ) => Promise<{ ok: number; error: string | null }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<string | null>;
  addHomework: (input: {
    classId: string;
    lesson: string;
    topic: string;
    purpose: string;
    attachments: HomeworkAttachment[];
  }) => Promise<string | null>;
  setHomeworkCheck: (
    homeworkId: string,
    studentId: string,
    done: boolean,
    pointsAwarded: number
  ) => Promise<void>;
  addStudyItem: (input: {
    studentId: string;
    lesson: string;
    topic: string;
    dayOfWeek: number;
    time: string;
    durationHours: number;
    createdBy: 'student' | 'teacher';
  }) => Promise<void>;
  toggleStudyCompleted: (id: string) => Promise<void>;
  saveAttendanceSession: (input: {
    classId: string;
    date: string;
    subject: string;
    entries: AttendanceEntry[];
  }) => Promise<string | null>;
  saveLessonSchedule: (input: {
    targetType: 'teacher' | 'class';
    targetId: string;
    title?: string;
    slots: LessonSlot[];
  }) => Promise<string | null>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeCode(code: string) {
  return code.trim().toLowerCase().replace(/\s+/g, '-');
}

function emptyDb(): AppDatabase {
  return {
    institutions: [],
    users: [],
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

function applyLocalPaymentNotices(db: AppDatabase): AppDatabase {
  const notices = [...(db.paymentNotices || [])];
  let changed = false;
  for (const inst of db.institutions || []) {
    const interval = inst.paymentOverdueIntervalDays || 7;
    const students = (db.users || []).filter(
      (u) => u.institutionId === inst.id && u.role === 'student' && u.paymentDay
    );
    for (const st of students) {
      const draft = buildPaymentNoticeDraft(Number(st.paymentDay), interval);
      if (!draft) continue;
      if (notices.some((n) => n.studentId === st.id && n.periodKey === draft.periodKey)) continue;
      notices.push({
        id: uid('pay'),
        institutionId: inst.id,
        studentId: st.id,
        kind: draft.kind,
        message: draft.message,
        daysLate: draft.daysLate,
        periodKey: draft.periodKey,
        createdAt: new Date().toISOString(),
      });
      changed = true;
    }
  }
  if (!changed && (db.paymentNotices || []).length === notices.length) {
    return { ...db, paymentNotices: notices };
  }
  return { ...db, paymentNotices: notices };
}

function dataToDb(data: any): AppDatabase {
  return {
    institutions: data.institutions || [],
    users: (data.users || []).map((u: UserAccount) => ({ ...u, password: u.password || '' })),
    classes: data.classes || [],
    messages: data.messages || [],
    denemes: data.denemes || [],
    homeworks: data.homeworks || [],
    homeworkStatuses: data.homeworkStatuses || [],
    studyItems: data.studyItems || [],
    attendances: data.attendances || [],
    lessonSchedules: data.lessonSchedules || [],
    paymentNotices: data.paymentNotices || [],
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<UserAccount | null>(null);
  const [db, setDb] = useState<AppDatabase | null>(null);
  const [apiOnline, setApiOnline] = useState(false);

  const refreshFromApi = useCallback(async () => {
    const boot = await apiBootstrap();
    setUser(boot.user);
    setDb(dataToDb(boot.data));
    await saveSession(boot.user.id);
    return boot.user as UserAccount;
  }, []);

  const hydrate = useCallback(async () => {
    const healthy = await apiHealth();
    setApiOnline(healthy);

    if (healthy) {
      const token = await getToken();
      if (token) {
        try {
          await refreshFromApi();
          setReady(true);
          return;
        } catch {
          await setToken(null);
          await clearSession();
        }
      }
      setDb(emptyDb());
      setUser(null);
      setReady(true);
      return;
    }

    let loaded = await loadDb();
    const seeded = ensureUzelClassStudents(loaded, 15);
    if (seeded !== loaded) {
      loaded = seeded;
      await saveDb(loaded);
    }
    setDb(loaded);
    const sessionId = await loadSession();
    if (sessionId) {
      const sessionUser = loaded.users.find((u) => u.id === sessionId) || null;
      if (sessionUser) setUser(sessionUser);
      else await clearSession();
    }
    setReady(true);
  }, [refreshFromApi]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const persist = useCallback(async (next: AppDatabase) => {
    setDb(next);
    if (!apiOnline) await saveDb(next);
  }, [apiOnline]);

  const institution = useMemo(() => {
    if (!db || !user?.institutionId) return null;
    return db.institutions.find((i) => i.id === user.institutionId) || null;
  }, [db, user]);

  const isManager = !!(user?.role === 'teacher' && user.isManager);
  const isMuhasebe = !!(
    user?.role === 'muhasebe' ||
    (user?.role === 'teacher' && user.isMuhasebe)
  );

  const scoped = useMemo(() => {
    if (!db) {
      return {
        institutions: [] as Institution[],
        users: [] as UserAccount[],
        classes: [] as ClassRoom[],
        messages: [] as ChatMessage[],
        denemes: [] as DenemeResult[],
        homeworks: [] as Homework[],
        homeworkStatuses: [] as HomeworkStatus[],
        studyItems: [] as StudyItem[],
        attendances: [] as AttendanceSession[],
        lessonSchedules: [] as LessonSchedule[],
        paymentNotices: [] as PaymentNotice[],
      };
    }
    if (!user || user.role === 'superadmin') {
      return {
        institutions: db.institutions,
        users: db.users,
        classes: db.classes,
        messages: db.messages,
        denemes: db.denemes,
        homeworks: db.homeworks,
        homeworkStatuses: db.homeworkStatuses,
        studyItems: db.studyItems,
        attendances: db.attendances || [],
        lessonSchedules: db.lessonSchedules || [],
        paymentNotices: db.paymentNotices || [],
      };
    }
    const iid = user.institutionId;
    return {
      institutions: db.institutions.filter((i) => i.id === iid),
      users: db.users.filter((u) => u.institutionId === iid),
      classes: db.classes.filter((c) => c.institutionId === iid),
      messages: db.messages.filter((m) => m.institutionId === iid),
      denemes: db.denemes.filter((d) => d.institutionId === iid),
      homeworks: db.homeworks.filter((h) => h.institutionId === iid),
      homeworkStatuses: db.homeworkStatuses.filter((h) => h.institutionId === iid),
      studyItems: db.studyItems.filter((s) => s.institutionId === iid),
      attendances: (db.attendances || []).filter((a) => a.institutionId === iid),
      lessonSchedules: (db.lessonSchedules || []).filter((s) => s.institutionId === iid),
      paymentNotices: (db.paymentNotices || []).filter((n) => n.institutionId === iid),
    };
  }, [db, user]);

  const myClasses = useMemo(() => {
    if (!user || user.role !== 'teacher') return [];
    if (user.isManager) return scoped.classes;
    return scoped.classes.filter((c) => (c.teacherIds || []).includes(user.id));
  }, [user, scoped.classes]);

  const requireInstitutionId = useCallback(() => {
    if (!user?.institutionId || user.role === 'superadmin') return null;
    return user.institutionId;
  }, [user]);

  const requireManager = useCallback(() => {
    if (!user || user.role !== 'teacher' || !user.isManager) return 'Yönetici öğretmen yetkisi gerekli.';
    return null;
  }, [user]);

  const login = useCallback(
    async (
      institutionCode: string,
      loginId: string,
      password: string,
      asRole?: 'superadmin' | 'teacher' | 'student',
      remember = true
    ) => {
      const id = loginId.trim();
      const pass = password;

      if (apiOnline) {
        try {
          await apiLogin({
            institutionCode,
            loginId: id,
            password: pass,
            asRole,
          });
          await refreshFromApi();
          return null;
        } catch {
          // SQL API’de kullanıcı yoksa veya ağ hatası varsa yerel (AsyncStorage) girişe düş
        }
      }

      if (!db) return 'Sistem hazır değil. Masaüstü uygulamasında web sunucusunun açık olduğundan emin olun.';

      const applyUser = async (account: UserAccount) => {
        setUser(account);
        if (remember) await saveSession(account.id);
        else await clearSession();
      };

      if (!asRole || asRole === 'superadmin') {
        const superUser = db.users.find(
          (u) => u.role === 'superadmin' && u.loginId === id && u.password === pass
        );
        if (superUser) {
          if (asRole && asRole !== 'superadmin') {
            return 'Bu hesap platform yöneticisidir. Yönetici girişini kullanın.';
          }
          await applyUser(superUser);
          return null;
        }
        if (asRole === 'superadmin') return 'Yönetici kullanıcı adı veya şifre hatalı.';
      }

      const code = normalizeCode(institutionCode);
      if (!code) return 'Kurum kodu gerekli.';
      const inst = db.institutions.find((i) => i.code === code);
      if (!inst) return 'Kurum bulunamadı. Kodu kontrol edin.';

      const found = db.users.find((u) => {
        if (u.institutionId !== inst.id || u.loginId.trim() !== id || u.password !== pass) {
          return false;
        }
        if (asRole === 'student') return u.role === 'student';
        if (asRole === 'teacher') return u.role === 'teacher' || u.role === 'muhasebe';
        return u.role === 'teacher' || u.role === 'student' || u.role === 'muhasebe';
      });
      if (!found) {
        if (asRole === 'student') return 'Öğrenci T.C. veya şifre hatalı.';
        if (asRole === 'teacher') return 'Öğretmen / muhasebe kullanıcı veya şifre hatalı.';
        return 'Kullanıcı adı veya şifre hatalı.';
      }
      await applyUser(found);
      return null;
    },
    [db, apiOnline, refreshFromApi]
  );

  const logout = useCallback(() => {
    setUser(null);
    void clearSession();
    void apiLogout();
    if (apiOnline) setDb(emptyDb());
  }, [apiOnline]);

  const resetAllExceptAdmin = useCallback(async () => {
    if (!db || user?.role !== 'superadmin') return 'Yetkiniz yok.';
    const admins = db.users.filter((u) => u.role === 'superadmin');
    const now = new Date().toISOString();
    const nextUsers =
      admins.length > 0
        ? admins
        : [
            {
              id: uid('usr'),
              role: 'superadmin' as const,
              fullName: 'Platform Admin',
              loginId: 'admin',
              password: 'admin123',
              points: 0,
              createdAt: now,
            },
          ];
    await persist({
      institutions: [],
      users: nextUsers,
      classes: [],
      messages: [],
      denemes: [],
      homeworks: [],
      homeworkStatuses: [],
      studyItems: [],
      attendances: [],
      lessonSchedules: [],
      paymentNotices: [],
    });
    return null;
  }, [db, user, persist]);

  const seedUzelStudents = useCallback(async () => {
    if (!db) return 'Sistem hazır değil.';
    if (user?.role !== 'teacher' && user?.role !== 'superadmin') return 'Yetkiniz yok.';
    const next = ensureUzelClassStudents(db, 15);
    if (next === db) {
      const hasUzel = (db.institutions || []).some((i) =>
        `${i.name} ${i.code}`.toLocaleLowerCase('tr').includes('uzel')
      );
      if (!hasUzel) return 'dershane uzel kurumu bulunamadı (ad veya kodda "uzel" olmalı).';
      return 'Sınıflar zaten 15 öğrenciye tamamlanmış görünüyor.';
    }
    await persist(next);
    return null;
  }, [db, user, persist]);

  const seedDenemeDershanesi = useCallback(async () => {
    if (user?.role !== 'superadmin' && !(user?.role === 'teacher' && user.isManager)) {
      return 'Platform yöneticisi veya yönetici öğretmen gerekli.';
    }
    if (apiOnline) {
      try {
        await apiRequest('/seed/deneme', { method: 'POST', body: { rebuildStudents: true } });
        await refreshFromApi();
        return null;
      } catch {
        // API yoksa yerel veritabanına yaz
      }
    }
    if (!db) return 'Sistem hazır değil.';
    const { db: next } = ensureDenemeDershanesi(db, { rebuildStudents: true });
    setDb(next);
    await saveDb(next);
    return null;
  }, [db, user, apiOnline, refreshFromApi]);

  const createInstitution = useCallback(
    async (input: {
      name: string;
      code: string;
      adminFullName: string;
      adminLoginId: string;
      adminPassword: string;
    }) => {
      if (apiOnline) {
        try {
          await apiRequest('/institutions', { method: 'POST', body: input });
          await refreshFromApi();
          return null;
        } catch (e: any) {
          return e?.message || 'Kurum oluşturulamadı.';
        }
      }
      if (!db || user?.role !== 'superadmin') return 'Yetkiniz yok.';
      const name = input.name.trim();
      const code = normalizeCode(input.code);
      const adminLoginId = input.adminLoginId.trim();
      if (!name) return 'Kurum adı gerekli.';
      if (!code) return 'Kurum kodu gerekli.';
      if (!/^[a-z0-9-]+$/.test(code)) return 'Kurum kodu sadece harf, rakam ve tire olabilir.';
      if (db.institutions.some((i) => i.code === code)) return 'Bu kurum kodu zaten var.';
      if (!adminLoginId) return 'Yönetici öğretmen kullanıcı adı gerekli.';
      if (input.adminPassword.trim().length < 4) return 'Şifre en az 4 karakter olmalı.';

      const now = new Date().toISOString();
      const institutionId = uid('inst');
      const inst: Institution = { id: institutionId, name, code, createdAt: now };
      const teacher: UserAccount = {
        id: uid('usr'),
        role: 'teacher',
        institutionId,
        fullName: input.adminFullName.trim() || 'Yönetici Öğretmen',
        loginId: adminLoginId,
        password: input.adminPassword.trim(),
        isManager: true,
        subjects: [],
        points: 0,
        createdAt: now,
      };

      await persist({
        ...db,
        institutions: [...db.institutions, inst],
        users: [...db.users, teacher],
      });
      return null;
    },
    [db, user, persist]
  );

  const setTeacherManager = useCallback(
    async (teacherId: string, nextManager: boolean) => {
      if (apiOnline) {
        try {
          await apiRequest(`/teachers/${teacherId}/manager`, {
            method: 'POST',
            body: { isManager: nextManager },
          });
          await refreshFromApi();
          return null;
        } catch (e: any) {
          return e?.message || 'Yetki güncellenemedi.';
        }
      }
      if (!db || user?.role !== 'superadmin') return 'Yetkiniz yok.';
      const nextUsers = db.users.map((u) =>
        u.id === teacherId && u.role === 'teacher' ? { ...u, isManager: nextManager } : u
      );
      await persist({ ...db, users: nextUsers });
      return null;
    },
    [db, user, persist]
  );


  const setTeacherMuhasebe = useCallback(
    async (teacherId: string, nextMuhasebe: boolean) => {
      if (apiOnline) {
        try {
          await apiRequest(`/teachers/${teacherId}/muhasebe`, {
            method: 'POST',
            body: { isMuhasebe: nextMuhasebe },
          });
          await refreshFromApi();
          return null;
        } catch (e: any) {
          return e?.message || 'Muhasebe yetkisi güncellenemedi.';
        }
      }
      if (!db) return 'Sistem hazır değil.';
      if (!(user?.role === 'superadmin' || (user?.role === 'teacher' && user.isManager))) {
        return 'Yönetici öğretmen veya platform yöneticisi gerekli.';
      }
      const nextUsers = db.users.map((u) =>
        u.id === teacherId && u.role === 'teacher' ? { ...u, isMuhasebe: nextMuhasebe } : u
      );
      await persist({ ...db, users: nextUsers });
      if (user?.id === teacherId) {
        const refreshed = nextUsers.find((u) => u.id === user.id);
        if (refreshed) setUser(refreshed);
      }
      return null;
    },
    [db, user, persist, apiOnline, refreshFromApi]
  );

  const updateInstitutionSettings = useCallback(
    async (input: { paymentOverdueIntervalDays: number; classPlacementSize?: number }) => {
      const days = Number(input.paymentOverdueIntervalDays);
      if (!Number.isFinite(days) || days < 1 || days > 60) {
        return 'Gecikme aralığı 1–60 gün olmalı.';
      }
      let size =
        input.classPlacementSize != null
          ? Number(input.classPlacementSize)
          : undefined;
      if (size != null && (!Number.isFinite(size) || size < 1 || size > 50)) {
        return 'Şube kotası 1–50 arası olmalı.';
      }
      if (size != null) size = Math.round(size);
      if (apiOnline) {
        try {
          await apiRequest('/institutions/settings', {
            method: 'PATCH',
            body: {
              paymentOverdueIntervalDays: Math.round(days),
              ...(size != null ? { classPlacementSize: size } : {}),
            },
          });
          await refreshFromApi();
          return null;
        } catch (e: any) {
          return e?.message || 'Kurum ayarı güncellenemedi.';
        }
      }
      if (!db || !user?.institutionId) return 'Kurum bulunamadı.';
      if (!(user.isManager || user.isMuhasebe || user.role === 'muhasebe')) {
        return 'Yetkiniz yok.';
      }
      const institutions = db.institutions.map((i) =>
        i.id === user.institutionId
          ? {
              ...i,
              paymentOverdueIntervalDays: Math.round(days),
              ...(size != null ? { classPlacementSize: size } : {}),
            }
          : i
      );
      let next = { ...db, institutions };
      next = applyLocalPaymentNotices(next);
      await persist(next);
      return null;
    },
    [db, user, persist, apiOnline, refreshFromApi]
  );

  const addTeacher = useCallback(
    async (input: {
      fullName: string;
      loginId: string;
      password: string;
      subjects: string[];
      classIds: string[];
      isManager?: boolean;
      isMuhasebe?: boolean;
    }) => {
      if (apiOnline) {
        try {
          await apiRequest('/teachers', { method: 'POST', body: input });
          await refreshFromApi();
          return null;
        } catch (e: any) {
          return e?.message || 'Öğretmen eklenemedi.';
        }
      }
      if (!db) return 'Sistem hazır değil.';
      const denied = requireManager();
      if (denied) return denied;
      const institutionId = requireInstitutionId();
      if (!institutionId) return 'Kurum bulunamadı.';
      const loginId = input.loginId.trim();
      if (!loginId) return 'Kullanıcı adı gerekli.';
      if (db.users.some((u) => u.institutionId === institutionId && u.loginId === loginId)) {
        return 'Bu kullanıcı adı kurumda zaten var.';
      }
      if (input.password.trim().length < 4) return 'Şifre en az 4 karakter olmalı.';

      const teacherId = uid('usr');
      const teacher: UserAccount = {
        id: teacherId,
        role: 'teacher',
        institutionId,
        fullName: input.fullName.trim(),
        loginId,
        password: input.password.trim(),
        isManager: !!input.isManager,
        isMuhasebe: !!input.isMuhasebe,
        subjects: input.subjects.map((s) => s.trim()).filter(Boolean),
        points: 0,
        createdAt: new Date().toISOString(),
      };

      const nextClasses = db.classes.map((c) => {
        if (c.institutionId !== institutionId) return c;
        if (!input.classIds.includes(c.id)) return c;
        const teacherIds = Array.from(new Set([...(c.teacherIds || []), teacherId]));
        return { ...c, teacherIds };
      });

      await persist({ ...db, users: [...db.users, teacher], classes: nextClasses });
      return null;
    },
    [db, persist, requireManager, requireInstitutionId, apiOnline, refreshFromApi]
  );

  const removeTeacher = useCallback(
    async (teacherId: string) => {
      if (apiOnline) {
        try {
          await apiRequest(`/teachers/${teacherId}`, { method: 'DELETE' });
          await refreshFromApi();
          return null;
        } catch (e: any) {
          return e?.message || 'Öğretmen silinemedi.';
        }
      }
      if (!db) return 'Sistem hazır değil.';
      const denied = requireManager();
      if (denied) return denied;
      const institutionId = requireInstitutionId();
      if (!institutionId) return 'Kurum bulunamadı.';
      if (teacherId === user?.id) return 'Kendinizi silemezsiniz.';
      const target = db.users.find((u) => u.id === teacherId);
      if (!target || target.institutionId !== institutionId || target.role !== 'teacher') {
        return 'Öğretmen bulunamadı.';
      }
      await persist({
        ...db,
        users: db.users.filter((u) => u.id !== teacherId),
        classes: db.classes.map((c) => ({
          ...c,
          teacherIds: (c.teacherIds || []).filter((id) => id !== teacherId),
        })),
      });
      return null;
    },
    [db, user, persist, requireManager, requireInstitutionId, apiOnline, refreshFromApi]
  );

  const updateTeacher = useCallback(
    async (input: {
      teacherId: string;
      subjects: string[];
      classIds: string[];
      isManager?: boolean;
      isMuhasebe?: boolean;
    }) => {
      if (apiOnline) {
        try {
          await apiRequest(`/teachers/${input.teacherId}`, {
            method: 'PATCH',
            body: {
              subjects: input.subjects,
              classIds: input.classIds,
              isManager: input.isManager,
              isMuhasebe: input.isMuhasebe,
            },
          });
          await refreshFromApi();
          return null;
        } catch (e: any) {
          return e?.message || 'Öğretmen güncellenemedi.';
        }
      }
      if (!db) return 'Sistem hazır değil.';
      const denied = requireManager();
      if (denied) return denied;
      const institutionId = requireInstitutionId();
      if (!institutionId) return 'Kurum bulunamadı.';

      const nextUsers = db.users.map((u) => {
        if (u.id !== input.teacherId || u.institutionId !== institutionId) return u;
        return {
          ...u,
          subjects: input.subjects.map((s) => s.trim()).filter(Boolean),
          isManager: input.isManager ?? u.isManager,
          isMuhasebe: input.isMuhasebe ?? u.isMuhasebe,
        };
      });

      const nextClasses = db.classes.map((c) => {
        if (c.institutionId !== institutionId) return c;
        const without = (c.teacherIds || []).filter((id) => id !== input.teacherId);
        if (input.classIds.includes(c.id)) {
          return { ...c, teacherIds: [...without, input.teacherId] };
        }
        return { ...c, teacherIds: without };
      });

      await persist({ ...db, users: nextUsers, classes: nextClasses });
      if (user?.id === input.teacherId) {
        const refreshed = nextUsers.find((u) => u.id === user.id);
        if (refreshed) setUser(refreshed);
      }
      return null;
    },
    [db, user, persist, requireManager, requireInstitutionId]
  );

  const addStudent = useCallback(
    async (input: {
      tc: string;
      fullName: string;
      phone: string;
      parentName: string;
      parentPhone: string;
      classId: string;
      feeAmount: number;
      paymentType: PaymentType;
      installmentCount?: number;
      paymentDay: number;
      password?: string;
    }) => {
      if (apiOnline) {
        try {
          await apiRequest('/students', { method: 'POST', body: input });
          await refreshFromApi();
          return null;
        } catch (e: any) {
          return e?.message || 'Öğrenci eklenemedi.';
        }
      }
      if (!db || user?.role !== 'teacher') return 'Yetkiniz yok.';
      const institutionId = requireInstitutionId();
      if (!institutionId) return 'Kurum bulunamadı.';
      if (!user.isManager) {
        const allowed = db.classes.some(
          (c) => c.id === input.classId && (c.teacherIds || []).includes(user.id)
        );
        if (!allowed) return 'Bu sınıfa öğrenci ekleme yetkiniz yok.';
      }
      const tc = input.tc.trim();
      if (!/^\d{11}$/.test(tc)) return 'T.C. Kimlik No 11 haneli olmalıdır.';
      if (db.users.some((u) => u.institutionId === institutionId && u.loginId === tc)) {
        return 'Bu T.C. bu kurumda zaten kayıtlı.';
      }
      const cls = db.classes.find((c) => c.id === input.classId && c.institutionId === institutionId);
      if (!cls) return 'Sınıf seçiniz.';
      const parentName = input.parentName.trim();
      if (!parentName) return 'Veli adı soyadı gerekli.';
      if (!input.parentPhone.trim()) return 'Veli telefonu gerekli.';
      const fee = Number(input.feeAmount);
      if (!Number.isFinite(fee) || fee <= 0) return 'Alınacak ücret giriniz.';
      if (!['cash', 'installment', 'credit_card'].includes(input.paymentType)) {
        return 'Ödeme tipi seçiniz.';
      }
      let installmentCount: number | undefined;
      if (input.paymentType === 'installment') {
        const n = Number(input.installmentCount);
        if (!Number.isFinite(n) || n < 2 || n > 48) return 'Taksit sayısı 2–48 arasında olmalı.';
        installmentCount = n;
      }
      const pDay = Number(input.paymentDay);
      if (!Number.isFinite(pDay) || pDay < 1 || pDay > 28) return 'Ödeme günü 1–28 arasında olmalı.';
      const student: UserAccount = {
        id: uid('usr'),
        role: 'student',
        institutionId,
        fullName: input.fullName.trim(),
        loginId: tc,
        password: input.password?.trim() || tc.slice(-6),
        phone: input.phone.trim(),
        parentName,
        parentPhone: input.parentPhone.trim(),
        classId: cls.id,
        className: cls.name,
        feeAmount: fee,
        paymentType: input.paymentType,
        installmentCount,
        paymentDay: pDay,
        points: 0,
        createdAt: new Date().toISOString(),
      };
      let next = { ...db, users: [...db.users, student] };
      next = applyLocalPaymentNotices(next);
      await persist(next);
      return null;
    },
    [db, user, persist, requireInstitutionId, apiOnline, refreshFromApi]
  );

  const updateStudent = useCallback(
    async (input: {
      studentId: string;
      fullName: string;
      phone: string;
      parentName: string;
      parentPhone: string;
      classId: string;
      feeAmount?: number;
      paymentType?: PaymentType;
      installmentCount?: number;
      paymentDay?: number;
    }) => {
      if (apiOnline) {
        try {
          await apiRequest(`/students/${input.studentId}`, { method: 'PATCH', body: input });
          await refreshFromApi();
          return null;
        } catch (e: any) {
          return e?.message || 'Öğrenci güncellenemedi.';
        }
      }
      if (!db || user?.role !== 'teacher') return 'Yetkiniz yok.';
      const institutionId = requireInstitutionId();
      if (!institutionId) return 'Kurum bulunamadı.';

      const cls = db.classes.find((c) => c.id === input.classId && c.institutionId === institutionId);
      if (!cls) return 'Sınıf seçiniz.';
      const fullName = input.fullName.trim();
      if (!fullName) return 'Ad soyad gerekli.';

      let next = {
        ...db,
        users: db.users.map((u) => {
          if (u.id !== input.studentId) return u;
          const paymentType = input.paymentType ?? u.paymentType;
          let installmentCount =
            input.installmentCount != null ? Number(input.installmentCount) : u.installmentCount;
          if (paymentType === 'installment') {
            if (!Number.isFinite(Number(installmentCount)) || Number(installmentCount) < 2) {
              installmentCount = u.installmentCount;
            }
          } else {
            installmentCount = undefined;
          }
          return {
            ...u,
            fullName,
            phone: input.phone.trim(),
            parentName: input.parentName.trim(),
            parentPhone: input.parentPhone.trim(),
            classId: cls.id,
            className: cls.name,
            feeAmount: input.feeAmount != null ? Number(input.feeAmount) : u.feeAmount,
            paymentType,
            installmentCount,
            paymentDay: input.paymentDay != null ? Number(input.paymentDay) : u.paymentDay,
          };
        }),
      };
      next = applyLocalPaymentNotices(next);
      await persist(next);
      return null;
    },
    [db, user, persist, requireInstitutionId, apiOnline, refreshFromApi]
  );

  /** Yalnızca sınıf değişimi — diğer alanlar korunur */
  const reassignStudentClasses = useCallback(
    async (updates: { studentId: string; classId: string }[]) => {
      if (!updates.length) return { ok: 0, error: null as string | null };
      let ok = 0;
      for (const u of updates) {
        const st = db?.users.find((x) => x.id === u.studentId && x.role === 'student');
        if (!st) {
          return { ok, error: `Öğrenci bulunamadı (${u.studentId}).` };
        }
        const err = await updateStudent({
          studentId: u.studentId,
          fullName: st.fullName,
          phone: st.phone || '',
          parentName: st.parentName || '',
          parentPhone: st.parentPhone || '',
          classId: u.classId,
          feeAmount: st.feeAmount,
          paymentType: st.paymentType,
          installmentCount: st.installmentCount,
          paymentDay: st.paymentDay,
        });
        if (err) return { ok, error: err };
        ok += 1;
      }
      return { ok, error: null as string | null };
    },
    [db, updateStudent]
  );

  const removeStudent = useCallback(
    async (studentId: string) => {
      if (apiOnline) {
        try {
          await apiRequest(`/students/${studentId}`, { method: 'DELETE' });
          await refreshFromApi();
          return null;
        } catch (e: any) {
          return e?.message || 'Öğrenci silinemedi.';
        }
      }
      if (!db || user?.role !== 'teacher') return 'Yetkiniz yok.';
      const institutionId = requireInstitutionId();
      if (!institutionId) return 'Kurum bulunamadı.';
      const student = db.users.find((u) => u.id === studentId && u.role === 'student');
      if (!student || student.institutionId !== institutionId) return 'Öğrenci bulunamadı.';
      if (!user.isManager) {
        const allowed = db.classes.some(
          (c) => c.id === student.classId && (c.teacherIds || []).includes(user.id)
        );
        if (!allowed) return 'Bu öğrenciyi silme yetkiniz yok.';
      }
      await persist({
        ...db,
        users: db.users.filter((u) => u.id !== studentId),
        denemes: db.denemes.filter((d) => d.studentId !== studentId),
        studyItems: db.studyItems.filter((s) => s.studentId !== studentId),
        homeworkStatuses: db.homeworkStatuses.filter((h) => h.studentId !== studentId),
      });
      return null;
    },
    [db, user, persist, requireInstitutionId]
  );

  const addClass = useCallback(
    async (input: { grade: ClassGrade; section: string; track: ClassTrack }) => {
      if (apiOnline) {
        try {
          await apiRequest('/classes', { method: 'POST', body: input });
          await refreshFromApi();
          return null;
        } catch (e: any) {
          return e?.message || 'Sınıf eklenemedi.';
        }
      }
      if (!db) return 'Sistem hazır değil.';
      const denied = requireManager();
      if (denied) return denied;
      const institutionId = requireInstitutionId();
      if (!institutionId) return 'Kurum bulunamadı.';

      const section = input.section.trim().toUpperCase();
      if (!section) return 'Şube seçin.';

      let track = input.track;
      if (isOrtaokulGrade(input.grade)) {
        track = 'ortaokul';
      } else if (input.grade === 'mezun') {
        if (!CLASS_TRACKS_MEZUN.includes(track)) {
          return 'Mezun için Sayısal, Eşit Ağırlık veya Sözel seçin.';
        }
      } else if (track === 'ortaokul') {
        return 'Lise veya mezun için alan (sayısal / sözel / eşit ağırlık / dil) seçin.';
      }

      const name = buildClassName(input.grade, section, track);
      const dup = db.classes.some(
        (c) =>
          c.institutionId === institutionId &&
          c.grade === input.grade &&
          (c.section || '').toUpperCase() === section &&
          c.track === track
      );
      if (dup) return 'Bu sınıf + şube + alan zaten kayıtlı.';

      const room: ClassRoom = {
        id: uid('cls'),
        institutionId,
        name,
        grade: input.grade,
        section,
        track,
        teacherIds: [],
        createdAt: new Date().toISOString(),
      };
      await persist({ ...db, classes: [...db.classes, room] });
      return null;
    },
    [db, persist, requireManager, requireInstitutionId]
  );

  const sendClassMessage = useCallback(
    async (
      classId: string,
      text: string,
      attachments: ChatAttachment[] = [],
      isHomeworkNotice = false
    ) => {
      if (apiOnline) {
        try {
          await apiRequest('/chat/messages', {
            method: 'POST',
            body: { classId, text, attachments, isHomeworkNotice },
          });
          await refreshFromApi();
          return null;
        } catch (e: any) {
          return e?.message || 'Mesaj gönderilemedi.';
        }
      }
      if (!db || user?.role !== 'teacher') return 'Sadece öğretmen mesaj gönderebilir.';
      const institutionId = requireInstitutionId();
      if (!institutionId) return 'Kurum bulunamadı.';
      const cls = db.classes.find((c) => c.id === classId && c.institutionId === institutionId);
      if (!cls) return 'Sınıf bulunamadı.';
      if (!user.isManager && !(cls.teacherIds || []).includes(user.id)) {
        return 'Bu sınıfa mesaj yetkiniz yok.';
      }
      if (!text.trim() && attachments.length === 0) return 'Mesaj veya belge gerekli.';
      const msg: ChatMessage = {
        id: uid('msg'),
        institutionId,
        classId,
        senderId: user.id,
        senderName: user.fullName,
        text: text.trim() || (attachments.length ? 'Belge gönderildi' : ''),
        attachments,
        createdAt: new Date().toISOString(),
        isHomeworkNotice,
      };
      await persist({ ...db, messages: [...db.messages, msg] });
      return null;
    },
    [db, user, persist, requireInstitutionId]
  );

  const addDeneme = useCallback(
    async (input: {
      studentId: string;
      title: string;
      date: string;
      net: number;
      score: number;
      note?: string;
      source: 'institution' | 'student';
      documentUri?: string;
      documentName?: string;
      subjects?: DenemeSubjectScore[];
      studentName?: string;
      examType?: string;
      averageScore?: number;
      ranks?: import('./types').DenemeRank[];
      classGrade?: import('./types').ClassGrade;
      classSection?: string;
      classTrack?: import('./types').ClassTrack;
    }) => {
      if (apiOnline) {
        try {
          await apiRequest('/denemes', { method: 'POST', body: input });
          await refreshFromApi();
          return null;
        } catch (e: any) {
          return e?.message || 'Deneme eklenemedi.';
        }
      }
      if (!db || !user) return 'Oturum bulunamadı.';
      const institutionId = requireInstitutionId();
      if (!institutionId) return 'Kurum bulunamadı.';
      if (input.source === 'institution' && user.role !== 'teacher') {
        return 'Kurum denemesini yalnızca öğretmen ekleyebilir.';
      }
      if (input.source === 'student' && user.role === 'student' && input.studentId !== user.id) {
        return 'Sadece kendi denemenizi ekleyebilirsiniz.';
      }
      const student = db.users.find(
        (u) => u.id === input.studentId && u.institutionId === institutionId && u.role === 'student'
      );
      if (!student) return 'Öğrenci bulunamadı.';
      if (!input.title.trim()) return 'Deneme adı gerekli.';
      const cls = db.classes.find((c) => c.id === student.classId);
      const row: DenemeResult = {
        id: uid('den'),
        institutionId,
        studentId: input.studentId,
        title: input.title.trim(),
        date: input.date,
        net: input.net,
        score: input.score,
        note: input.note?.trim(),
        source: input.source,
        documentUri: input.documentUri,
        documentName: input.documentName,
        subjects: input.subjects || [],
        studentName: input.studentName,
        examType: input.examType,
        averageScore: input.averageScore,
        ranks: input.ranks || [],
        classGrade: input.classGrade ?? cls?.grade,
        classSection: input.classSection ?? cls?.section,
        classTrack: input.classTrack ?? cls?.track,
        createdAt: new Date().toISOString(),
      };
      await persist({ ...db, denemes: [...db.denemes, row] });
      return null;
    },
    [db, user, persist, requireInstitutionId]
  );

  const addDenemesBulk = useCallback(
    async (
      items: {
        studentId: string;
        title: string;
        date: string;
        net: number;
        score: number;
        note?: string;
        documentUri?: string;
        documentName?: string;
        subjects?: DenemeSubjectScore[];
        studentName?: string;
        examType?: string;
        averageScore?: number;
        ranks?: import('./types').DenemeRank[];
        classGrade?: import('./types').ClassGrade;
        classSection?: string;
        classTrack?: import('./types').ClassTrack;
      }[]
    ) => {
      if (apiOnline) {
        try {
          const r = await apiRequest<{ ok: number; error: string | null }>('/denemes/bulk', {
            method: 'POST',
            body: { items },
          });
          await refreshFromApi();
          return { ok: r.ok, error: r.error };
        } catch (e: any) {
          return { ok: 0, error: e?.message || 'Toplu kayıt başarısız.' };
        }
      }
      if (!db || !user) return { ok: 0, error: 'Oturum bulunamadı.' };
      const institutionId = requireInstitutionId();
      if (!institutionId) return { ok: 0, error: 'Kurum bulunamadı.' };
      if (user.role !== 'teacher') {
        return { ok: 0, error: 'Toplu deneme yalnızca öğretmen ekleyebilir.' };
      }
      if (!items.length) return { ok: 0, error: 'Kayıt edilecek satır yok.' };

      const created: DenemeResult[] = [];
      for (const input of items) {
        const student = db.users.find(
          (u) =>
            u.id === input.studentId && u.institutionId === institutionId && u.role === 'student'
        );
        if (!student) continue;
        if (!input.title.trim()) continue;
        if (!Number.isFinite(input.net) || !Number.isFinite(input.score)) continue;
        const cls = db.classes.find((c) => c.id === student.classId);
        created.push({
          id: uid('den'),
          institutionId,
          studentId: input.studentId,
          title: input.title.trim(),
          date: input.date || new Date().toISOString().slice(0, 10),
          net: input.net,
          score: input.score,
          note: input.note?.trim(),
          source: 'institution',
          documentUri: input.documentUri,
          documentName: input.documentName,
          subjects: input.subjects || [],
          studentName: input.studentName || student.fullName,
          examType: input.examType,
          averageScore: input.averageScore,
          ranks: input.ranks || [],
          classGrade: input.classGrade ?? cls?.grade,
          classSection: input.classSection ?? cls?.section,
          classTrack: input.classTrack ?? cls?.track,
          createdAt: new Date().toISOString(),
        });
      }

      if (!created.length) return { ok: 0, error: 'Geçerli eşleşen satır bulunamadı.' };
      await persist({ ...db, denemes: [...db.denemes, ...created] });
      return { ok: created.length, error: null };
    },
    [db, user, persist, requireInstitutionId]
  );

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (apiOnline) {
        try {
          await apiRequest('/auth/change-password', {
            method: 'POST',
            body: { currentPassword, newPassword },
          });
          return null;
        } catch (e: any) {
          return e?.message || 'Şifre değiştirilemedi.';
        }
      }
      if (!db || !user) return 'Oturum bulunamadı.';
      if (user.password !== currentPassword) return 'Mevcut şifre hatalı.';
      if (newPassword.trim().length < 4) return 'Yeni şifre en az 4 karakter olmalı.';
      const nextUsers = db.users.map((u) =>
        u.id === user.id ? { ...u, password: newPassword.trim() } : u
      );
      setUser({ ...user, password: newPassword.trim() });
      await persist({ ...db, users: nextUsers });
      return null;
    },
    [db, user, persist, apiOnline]
  );

  const addHomework = useCallback(
    async (input: {
      classId: string;
      lesson: string;
      topic: string;
      purpose: string;
      attachments: HomeworkAttachment[];
    }) => {
      if (apiOnline) {
        try {
          await apiRequest('/homeworks', { method: 'POST', body: input });
          await refreshFromApi();
          return null;
        } catch (e: any) {
          return e?.message || 'Ödev gönderilemedi.';
        }
      }
      if (!db || user?.role !== 'teacher') return 'Yetkiniz yok.';
      const institutionId = requireInstitutionId();
      if (!institutionId) return 'Kurum bulunamadı.';
      const cls = db.classes.find((c) => c.id === input.classId && c.institutionId === institutionId);
      if (!cls) return 'Sınıf bulunamadı.';
      if (!user.isManager && !(cls.teacherIds || []).includes(user.id)) {
        return 'Bu sınıfa ödev yetkiniz yok.';
      }
      const hw: Homework = {
        id: uid('hw'),
        institutionId,
        classId: cls.id,
        className: cls.name,
        lesson: input.lesson.trim(),
        topic: input.topic.trim(),
        purpose: input.purpose.trim(),
        attachments: input.attachments,
        createdAt: new Date().toISOString(),
        createdBy: user.id,
      };
      const students = db.users.filter(
        (u) => u.role === 'student' && u.institutionId === institutionId && u.classId === cls.id
      );
      const statuses: HomeworkStatus[] = students.map((s) => ({
        id: uid('hws'),
        institutionId,
        homeworkId: hw.id,
        studentId: s.id,
        done: null,
        pointsAwarded: 0,
      }));
      const notice: ChatMessage = {
        id: uid('msg'),
        institutionId,
        classId: cls.id,
        senderId: user.id,
        senderName: user.fullName,
        text: `Yeni ödev: ${hw.lesson} — ${hw.topic}`,
        createdAt: new Date().toISOString(),
        isHomeworkNotice: true,
        attachments: input.attachments.map((a) => ({
          type: a.type === 'video' ? 'file' : a.type === 'link' ? 'link' : a.type === 'image' ? 'image' : 'pdf',
          label: a.label,
          uri: a.uri,
        })),
      };
      await persist({
        ...db,
        homeworks: [...db.homeworks, hw],
        homeworkStatuses: [...db.homeworkStatuses, ...statuses],
        messages: [...db.messages, notice],
      });
      return null;
    },
    [db, user, persist, requireInstitutionId]
  );

  const setHomeworkCheck = useCallback(
    async (homeworkId: string, studentId: string, done: boolean, pointsAwarded: number) => {
      if (apiOnline) {
        try {
          await apiRequest(`/homeworks/${homeworkId}/check`, {
            method: 'POST',
            body: { studentId, done, pointsAwarded },
          });
          await refreshFromApi();
          return;
        } catch {
          return;
        }
      }
      if (!db || user?.role !== 'teacher') return;
      const institutionId = requireInstitutionId();
      if (!institutionId) return;

      const prev = db.homeworkStatuses.find(
        (s) =>
          s.homeworkId === homeworkId &&
          s.studentId === studentId &&
          s.institutionId === institutionId
      );

      let nextStatuses = db.homeworkStatuses;
      if (!prev) {
        nextStatuses = [
          ...db.homeworkStatuses,
          {
            id: uid('hws'),
            institutionId,
            homeworkId,
            studentId,
            done,
            pointsAwarded,
            checkedAt: new Date().toISOString(),
          },
        ];
      } else {
        nextStatuses = db.homeworkStatuses.map((s) =>
          s.homeworkId === homeworkId &&
          s.studentId === studentId &&
          s.institutionId === institutionId
            ? { ...s, done, pointsAwarded, checkedAt: new Date().toISOString() }
            : s
        );
      }

      const delta = pointsAwarded - (prev?.pointsAwarded || 0);
      const nextUsers = db.users.map((u) =>
        u.id === studentId && u.institutionId === institutionId
          ? { ...u, points: Math.max(0, u.points + delta) }
          : u
      );
      await persist({ ...db, homeworkStatuses: nextStatuses, users: nextUsers });
    },
    [db, user, persist, requireInstitutionId]
  );

  const addStudyItem = useCallback(
    async (input: {
      studentId: string;
      lesson: string;
      topic: string;
      dayOfWeek: number;
      time: string;
      durationHours: number;
      createdBy: 'student' | 'teacher';
    }) => {
      if (!db || !user) return;
      const institutionId = requireInstitutionId();
      if (!institutionId) return;
      const item: StudyItem = {
        id: uid('std'),
        institutionId,
        studentId: input.studentId,
        lesson: input.lesson.trim(),
        topic: input.topic.trim(),
        dayOfWeek: input.dayOfWeek,
        time: input.time.trim(),
        durationHours: input.durationHours,
        completed: false,
        createdBy: input.createdBy,
        createdAt: new Date().toISOString(),
      };
      await persist({ ...db, studyItems: [...db.studyItems, item] });
    },
    [db, user, persist, requireInstitutionId]
  );

  const toggleStudyCompleted = useCallback(
    async (id: string) => {
      if (!db || !user) return;
      const institutionId = requireInstitutionId();
      const next = db.studyItems.map((s) => {
        if (s.id !== id) return s;
        if (institutionId && s.institutionId !== institutionId) return s;
        return { ...s, completed: !s.completed };
      });
      await persist({ ...db, studyItems: next });
    },
    [db, user, persist, requireInstitutionId]
  );

  const saveAttendanceSession = useCallback(
    async (input: {
      classId: string;
      date: string;
      subject: string;
      entries: AttendanceEntry[];
    }) => {
      if (apiOnline) {
        try {
          await apiRequest('/attendance', { method: 'POST', body: input });
          await refreshFromApi();
          return null;
        } catch (e: any) {
          return e?.message || 'Yoklama kaydedilemedi.';
        }
      }
      if (!db || user?.role !== 'teacher') return 'Yetkiniz yok.';
      const institutionId = user.institutionId;
      if (!institutionId) return 'Kurum bulunamadı.';
      const cls = db.classes.find((c) => c.id === input.classId && c.institutionId === institutionId);
      if (!cls) return 'Sınıf bulunamadı.';
      if (!input.entries.length) return 'Öğrenci kaydı yok.';

      const session: AttendanceSession = {
        id: uid('att'),
        institutionId,
        classId: cls.id,
        className: cls.name,
        date: input.date || new Date().toISOString().slice(0, 10),
        teacherId: user.id,
        teacherName: user.fullName,
        subject: (input.subject || user.subjects?.[0] || 'Ders').trim(),
        entries: input.entries,
        createdAt: new Date().toISOString(),
      };
      await persist({
        ...db,
        attendances: [...(db.attendances || []), session],
      });
      return null;
    },
    [db, user, persist]
  );

  const saveLessonSchedule = useCallback(
    async (input: {
      targetType: 'teacher' | 'class';
      targetId: string;
      title?: string;
      slots: LessonSlot[];
    }) => {
      if (apiOnline) {
        try {
          await apiRequest('/schedules', { method: 'POST', body: input });
          await refreshFromApi();
          return null;
        } catch (e: any) {
          return e?.message || 'Program kaydedilemedi.';
        }
      }
      const canSendSchedule =
        user?.role === 'muhasebe' || (user?.role === 'teacher' && !!user.isMuhasebe);
      if (!db || !canSendSchedule) return 'Ders programı gönderme yalnızca muhasebe yetkilisi içindir.';
      const institutionId = requireInstitutionId();
      if (!institutionId) return 'Kurum bulunamadı.';
      if (!input.slots.length) return 'En az bir ders satırı ekleyin.';

      let targetName = '';
      if (input.targetType === 'teacher') {
        const t = db.users.find(
          (u) =>
            u.id === input.targetId &&
            u.role === 'teacher' &&
            u.institutionId === institutionId
        );
        if (!t) return 'Öğretmen bulunamadı.';
        targetName = t.fullName;
      } else {
        const cls = db.classes.find(
          (c) => c.id === input.targetId && c.institutionId === institutionId
        );
        if (!cls) return 'Sınıf bulunamadı.';
        targetName = cls.name;
      }

      const now = new Date().toISOString();
      const existing = (db.lessonSchedules || []).find(
        (s) =>
          s.institutionId === institutionId &&
          s.targetType === input.targetType &&
          s.targetId === input.targetId
      );

      const next: LessonSchedule = existing
        ? {
            ...existing,
            targetName,
            title: input.title?.trim() || existing.title,
            slots: input.slots,
            updatedAt: now,
            createdBy: user.id,
          }
        : {
            id: uid('sch'),
            institutionId,
            targetType: input.targetType,
            targetId: input.targetId,
            targetName,
            title: input.title?.trim() || undefined,
            slots: input.slots,
            createdAt: now,
            createdBy: user.id,
            updatedAt: now,
          };

      const lessonSchedules = existing
        ? (db.lessonSchedules || []).map((s) => (s.id === existing.id ? next : s))
        : [...(db.lessonSchedules || []), next];

      await persist({ ...db, lessonSchedules });
      return null;
    },
    [db, user, persist, requireInstitutionId]
  );

  const value = useMemo(
    () => ({
      ready,
      user,
      institution,
      institutions: scoped.institutions,
      users: scoped.users,
      classes: scoped.classes,
      messages: scoped.messages,
      denemes: scoped.denemes,
      homeworks: scoped.homeworks,
      homeworkStatuses: scoped.homeworkStatuses,
      studyItems: scoped.studyItems,
      attendances: scoped.attendances,
      lessonSchedules: scoped.lessonSchedules,
      paymentNotices: scoped.paymentNotices,
      isManager,
      isMuhasebe,
      myClasses,
      login,
      logout,
      resetAllExceptAdmin,
      seedUzelStudents,
      seedDenemeDershanesi,
      createInstitution,
      setTeacherManager,
      setTeacherMuhasebe,
      updateInstitutionSettings,
      addTeacher,
      removeTeacher,
      updateTeacher,
      addStudent,
      updateStudent,
      reassignStudentClasses,
      removeStudent,
      addClass,
      sendClassMessage,
      addDeneme,
      addDenemesBulk,
      changePassword,
      addHomework,
      setHomeworkCheck,
      addStudyItem,
      toggleStudyCompleted,
      saveAttendanceSession,
      saveLessonSchedule,
      refresh: hydrate,
    }),
    [
      ready,
      user,
      institution,
      scoped,
      isManager,
      isMuhasebe,
      myClasses,
      login,
      logout,
      resetAllExceptAdmin,
      seedUzelStudents,
      seedDenemeDershanesi,
      createInstitution,
      setTeacherManager,
      setTeacherMuhasebe,
      updateInstitutionSettings,
      addTeacher,
      removeTeacher,
      updateTeacher,
      addStudent,
      updateStudent,
      reassignStudentClasses,
      removeStudent,
      addClass,
      sendClassMessage,
      addDeneme,
      addDenemesBulk,
      changePassword,
      addHomework,
      setHomeworkCheck,
      addStudyItem,
      toggleStudyCompleted,
      saveAttendanceSession,
      saveLessonSchedule,
      hydrate,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth AuthProvider içinde kullanılmalı');
  return ctx;
}
