const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
}
function verifyToken(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.split(' ')[1], process.env.JWT_SECRET); } catch { return null; }
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  await sql`CREATE TABLE IF NOT EXISTS coach_data (
    id SERIAL PRIMARY KEY,
    data_type VARCHAR(50) NOT NULL,
    data_key VARCHAR(200) NOT NULL,
    data_value JSONB NOT NULL DEFAULT '{}',
    updated_by INTEGER,
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(data_type, data_key)
  )`;

  if (req.method === 'GET') {
    const type = req.query?.type;
    const rows = type
      ? await sql`SELECT * FROM coach_data WHERE data_type = ${type} ORDER BY updated_at DESC`
      : await sql`SELECT * FROM coach_data ORDER BY updated_at DESC`;
    return res.status(200).json({ data: rows });
  }

  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Non autorisé' });
  if (decoded.role !== 'admin' && decoded.role !== 'coach') return res.status(403).json({ error: 'Coach ou Admin requis' });

  if (req.method === 'POST') {
    const { data_type, data_key, data_value } = req.body;
    if (!data_type || !data_key) return res.status(400).json({ error: 'data_type et data_key requis' });
    await sql`
      INSERT INTO coach_data (data_type, data_key, data_value, updated_by, updated_at)
      VALUES (${data_type}, ${data_key}, ${JSON.stringify(data_value)}, ${decoded.id}, NOW())
      ON CONFLICT (data_type, data_key)
      DO UPDATE SET data_value = ${JSON.stringify(data_value)}, updated_by = ${decoded.id}, updated_at = NOW()
    `;
    return res.status(200).json({ success: true });
  }

  if (req.method === 'DELETE') {
    const { data_type, data_key } = req.body;
    if (!data_type || !data_key) return res.status(400).json({ error: 'data_type et data_key requis' });
    await sql`DELETE FROM coach_data WHERE data_type = ${data_type} AND data_key = ${data_key}`;
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
