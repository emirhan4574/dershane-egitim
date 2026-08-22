const { query } = require('./db');
const { uid, hashPassword } = require('./auth');

const INST_NAME = 'Deneme Dershanesi';
const INST_CODE = 'deneme';
const GRADES = [9, 10, 11, 12];
const SECTIONS = ['A', 'B', 'C'];
const TRACKS = ['sayisal', 'sozel', 'esit_agirlik', 'dil'];
const STUDENTS_PER_CLASS = 10;
const TEACHER_PASSWORD = '1234';
const STUDENT_PASSWORD = '123456';
const MANAGER_LOGIN = 'yonetici';
const MANAGER_PASSWORD = '1234';

const TEACHER_SUBJECTS = [
  'Matematik',
  'Fizik',
  'Kimya',
  'Biyoloji',
  'Türkçe',
  'Coğrafya',
  'Felsefe',
  'Din',
  'Rehberlik',
];

const TEACHER_FIRST = [
  'Ahmet', 'Ayşe', 'Mehmet', 'Fatma', 'Ali', 'Zeynep', 'Mustafa', 'Elif', 'Hasan',
  'Merve', 'Can', 'Selin', 'Burak', 'Deniz', 'Emre', 'Ceren', 'Onur', 'İrem',
];
const TEACHER_LAST = [
  'Yılmaz', 'Demir', 'Kaya', 'Çelik', 'Şahin', 'Arslan', 'Aydın', 'Koç', 'Kurt',
  'Özkan', 'Yavuz', 'Doğan', 'Polat', 'Aksoy', 'Öztürk', 'Erdoğan', 'Şimşek', 'Acar',
];
const STUDENT_FIRST = [
  'Ege', 'Defne', 'Yiğit', 'Ecrin', 'Arda', 'Zeynep', 'Emir', 'Elif', 'Kerem', 'Ayşe',
  'Berk', 'Nisan', 'Can', 'Melisa', 'Baran', 'Sude', 'Alp', 'İrem', 'Mert', 'Duru',
];
const STUDENT_LAST = [
  'Yıldız', 'Aydın', 'Koç', 'Şahin', 'Demir', 'Kaya', 'Çelik', 'Arslan', 'Öztürk', 'Yılmaz',
  'Polat', 'Aksoy', 'Erdoğan', 'Bulut', 'Kara', 'Tekin', 'Avcı', 'Mutlu', 'Güneş', 'Aslan',
];

function subjectLoginBase(subject) {
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

function trackLabel(track) {
  return (
    {
      sayisal: 'Sayısal',
      sozel: 'Sözel',
      esit_agirlik: 'Eşit Ağırlık',
      dil: 'Dil',
    }[track] || track
  );
}

function buildClassName(grade, section, track) {
  return `${grade}-${section} ${trackLabel(track)}`;
}

function makeTc(used, seed) {
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

function makePhone(i) {
  return `05${String(400000000 + (i % 599999999)).slice(0, 9)}`;
}

async function ensureDenemeDershanesiSql(options = {}) {
  const rebuildStudents = options.rebuildStudents !== false;
  let teachersAdded = 0;
  let classesAdded = 0;
  let studentsAdded = 0;
  let createdInstitution = false;

  let inst = await query(
    `SELECT TOP 1 * FROM dbo.Institutions WHERE Code = @C AND IsDeleted = 0`,
    { C: INST_CODE }
  );
  let institutionId;
  if (!inst.recordset[0]) {
    institutionId = uid('inst');
    await query(
      `INSERT INTO dbo.Institutions (Id, Name, Code, PaymentOverdueIntervalDays, CreatedAt, UpdatedAt, IsDeleted)
       VALUES (@Id, @N, @C, 7, SYSUTCDATETIME(), SYSUTCDATETIME(), 0)`,
      { Id: institutionId, N: INST_NAME, C: INST_CODE }
    );
    createdInstitution = true;
  } else {
    institutionId = inst.recordset[0].Id;
  }

  const existingUsers = await query(
    `SELECT Id, LoginId, Role FROM dbo.Users WHERE InstitutionId = @I AND IsDeleted = 0`,
    { I: institutionId }
  );
  const byLogin = new Map(existingUsers.recordset.map((u) => [u.LoginId, u]));

  async function ensureTeacher(loginId, fullName, subjects, isManager, isMuhasebe) {
    if (byLogin.has(loginId)) return byLogin.get(loginId).Id;
    const id = uid('usr');
    const hash = await hashPassword(isManager ? MANAGER_PASSWORD : TEACHER_PASSWORD);
    await query(
      `INSERT INTO dbo.Users (Id, Role, InstitutionId, FullName, LoginId, PasswordHash, IsManager, IsMuhasebe, Points, CreatedAt, UpdatedAt, IsDeleted)
       VALUES (@Id, N'teacher', @I, @FullName, @L, @Hash, @M, @Muh, 0, SYSUTCDATETIME(), SYSUTCDATETIME(), 0)`,
      {
        Id: id,
        I: institutionId,
        FullName: fullName,
        L: loginId,
        Hash: hash,
        M: isManager ? 1 : 0,
        Muh: isMuhasebe ? 1 : 0,
      }
    );
    for (let i = 0; i < subjects.length; i++) {
      await query(
        `INSERT INTO dbo.UserSubjects (UserId, Subject, SortOrder) VALUES (@U, @S, @O)`,
        { U: id, S: subjects[i], O: i }
      );
    }
    byLogin.set(loginId, { Id: id, LoginId: loginId, Role: 'teacher' });
    teachersAdded++;
    return id;
  }

  await ensureTeacher(MANAGER_LOGIN, 'Deneme Yönetici', [], true, true);

  const subjectTeacherIds = [];
  let nameIdx = 0;
  for (const subject of TEACHER_SUBJECTS) {
    const base = subjectLoginBase(subject);
    for (let n = 1; n <= 2; n++) {
      const loginId = `${base}${n}`;
      const fullName = `${TEACHER_FIRST[nameIdx % TEACHER_FIRST.length]} ${
        TEACHER_LAST[nameIdx % TEACHER_LAST.length]
      }`;
      nameIdx++;
      const id = await ensureTeacher(loginId, fullName, [subject], false, false);
      subjectTeacherIds.push(id);
    }
  }

  const existingClasses = await query(
    `SELECT * FROM dbo.Classes WHERE InstitutionId = @I AND IsDeleted = 0`,
    { I: institutionId }
  );
  const classKey = (g, s, t) => `${g}|${s}|${t}`;
  const classMap = new Map();
  for (const c of existingClasses.recordset) {
    classMap.set(classKey(c.Grade, c.Section, c.Track), c);
  }

  const classIds = [];
  for (const grade of GRADES) {
    for (const section of SECTIONS) {
      for (const track of TRACKS) {
        const key = classKey(String(grade), section, track);
        let row = classMap.get(key);
        let classId;
        if (!row) {
          classId = uid('cls');
          const name = buildClassName(grade, section, track);
          await query(
            `INSERT INTO dbo.Classes (Id, InstitutionId, Name, Grade, Section, Track, CreatedAt, UpdatedAt, IsDeleted)
             VALUES (@Id, @I, @Name, @G, @S, @T, SYSUTCDATETIME(), SYSUTCDATETIME(), 0)`,
            {
              Id: classId,
              I: institutionId,
              Name: name,
              G: String(grade),
              S: section,
              T: track,
            }
          );
          classesAdded++;
        } else {
          classId = row.Id;
        }
        classIds.push({ id: classId, name: buildClassName(grade, section, track), section });
        for (const tid of subjectTeacherIds) {
          const exists = await query(
            `SELECT 1 FROM dbo.ClassTeachers WHERE ClassId = @C AND TeacherId = @T`,
            { C: classId, T: tid }
          );
          if (!exists.recordset.length) {
            await query(
              `INSERT INTO dbo.ClassTeachers (ClassId, TeacherId) VALUES (@C, @T)`,
              { C: classId, T: tid }
            );
          }
        }
      }
    }
  }

  if (rebuildStudents) {
    await query(
      `UPDATE dbo.Users SET IsDeleted = 1, UpdatedAt = SYSUTCDATETIME()
       WHERE InstitutionId = @I AND Role = N'student' AND IsDeleted = 0`,
      { I: institutionId }
    );
  }

  const usedTc = new Set();
  const allLogins = await query(
    `SELECT LoginId FROM dbo.Users WHERE InstitutionId = @I AND IsDeleted = 0`,
    { I: institutionId }
  );
  for (const r of allLogins.recordset) usedTc.add(r.LoginId);

  let tcSeed = 11111111101;
  let phoneIdx = 1;
  let studentNameIdx = 0;
  const studentHash = await hashPassword(STUDENT_PASSWORD);

  for (const cls of classIds) {
    const countR = await query(
      `SELECT COUNT(1) AS n FROM dbo.Users
       WHERE InstitutionId = @I AND Role = N'student' AND ClassId = @C AND IsDeleted = 0`,
      { I: institutionId, C: cls.id }
    );
    const existing = Number(countR.recordset[0]?.n || 0);
    const need = Math.max(0, STUDENTS_PER_CLASS - existing);
    for (let i = 0; i < need; i++) {
      const fullName = `${STUDENT_FIRST[studentNameIdx % STUDENT_FIRST.length]} ${
        STUDENT_LAST[(studentNameIdx * 7 + i) % STUDENT_LAST.length]
      }`;
      studentNameIdx++;
      const tc = makeTc(usedTc, tcSeed++);
      const id = uid('usr');
      const fee = 24000;
      const pType = i % 3 === 0 ? 'cash' : i % 3 === 1 ? 'installment' : 'credit_card';
      const instCount = pType === 'installment' ? 12 : null;
      const pDay = 5 + (i % 20);
      await query(
        `INSERT INTO dbo.Users
         (Id, Role, InstitutionId, FullName, LoginId, PasswordHash, Phone, ParentName, ParentPhone,
          ClassId, ClassName, FeeAmount, PaymentType, InstallmentCount, PaymentDay, Points, CreatedAt, UpdatedAt, IsDeleted)
         VALUES
         (@Id, N'student', @I, @FullName, @L, @Hash, @Phone, @ParentName, @Parent,
          @ClassId, @ClassName, @Fee, @PType, @Inst, @PDay, 0, SYSUTCDATETIME(), SYSUTCDATETIME(), 0)`,
        {
          Id: id,
          I: institutionId,
          FullName: fullName,
          L: tc,
          Hash: studentHash,
          Phone: makePhone(phoneIdx++),
          ParentName: `Veli ${fullName.split(' ')[0]}`,
          Parent: makePhone(phoneIdx++),
          ClassId: cls.id,
          ClassName: cls.name,
          Fee: fee,
          PType: pType,
          Inst: instCount,
          PDay: pDay,
        }
      );
      studentsAdded++;
    }
  }

  const totals = await query(
    `SELECT
       (SELECT COUNT(1) FROM dbo.Users WHERE InstitutionId = @I AND Role = N'teacher' AND IsDeleted = 0) AS teachers,
       (SELECT COUNT(1) FROM dbo.Classes WHERE InstitutionId = @I AND IsDeleted = 0) AS classes,
       (SELECT COUNT(1) FROM dbo.Users WHERE InstitutionId = @I AND Role = N'student' AND IsDeleted = 0) AS students`,
    { I: institutionId }
  );

  return {
    institutionId,
    createdInstitution,
    teachersAdded,
    classesAdded,
    studentsAdded,
    totals: {
      teachers: Number(totals.recordset[0].teachers),
      classes: Number(totals.recordset[0].classes),
      students: Number(totals.recordset[0].students),
    },
    login: {
      code: INST_CODE,
      manager: MANAGER_LOGIN,
      managerPassword: MANAGER_PASSWORD,
      teacherPassword: TEACHER_PASSWORD,
      studentPassword: STUDENT_PASSWORD,
      teacherExample: 'matematik1',
    },
  };
}

module.exports = { ensureDenemeDershanesiSql };
