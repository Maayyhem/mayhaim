// /api/player-profile — profil public d'un joueur (pas d'auth requise)
// GET ?username=xxx → stats publiques, meilleurs scores, rang global

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

  const { username } = req.query || {};
  if (!username) return res.status(400).json({ error: 'username requis' });

  try {
    const sql = neon(process.env.DATABASE_URL);

    // Infos de base
    const users = await sql`
      SELECT id, username, role, bio, avatar_url, created_at
      FROM users WHERE username = ${username}
    `;
    if (users.length === 0) return res.status(404).json({ error: 'Joueur introuvable' });
    const user = users[0];

    // Meilleurs scores benchmark par scénario
    const best = await sql`
      SELECT DISTINCT ON (scenario)
        scenario, score, accuracy, energy, rank_name, played_at
      FROM benchmark_runs
      WHERE user_id = ${user.id} AND is_benchmark = true
      ORDER BY scenario, score DESC
    `;

    // Statistiques globales
    const stats = await sql`
      SELECT
        COUNT(*)::int                       AS total_runs,
        COUNT(*) FILTER (WHERE is_benchmark)::int AS benchmark_runs,
        ROUND(AVG(accuracy)::numeric, 1)    AS avg_accuracy,
        MAX(score)                          AS best_score,
        ROUND(AVG(energy) FILTER (WHERE is_benchmark AND energy > 0)::numeric, 1) AS avg_energy,
        MAX(energy)                         AS best_energy,
        MIN(played_at)                      AS first_played,
        MAX(played_at)                      AS last_played
      FROM benchmark_runs
      WHERE user_id = ${user.id}
    `;

    // Progression sur les 30 derniers jours (1 point par jour joué)
    const progression = await sql`
      SELECT
        DATE(played_at) AS day,
        COUNT(*)::int   AS runs,
        ROUND(AVG(energy) FILTER (WHERE is_benchmark AND energy > 0)::numeric, 1) AS avg_energy
      FROM benchmark_runs
      WHERE user_id = ${user.id} AND played_at > NOW() - INTERVAL '30 days'
      GROUP BY DATE(played_at)
      ORDER BY day ASC
    `;

    return res.status(200).json({
      user: {
        id:          user.id,
        username:    user.username,
        role:        user.role,
        bio:         user.bio,
        avatar_url:  user.avatar_url,
        member_since: user.created_at,
      },
      stats:       stats[0] || {},
      best_scores: best,
      progression,
    });
  } catch (err) {
    console.error('Player profile error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};
