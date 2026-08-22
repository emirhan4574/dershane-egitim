import {
  AppDatabase,
  ClassRoom,
  ClassTrack,
  Institution,
  TEACHER_SUBJECTS,
  UserAccount,
  buildClassName,
} from './types';
import { uid } from './db';

const INST_NAME = 'Deneme Dershanesi';
const INST_CODE = 'deneme';
const GRADES = [9, 10, 11, 12] as const;
const SECTIONS = ['A', 'B', 'C'] as const;
const TRACKS: ClassTrack[] = ['sayisal', 'sozel', 'esit_agirlik', 'dil'];
const STUDENTS_PER_CLASS = 10;
const TEACHER_PASSWORD = '1234';
const STUDENT_PASSWORD = '123456';
const MANAGER_LOGIN = 'yonetici';
const MANAGER_PASSWORD = '1234';

const TEACHER_FIRST = [
  'Ahmet',
  'Ayşe',
  'Mehmet',
  'Fatma',
  'Ali',
  'Zeynep',
  'Mustafa',
  'Elif',
  'Hasan',
  'Merve',
  'Can',
  'Selin',
  'Burak',
  'Deniz',
  'Emre',
  'Ceren',
  'Onur',
  'İrem',
] as const;

const TEACHER_LAST = [
  'Yılmaz',
  'Demir',
  'Kaya',
  'Çelik',
  'Şahin',
  'Arslan',
  'Aydın',
  'Koç',
  'Kurt',
  'Özkan',
  'Yavuz',
  'Doğan',
  'Polat',
  'Aksoy',
  'Öztürk',
  'Erdoğan',
  'Şimşek',
  'Acar',
] as const;

const STUDENT_FIRST = [
  'Ege',
  'Defne',
  'Yiğit',
  'Ecrin',
  'Arda',
  'Zeynep',
  'Emir',
  'Elif',
  'Kerem',
  'Ayşe',
  'Berk',
  'Nisan',
  'Can',
  'Melisa',
  'Baran',
  'Sude',
  'Alp',
  'İrem',
  'Mert',
  'Duru',
] as const;

const STUDENT_LAST = [
  'Yıldız',
  'Aydın',
  'Koç',
  'Şahin',
  'Demir',
  'Kaya',
  'Çelik',
  'Arslan',
  'Öztürk',
  'Yılmaz',
  'Polat',
  'Aksoy',
  'Erdoğan',
  'Bulut',
  'Kara',
  'Tekin',
  'Avcı',
  'Mutlu',
  'Güneş',
  'Aslan',
] as const;

function subjectLoginBase(subject: string) {
  return subject
    .toLocaleLowerCase('tr')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/[^a-z0-9]/g, '');
}

function makeTc(used: Set<string>, seed: number) {
  let n = 20000000000 + (seed % 79999999999);
  for (let i = 0; i < 20000; i++) {
    const tc = String(n).padStart(11, '0').slice(0, 11);
    if (/^\d{11}$/.test(tc) && !used.has(tc)) {
      used.add(tc);
      return tc;
    }
    n += 13;
  }
  const fallback = String(80000000000 + used.size).slice(0, 11);
  used.add(fallback);
  return fallback;
}

function makePhone(i: number) {
  return `05${String(400000000 + (i % 599999999)).slice(0, 9)}`;
}

export type DenemeSeedSummary = {
  institutionId: string;
  createdInstitution: boolean;
  teachersAdded: number;
  classesAdded: number;
  studentsAdded: number;
  totals: { teachers: number; classes: number; students: number };
};

/**
 * Deneme Dershanesi: branş başına 2 öğretmen,
 * 9–12 × A/B/C × 4 bölüm sınıfları, her sınıfta 10 öğrenci.
 * Idempotent — eksikleri tamamlar.
 */
export function ensureDenemeDershanesi(
  db: AppDatabase,
  options?: { rebuildStudents?: boolean }
): {
  db: AppDatabase;
  summary: DenemeSeedSummary;
} {
  const rebuildStudents = options?.rebuildStudents !== false;
  const now = new Date().toISOString();
  let institutions = [...(db.institutions || [])];
  let users = [...(db.users || [])];
  let classes = [...(db.classes || [])];

  let createdInstitution = false;
  let inst = institutions.find((i) => i.code === INST_CODE);
  if (!inst) {
    inst = {
      id: uid('inst'),
      name: INST_NAME,
      code: INST_CODE,
      paymentOverdueIntervalDays: 7,
      createdAt: now,
    };
    institutions = [...institutions, inst];
    createdInstitution = true;
  }

  const institutionId = inst.id;
  let teachersAdded = 0;
  let classesAdded = 0;
  let studentsAdded = 0;

  // Yönetici öğretmen
  let manager = users.find(
    (u) =>
      u.institutionId === institutionId &&
      u.role === 'teacher' &&
      u.loginId === MANAGER_LOGIN
  );
  if (!manager) {
    manager = {
      id: uid('usr'),
      role: 'teacher',
      institutionId,
      fullName: 'Deneme Yönetici',
      loginId: MANAGER_LOGIN,
      password: MANAGER_PASSWORD,
      isManager: true,
      isMuhasebe: true,
      subjects: [],
      points: 0,
      createdAt: now,
    };
    users = [...users, manager];
    teachersAdded++;
  } else if (!manager.isManager || !manager.isMuhasebe) {
    users = users.map((u) =>
      u.id === manager!.id ? { ...u, isManager: true, isMuhasebe: true } : u
    );
  }

  // Branş başına 2 öğretmen
  const subjectTeacherIds: string[] = [];
  let nameIdx = 0;
  for (const subject of TEACHER_SUBJECTS) {
    const base = subjectLoginBase(subject);
    for (let n = 1; n <= 2; n++) {
      const loginId = `${base}${n}`;
      let t = users.find(
        (u) =>
          u.institutionId === institutionId &&
          u.role === 'teacher' &&
          u.loginId === loginId
      );
      if (!t) {
        const fullName = `${TEACHER_FIRST[nameIdx % TEACHER_FIRST.length]} ${
          TEACHER_LAST[nameIdx % TEACHER_LAST.length]
        }`;
        nameIdx++;
        t = {
          id: uid('usr'),
          role: 'teacher',
          institutionId,
          fullName,
          loginId,
          password: TEACHER_PASSWORD,
          isManager: false,
          isMuhasebe: false,
          subjects: [subject],
          points: 0,
          createdAt: now,
        };
        users = [...users, t];
        teachersAdded++;
      } else if (!(t.subjects || []).includes(subject)) {
        users = users.map((u) =>
          u.id === t!.id ? { ...u, subjects: [subject] } : u
        );
      }
      subjectTeacherIds.push(t.id);
    }
  }

  // Sınıflar: 9–12 × A/B/C × 4 bölüm
  const classIds: string[] = [];
  for (const grade of GRADES) {
    for (const section of SECTIONS) {
      for (const track of TRACKS) {
        const name = buildClassName(grade, section, track);
        let cls = classes.find(
          (c) =>
            c.institutionId === institutionId &&
            c.grade === grade &&
            c.section === section &&
            c.track === track
        );
        if (!cls) {
          cls = {
            id: uid('cls'),
            institutionId,
            name,
            grade,
            section,
            track,
            teacherIds: [...subjectTeacherIds],
            createdAt: now,
          };
          classes = [...classes, cls];
          classesAdded++;
        } else {
          const merged = Array.from(
            new Set([...(cls.teacherIds || []), ...subjectTeacherIds])
          );
          if (merged.length !== (cls.teacherIds || []).length) {
            classes = classes.map((c) =>
              c.id === cls!.id ? { ...c, teacherIds: merged, name } : c
            );
          }
        }
        classIds.push(cls.id);
      }
    }
  }

  // Her sınıfa 10 öğrenci (yeniden kurulumda eski deneme öğrencilerini sil)
  if (rebuildStudents) {
    users = users.filter(
      (u) => !(u.institutionId === institutionId && u.role === 'student')
    );
  }

  const usedTc = new Set(
    users.filter((u) => u.institutionId === institutionId).map((u) => u.loginId)
  );
  let tcSeed = 11111111101;
  let phoneIdx = 1;
  let studentNameIdx = 0;

  for (const classId of classIds) {
    const cls = classes.find((c) => c.id === classId)!;
    const existing = users.filter(
      (u) =>
        u.role === 'student' &&
        u.institutionId === institutionId &&
        u.classId === classId
    ).length;
    const need = Math.max(0, STUDENTS_PER_CLASS - existing);
    for (let i = 0; i < need; i++) {
      const fullName = `${STUDENT_FIRST[studentNameIdx % STUDENT_FIRST.length]} ${
        STUDENT_LAST[(studentNameIdx * 7 + i) % STUDENT_LAST.length]
      }`;
      studentNameIdx++;
      const tc = makeTc(usedTc, tcSeed++);
      const phone = makePhone(phoneIdx++);
      const parentPhone = makePhone(phoneIdx++);
      const student: UserAccount = {
        id: uid('usr'),
        role: 'student',
        institutionId,
        fullName,
        loginId: tc,
        password: STUDENT_PASSWORD,
        phone,
        parentName: `Veli ${fullName.split(' ')[0]}`,
        parentPhone,
        classId: cls.id,
        className: cls.name,
        feeAmount: 24000,
        paymentType: i % 3 === 0 ? 'cash' : i % 3 === 1 ? 'installment' : 'credit_card',
        installmentCount: i % 3 === 1 ? 12 : undefined,
        paymentDay: 5 + (i % 20),
        points: 0,
        createdAt: now,
      };
      users = [...users, student];
      studentsAdded++;
    }
  }

  const next: AppDatabase = {
    ...db,
    institutions,
    users,
    classes,
  };

  const teachers = users.filter(
    (u) => u.institutionId === institutionId && u.role === 'teacher'
  ).length;
  const classCount = classes.filter((c) => c.institutionId === institutionId).length;
  const students = users.filter(
    (u) => u.institutionId === institutionId && u.role === 'student'
  ).length;

  return {
    db: next,
    summary: {
      institutionId,
      createdInstitution,
      teachersAdded,
      classesAdded,
      studentsAdded,
      totals: { teachers, classes: classCount, students },
    },
  };
}

export const DENEME_SEED_INFO = {
  institutionName: INST_NAME,
  institutionCode: INST_CODE,
  managerLogin: MANAGER_LOGIN,
  managerPassword: MANAGER_PASSWORD,
  teacherPassword: TEACHER_PASSWORD,
  studentPassword: STUDENT_PASSWORD,
  studentsPerClass: STUDENTS_PER_CLASS,
};
