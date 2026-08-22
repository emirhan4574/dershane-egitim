const express = require('express');
const { query, getPool, sql } = require('./db');
const {
  uid,
  signToken,
  authRequired,
  requireRole,
  canMuhasebe,
  hashPassword,
  verifyPassword,
  publicUser,
} = require('./auth');
const { loadUserById, loadSubjects, bootstrapForUser, gradeToDb } = require('./bootstrap');

const router = express.Router();

function normalizeCode(code) {
  return String(code || '')
    .trim()
    .toLocaleLowerCase('tr')
    .replace(/\s+/g, '-');
}

function buildClassName(grade, section, track) {
  const sec = String(section || '').trim().toUpperCase();
  const trackLabel = {
    sayisal: 'Sayısal',
    sozel: 'Sözel',
    esit_agirlik: 'Eşit Ağırlık',
    dil: 'Dil',
    ortaokul: 'Ortaokul',
  }[track] || track;
  if (grade === 'mezun') return `Mezun-${sec} ${trackLabel}`;
  if (track === 'ortaokul') return `${grade}-${sec}`;
  return `${grade}-${sec} ${trackLabel}`;
}

/* ---------- Health ---------- */
router.get('/health', async (_req, res) => {
  try {
    await getPool();
    const r = await query('SELECT 1 AS ok');
    res.json({ ok: true, sql: r.recordset[0]?.ok === 1 });
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message });
  }
});

/* ---------- Auth ---------- */
router.post('/auth/login', async (req, res) => {
  try {
    const { institutionCode, loginId, password, asRole } = req.body || {};
    const id = String(loginId || '').trim();
    const pass = String(password || '');

    if (!asRole || asRole === 'superadmin') {
      const r = await query(
        `SELECT TOP 1 * FROM dbo.Users WHERE Role = N'superadmin' AND LoginId = @LoginId AND IsDeleted = 0`,
        { LoginId: id }
      );
      const row = r.recordset[0];
      if (row && (await verifyPassword(pass, row.PasswordHash))) {
        if (asRole && asRole !== 'superadmin') {
          return res.status(400).json({ error: 'Bu hesap platform yöneticisidir.' });
        }
        const subjects = await loadSubjects(row.Id);
        const user = publicUser(row, subjects);
        const token = signToken(user);
        return res.json({ token, user });
      }
      if (asRole === 'superadmin') {
        return res.status(401).json({ error: 'Yönetici kullanıcı adı veya şifre hatalı.' });
      }
    }

    const code = normalizeCode(institutionCode);
    if (!code) return res.status(400).json({ error: 'Kurum kodu gerekli.' });
    const inst = await query(
      `SELECT TOP 1 * FROM dbo.Institutions WHERE Code = @Code AND IsDeleted = 0`,
      { Code: code }
    );
    if (!inst.recordset[0]) return res.status(401).json({ error: 'Kurum kodu bulunamadı.' });
    const institutionId = inst.recordset[0].Id;

    const roleFilter =
      asRole === 'student' ? 'student' : asRole === 'teacher' || asRole === 'muhasebe' ? 'staff' : null;

    let sqlText = `SELECT TOP 1 * FROM dbo.Users
      WHERE InstitutionId = @InstitutionId AND LoginId = @LoginId AND IsDeleted = 0`;
    const inputs = { InstitutionId: institutionId, LoginId: id };
    if (roleFilter === 'student') {
      sqlText += ` AND Role = N'student'`;
    } else if (roleFilter === 'staff') {
      // Öğretmen girişi: öğretmen veya muhasebe (yetkili öğretmen)
      sqlText += ` AND (Role = N'teacher' OR Role = N'muhasebe')`;
    }

    const found = await query(sqlText, inputs);
    const row = found.recordset[0];
    if (!row || !(await verifyPassword(pass, row.PasswordHash))) {
      if (asRole === 'student') return res.status(401).json({ error: 'Öğrenci T.C. veya şifre hatalı.' });
      if (asRole === 'teacher') return res.status(401).json({ error: 'Öğretmen kullanıcı veya şifre hatalı.' });
      return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
    }

    // upgrade plain password to bcrypt
    if (!String(row.PasswordHash).startsWith('$2')) {
      const hash = await hashPassword(pass);
      await query(`UPDATE dbo.Users SET PasswordHash = @Hash, UpdatedAt = SYSUTCDATETIME() WHERE Id = @Id`, {
        Hash: hash,
        Id: row.Id,
      });
      row.PasswordHash = hash;
    }

    const subjects = await loadSubjects(row.Id);
    const user = publicUser(row, subjects);
    const token = signToken(user);
    return res.json({ token, user });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

router.get('/auth/me', authRequired, async (req, res) => {
  const user = await loadUserById(req.auth.sub);
  if (!user) return res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
  res.json({ user });
});

router.get('/bootstrap', authRequired, async (req, res) => {
  try {
    const user = await loadUserById(req.auth.sub);
    if (!user) return res.status(401).json({ error: 'Kullanıcı bulunamadı.' });
    const data = await bootstrapForUser(user);
    res.json({ user, data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

router.post('/auth/change-password', authRequired, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 4) {
    return res.status(400).json({ error: 'Yeni şifre en az 4 karakter olmalı.' });
  }
  const r = await query(`SELECT * FROM dbo.Users WHERE Id = @Id AND IsDeleted = 0`, {
    Id: req.auth.sub,
  });
  const row = r.recordset[0];
  if (!row || !(await verifyPassword(currentPassword, row.PasswordHash))) {
    return res.status(400).json({ error: 'Mevcut şifre hatalı.' });
  }
  const hash = await hashPassword(newPassword);
  await query(`UPDATE dbo.Users SET PasswordHash = @Hash, UpdatedAt = SYSUTCDATETIME() WHERE Id = @Id`, {
    Hash: hash,
    Id: row.Id,
  });
  res.json({ ok: true });
});

/* ---------- Institutions ---------- */
router.post('/institutions', authRequired, requireRole('superadmin'), async (req, res) => {
  try {
    const { name, code, adminFullName, adminLoginId, adminPassword } = req.body || {};
    const nm = String(name || '').trim();
    const cd = normalizeCode(code);
    const adminLogin = String(adminLoginId || '').trim();
    if (!nm) return res.status(400).json({ error: 'Kurum adı gerekli.' });
    if (!cd) return res.status(400).json({ error: 'Kurum kodu gerekli.' });
    if (!/^[a-z0-9-]+$/.test(cd)) {
      return res.status(400).json({ error: 'Kurum kodu sadece harf, rakam ve tire olabilir.' });
    }
    if (!adminLogin) return res.status(400).json({ error: 'Yönetici öğretmen kullanıcı adı gerekli.' });
    if (String(adminPassword || '').trim().length < 4) {
      return res.status(400).json({ error: 'Şifre en az 4 karakter olmalı.' });
    }
    const exists = await query(`SELECT 1 FROM dbo.Institutions WHERE Code = @Code AND IsDeleted = 0`, {
      Code: cd,
    });
    if (exists.recordset.length) return res.status(400).json({ error: 'Bu kurum kodu zaten var.' });

    const institutionId = uid('inst');
    const teacherId = uid('usr');
    const hash = await hashPassword(adminPassword);
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      await new sql.Request(tx)
        .input('Id', institutionId)
        .input('Name', nm)
        .input('Code', cd)
        .query(
          `INSERT INTO dbo.Institutions (Id, Name, Code, CreatedAt, UpdatedAt, IsDeleted)
           VALUES (@Id, @Name, @Code, SYSUTCDATETIME(), SYSUTCDATETIME(), 0)`
        );
      await new sql.Request(tx)
        .input('Id', teacherId)
        .input('InstitutionId', institutionId)
        .input('FullName', String(adminFullName || '').trim() || 'Yönetici Öğretmen')
        .input('LoginId', adminLogin)
        .input('Hash', hash)
        .query(
          `INSERT INTO dbo.Users (Id, Role, InstitutionId, FullName, LoginId, PasswordHash, IsManager, Points, CreatedAt, UpdatedAt, IsDeleted)
           VALUES (@Id, N'teacher', @InstitutionId, @FullName, @LoginId, @Hash, 1, 0, SYSUTCDATETIME(), SYSUTCDATETIME(), 0)`
        );
      await tx.commit();
    } catch (e) {
      await tx.rollback();
      throw e;
    }
    res.json({ ok: true, institutionId });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

/* ---------- Classes ---------- */
router.post('/classes', authRequired, requireRole('teacher'), async (req, res) => {
  try {
    if (!req.auth.isManager) return res.status(403).json({ error: 'Yönetici öğretmen yetkisi gerekli.' });
    const { grade, section, track } = req.body || {};
    const institutionId = req.auth.institutionId;
    const name = buildClassName(grade, section, track);
    const dup = await query(
      `SELECT 1 FROM dbo.Classes WHERE InstitutionId = @I AND Name = @Name AND IsDeleted = 0`,
      { I: institutionId, Name: name }
    );
    if (dup.recordset.length) return res.status(400).json({ error: 'Bu sınıf zaten var.' });
    const id = uid('cls');
    await query(
      `INSERT INTO dbo.Classes (Id, InstitutionId, Name, Grade, Section, Track, CreatedAt, UpdatedAt, IsDeleted)
       VALUES (@Id, @I, @Name, @Grade, @Section, @Track, SYSUTCDATETIME(), SYSUTCDATETIME(), 0)`,
      {
        Id: id,
        I: institutionId,
        Name: name,
        Grade: gradeToDb(grade),
        Section: String(section || '').toUpperCase(),
        Track: track || null,
      }
    );
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ---------- Teachers ---------- */
router.post('/teachers', authRequired, requireRole('teacher'), async (req, res) => {
  try {
    if (!req.auth.isManager) return res.status(403).json({ error: 'Yönetici öğretmen yetkisi gerekli.' });
    const { fullName, loginId, password, subjects, classIds, isManager, isMuhasebe } = req.body || {};
    const institutionId = req.auth.institutionId;
    const lid = String(loginId || '').trim();
    if (!lid) return res.status(400).json({ error: 'Kullanıcı adı gerekli.' });
    const exists = await query(
      `SELECT 1 FROM dbo.Users WHERE InstitutionId = @I AND LoginId = @L AND IsDeleted = 0`,
      { I: institutionId, L: lid }
    );
    if (exists.recordset.length) return res.status(400).json({ error: 'Bu kullanıcı adı zaten kayıtlı.' });
    const id = uid('usr');
    const hash = await hashPassword(password || '1234');
    await query(
      `INSERT INTO dbo.Users (Id, Role, InstitutionId, FullName, LoginId, PasswordHash, IsManager, IsMuhasebe, Points, CreatedAt, UpdatedAt, IsDeleted)
       VALUES (@Id, N'teacher', @I, @FullName, @L, @Hash, @IsManager, @IsMuhasebe, 0, SYSUTCDATETIME(), SYSUTCDATETIME(), 0)`,
      {
        Id: id,
        I: institutionId,
        FullName: String(fullName || '').trim(),
        L: lid,
        Hash: hash,
        IsManager: isManager ? 1 : 0,
        IsMuhasebe: isMuhasebe ? 1 : 0,
      }
    );
    const subs = Array.isArray(subjects) ? subjects : [];
    for (let i = 0; i < subs.length; i++) {
      await query(
        `INSERT INTO dbo.UserSubjects (UserId, Subject, SortOrder) VALUES (@U, @S, @O)`,
        { U: id, S: String(subs[i]), O: i }
      );
    }
    for (const classId of classIds || []) {
      await query(
        `INSERT INTO dbo.ClassTeachers (ClassId, TeacherId) VALUES (@C, @T)`,
        { C: classId, T: id }
      );
    }
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/teachers/:id', authRequired, requireRole('teacher'), async (req, res) => {
  try {
    if (!req.auth.isManager) return res.status(403).json({ error: 'Yönetici öğretmen yetkisi gerekli.' });
    const teacherId = req.params.id;
    const { subjects, classIds, isManager, isMuhasebe } = req.body || {};
    const institutionId = req.auth.institutionId;
    const t = await query(
      `SELECT * FROM dbo.Users WHERE Id = @Id AND InstitutionId = @I AND Role = N'teacher' AND IsDeleted = 0`,
      { Id: teacherId, I: institutionId }
    );
    if (!t.recordset[0]) return res.status(404).json({ error: 'Öğretmen bulunamadı.' });

    if (typeof isManager === 'boolean') {
      await query(
        `UPDATE dbo.Users SET IsManager = @M, UpdatedAt = SYSUTCDATETIME() WHERE Id = @Id`,
        { M: isManager ? 1 : 0, Id: teacherId }
      );
    }
    if (typeof isMuhasebe === 'boolean') {
      await query(
        `UPDATE dbo.Users SET IsMuhasebe = @M, UpdatedAt = SYSUTCDATETIME() WHERE Id = @Id`,
        { M: isMuhasebe ? 1 : 0, Id: teacherId }
      );
    }
    if (Array.isArray(subjects)) {
      await query(`DELETE FROM dbo.UserSubjects WHERE UserId = @U`, { U: teacherId });
      for (let i = 0; i < subjects.length; i++) {
        await query(`INSERT INTO dbo.UserSubjects (UserId, Subject, SortOrder) VALUES (@U, @S, @O)`, {
          U: teacherId,
          S: String(subjects[i]),
          O: i,
        });
      }
    }
    if (Array.isArray(classIds)) {
      await query(`DELETE FROM dbo.ClassTeachers WHERE TeacherId = @T`, { T: teacherId });
      for (const classId of classIds) {
        await query(`INSERT INTO dbo.ClassTeachers (ClassId, TeacherId) VALUES (@C, @T)`, {
          C: classId,
          T: teacherId,
        });
      }
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/teachers/:id', authRequired, requireRole('teacher'), async (req, res) => {
  if (!req.auth.isManager) return res.status(403).json({ error: 'Yönetici öğretmen yetkisi gerekli.' });
  await query(
    `UPDATE dbo.Users SET IsDeleted = 1, UpdatedAt = SYSUTCDATETIME()
     WHERE Id = @Id AND InstitutionId = @I AND Role = N'teacher'`,
    { Id: req.params.id, I: req.auth.institutionId }
  );
  await query(`DELETE FROM dbo.ClassTeachers WHERE TeacherId = @T`, { T: req.params.id });
  res.json({ ok: true });
});

router.post('/teachers/:id/manager', authRequired, requireRole('superadmin'), async (req, res) => {
  const { isManager } = req.body || {};
  await query(`UPDATE dbo.Users SET IsManager = @M, UpdatedAt = SYSUTCDATETIME() WHERE Id = @Id AND Role = N'teacher'`, {
    M: isManager ? 1 : 0,
    Id: req.params.id,
  });
  res.json({ ok: true });
});

router.post('/teachers/:id/muhasebe', authRequired, async (req, res) => {
  try {
    const { isMuhasebe } = req.body || {};
    if (req.auth.role === 'superadmin') {
      await query(
        `UPDATE dbo.Users SET IsMuhasebe = @M, UpdatedAt = SYSUTCDATETIME() WHERE Id = @Id AND Role = N'teacher'`,
        { M: isMuhasebe ? 1 : 0, Id: req.params.id }
      );
      return res.json({ ok: true });
    }
    if (req.auth.role !== 'teacher' || !req.auth.isManager) {
      return res.status(403).json({ error: 'Yönetici öğretmen veya platform yöneticisi gerekli.' });
    }
    await query(
      `UPDATE dbo.Users SET IsMuhasebe = @M, UpdatedAt = SYSUTCDATETIME()
       WHERE Id = @Id AND InstitutionId = @I AND Role = N'teacher'`,
      { M: isMuhasebe ? 1 : 0, Id: req.params.id, I: req.auth.institutionId }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/institutions/settings', authRequired, async (req, res) => {
  try {
    const { paymentOverdueIntervalDays, classPlacementSize } = req.body || {};
    const days = Number(paymentOverdueIntervalDays);
    if (!Number.isFinite(days) || days < 1 || days > 60) {
      return res.status(400).json({ error: 'Gecikme aralığı 1–60 gün olmalı.' });
    }
    let size = 10;
    if (classPlacementSize != null && classPlacementSize !== '') {
      size = Number(classPlacementSize);
      if (!Number.isFinite(size) || size < 1 || size > 50) {
        return res.status(400).json({ error: 'Şube kotası 1–50 arası olmalı.' });
      }
      size = Math.round(size);
    }
    if (req.auth.role === 'superadmin') {
      return res.status(400).json({ error: 'Kurum seçerek ayarlayın.' });
    }
    if (!(req.auth.isManager || canMuhasebe(req.auth))) {
      return res.status(403).json({ error: 'Yetkiniz yok.' });
    }
    await query(
      `UPDATE dbo.Institutions
       SET PaymentOverdueIntervalDays = @D,
           ClassPlacementSize = @S,
           UpdatedAt = SYSUTCDATETIME()
       WHERE Id = @I AND IsDeleted = 0`,
      { D: Math.round(days), S: size, I: req.auth.institutionId }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ---------- Students ---------- */
router.post('/students', authRequired, requireRole('teacher'), async (req, res) => {
  try {
    const {
      tc,
      fullName,
      phone,
      parentName,
      parentPhone,
      classId,
      password,
      feeAmount,
      paymentType,
      installmentCount,
      paymentDay,
    } = req.body || {};
    const institutionId = req.auth.institutionId;
    const loginId = String(tc || '').trim();
    if (!/^\d{11}$/.test(loginId)) return res.status(400).json({ error: 'T.C. Kimlik No 11 haneli olmalıdır.' });
    if (!String(parentName || '').trim()) return res.status(400).json({ error: 'Veli adı soyadı gerekli.' });
    if (!String(parentPhone || '').trim()) return res.status(400).json({ error: 'Veli telefonu gerekli.' });
    const fee = Number(feeAmount);
    if (!Number.isFinite(fee) || fee <= 0) return res.status(400).json({ error: 'Alınacak ücret giriniz.' });
    const pType = String(paymentType || '').trim();
    if (!['cash', 'installment', 'credit_card'].includes(pType)) {
      return res.status(400).json({ error: 'Ödeme tipi seçiniz (nakit / taksitli / kredi kartı).' });
    }
    let instCount = null;
    if (pType === 'installment') {
      instCount = Number(installmentCount);
      if (!Number.isFinite(instCount) || instCount < 2 || instCount > 48) {
        return res.status(400).json({ error: 'Taksit sayısı 2–48 arasında olmalı.' });
      }
    }
    const pDay = Number(paymentDay);
    if (!Number.isFinite(pDay) || pDay < 1 || pDay > 28) {
      return res.status(400).json({ error: 'Ödeme günü 1–28 arasında olmalı.' });
    }
    const exists = await query(
      `SELECT 1 FROM dbo.Users WHERE InstitutionId = @I AND LoginId = @L AND IsDeleted = 0`,
      { I: institutionId, L: loginId }
    );
    if (exists.recordset.length) return res.status(400).json({ error: 'Bu T.C. bu kurumda zaten kayıtlı.' });
    const cls = await query(
      `SELECT * FROM dbo.Classes WHERE Id = @Id AND InstitutionId = @I AND IsDeleted = 0`,
      { Id: classId, I: institutionId }
    );
    if (!cls.recordset[0]) return res.status(400).json({ error: 'Sınıf seçiniz.' });
    if (!req.auth.isManager) {
      const ok = await query(
        `SELECT 1 FROM dbo.ClassTeachers WHERE ClassId = @C AND TeacherId = @T`,
        { C: classId, T: req.auth.sub }
      );
      if (!ok.recordset.length) return res.status(403).json({ error: 'Bu sınıfa öğrenci ekleme yetkiniz yok.' });
    }
    const id = uid('usr');
    const hash = await hashPassword(password?.trim() || loginId.slice(-6));
    await query(
      `INSERT INTO dbo.Users (Id, Role, InstitutionId, FullName, LoginId, PasswordHash, Phone, ParentName, ParentPhone, ClassId, ClassName, FeeAmount, PaymentType, InstallmentCount, PaymentDay, Points, CreatedAt, UpdatedAt, IsDeleted)
       VALUES (@Id, N'student', @I, @FullName, @L, @Hash, @Phone, @ParentName, @Parent, @ClassId, @ClassName, @Fee, @PType, @Inst, @PDay, 0, SYSUTCDATETIME(), SYSUTCDATETIME(), 0)`,
      {
        Id: id,
        I: institutionId,
        FullName: String(fullName || '').trim(),
        L: loginId,
        Hash: hash,
        Phone: String(phone || '').trim(),
        ParentName: String(parentName || '').trim(),
        Parent: String(parentPhone || '').trim(),
        ClassId: cls.recordset[0].Id,
        ClassName: cls.recordset[0].Name,
        Fee: fee,
        PType: pType,
        Inst: instCount,
        PDay: pDay,
      }
    );
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/students/:id', authRequired, requireRole('teacher'), async (req, res) => {
  try {
    const {
      fullName,
      phone,
      parentName,
      parentPhone,
      classId,
      feeAmount,
      paymentType,
      installmentCount,
      paymentDay,
    } = req.body || {};
    const institutionId = req.auth.institutionId;
    const student = await query(
      `SELECT * FROM dbo.Users WHERE Id = @Id AND Role = N'student' AND InstitutionId = @I AND IsDeleted = 0`,
      { Id: req.params.id, I: institutionId }
    );
    if (!student.recordset[0]) return res.status(404).json({ error: 'Öğrenci bulunamadı.' });
    const cls = await query(
      `SELECT * FROM dbo.Classes WHERE Id = @Id AND InstitutionId = @I AND IsDeleted = 0`,
      { Id: classId, I: institutionId }
    );
    if (!cls.recordset[0]) return res.status(400).json({ error: 'Sınıf seçiniz.' });
    const fee =
      feeAmount != null && feeAmount !== ''
        ? Number(feeAmount)
        : student.recordset[0].FeeAmount != null
          ? Number(student.recordset[0].FeeAmount)
          : null;
    const pType =
      paymentType != null && paymentType !== ''
        ? String(paymentType)
        : student.recordset[0].PaymentType || null;
    let instCount =
      installmentCount != null && installmentCount !== ''
        ? Number(installmentCount)
        : student.recordset[0].InstallmentCount != null
          ? Number(student.recordset[0].InstallmentCount)
          : null;
    if (pType === 'installment') {
      if (!Number.isFinite(instCount) || instCount < 2 || instCount > 48) {
        return res.status(400).json({ error: 'Taksit sayısı 2–48 arasında olmalı.' });
      }
    } else {
      instCount = null;
    }
    const pDay =
      paymentDay != null && paymentDay !== ''
        ? Number(paymentDay)
        : student.recordset[0].PaymentDay != null
          ? Number(student.recordset[0].PaymentDay)
          : null;
    await query(
      `UPDATE dbo.Users SET FullName = @FullName, Phone = @Phone, ParentName = @ParentName, ParentPhone = @Parent,
        ClassId = @ClassId, ClassName = @ClassName, FeeAmount = @Fee, PaymentType = @PType,
        InstallmentCount = @Inst, PaymentDay = @PDay,
        UpdatedAt = SYSUTCDATETIME()
       WHERE Id = @Id`,
      {
        FullName: String(fullName || '').trim(),
        Phone: String(phone || '').trim(),
        ParentName: String(parentName || '').trim() || null,
        Parent: String(parentPhone || '').trim(),
        ClassId: cls.recordset[0].Id,
        ClassName: cls.recordset[0].Name,
        Fee: fee,
        PType: pType,
        Inst: instCount,
        PDay: pDay,
        Id: req.params.id,
      }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/students/:id', authRequired, requireRole('teacher'), async (req, res) => {
  await query(
    `UPDATE dbo.Users SET IsDeleted = 1, UpdatedAt = SYSUTCDATETIME()
     WHERE Id = @Id AND InstitutionId = @I AND Role = N'student'`,
    { Id: req.params.id, I: req.auth.institutionId }
  );
  res.json({ ok: true });
});

router.post('/students/seed-uzel', authRequired, requireRole('teacher', 'superadmin'), async (req, res) => {
  // Client still can call local seed; optional no-op bridge
  res.json({ ok: true, message: 'Sunucu tarafı seed için client seedUzelStudents kullanın veya SQL ile doldurun.' });
});

/* ---------- Chat ---------- */
router.post('/chat/messages', authRequired, requireRole('teacher'), async (req, res) => {
  try {
    const { classId, text, attachments, isHomeworkNotice } = req.body || {};
    const institutionId = req.auth.institutionId;
    const cls = await query(
      `SELECT * FROM dbo.Classes WHERE Id = @Id AND InstitutionId = @I AND IsDeleted = 0`,
      { Id: classId, I: institutionId }
    );
    if (!cls.recordset[0]) return res.status(400).json({ error: 'Sınıf bulunamadı.' });
    const user = await loadUserById(req.auth.sub);
    const id = uid('msg');
    await query(
      `INSERT INTO dbo.ChatMessages (Id, InstitutionId, ClassId, SenderId, SenderName, TextBody, IsHomeworkNotice, CreatedAt, UpdatedAt, IsDeleted)
       VALUES (@Id, @I, @C, @S, @SN, @T, @Hw, SYSUTCDATETIME(), SYSUTCDATETIME(), 0)`,
      {
        Id: id,
        I: institutionId,
        C: classId,
        S: req.auth.sub,
        SN: user.fullName,
        T: String(text || ''),
        Hw: isHomeworkNotice ? 1 : 0,
      }
    );
    const atts = Array.isArray(attachments) ? attachments : [];
    for (let i = 0; i < atts.length; i++) {
      const a = atts[i];
      await query(
        `INSERT INTO dbo.ChatAttachments (Id, MessageId, Type, Label, Uri, SortOrder)
         VALUES (@Id, @M, @Type, @Label, @Uri, @O)`,
        {
          Id: uid('catt'),
          M: id,
          Type: a.type || 'file',
          Label: a.label || 'Ek',
          Uri: a.uri || '',
          O: i,
        }
      );
    }
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ---------- Deneme ---------- */
async function insertDeneme(institutionId, input) {
  const id = uid('den');
  await query(
    `INSERT INTO dbo.DenemeResults (
      Id, InstitutionId, StudentId, Title, ExamDate, Net, Score, Note, Source,
      DocumentUri, DocumentName, StudentName, ExamType, AverageScore,
      ClassGrade, ClassSection, ClassTrack, CreatedAt, UpdatedAt, IsDeleted
    ) VALUES (
      @Id, @I, @StudentId, @Title, @ExamDate, @Net, @Score, @Note, @Source,
      @DocUri, @DocName, @StudentName, @ExamType, @Avg,
      @Grade, @Section, @Track, SYSUTCDATETIME(), SYSUTCDATETIME(), 0
    )`,
    {
      Id: id,
      I: institutionId,
      StudentId: input.studentId,
      Title: input.title,
      ExamDate: input.date || new Date().toISOString().slice(0, 10),
      Net: input.net || 0,
      Score: input.score || 0,
      Note: input.note || null,
      Source: input.source || 'institution',
      DocUri: input.documentUri || null,
      DocName: input.documentName || null,
      StudentName: input.studentName || null,
      ExamType: input.examType || null,
      Avg: input.averageScore ?? null,
      Grade: gradeToDb(input.classGrade),
      Section: input.classSection || null,
      Track: input.classTrack || null,
    }
  );
  const subjects = input.subjects || [];
  for (let i = 0; i < subjects.length; i++) {
    const s = subjects[i];
    await query(
      `INSERT INTO dbo.DenemeSubjects (Id, DenemeId, Subject, Correct, Wrong, Blank, Net, SuccessPercent, ClassAvg, InstitutionAvg, GeneralAvg, SortOrder)
       VALUES (@Id, @D, @Subject, @C, @W, @B, @N, @Sp, @Ca, @Ia, @Ga, @O)`,
      {
        Id: uid('dsub'),
        D: id,
        Subject: s.subject,
        C: s.correct || 0,
        W: s.wrong || 0,
        B: s.blank || 0,
        N: s.net || 0,
        Sp: s.successPercent ?? null,
        Ca: s.classAvg ?? null,
        Ia: s.institutionAvg ?? null,
        Ga: s.generalAvg ?? null,
        O: i,
      }
    );
  }
  const ranks = input.ranks || [];
  for (const r of ranks) {
    await query(
      `INSERT INTO dbo.DenemeRanks (Id, DenemeId, Scope, Label, RankNo, Total)
       VALUES (@Id, @D, @Scope, @Label, @Rank, @Total)`,
      {
        Id: uid('drnk'),
        D: id,
        Scope: r.scope,
        Label: r.label,
        Rank: r.rank,
        Total: r.total,
      }
    );
  }
  return id;
}

router.post('/denemes', authRequired, async (req, res) => {
  try {
    const user = await loadUserById(req.auth.sub);
    const institutionId =
      user.role === 'student' ? user.institutionId : req.auth.institutionId;
    if (!institutionId) return res.status(400).json({ error: 'Kurum bulunamadı.' });
    const id = await insertDeneme(institutionId, req.body || {});
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/denemes/bulk', authRequired, requireRole('teacher'), async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    let ok = 0;
    for (const item of items) {
      await insertDeneme(req.auth.institutionId, item);
      ok++;
    }
    res.json({ ok, error: null });
  } catch (e) {
    res.status(500).json({ ok: 0, error: e.message });
  }
});

/* ---------- Homework ---------- */
router.post('/homeworks', authRequired, requireRole('teacher'), async (req, res) => {
  try {
    const { classId, lesson, topic, purpose, attachments } = req.body || {};
    const institutionId = req.auth.institutionId;
    const cls = await query(
      `SELECT * FROM dbo.Classes WHERE Id = @Id AND InstitutionId = @I AND IsDeleted = 0`,
      { Id: classId, I: institutionId }
    );
    if (!cls.recordset[0]) return res.status(400).json({ error: 'Sınıf bulunamadı.' });
    if (!req.auth.isManager) {
      const ok = await query(
        `SELECT 1 FROM dbo.ClassTeachers WHERE ClassId = @C AND TeacherId = @T`,
        { C: classId, T: req.auth.sub }
      );
      if (!ok.recordset.length) return res.status(403).json({ error: 'Bu sınıfa ödev yetkiniz yok.' });
    }
    const id = uid('hw');
    await query(
      `INSERT INTO dbo.Homeworks (Id, InstitutionId, ClassId, ClassName, Lesson, Topic, Purpose, CreatedBy, CreatedAt, UpdatedAt, IsDeleted)
       VALUES (@Id, @I, @C, @CN, @Lesson, @Topic, @Purpose, @By, SYSUTCDATETIME(), SYSUTCDATETIME(), 0)`,
      {
        Id: id,
        I: institutionId,
        C: classId,
        CN: cls.recordset[0].Name,
        Lesson: String(lesson || '').trim(),
        Topic: String(topic || '').trim(),
        Purpose: String(purpose || '').trim(),
        By: req.auth.sub,
      }
    );
    const atts = Array.isArray(attachments) ? attachments : [];
    for (let i = 0; i < atts.length; i++) {
      const a = atts[i];
      await query(
        `INSERT INTO dbo.HomeworkAttachments (Id, HomeworkId, Type, Label, Uri, SortOrder)
         VALUES (@Id, @H, @Type, @Label, @Uri, @O)`,
        { Id: uid('hatt'), H: id, Type: a.type || 'file', Label: a.label || 'Ek', Uri: a.uri || '', O: i }
      );
    }
    const students = await query(
      `SELECT Id FROM dbo.Users WHERE Role = N'student' AND InstitutionId = @I AND ClassId = @C AND IsDeleted = 0`,
      { I: institutionId, C: classId }
    );
    for (const s of students.recordset) {
      await query(
        `INSERT INTO dbo.HomeworkStatuses (Id, InstitutionId, HomeworkId, StudentId, Done, PointsAwarded, CreatedAt, UpdatedAt, IsDeleted)
         VALUES (@Id, @I, @H, @S, NULL, 0, SYSUTCDATETIME(), SYSUTCDATETIME(), 0)`,
        { Id: uid('hws'), I: institutionId, H: id, S: s.Id }
      );
    }
    // notice message
    const user = await loadUserById(req.auth.sub);
    const msgId = uid('msg');
    await query(
      `INSERT INTO dbo.ChatMessages (Id, InstitutionId, ClassId, SenderId, SenderName, TextBody, IsHomeworkNotice, CreatedAt, UpdatedAt, IsDeleted)
       VALUES (@Id, @I, @C, @S, @SN, @T, 1, SYSUTCDATETIME(), SYSUTCDATETIME(), 0)`,
      {
        Id: msgId,
        I: institutionId,
        C: classId,
        S: req.auth.sub,
        SN: user.fullName,
        T: `Yeni ödev: ${String(lesson || '').trim()} — ${String(topic || '').trim()}`,
      }
    );
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/homeworks/:id/check', authRequired, requireRole('teacher'), async (req, res) => {
  try {
    const { studentId, done, pointsAwarded } = req.body || {};
    const homeworkId = req.params.id;
    const institutionId = req.auth.institutionId;
    const pts = done ? Number(pointsAwarded) || 0 : 0;
    const prev = await query(
      `SELECT * FROM dbo.HomeworkStatuses WHERE HomeworkId = @H AND StudentId = @S AND InstitutionId = @I AND IsDeleted = 0`,
      { H: homeworkId, S: studentId, I: institutionId }
    );
    const oldPts = prev.recordset[0]?.PointsAwarded || 0;
    if (!prev.recordset[0]) {
      await query(
        `INSERT INTO dbo.HomeworkStatuses (Id, InstitutionId, HomeworkId, StudentId, Done, PointsAwarded, CheckedAt, CreatedAt, UpdatedAt, IsDeleted)
         VALUES (@Id, @I, @H, @S, @Done, @Pts, SYSUTCDATETIME(), SYSUTCDATETIME(), SYSUTCDATETIME(), 0)`,
        {
          Id: uid('hws'),
          I: institutionId,
          H: homeworkId,
          S: studentId,
          Done: done ? 1 : 0,
          Pts: pts,
        }
      );
    } else {
      await query(
        `UPDATE dbo.HomeworkStatuses SET Done = @Done, PointsAwarded = @Pts, CheckedAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME()
         WHERE HomeworkId = @H AND StudentId = @S AND InstitutionId = @I`,
        { Done: done ? 1 : 0, Pts: pts, H: homeworkId, S: studentId, I: institutionId }
      );
    }
    const delta = pts - oldPts;
    if (delta !== 0) {
      await query(
        `UPDATE dbo.Users SET Points = CASE WHEN Points + @D < 0 THEN 0 ELSE Points + @D END, UpdatedAt = SYSUTCDATETIME()
         WHERE Id = @S AND InstitutionId = @I`,
        { D: delta, S: studentId, I: institutionId }
      );
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ---------- Attendance ---------- */
router.post('/attendance', authRequired, requireRole('teacher'), async (req, res) => {
  try {
    const { classId, date, subject, entries } = req.body || {};
    const institutionId = req.auth.institutionId;
    const cls = await query(
      `SELECT * FROM dbo.Classes WHERE Id = @Id AND InstitutionId = @I AND IsDeleted = 0`,
      { Id: classId, I: institutionId }
    );
    if (!cls.recordset[0]) return res.status(400).json({ error: 'Sınıf bulunamadı.' });
    if (!Array.isArray(entries) || !entries.length) {
      return res.status(400).json({ error: 'Öğrenci kaydı yok.' });
    }
    const user = await loadUserById(req.auth.sub);
    const sessionId = uid('att');
    await query(
      `INSERT INTO dbo.AttendanceSessions (Id, InstitutionId, ClassId, ClassName, SessionDate, TeacherId, TeacherName, Subject, CreatedAt, UpdatedAt, IsDeleted)
       VALUES (@Id, @I, @C, @CN, @D, @T, @TN, @Sub, SYSUTCDATETIME(), SYSUTCDATETIME(), 0)`,
      {
        Id: sessionId,
        I: institutionId,
        C: classId,
        CN: cls.recordset[0].Name,
        D: date || new Date().toISOString().slice(0, 10),
        T: req.auth.sub,
        TN: user.fullName,
        Sub: (subject || user.subjects?.[0] || 'Ders').trim(),
      }
    );
    for (const e of entries) {
      await query(
        `INSERT INTO dbo.AttendanceEntries (Id, SessionId, StudentId, StudentName, Status, Note, ParentMessage)
         VALUES (@Id, @S, @St, @Sn, @Status, @Note, @Msg)`,
        {
          Id: uid('atte'),
          S: sessionId,
          St: e.studentId,
          Sn: e.studentName,
          Status: e.status,
          Note: e.note || null,
          Msg: e.parentMessage || null,
        }
      );
    }
    res.json({ ok: true, id: sessionId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ---------- Lesson schedule ---------- */
router.post('/schedules', authRequired, async (req, res) => {
  try {
    if (!canMuhasebe(req.auth)) {
      return res.status(403).json({ error: 'Ders programı gönderme yalnızca muhasebe yetkilisi içindir.' });
    }
    const { targetType, targetId, title, slots } = req.body || {};
    const institutionId = req.auth.institutionId;
    if (!Array.isArray(slots) || !slots.length) {
      return res.status(400).json({ error: 'En az bir ders satırı ekleyin.' });
    }
    let targetName = '';
    if (targetType === 'teacher') {
      const t = await query(
        `SELECT * FROM dbo.Users WHERE Id = @Id AND Role = N'teacher' AND InstitutionId = @I AND IsDeleted = 0`,
        { Id: targetId, I: institutionId }
      );
      if (!t.recordset[0]) return res.status(400).json({ error: 'Öğretmen bulunamadı.' });
      targetName = t.recordset[0].FullName;
    } else {
      const c = await query(
        `SELECT * FROM dbo.Classes WHERE Id = @Id AND InstitutionId = @I AND IsDeleted = 0`,
        { Id: targetId, I: institutionId }
      );
      if (!c.recordset[0]) return res.status(400).json({ error: 'Sınıf bulunamadı.' });
      targetName = c.recordset[0].Name;
    }

    const existing = await query(
      `SELECT * FROM dbo.LessonSchedules WHERE InstitutionId = @I AND TargetType = @TT AND TargetId = @Tid AND IsDeleted = 0`,
      { I: institutionId, TT: targetType, Tid: targetId }
    );

    let scheduleId;
    if (existing.recordset[0]) {
      scheduleId = existing.recordset[0].Id;
      await query(
        `UPDATE dbo.LessonSchedules SET TargetName = @TN, Title = @Title, UpdatedAt = SYSUTCDATETIME(), CreatedBy = @By WHERE Id = @Id`,
        {
          TN: targetName,
          Title: title?.trim() || existing.recordset[0].Title,
          By: req.auth.sub,
          Id: scheduleId,
        }
      );
      await query(`DELETE FROM dbo.LessonSlots WHERE ScheduleId = @Id`, { Id: scheduleId });
    } else {
      scheduleId = uid('sch');
      await query(
        `INSERT INTO dbo.LessonSchedules (Id, InstitutionId, TargetType, TargetId, TargetName, Title, CreatedBy, CreatedAt, UpdatedAt, IsDeleted)
         VALUES (@Id, @I, @TT, @Tid, @TN, @Title, @By, SYSUTCDATETIME(), SYSUTCDATETIME(), 0)`,
        {
          Id: scheduleId,
          I: institutionId,
          TT: targetType,
          Tid: targetId,
          TN: targetName,
          Title: title?.trim() || null,
          By: req.auth.sub,
        }
      );
    }

    for (let i = 0; i < slots.length; i++) {
      const s = slots[i];
      await query(
        `INSERT INTO dbo.LessonSlots (
          Id, ScheduleId, DayOfWeek, StartTime, EndTime, Subject, Room, Note,
          RelatedClassId, RelatedClassName, RelatedTeacherId, RelatedTeacherName, SortOrder
        ) VALUES (
          @Id, @Sch, @Day, @Start, @End, @Subject, @Room, @Note,
          @RC, @RCN, @RT, @RTN, @O
        )`,
        {
          Id: uid('slot'),
          Sch: scheduleId,
          Day: s.dayOfWeek,
          Start: s.startTime,
          End: s.endTime,
          Subject: s.subject,
          Room: s.room || null,
          Note: s.note || null,
          RC: s.relatedClassId || null,
          RCN: s.relatedClassName || null,
          RT: s.relatedTeacherId || null,
          RTN: s.relatedTeacherName || null,
          O: i,
        }
      );
    }
    res.json({ ok: true, id: scheduleId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ---------- Study ---------- */
router.post('/study', authRequired, async (req, res) => {
  try {
    const { studentId, lesson, topic, dayOfWeek, time, durationHours, createdBy } = req.body || {};
    const user = await loadUserById(req.auth.sub);
    const institutionId = user.institutionId;
    const id = uid('study');
    await query(
      `INSERT INTO dbo.StudyItems (Id, InstitutionId, StudentId, Lesson, Topic, DayOfWeek, TimeText, DurationHours, Completed, CreatedByRole, CreatedAt, UpdatedAt, IsDeleted)
       VALUES (@Id, @I, @S, @Lesson, @Topic, @Day, @Time, @Dur, 0, @By, SYSUTCDATETIME(), SYSUTCDATETIME(), 0)`,
      {
        Id: id,
        I: institutionId,
        S: studentId,
        Lesson: lesson,
        Topic: topic,
        Day: dayOfWeek,
        Time: time,
        Dur: durationHours,
        By: createdBy || user.role,
      }
    );
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/study/:id/toggle', authRequired, async (req, res) => {
  await query(
    `UPDATE dbo.StudyItems SET Completed = CASE WHEN Completed = 1 THEN 0 ELSE 1 END, UpdatedAt = SYSUTCDATETIME()
     WHERE Id = @Id`,
    { Id: req.params.id }
  );
  res.json({ ok: true });
});

router.post('/seed/deneme', authRequired, async (req, res) => {
  try {
    if (req.auth.role !== 'superadmin' && !(req.auth.role === 'teacher' && req.auth.isManager)) {
      return res.status(403).json({ error: 'Platform yöneticisi veya yönetici öğretmen gerekli.' });
    }
    const { ensureDenemeDershanesiSql } = require('./seedDeneme');
    const summary = await ensureDenemeDershanesiSql({
      rebuildStudents: req.body?.rebuildStudents !== false,
    });
    res.json({ ok: true, summary });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
