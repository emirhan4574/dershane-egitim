const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const { getPool, query } = require('./db');
const routes = require('./routes');

const app = express();
const PORT = Number(process.env.PORT || 3001);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN === '*' ? true : process.env.CORS_ORIGIN || true,
  })
);
app.use(express.json({ limit: '25mb' }));

app.use('/api', routes);

async function ensureAdmin() {
  const existing = await query(
    `SELECT TOP 1 Id, PasswordHash FROM dbo.Users WHERE Role = N'superadmin' AND LoginId = N'admin' AND IsDeleted = 0`
  );
  if (!existing.recordset.length) {
    const hash = await bcrypt.hash('admin123', 10);
    await query(
      `INSERT INTO dbo.Users (Id, Role, InstitutionId, FullName, LoginId, PasswordHash, IsManager, Points, CreatedAt, UpdatedAt, IsDeleted)
       VALUES (N'usr_platform_admin', N'superadmin', NULL, N'Platform Admin', N'admin', @Hash, 0, 0, SYSUTCDATETIME(), SYSUTCDATETIME(), 0)`,
      { Hash: hash }
    );
    console.log('Seed: admin / admin123 oluşturuldu');
    return;
  }
  const row = existing.recordset[0];
  if (!String(row.PasswordHash || '').startsWith('$2')) {
    const hash = await bcrypt.hash('admin123', 10);
    await query(`UPDATE dbo.Users SET PasswordHash = @Hash WHERE Id = @Id`, {
      Hash: hash,
      Id: row.Id,
    });
    console.log('Seed: admin şifre hash güncellendi');
  }
}

async function start() {
  try {
    await getPool();
    await ensureAdmin();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Dershane API http://0.0.0.0:${PORT}/api`);
      console.log(`Health: http://localhost:${PORT}/api/health`);
    });
  } catch (e) {
    console.error('API başlatılamadı. SQL bağlantısını kontrol edin.', e.message);
    console.error('Öneri: database/docker-compose.yml ile SQL ayağa kaldırın, sonra npm run migrate');
    process.exit(1);
  }
}

start();
