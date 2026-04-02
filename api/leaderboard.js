const { neon } = require('@neondatabase/serverless');

function setCors(req, res) {
  const o = req.headers.origin || '';
  const a = process.env.ALLOWED_ORIGIN || 'https://mayhaim.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', (o===a||/^https:\/\/mayhaim[^.]*\.vercel\.app$/.test(o))?o:a);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const sql = neon(process.env.DATABASE_URL);

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

  // Top 50 players: join with users table for real username
  const rows = await sql`
    SELECT
      gh.user_id,
      COALESCE(u.username, gh.username, 'Joueur') AS username,
      SUM(gh.score) AS total_score,
      COUNT(*) AS total_games,
      ROUND(AVG(gh.accuracy)) AS avg_accuracy,
      MAX(gh.score) AS best_game,
      MAX(gh.played_at) AS last_played
    FROM game_history gh
    LEFT JOIN users u ON u.id = gh.user_id
    GROUP BY gh.user_id, u.username, gh.username
    ORDER BY total_score DESC
    LIMIT 50
  `;
  return res.status(200).json({ leaderboard: rows });
};
