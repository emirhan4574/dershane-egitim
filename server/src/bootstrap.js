const { query } = require('./db');
const { publicUser, uid } = require('./auth');
const { buildPaymentNoticeDraft } = require('./paymentNotices');

async function loadSubjects(userId) {
  const r = await query(
    `SELECT Subject FROM dbo.UserSubjects WHERE UserId = @UserId ORDER BY SortOrder, Subject`,
    { UserId: userId }
  );
  return r.recordset.map((x) => x.Subject);
}

async function loadUserById(id) {
  const r = await query(
    `SELECT * FROM dbo.Users WHERE Id = @Id AND IsDeleted = 0`,
    { Id: id }
  );
  const row = r.recordset[0];
  if (!row) return null;
  const subjects = await loadSubjects(id);
  return publicUser(row, subjects);
}

async function loadTeacherIdsForClass(classId) {
  const r = await query(
    `SELECT TeacherId FROM dbo.ClassTeachers WHERE ClassId = @ClassId`,
    { ClassId: classId }
  );
  return r.recordset.map((x) => x.TeacherId);
}

async function bootstrapForUser(user) {
  if (user.role === 'superadmin') {
    const institutions = await query(
      `SELECT * FROM dbo.Institutions WHERE IsDeleted = 0 ORDER BY CreatedAt DESC`
    );
    const users = await query(`SELECT * FROM dbo.Users WHERE IsDeleted = 0`);
    const classes = await query(`SELECT * FROM dbo.Classes WHERE IsDeleted = 0`);
    const allSubjects = await query(`SELECT * FROM dbo.UserSubjects`);
    const classTeachers = await query(`SELECT * FROM dbo.ClassTeachers`);
    return {
      institutions: institutions.recordset.map(mapInstitution),
      users: await mapUsers(users.recordset, allSubjects.recordset),
      classes: mapClasses(classes.recordset, classTeachers.recordset),
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

  const iid = user.institutionId;
  if (!iid) {
    return emptyBootstrap();
  }

  const [
    institutions,
    users,
    classes,
    subjects,
    classTeachers,
    messages,
    chatAtt,
    denemes,
    denemeSubs,
    denemeRanks,
    homeworks,
    hwAtt,
    hwStatus,
    attendances,
    attEntries,
    schedules,
    slots,
    studyItems,
    paymentNotices,
  ] = await Promise.all([
    query(`SELECT * FROM dbo.Institutions WHERE Id = @I AND IsDeleted = 0`, { I: iid }),
    query(`SELECT * FROM dbo.Users WHERE InstitutionId = @I AND IsDeleted = 0`, { I: iid }),
    query(`SELECT * FROM dbo.Classes WHERE InstitutionId = @I AND IsDeleted = 0`, { I: iid }),
    query(
      `SELECT us.* FROM dbo.UserSubjects us
       INNER JOIN dbo.Users u ON u.Id = us.UserId
       WHERE u.InstitutionId = @I AND u.IsDeleted = 0`,
      { I: iid }
    ),
    query(
      `SELECT ct.* FROM dbo.ClassTeachers ct
       INNER JOIN dbo.Classes c ON c.Id = ct.ClassId
       WHERE c.InstitutionId = @I AND c.IsDeleted = 0`,
      { I: iid }
    ),
    query(
      `SELECT * FROM dbo.ChatMessages WHERE InstitutionId = @I AND IsDeleted = 0 ORDER BY CreatedAt`,
      { I: iid }
    ),
    query(
      `SELECT a.* FROM dbo.ChatAttachments a
       INNER JOIN dbo.ChatMessages m ON m.Id = a.MessageId
       WHERE m.InstitutionId = @I AND m.IsDeleted = 0`,
      { I: iid }
    ),
    query(
      `SELECT * FROM dbo.DenemeResults WHERE InstitutionId = @I AND IsDeleted = 0`,
      { I: iid }
    ),
    query(
      `SELECT s.* FROM dbo.DenemeSubjects s
       INNER JOIN dbo.DenemeResults d ON d.Id = s.DenemeId
       WHERE d.InstitutionId = @I AND d.IsDeleted = 0`,
      { I: iid }
    ),
    query(
      `SELECT r.* FROM dbo.DenemeRanks r
       INNER JOIN dbo.DenemeResults d ON d.Id = r.DenemeId
       WHERE d.InstitutionId = @I AND d.IsDeleted = 0`,
      { I: iid }
    ),
    query(
      `SELECT * FROM dbo.Homeworks WHERE InstitutionId = @I AND IsDeleted = 0`,
      { I: iid }
    ),
    query(
      `SELECT a.* FROM dbo.HomeworkAttachments a
       INNER JOIN dbo.Homeworks h ON h.Id = a.HomeworkId
       WHERE h.InstitutionId = @I AND h.IsDeleted = 0`,
      { I: iid }
    ),
    query(
      `SELECT * FROM dbo.HomeworkStatuses WHERE InstitutionId = @I AND IsDeleted = 0`,
      { I: iid }
    ),
    query(
      `SELECT * FROM dbo.AttendanceSessions WHERE InstitutionId = @I AND IsDeleted = 0`,
      { I: iid }
    ),
    query(
      `SELECT e.* FROM dbo.AttendanceEntries e
       INNER JOIN dbo.AttendanceSessions s ON s.Id = e.SessionId
       WHERE s.InstitutionId = @I AND s.IsDeleted = 0`,
      { I: iid }
    ),
    query(
      `SELECT * FROM dbo.LessonSchedules WHERE InstitutionId = @I AND IsDeleted = 0`,
      { I: iid }
    ),
    query(
      `SELECT sl.* FROM dbo.LessonSlots sl
       INNER JOIN dbo.LessonSchedules sc ON sc.Id = sl.ScheduleId
       WHERE sc.InstitutionId = @I AND sc.IsDeleted = 0`,
      { I: iid }
    ),
    query(
      `SELECT * FROM dbo.StudyItems WHERE InstitutionId = @I AND IsDeleted = 0`,
      { I: iid }
    ),
    query(
      `SELECT * FROM dbo.PaymentNotices WHERE InstitutionId = @I ORDER BY CreatedAt DESC`,
      { I: iid }
    ).catch(() => ({ recordset: [] })),
  ]);

  try {
    await syncInstitutionPaymentNotices(iid, institutions.recordset[0], users.recordset);
  } catch {
    /* tablo yoksa sessiz */
  }

  let noticeRows = paymentNotices.recordset || [];
  try {
    const fresh = await query(
      `SELECT * FROM dbo.PaymentNotices WHERE InstitutionId = @I ORDER BY CreatedAt DESC`,
      { I: iid }
    );
    noticeRows = fresh.recordset || [];
  } catch {
    /* keep prior */
  }

  return {
    institutions: institutions.recordset.map(mapInstitution),
    users: await mapUsers(users.recordset, subjects.recordset),
    classes: mapClasses(classes.recordset, classTeachers.recordset),
    messages: mapMessages(messages.recordset, chatAtt.recordset),
    denemes: mapDenemes(denemes.recordset, denemeSubs.recordset, denemeRanks.recordset),
    homeworks: mapHomeworks(homeworks.recordset, hwAtt.recordset),
    homeworkStatuses: hwStatus.recordset.map(mapHwStatus),
    studyItems: studyItems.recordset.map(mapStudy),
    attendances: mapAttendances(attendances.recordset, attEntries.recordset),
    lessonSchedules: mapSchedules(schedules.recordset, slots.recordset),
    paymentNotices: noticeRows.map(mapPaymentNotice),
  };
}

function emptyBootstrap() {
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

async function syncInstitutionPaymentNotices(iid, instRow, userRows) {
  if (!instRow) return;
  const interval =
    instRow.PaymentOverdueIntervalDays != null
      ? Number(instRow.PaymentOverdueIntervalDays)
      : 7;
  const students = (userRows || []).filter(
    (u) => u.Role === 'student' && u.PaymentDay != null && !u.IsDeleted
  );
  for (const s of students) {
    const draft = buildPaymentNoticeDraft(Number(s.PaymentDay), interval);
    if (!draft) continue;
    const exists = await query(
      `SELECT 1 FROM dbo.PaymentNotices WHERE StudentId = @S AND PeriodKey = @P`,
      { S: s.Id, P: draft.periodKey }
    );
    if (exists.recordset.length) continue;
    await query(
      `INSERT INTO dbo.PaymentNotices (Id, InstitutionId, StudentId, Kind, Message, DaysLate, PeriodKey, CreatedAt)
       VALUES (@Id, @I, @S, @K, @M, @D, @P, SYSUTCDATETIME())`,
      {
        Id: uid('pay'),
        I: iid,
        S: s.Id,
        K: draft.kind,
        M: draft.message,
        D: draft.daysLate != null ? draft.daysLate : null,
        P: draft.periodKey,
      }
    );
  }
}

function mapPaymentNotice(r) {
  return {
    id: r.Id,
    institutionId: r.InstitutionId,
    studentId: r.StudentId,
    kind: r.Kind,
    message: r.Message,
    daysLate: r.DaysLate != null ? Number(r.DaysLate) : undefined,
    periodKey: r.PeriodKey,
    createdAt: r.CreatedAt ? new Date(r.CreatedAt).toISOString() : new Date().toISOString(),
  };
}

function mapInstitution(r) {
  return {
    id: r.Id,
    name: r.Name,
    code: r.Code,
    paymentOverdueIntervalDays:
      r.PaymentOverdueIntervalDays != null ? Number(r.PaymentOverdueIntervalDays) : 7,
    classPlacementSize:
      r.ClassPlacementSize != null ? Number(r.ClassPlacementSize) : 10,
    createdAt: new Date(r.CreatedAt).toISOString(),
  };
}

async function mapUsers(rows, subjectRows) {
  const byUser = new Map();
  for (const s of subjectRows) {
    if (!byUser.has(s.UserId)) byUser.set(s.UserId, []);
    byUser.get(s.UserId).push(s.Subject);
  }
  return rows.map((r) => publicUser(r, byUser.get(r.Id) || []));
}

function mapClasses(rows, teacherRows) {
  const byClass = new Map();
  for (const t of teacherRows) {
    if (!byClass.has(t.ClassId)) byClass.set(t.ClassId, []);
    byClass.get(t.ClassId).push(t.TeacherId);
  }
  return rows.map((r) => ({
    id: r.Id,
    institutionId: r.InstitutionId,
    name: r.Name,
    grade: parseGrade(r.Grade),
    section: r.Section || undefined,
    track: r.Track || undefined,
    teacherIds: byClass.get(r.Id) || [],
    createdAt: new Date(r.CreatedAt).toISOString(),
  }));
}

function parseGrade(g) {
  if (g == null || g === '') return undefined;
  if (g === 'mezun') return 'mezun';
  const n = Number(g);
  return Number.isFinite(n) ? n : undefined;
}

function mapMessages(rows, atts) {
  const byMsg = new Map();
  for (const a of atts) {
    if (!byMsg.has(a.MessageId)) byMsg.set(a.MessageId, []);
    byMsg.get(a.MessageId).push({ type: a.Type, label: a.Label, uri: a.Uri });
  }
  return rows.map((r) => ({
    id: r.Id,
    institutionId: r.InstitutionId,
    classId: r.ClassId,
    senderId: r.SenderId,
    senderName: r.SenderName,
    text: r.TextBody,
    attachments: byMsg.get(r.Id) || [],
    createdAt: new Date(r.CreatedAt).toISOString(),
    isHomeworkNotice: !!r.IsHomeworkNotice,
  }));
}

function mapDenemes(rows, subs, ranks) {
  const bySub = new Map();
  const byRank = new Map();
  for (const s of subs) {
    if (!bySub.has(s.DenemeId)) bySub.set(s.DenemeId, []);
    bySub.get(s.DenemeId).push({
      subject: s.Subject,
      correct: s.Correct,
      wrong: s.Wrong,
      blank: s.Blank,
      net: Number(s.Net),
      successPercent: s.SuccessPercent != null ? Number(s.SuccessPercent) : undefined,
      classAvg: s.ClassAvg != null ? Number(s.ClassAvg) : undefined,
      institutionAvg: s.InstitutionAvg != null ? Number(s.InstitutionAvg) : undefined,
      generalAvg: s.GeneralAvg != null ? Number(s.GeneralAvg) : undefined,
    });
  }
  for (const r of ranks) {
    if (!byRank.has(r.DenemeId)) byRank.set(r.DenemeId, []);
    byRank.get(r.DenemeId).push({
      scope: r.Scope,
      label: r.Label,
      rank: r.RankNo,
      total: r.Total,
    });
  }
  return rows.map((d) => ({
    id: d.Id,
    institutionId: d.InstitutionId,
    studentId: d.StudentId,
    title: d.Title,
    date: formatDate(d.ExamDate),
    net: Number(d.Net),
    score: Number(d.Score),
    note: d.Note || undefined,
    source: d.Source,
    documentUri: d.DocumentUri || undefined,
    documentName: d.DocumentName || undefined,
    studentName: d.StudentName || undefined,
    examType: d.ExamType || undefined,
    averageScore: d.AverageScore != null ? Number(d.AverageScore) : undefined,
    subjects: bySub.get(d.Id) || [],
    ranks: byRank.get(d.Id) || [],
    classGrade: parseGrade(d.ClassGrade),
    classSection: d.ClassSection || undefined,
    classTrack: d.ClassTrack || undefined,
    createdAt: new Date(d.CreatedAt).toISOString(),
  }));
}

function mapHomeworks(rows, atts) {
  const byHw = new Map();
  for (const a of atts) {
    if (!byHw.has(a.HomeworkId)) byHw.set(a.HomeworkId, []);
    byHw.get(a.HomeworkId).push({ type: a.Type, label: a.Label, uri: a.Uri });
  }
  return rows.map((h) => ({
    id: h.Id,
    institutionId: h.InstitutionId,
    classId: h.ClassId,
    className: h.ClassName,
    lesson: h.Lesson,
    topic: h.Topic,
    purpose: h.Purpose,
    attachments: byHw.get(h.Id) || [],
    createdAt: new Date(h.CreatedAt).toISOString(),
    createdBy: h.CreatedBy,
  }));
}

function mapHwStatus(s) {
  return {
    id: s.Id,
    institutionId: s.InstitutionId,
    homeworkId: s.HomeworkId,
    studentId: s.StudentId,
    done: s.Done === null || s.Done === undefined ? null : !!s.Done,
    pointsAwarded: s.PointsAwarded || 0,
    checkedAt: s.CheckedAt ? new Date(s.CheckedAt).toISOString() : undefined,
  };
}

function mapStudy(s) {
  return {
    id: s.Id,
    institutionId: s.InstitutionId,
    studentId: s.StudentId,
    lesson: s.Lesson,
    topic: s.Topic,
    dayOfWeek: s.DayOfWeek,
    time: s.TimeText,
    durationHours: Number(s.DurationHours),
    completed: !!s.Completed,
    createdBy: s.CreatedByRole,
    createdAt: new Date(s.CreatedAt).toISOString(),
  };
}

function mapAttendances(sessions, entries) {
  const byS = new Map();
  for (const e of entries) {
    if (!byS.has(e.SessionId)) byS.set(e.SessionId, []);
    byS.get(e.SessionId).push({
      studentId: e.StudentId,
      studentName: e.StudentName,
      status: e.Status,
      note: e.Note || undefined,
      parentMessage: e.ParentMessage || undefined,
    });
  }
  return sessions.map((s) => ({
    id: s.Id,
    institutionId: s.InstitutionId,
    classId: s.ClassId,
    className: s.ClassName,
    date: formatDate(s.SessionDate),
    teacherId: s.TeacherId,
    teacherName: s.TeacherName,
    subject: s.Subject,
    entries: byS.get(s.Id) || [],
    createdAt: new Date(s.CreatedAt).toISOString(),
  }));
}

function mapSchedules(rows, slots) {
  const by = new Map();
  for (const s of slots) {
    if (!by.has(s.ScheduleId)) by.set(s.ScheduleId, []);
    by.get(s.ScheduleId).push({
      dayOfWeek: s.DayOfWeek,
      startTime: s.StartTime,
      endTime: s.EndTime,
      subject: s.Subject,
      room: s.Room || undefined,
      note: s.Note || undefined,
      relatedClassId: s.RelatedClassId || undefined,
      relatedClassName: s.RelatedClassName || undefined,
      relatedTeacherId: s.RelatedTeacherId || undefined,
      relatedTeacherName: s.RelatedTeacherName || undefined,
    });
  }
  return rows.map((r) => ({
    id: r.Id,
    institutionId: r.InstitutionId,
    targetType: r.TargetType,
    targetId: r.TargetId,
    targetName: r.TargetName,
    title: r.Title || undefined,
    slots: by.get(r.Id) || [],
    createdAt: new Date(r.CreatedAt).toISOString(),
    createdBy: r.CreatedBy,
    updatedAt: new Date(r.UpdatedAt).toISOString(),
  }));
}

function formatDate(d) {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return String(d).slice(0, 10);
  return x.toISOString().slice(0, 10);
}

function gradeToDb(g) {
  if (g == null) return null;
  return String(g);
}

module.exports = {
  loadUserById,
  loadSubjects,
  loadTeacherIdsForClass,
  bootstrapForUser,
  gradeToDb,
  mapInstitution,
};
