require('dotenv').config();
const sql = require('mssql');

const config = {
  server: process.env.SQL_SERVER || 'localhost',
  port: Number(process.env.SQL_PORT || 1433),
  database: process.env.SQL_DATABASE || 'DershaneDb',
  user: process.env.SQL_USER || 'sa',
  password: process.env.SQL_PASSWORD || '',
  options: {
    encrypt: String(process.env.SQL_ENCRYPT || 'false') === 'true',
    trustServerCertificate: String(process.env.SQL_TRUST_CERT || 'true') === 'true',
    enableArithAbort: true,
  },
  pool: { max: 20, min: 0, idleTimeoutMillis: 30000 },
};

let poolPromise;

function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(config);
  }
  return poolPromise;
}

async function query(text, inputs = {}) {
  const pool = await getPool();
  const req = pool.request();
  for (const [key, val] of Object.entries(inputs)) {
    req.input(key, val);
  }
  return req.query(text);
}

async function ping() {
  const r = await query('SELECT 1 AS ok');
  return r.recordset[0]?.ok === 1;
}

module.exports = { sql, getPool, query, ping, config };
