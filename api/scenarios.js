const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
}

function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
  } catch (e) { return null; }
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Token manquant ou invalide' });

  const sql = neon(process.env.DATABASE_URL);

  // Auto-create and migrate table
  await sql`CREATE TABLE IF NOT EXISTS scenarios (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    rank VARCHAR(50),
    map VARCHAR(100),
    type VARCHAR(50),
    difficulty INTEGER DEFAULT 3,
    description TEXT DEFAULT '',
    guide TEXT DEFAULT '',
    tips TEXT DEFAULT '',
    aim_mode VARCHAR(100) DEFAULT '',
    aim_diff VARCHAR(20) DEFAULT 'medium',
    created_by INTEGER,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`;
  await sql`ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS aim_mode VARCHAR(100) DEFAULT ''`;
  await sql`ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS aim_diff VARCHAR(20) DEFAULT 'medium'`;
  await sql`ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS created_by INTEGER`;
  await sql`ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`;
  await sql`ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`;

  if (req.method === 'GET') {
    const scenarios = await sql`SELECT * FROM scenarios ORDER BY id ASC`;
    return res.status(200).json({ scenarios });
  }

  if (req.method === 'POST') {
    if (decoded.role !== 'admin' && decoded.role !== 'coach') {
      return res.status(403).json({ error: 'Coach ou Admin requis' });
    }
    try {
      const data = req.body;
      const result = await sql`
        INSERT INTO scenarios (title, rank, map, type, difficulty, description, guide, tips, aim_mode, aim_diff, created_by)
        VALUES (${data.title}, ${data.rank}, ${data.map}, ${data.type}, ${data.difficulty || 3}, ${data.description || ''}, ${data.guide || ''}, ${data.tips || ''}, ${data.aim_mode || ''}, ${data.aim_diff || 'medium'}, ${decoded.id})
        RETURNING *
      `;
      return res.status(201).json({ scenario: result[0] });
    } catch (err) {
      console.error('Create scenario error:', err);
      return res.status(500).json({ error: 'Erreur creation' });
    }
  }

  if (req.method === 'PUT') {
    if (decoded.role !== 'admin' && decoded.role !== 'coach') {
      return res.status(403).json({ error: 'Coach ou Admin requis' });
    }
    try {
      const data = req.body;
      if (!data.id) return res.status(400).json({ error: 'ID requis' });

      await sql`
        UPDATE scenarios SET
          title = ${data.title}, rank = ${data.rank}, map = ${data.map}, type = ${data.type},
          difficulty = ${data.difficulty || 3}, description = ${data.description || ''},
          guide = ${data.guide || ''}, tips = ${data.tips || ''},
          aim_mode = ${data.aim_mode || ''}, aim_diff = ${data.aim_diff || 'medium'},
          updated_at = NOW()
        WHERE id = ${data.id}
      `;
      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Update scenario error:', err);
      return res.status(500).json({ error: 'Erreur mise a jour' });
    }
  }

  if (req.method === 'DELETE') {
    if (decoded.role !== 'admin' && decoded.role !== 'coach') return res.status(403).json({ error: 'Coach ou Admin requis' });
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'ID requis' });
    await sql`DELETE FROM scenarios WHERE id = ${id}`;
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
