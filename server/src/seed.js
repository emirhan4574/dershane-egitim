const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { query, getPool } = require('./db');

async function ensureAdmin() {
  await getPool();
  const existing = await query(
    `SELECT TOP 1 Id FROM dbo.Users WHERE Role = N'superadmin' AND LoginId = N'admin' AND IsDeleted = 0`
  );
  if (existing.recordset.length) {
    console.log('Admin zaten var.');
    return;
  }
  const hash = await bcrypt.hash('admin123', 10);
  const id = 'usr_platform_admin';
  await query(
    `INSERT INTO dbo.Users (Id, Role, InstitutionId, FullName, LoginId, PasswordHash, IsManager, Points, CreatedAt, UpdatedAt, IsDeleted)
     VALUES (@Id, N'superadmin', NULL, N'Platform Admin', N'admin', @Hash, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME(), 0)`,
    { Id: id, Hash: hash }
  );
  console.log('Admin oluşturuldu: admin / admin123');
}

ensureAdmin()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
