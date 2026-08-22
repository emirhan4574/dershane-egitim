export type Role = 'superadmin' | 'teacher' | 'student' | 'muhasebe';

export type Institution = {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  /** Gecikmiş ödeme hatırlatması kaç günde bir (varsayılan 7) */
  paymentOverdueIntervalDays?: number;
  /** Deneme listesine göre şube başına öğrenci (örn. 10 → ilk 10 A, sonraki 10 B) */
  classPlacementSize?: number;
};

/** 4–8 ortaokul, 9–12 lise, mezun */
export type ClassGrade = 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 'mezun';

/** Lise / mezun alanı; ortaokulda her zaman ortaokul */
export type ClassTrack = 'sayisal' | 'sozel' | 'esit_agirlik' | 'dil' | 'ortaokul';

export type ClassRoom = {
  id: string;
  institutionId: string;
  /** Görünen ad, örn: 11-A Sayısal */
  name: string;
  grade?: ClassGrade;
  section?: string;
  track?: ClassTrack;
  teacherIds: string[];
  createdAt: string;
};

export const CLASS_GRADES: ClassGrade[] = [4, 5, 6, 7, 8, 9, 10, 11, 12, 'mezun'];
export const CLASS_SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
/** Lise alan listelerinde sınıf sekmeleri (9–12) */
export const CLASS_GRADES_LISE: ClassGrade[] = [9, 10, 11, 12];
/** Ortaokul listesinde sınıf sekmeleri (5–8) */
export const CLASS_GRADES_ORTAOKUL: ClassGrade[] = [5, 6, 7, 8];

export const CLASS_TRACKS_LISE: ClassTrack[] = ['sayisal', 'sozel', 'esit_agirlik', 'dil'];
/** Mezun: soldan sağa sayısal → eşit ağırlık → sözel */
export const CLASS_TRACKS_MEZUN: ClassTrack[] = ['sayisal', 'esit_agirlik', 'sozel'];

export function isLiseTrackCategory(cat: ClassListCategory): boolean {
  return cat === 'sayisal' || cat === 'sozel' || cat === 'esit_agirlik';
}

export function isOrtaokulGrade(grade: ClassGrade): boolean {
  return grade !== 'mezun' && typeof grade === 'number' && grade >= 4 && grade <= 8;
}

export function isLiseGrade(grade: ClassGrade): boolean {
  return grade !== 'mezun' && typeof grade === 'number' && grade >= 9 && grade <= 12;
}

export function trackLabel(track: ClassTrack): string {
  switch (track) {
    case 'sayisal':
      return 'Sayısal';
    case 'sozel':
      return 'Sözel';
    case 'esit_agirlik':
      return 'Eşit Ağırlık';
    case 'dil':
      return 'Dil';
    case 'ortaokul':
      return 'Ortaokul';
  }
}

export function gradeLabel(grade: ClassGrade): string {
  return grade === 'mezun' ? 'Mezun' : `${grade}. Sınıf`;
}

/** Optik / listede yazan sınıf metninden grade-section-track çıkarır */
export function parseClassFromOptikLabel(raw?: string | null): {
  grade?: ClassGrade;
  section?: string;
  track?: ClassTrack;
  label?: string;
} {
  const text = String(raw || '').trim();
  if (!text) return {};
  const lower = text.toLocaleLowerCase('tr');

  let grade: ClassGrade | undefined;
  if (/mezun/.test(lower)) grade = 'mezun';
  else {
    const gm = text.match(/(?:^|[^\d])(1[0-2]|[4-9])(?:[^\d]|$)/);
    if (gm) grade = Number(gm[1]) as ClassGrade;
  }

  let section: string | undefined;
  const sm = text.match(/(?:şube\s*)?([A-Ha-h])(?:\b|(?=\s|$))/);
  if (sm) section = sm[1].toUpperCase();
  else {
    const sm2 = text.match(/(?:mezun|1[0-2]|[4-9])\s*[-–]?\s*([A-Ha-h])\b/i);
    if (sm2) section = sm2[1].toUpperCase();
  }

  let track: ClassTrack | undefined;
  if (/eşit\s*ağır|esit\s*agir|ea\b/.test(lower)) track = 'esit_agirlik';
  else if (/say[ıi]sal/.test(lower)) track = 'sayisal';
  else if (/s[oö]zel/.test(lower)) track = 'sozel';
  else if (/\bdil\b/.test(lower)) track = 'dil';
  else if (grade != null && isOrtaokulGrade(grade)) track = 'ortaokul';

  return { grade, section, track, label: text };
}

export function buildClassName(grade: ClassGrade, section: string, track: ClassTrack): string {
  const sec = section.trim().toUpperCase();
  if (grade === 'mezun') return `Mezun-${sec} ${trackLabel(track)}`;
  if (track === 'ortaokul') return `${grade}-${sec}`;
  return `${grade}-${sec} ${trackLabel(track)}`;
}

/** Liste menüsü / filtre anahtarı */
export type ClassListCategory = 'sozel' | 'sayisal' | 'esit_agirlik' | 'dil' | 'mezun' | 'ortaokul' | 'other';

export function classListCategory(c: ClassRoom): ClassListCategory {
  if (c.grade === 'mezun') return 'mezun';
  if (c.track === 'ortaokul' || (c.grade != null && isOrtaokulGrade(c.grade))) return 'ortaokul';
  if (c.track === 'sayisal') return 'sayisal';
  if (c.track === 'sozel') return 'sozel';
  if (c.track === 'esit_agirlik') return 'esit_agirlik';
  if (c.track === 'dil') return 'dil';
  return 'other';
}

export function classCategoryLabel(cat: ClassListCategory): string {
  switch (cat) {
    case 'sozel':
      return 'Kayıtlı sınıf — Sözel';
    case 'sayisal':
      return 'Kayıtlı sınıf — Sayısal';
    case 'esit_agirlik':
      return 'Kayıtlı sınıf — Eşit Ağırlık';
    case 'dil':
      return 'Kayıtlı sınıf — Dil';
    case 'mezun':
      return 'Kayıtlı sınıf — Mezun';
    case 'ortaokul':
      return 'Kayıtlı sınıf — Ortaokul';
    case 'other':
      return 'Kayıtlı sınıf — Diğer';
  }
}

export type PaymentType = 'cash' | 'installment' | 'credit_card';

export type UserAccount = {
  id: string;
  role: Role;
  institutionId?: string;
  fullName: string;
  loginId: string;
  password: string;
  phone?: string;
  parentName?: string;
  parentPhone?: string;
  classId?: string;
  className?: string;
  /** Aynı öğretmen girişi; platform/kurum yöneticisi yetkisi */
  isManager?: boolean;
  /** Öğretmen girişinden muhasebe (ders programı + ödemeler) */
  isMuhasebe?: boolean;
  /** Örn: ['Fizik'] → ekranda Fizik-Anıl Hoca */
  subjects?: string[];
  /** Öğrenci: alınacak ücret */
  feeAmount?: number;
  paymentType?: PaymentType;
  /** Taksitli ise taksit adedi (örn. 2–24) */
  installmentCount?: number;
  /** Ayın kaçıncı günü (1–28) */
  paymentDay?: number;
  points: number;
  createdAt: string;
};

export type ChatAttachment = {
  type: 'image' | 'pdf' | 'file' | 'link';
  label: string;
  uri: string;
};

export type ChatMessage = {
  id: string;
  institutionId: string;
  classId: string;
  senderId: string;
  senderName: string;
  text: string;
  attachments?: ChatAttachment[];
  createdAt: string;
  isHomeworkNotice?: boolean;
};

export type DenemeSource = 'institution' | 'student';

export type DenemeSubjectScore = {
  subject: string;
  correct: number;
  wrong: number;
  blank: number;
  net: number;
  successPercent?: number;
  classAvg?: number;
  institutionAvg?: number;
  generalAvg?: number;
};

export type DenemeRank = {
  scope: 'class' | 'institution' | 'district' | 'province' | 'general';
  label: string;
  rank: number;
  total: number;
};

export type DenemeResult = {
  id: string;
  institutionId: string;
  studentId: string;
  title: string;
  date: string;
  net: number;
  score: number;
  note?: string;
  source: DenemeSource;
  documentUri?: string;
  documentName?: string;
  subjects?: DenemeSubjectScore[];
  studentName?: string;
  examType?: string;
  averageScore?: number;
  ranks?: DenemeRank[];
  /** Kayıt anındaki sınıf damgası — filtreleme için */
  classGrade?: ClassGrade;
  classSection?: string;
  classTrack?: ClassTrack;
  createdAt: string;
};

export type HomeworkAttachment = {
  type: 'image' | 'pdf' | 'video' | 'link' | 'file';
  label: string;
  uri: string;
};

export type Homework = {
  id: string;
  institutionId: string;
  classId: string;
  className: string;
  lesson: string;
  topic: string;
  purpose: string;
  attachments: HomeworkAttachment[];
  createdAt: string;
  createdBy: string;
};

export type HomeworkStatus = {
  id: string;
  institutionId: string;
  homeworkId: string;
  studentId: string;
  done: boolean | null;
  pointsAwarded: number;
  checkedAt?: string;
};

/** 0=Pzt ... 6=Paz */
export type StudyItem = {
  id: string;
  institutionId: string;
  studentId: string;
  lesson: string;
  topic: string;
  dayOfWeek: number;
  time: string;
  durationHours: number;
  completed: boolean;
  createdBy: 'student' | 'teacher';
  createdAt: string;
};

export type AttendanceStatus = 'present' | 'absent' | 'pending';

export type AttendanceEntry = {
  studentId: string;
  studentName: string;
  status: 'present' | 'absent';
  note?: string;
  parentMessage?: string;
};

export type AttendanceSession = {
  id: string;
  institutionId: string;
  classId: string;
  className: string;
  date: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  entries: AttendanceEntry[];
  createdAt: string;
};

/** Haftalık ders programı satırı */
export type LessonSlot = {
  dayOfWeek: number; // 0=Pzt ... 6=Paz
  startTime: string;
  endTime: string;
  subject: string;
  room?: string;
  note?: string;
  /** Öğretmene gönderimde ilgili sınıf */
  relatedClassId?: string;
  relatedClassName?: string;
  /** Sınıfa gönderimde ilgili öğretmen */
  relatedTeacherId?: string;
  relatedTeacherName?: string;
};

export type LessonSchedule = {
  id: string;
  institutionId: string;
  targetType: 'teacher' | 'class';
  targetId: string;
  targetName: string;
  title?: string;
  slots: LessonSlot[];
  createdAt: string;
  createdBy: string;
  updatedAt: string;
};

export type PaymentNoticeKind = 'approaching' | 'due' | 'overdue';

export type PaymentNotice = {
  id: string;
  institutionId: string;
  studentId: string;
  kind: PaymentNoticeKind;
  message: string;
  daysLate?: number;
  periodKey: string;
  createdAt: string;
};

export type AppDatabase = {
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
  paymentNotices: PaymentNotice[];
};

/** Öğretmen ders filtreleri / atama listesi (soldan sağa sıra) */
export const TEACHER_SUBJECTS = [
  'Matematik',
  'Fizik',
  'Kimya',
  'Biyoloji',
  'Türkçe',
  'Coğrafya',
  'Felsefe',
  'Din',
  'Rehberlik',
] as const;

export type TeacherSubject = (typeof TEACHER_SUBJECTS)[number];

export function normalizeTeacherSubject(raw?: string | null): string {
  const t = (raw || '').trim();
  if (!t) return '';
  const hit = TEACHER_SUBJECTS.find((s) => s.toLocaleLowerCase('tr') === t.toLocaleLowerCase('tr'));
  return hit || t;
}

export function teacherHasSubject(user: UserAccount, subject: string): boolean {
  const target = subject.toLocaleLowerCase('tr');
  return (user.subjects || []).some((s) => normalizeTeacherSubject(s).toLocaleLowerCase('tr') === target);
}

export function teacherLabel(user: UserAccount): string {
  const sub = user.subjects?.[0] ? normalizeTeacherSubject(user.subjects[0]) : '';
  if (sub) return `${sub}-${user.fullName}`;
  return user.fullName;
}

export const WEEK_DAYS = [
  { key: 0, short: 'Pzt', full: 'Pazartesi' },
  { key: 1, short: 'Sal', full: 'Salı' },
  { key: 2, short: 'Çar', full: 'Çarşamba' },
  { key: 3, short: 'Per', full: 'Perşembe' },
  { key: 4, short: 'Cum', full: 'Cuma' },
  { key: 5, short: 'Cmt', full: 'Cumartesi' },
  { key: 6, short: 'Paz', full: 'Pazar' },
];
