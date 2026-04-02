// /api/feedback — commentaires coach sur les runs d'un joueur
// POST : créer un feedback (coach)
// GET  : lire les feedbacks (joueur ou coach)

const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
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
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Non autorisé' });

  const sql = neon(process.env.DATABASE_URL);

  // ── POST — laisser un feedback ────────────────────────────────────────
  if (req.method === 'POST') {
    if (decoded.role !== 'coach' && decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Rôle coach requis' });
    }
    const { player_id, run_id, content, strengths, weaknesses, week_objective } = req.body;
    if (!player_id || !content) {
      return res.status(400).json({ error: 'player_id et content requis' });
    }

    // Vérifier que le joueur est bien suivi par ce coach
    const rel = await sql`
      SELECT id FROM coaching_relationships
      WHERE coach_id = ${decoded.id} AND player_id = ${player_id} AND status = 'active'
    `;
    if (rel.length === 0 && decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Ce joueur n\'est pas dans votre roster' });
    }

    const result = await sql`
      INSERT INTO feedback (coach_id, player_id, run_id, content, strengths, weaknesses, week_objective)
      VALUES (${decoded.id}, ${player_id}, ${run_id||null}, ${content},
              ${strengths||null}, ${weaknesses||null}, ${week_objective||null})
      RETURNING *
    `;
    return res.status(201).json({ feedback: result[0] });
  }

  // ── GET ───────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { player_id, limit: lim } = req.query || {};
    const limit = Math.min(parseInt(lim) || 20, 100);

    // Coach : feedbacks qu'il a donnés à un joueur
    if (player_id && (decoded.role === 'coach' || decoded.role === 'admin')) {
      const rows = await sql`
        SELECT f.*, br.scenario, br.score, br.energy, br.played_at AS run_date
        FROM feedback f
        LEFT JOIN benchmark_runs br ON br.id = f.run_id
        WHERE f.coach_id = ${decoded.id} AND f.player_id = ${parseInt(player_id)}
        ORDER BY f.created_at DESC
        LIMIT ${limit}
      `;
      return res.status(200).json({ feedbacks: rows });
    }

    // Joueur : feedbacks reçus (de n'importe quel coach)
    const rows = await sql`
      SELECT
        f.*,
        u.username AS coach_username,
        br.scenario, br.score, br.energy, br.played_at AS run_date
      FROM feedback f
      JOIN users u ON u.id = f.coach_id
      LEFT JOIN benchmark_runs br ON br.id = f.run_id
      WHERE f.player_id = ${decoded.id}
      ORDER BY f.created_at DESC
      LIMIT ${limit}
    `;
    return res.status(200).json({ feedbacks: rows });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
