const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const JWT_SECRET = process.env.JWT_SECRET || 'dershane_dev_jwt_change_me';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

function uid(prefix) {
  return `${prefix}_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      institutionId: user.institutionId || null,
      isManager: !!user.isManager,
      isMuhasebe: !!user.isMuhasebe || user.role === 'muhasebe',
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function canMuhasebe(auth) {
  return !!(auth && (auth.role === 'muhasebe' || auth.isMuhasebe));
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Oturum gerekli.' });
  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Oturum geçersiz veya süresi dolmuş.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ error: 'Yetkiniz yok.' });
    }
    next();
  };
}

async function hashPassword(plain) {
  return bcrypt.hash(String(plain), 10);
}

async function verifyPassword(plain, hash) {
  if (!hash) return false;
  // legacy plain fallback during migration
  if (!String(hash).startsWith('$2')) return String(plain) === String(hash);
  return bcrypt.compare(String(plain), String(hash));
}

function publicUser(row, subjects = []) {
  if (!row) return null;
  return {
    id: row.Id,
    role: row.Role,
    institutionId: row.InstitutionId || undefined,
    fullName: row.FullName,
    loginId: row.LoginId,
    phone: row.Phone || undefined,
    parentName: row.ParentName || undefined,
    parentPhone: row.ParentPhone || undefined,
    classId: row.ClassId || undefined,
    className: row.ClassName || undefined,
    isManager: !!row.IsManager,
    isMuhasebe: !!row.IsMuhasebe || row.Role === 'muhasebe',
    subjects,
    feeAmount: row.FeeAmount != null ? Number(row.FeeAmount) : undefined,
    paymentType: row.PaymentType || undefined,
    installmentCount: row.InstallmentCount != null ? Number(row.InstallmentCount) : undefined,
    paymentDay: row.PaymentDay != null ? Number(row.PaymentDay) : undefined,
    points: row.Points || 0,
    createdAt: row.CreatedAt ? new Date(row.CreatedAt).toISOString() : new Date().toISOString(),
  };
}

module.exports = {
  uid,
  signToken,
  authRequired,
  requireRole,
  canMuhasebe,
  hashPassword,
  verifyPassword,
  publicUser,
  JWT_SECRET,
};
