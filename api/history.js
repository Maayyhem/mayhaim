const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

function setCors(req, res) {
  const o = req.headers.origin || '';
  const a = process.env.ALLOWED_ORIGIN || 'https://mayhaim.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', o === a ? o : a);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}
function verifyToken(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.split(' ')[1], process.env.JWT_SECRET); } catch { return null; }
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Non autorisé' });
  const sql = neon(process.env.DATABASE_URL);

  // Auto-create table
  await sql`CREATE TABLE IF NOT EXISTS game_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    username VARCHAR(100),
    mode VARCHAR(100) NOT NULL,
    score INTEGER DEFAULT 0,
    accuracy INTEGER DEFAULT 0,
    hits INTEGER DEFAULT 0,
    misses INTEGER DEFAULT 0,
    avg_reaction INTEGER,
    best_combo INTEGER DEFAULT 0,
    duration INTEGER DEFAULT 60,
    played_at TIMESTAMP DEFAULT NOW()
  )`;

  if (req.method === 'GET') {
    const limit = parseInt(req.query?.limit) || 50;
    const rows = await sql`
      SELECT * FROM game_history WHERE user_id = ${decoded.id}
      ORDER BY played_at DESC LIMIT ${limit}
    `;
    return res.status(200).json({ history: rows });
  }

  if (req.method === 'POST') {
    const { mode, score, accuracy, hits, misses, avg_reaction, best_combo, duration } = req.body;
    // Fetch real username from users table
    const userRow = await sql`SELECT username FROM users WHERE id = ${decoded.id} LIMIT 1`;
    const username = userRow[0]?.username || decoded.email;
    await sql`
      INSERT INTO game_history (user_id, username, mode, score, accuracy, hits, misses, avg_reaction, best_combo, duration)
      VALUES (${decoded.id}, ${username}, ${mode||''}, ${score||0}, ${accuracy||0},
              ${hits||0}, ${misses||0}, ${avg_reaction||null}, ${best_combo||0}, ${duration||60})
    `;
    return res.status(201).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
