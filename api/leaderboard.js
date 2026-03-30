const { neon } = require('@neondatabase/serverless');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
}

module.exports = async function handler(req, res) {
  setCors(res);
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

  // Top 50 players: sum of best score per mode, plus total games & avg accuracy
  const rows = await sql`
    SELECT
      user_id,
      username,
      SUM(score) AS total_score,
      COUNT(*) AS total_games,
      ROUND(AVG(accuracy)) AS avg_accuracy,
      MAX(score) AS best_game,
      MAX(played_at) AS last_played
    FROM game_history
    GROUP BY user_id, username
    ORDER BY total_score DESC
    LIMIT 50
  `;
  return res.status(200).json({ leaderboard: rows });
};
