// /api/feedback — commentaires coach sur les runs d'un joueur
// POST : créer un feedback (coach)
// GET  : lire les feedbacks (joueur ou coach)

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
  try { return jwt.verify(h.split(' ')[1], process.env.JWT_SECRET, { algorithms: ['HS256'] }); }
  catch { return null; }
}

let _errTableReady = false;
async function ensureErrorTable(sql) {
  if (_errTableReady) return;
  await sql`CREATE TABLE IF NOT EXISTS client_errors (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    message TEXT NOT NULL,
    stack TEXT,
    url TEXT,
    app_version TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;
  _errTableReady = true;
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── Rapport d'erreur client (monitoring) ──────────────────────────────
  // Auth optionnelle : les crashes arrivent aussi hors-login. Tous les champs
  // sont bornés côté serveur, et on n'insère jamais plus d'un rapport par
  // requête — le throttle principal est côté client (max 5/session).
  if (req.method === 'POST' && req.body?.action === 'client-error') {
    const sql = neon(process.env.DATABASE_URL);
    await ensureErrorTable(sql);
    const who = verifyToken(req); // null accepté
    const b = req.body || {};
    const cap = (v, n) => v == null ? null : String(v).slice(0, n);
    const message = cap(b.message, 500);
    if (!message) return res.status(400).json({ error: 'message requis' });
    try {
      await sql`INSERT INTO client_errors (user_id, message, stack, url, app_version, user_agent)
        VALUES (${who?.id || null}, ${message}, ${cap(b.stack, 2000)}, ${cap(b.url, 300)},
                ${cap(b.version, 20)}, ${cap(b.ua, 300)})`;
      // Rétention simple : on garde les 5000 derniers rapports
      await sql`DELETE FROM client_errors WHERE id < (SELECT COALESCE(MAX(id),0) - 5000 FROM client_errors)`;
    } catch(e) { console.error('[client-error] insert failed', e.message); }
    return res.status(204).end();
  }

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

    // Caps serveur : ces champs texte étaient non bornés (abus de stockage).
    const _cap = (v, n) => v == null ? null : String(v).slice(0, n);
    const result = await sql`
      INSERT INTO feedback (coach_id, player_id, run_id, content, strengths, weaknesses, week_objective)
      VALUES (${decoded.id}, ${player_id}, ${run_id||null}, ${_cap(content, 4000)},
              ${_cap(strengths, 2000)}, ${_cap(weaknesses, 2000)}, ${_cap(week_objective, 1000)})
      RETURNING *
    `;
    // Notifier le joueur (non-bloquant)
    const coachRow = await sql`SELECT username FROM users WHERE id = ${decoded.id} LIMIT 1`;
    sql`INSERT INTO notifications (user_id, type, title, body, tab)
      VALUES (${player_id}, 'feedback', 'Nouveau feedback reçu',
              ${`${coachRow[0]?.username || 'Ton coach'} : ${content.substring(0,60)}`}, 'cp-feedbacks')`.catch(() => {});
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
