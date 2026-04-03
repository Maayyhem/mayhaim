// /api/training-plan — plans d'entraînement assignés par le coach
// POST   : créer un plan (coach)
// GET    : voir le plan actif (joueur) ou d'un joueur (coach)
// PATCH  : mettre à jour (cocher un exercice, modifier, archiver)
// DELETE : supprimer

const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

function setCors(req, res) {
  const o = req.headers.origin || '';
  const a = process.env.ALLOWED_ORIGIN || 'https://mayhaim.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', (o===a||/^https:\/\/mayhaim[^.]*\.vercel\.app$/.test(o))?o:a);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
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

  // ── POST — créer un plan ──────────────────────────────────────────────
  if (req.method === 'POST') {
    if (decoded.role !== 'coach' && decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Rôle coach requis' });
    }
    const { player_id, title, description, scenarios, target_energy, target_scenario } = req.body;
    if (!player_id || !title) return res.status(400).json({ error: 'player_id et title requis' });

    // Vérifie que ce joueur est bien suivi par ce coach
    const rel = await sql`
      SELECT id FROM coaching_relationships
      WHERE coach_id = ${decoded.id} AND player_id = ${player_id} AND status = 'active'
    `;
    if (rel.length === 0 && decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Ce joueur n\'est pas dans votre roster' });
    }

    // Archive les plans actifs précédents pour ce joueur
    await sql`
      UPDATE training_plans SET status = 'archived', updated_at = NOW()
      WHERE player_id = ${player_id} AND coach_id = ${decoded.id} AND status = 'active'
    `;

    const result = await sql`
      INSERT INTO training_plans
        (coach_id, player_id, title, description, scenarios, target_energy, target_scenario)
      VALUES
        (${decoded.id}, ${player_id}, ${title}, ${description||null},
         ${JSON.stringify(scenarios||[])}, ${target_energy||null}, ${target_scenario||null})
      RETURNING *
    `;
    // Notifier le joueur (non-bloquant)
    sql`INSERT INTO notifications (user_id, type, title, body, tab)
      VALUES (${player_id}, 'plan', 'Nouveau plan d\'entraînement',
              ${title}, 'cp-mon-plan')`.catch(() => {});
    return res.status(201).json({ plan: result[0] });
  }

  // ── GET — lire un plan ────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { player_id, plan_id } = req.query || {};

    // Plan spécifique par ID
    if (plan_id) {
      const rows = await sql`
        SELECT tp.*, u.username AS coach_username        FROM training_plans tp
        LEFT JOIN users u ON u.id = tp.coach_id
        WHERE tp.id = ${parseInt(plan_id)}
          AND (tp.player_id = ${decoded.id} OR tp.coach_id = ${decoded.id})
      `;
      if (rows.length === 0) return res.status(404).json({ error: 'Plan introuvable' });
      return res.status(200).json({ plan: rows[0] });
    }

    // Coach : plans d'un joueur spécifique
    if (player_id && (decoded.role === 'coach' || decoded.role === 'admin')) {
      const rows = await sql`
        SELECT * FROM training_plans
        WHERE player_id = ${parseInt(player_id)} AND coach_id = ${decoded.id}
        ORDER BY created_at DESC
      `;
      return res.status(200).json({ plans: rows });
    }

    // Joueur : son plan actif
    const rows = await sql`
      SELECT tp.*, u.username AS coach_username      FROM training_plans tp
      LEFT JOIN users u ON u.id = tp.coach_id
      WHERE tp.player_id = ${decoded.id} AND tp.status = 'active'
      ORDER BY tp.created_at DESC
      LIMIT 1
    `;
    return res.status(200).json({ plan: rows[0] || null });
  }

  // ── PATCH — mettre à jour ─────────────────────────────────────────────
  if (req.method === 'PATCH') {
    const { plan_id, scenarios, status, title, description, target_energy, target_scenario } = req.body;
    if (!plan_id) return res.status(400).json({ error: 'plan_id requis' });

    // Vérifier accès
    const rows = await sql`
      SELECT * FROM training_plans WHERE id = ${plan_id}
        AND (player_id = ${decoded.id} OR coach_id = ${decoded.id})
    `;
    if (rows.length === 0) return res.status(404).json({ error: 'Plan introuvable' });

    // Le joueur peut seulement cocher des exercices (mettre à jour scenarios)
    // Le coach peut tout modifier
    const isCoach = rows[0].coach_id === decoded.id || decoded.role === 'admin';

    if (!isCoach && (status || title || description)) {
      return res.status(403).json({ error: 'Seul le coach peut modifier le plan' });
    }

    await sql`
      UPDATE training_plans SET
        scenarios        = COALESCE(${scenarios ? JSON.stringify(scenarios) : null}::jsonb, scenarios),
        status           = COALESCE(${status||null}, status),
        title            = COALESCE(${isCoach && title ? title : null}, title),
        description      = COALESCE(${isCoach && description ? description : null}, description),
        target_energy    = COALESCE(${isCoach && target_energy ? target_energy : null}::float, target_energy),
        target_scenario  = COALESCE(${isCoach && target_scenario ? target_scenario : null}, target_scenario),
        updated_at       = NOW()
      WHERE id = ${plan_id}
    `;
    return res.status(200).json({ success: true });
  }

  // ── DELETE ────────────────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { plan_id } = req.body;
    if (!plan_id) return res.status(400).json({ error: 'plan_id requis' });

    if (decoded.role !== 'coach' && decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Rôle coach requis' });
    }
    await sql`DELETE FROM training_plans WHERE id = ${plan_id} AND coach_id = ${decoded.id}`;
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
