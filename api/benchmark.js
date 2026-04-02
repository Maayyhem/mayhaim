// /api/benchmark — sauvegarde et lecture des runs benchmark
// POST : sauvegarder un run
// GET  : ?user_id=x (coach) | ?scenario=x | résumé best scores

const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

function setCors(req, res) {
  const o = req.headers.origin || '';
  const a = process.env.ALLOWED_ORIGIN || 'https://mayhaim.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', (o===a||/^https:\/\/mayhaim[^.]*\.vercel\.app$/.test(o))?o:a);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

function verifyToken(req) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.split(' ')[1], process.env.JWT_SECRET); }
  catch { return null; }
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Non autorisé' });

  const sql = neon(process.env.DATABASE_URL);

  // ── POST — sauvegarder un run ─────────────────────────────────────────
  if (req.method === 'POST') {
    const { scenario, score, accuracy, hits, misses, energy, rank_name,
            difficulty, duration, is_benchmark } = req.body;

    if (!scenario) return res.status(400).json({ error: 'scenario requis' });

    await sql`
      INSERT INTO benchmark_runs
        (user_id, scenario, score, accuracy, hits, misses, energy, rank_name, difficulty, duration, is_benchmark)
      VALUES
        (${decoded.id}, ${scenario}, ${score||0}, ${accuracy||0}, ${hits||0},
         ${misses||0}, ${energy||0}, ${rank_name||null}, ${difficulty||'medium'},
         ${duration||60}, ${is_benchmark||false})
    `;
    return res.status(201).json({ success: true });
  }

  // ── GET ───────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { view, user_id, scenario, limit: lim } = req.query || {};
    const limit = Math.min(parseInt(lim) || 100, 500);

    // Résumé : meilleur score par scénario (pour le dashboard benchmark)
    if (view === 'best') {
      const targetId = user_id ? parseInt(user_id) : decoded.id;

      // Si c'est un autre user, vérifier que le demandeur est son coach
      if (targetId !== decoded.id) {
        const rel = await sql`
          SELECT id FROM coaching_relationships
          WHERE coach_id = ${decoded.id} AND player_id = ${targetId} AND status = 'active'
        `;
        if (rel.length === 0 && decoded.role !== 'admin') {
          return res.status(403).json({ error: 'Accès refusé : pas le coach de ce joueur' });
        }
      }

      const rows = await sql`
        SELECT DISTINCT ON (scenario)
          id, scenario, score, accuracy, energy, rank_name, difficulty, played_at
        FROM benchmark_runs
        WHERE user_id = ${targetId} AND is_benchmark = true
        ORDER BY scenario, score DESC
      `;
      return res.status(200).json({ best: rows });
    }

    // Historique complet d'un scénario (pour le graphe d'évolution)
    if (view === 'history' && scenario) {
      const targetId = user_id ? parseInt(user_id) : decoded.id;

      if (targetId !== decoded.id) {
        const rel = await sql`
          SELECT id FROM coaching_relationships
          WHERE coach_id = ${decoded.id} AND player_id = ${targetId} AND status = 'active'
        `;
        if (rel.length === 0 && decoded.role !== 'admin') {
          return res.status(403).json({ error: 'Accès refusé' });
        }
      }

      const rows = await sql`
        SELECT id, scenario, score, accuracy, energy, rank_name, difficulty, played_at
        FROM benchmark_runs
        WHERE user_id = ${targetId} AND scenario = ${scenario}
        ORDER BY played_at DESC
        LIMIT ${limit}
      `;
      return res.status(200).json({ history: rows });
    }

    // Tous les runs récents (free play + benchmark)
    if (view === 'recent') {
      const rows = await sql`
        SELECT id, scenario, score, accuracy, energy, rank_name, difficulty, is_benchmark, played_at
        FROM benchmark_runs
        WHERE user_id = ${decoded.id}
        ORDER BY played_at DESC
        LIMIT ${limit}
      `;
      return res.status(200).json({ runs: rows });
    }

    // Vue coach : résumé de tous ses joueurs (tableau de bord)
    if (view === 'coach-overview') {
      if (decoded.role !== 'coach' && decoded.role !== 'admin') {
        return res.status(403).json({ error: 'Rôle coach requis' });
      }
      // Pour chaque joueur actif, récupère son dernier energy global
      const rows = await sql`
        SELECT
          u.id, u.username,
          COUNT(br.id)::int AS total_runs,
          MAX(br.played_at) AS last_played,
          ROUND(AVG(br.energy)::numeric, 1) AS avg_energy,
          MAX(br.energy) AS best_energy
        FROM coaching_relationships cr
        JOIN users u ON u.id = cr.player_id
        LEFT JOIN benchmark_runs br ON br.user_id = u.id AND br.is_benchmark = true
        WHERE cr.coach_id = ${decoded.id} AND cr.status = 'active'
        GROUP BY u.id, u.username
        ORDER BY avg_energy DESC NULLS LAST
      `;
      return res.status(200).json({ overview: rows });
    }

    // Profil public d'un joueur (pas d'auth requise — token optionnel)
    // GET /api/benchmark?view=profile&username=xxx
    if (view === 'profile') {
      const { username } = req.query;
      if (!username) return res.status(400).json({ error: 'username requis' });

      const users = await sql`SELECT id, username, role, bio, avatar_url, created_at FROM users WHERE username = ${username}`;
      if (users.length === 0) return res.status(404).json({ error: 'Joueur introuvable' });
      const user = users[0];

      const best = await sql`
        SELECT DISTINCT ON (scenario) scenario, score, accuracy, energy, rank_name, played_at
        FROM benchmark_runs WHERE user_id = ${user.id} AND is_benchmark = true
        ORDER BY scenario, score DESC`;

      const stats = await sql`
        SELECT COUNT(*)::int AS total_runs,
          COUNT(*) FILTER (WHERE is_benchmark)::int AS benchmark_runs,
          ROUND(AVG(accuracy)::numeric,1) AS avg_accuracy,
          MAX(score) AS best_score,
          ROUND(AVG(energy) FILTER (WHERE is_benchmark AND energy>0)::numeric,1) AS avg_energy,
          MAX(energy) AS best_energy,
          MIN(played_at) AS first_played, MAX(played_at) AS last_played
        FROM benchmark_runs WHERE user_id = ${user.id}`;

      const progression = await sql`
        SELECT DATE(played_at) AS day, COUNT(*)::int AS runs,
          ROUND(AVG(energy) FILTER (WHERE is_benchmark AND energy>0)::numeric,1) AS avg_energy
        FROM benchmark_runs
        WHERE user_id = ${user.id} AND played_at > NOW() - INTERVAL '30 days'
        GROUP BY DATE(played_at) ORDER BY day ASC`;

      return res.status(200).json({
        user: { id:user.id, username:user.username, role:user.role, bio:user.bio, avatar_url:user.avatar_url, member_since:user.created_at },
        stats: stats[0] || {}, best_scores: best, progression,
      });
    }

    return res.status(400).json({ error: 'view requis : best | history | recent | coach-overview | profile' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
