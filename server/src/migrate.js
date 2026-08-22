const fs = require('fs');
const path = require('path');
const sql = require('mssql');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function run() {
  const base = {
    server: process.env.SQL_SERVER || 'localhost',
    port: Number(process.env.SQL_PORT || 1433),
    user: process.env.SQL_USER || 'sa',
    password: process.env.SQL_PASSWORD || '',
    options: {
      encrypt: String(process.env.SQL_ENCRYPT || 'false') === 'true',
      trustServerCertificate: String(process.env.SQL_TRUST_CERT || 'true') === 'true',
      enableArithAbort: true,
    },
  };

  const dbDir = path.join(__dirname, '..', '..', 'database');
  const files = [
    '01_create_database.sql',
    '02_tables.sql',
    '03_indexes.sql',
    '04_seed.sql',
    '05_views_procs.sql',
    '06_payment_muhasebe.sql',
  ];

  console.log('SQL migrate başlıyor...', base.server);

  // master ile DB oluştur
  let pool = await sql.connect({ ...base, database: 'master' });
  const createSql = fs.readFileSync(path.join(dbDir, '01_create_database.sql'), 'utf8');
  for (const batch of splitBatches(createSql)) {
    if (!batch.trim()) continue;
    await pool.request().query(batch);
  }
  await pool.close();

  pool = await sql.connect({ ...base, database: process.env.SQL_DATABASE || 'DershaneDb' });
  for (const file of files.slice(1)) {
    const full = path.join(dbDir, file);
    console.log('Çalışıyor:', file);
    const text = fs.readFileSync(full, 'utf8');
    for (const batch of splitBatches(text)) {
      if (!batch.trim()) continue;
      try {
        await pool.request().query(batch);
      } catch (err) {
        console.error('Batch hata @', file, err.message);
        throw err;
      }
    }
  }
  await pool.close();
  console.log('Migrate tamam.');
}

function splitBatches(sqlText) {
  return sqlText
    .split(/^\s*GO\s*$/gim)
    .map((s) => s.trim())
    .filter(Boolean);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
