// /api/coaching — gestion des relations coach ↔ joueur
// Actions : request | accept | decline | end
// Vues    : my-players | my-coach | pending

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

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const view = req.query?.view;

    // Coach : liste ses joueurs actifs
    if (view === 'my-players') {
      if (decoded.role !== 'coach' && decoded.role !== 'admin') {
        return res.status(403).json({ error: 'Rôle coach requis' });
      }
      const rows = await sql`
        SELECT
          r.id AS rel_id, r.status, r.created_at,
          u.id, u.username, u.email, u.avatar_url
        FROM coaching_relationships r
        JOIN users u ON u.id = r.player_id
        WHERE r.coach_id = ${decoded.id} AND r.status = 'active'
        ORDER BY r.created_at DESC
      `;
      return res.status(200).json({ players: rows });
    }

    // Joueur : voit son coach actif
    if (view === 'my-coach') {
      const rows = await sql`
        SELECT
          r.id AS rel_id, r.status, r.created_at,
          u.id, u.username, u.email, u.avatar_url, u.bio
        FROM coaching_relationships r
        JOIN users u ON u.id = r.coach_id
        WHERE r.player_id = ${decoded.id} AND r.status = 'active'
        LIMIT 1
      `;
      return res.status(200).json({ coach: rows[0] || null });
    }

    // Demandes en attente (pour l'un ou l'autre)
    if (view === 'pending') {
      const rows = await sql`
        SELECT
          r.id AS rel_id, r.status, r.message, r.created_at, r.requested_by,
          c.id AS coach_id, c.username AS coach_username, c.avatar_url AS coach_avatar,
          p.id AS player_id, p.username AS player_username, p.avatar_url AS player_avatar
        FROM coaching_relationships r
        JOIN users c ON c.id = r.coach_id
        JOIN users p ON p.id = r.player_id
        WHERE r.status = 'pending'
          AND (r.coach_id = ${decoded.id} OR r.player_id = ${decoded.id})
        ORDER BY r.created_at DESC
      `;
      return res.status(200).json({ pending: rows });
    }

    // Admin : tous les utilisateurs avec leur rôle
    if (view === 'all-users') {
      if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin requis' });
      const rows = await sql`
        SELECT id, email, username, role, created_at FROM users ORDER BY created_at DESC
      `;
      return res.status(200).json({ students: rows });
    }

    // Admin : toutes les relations coaching
    if (view === 'all-relationships') {
      if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin requis' });
      const rows = await sql`
        SELECT
          r.id AS rel_id, r.status, r.created_at, r.updated_at,
          c.id AS coach_id, c.username AS coach_username, c.role AS coach_role,
          p.id AS player_id, p.username AS player_username
        FROM coaching_relationships r
        JOIN users c ON c.id = r.coach_id
        JOIN users p ON p.id = r.player_id
        ORDER BY r.created_at DESC
      `;
      return res.status(200).json({ relationships: rows });
    }

    return res.status(400).json({ error: 'view requis : my-players | my-coach | pending | all-users | all-relationships' });
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { action, target_username, message, rel_id } = req.body;

    // ── Envoyer une demande ──────────────────────────────────────────────
    if (action === 'request') {
      if (!target_username) return res.status(400).json({ error: 'target_username requis' });

      // Trouver la cible
      const targets = await sql`SELECT id, role FROM users WHERE username = ${target_username}`;
      if (targets.length === 0) return res.status(404).json({ error: 'Utilisateur introuvable' });
      const target = targets[0];

      // Déterminer coach_id / player_id selon les rôles
      let coach_id, player_id;
      if (decoded.role === 'coach' || decoded.role === 'admin') {
        coach_id  = decoded.id;
        player_id = target.id;
      } else {
        // joueur invite un coach
        if (target.role !== 'coach' && target.role !== 'admin') {
          return res.status(400).json({ error: 'La cible doit être un coach' });
        }
        coach_id  = target.id;
        player_id = decoded.id;
      }

      // Vérifie doublon
      const existing = await sql`
        SELECT id, status FROM coaching_relationships
        WHERE coach_id = ${coach_id} AND player_id = ${player_id}
      `;
      if (existing.length > 0) {
        return res.status(409).json({ error: 'Relation déjà existante', status: existing[0].status });
      }

      await sql`
        INSERT INTO coaching_relationships (coach_id, player_id, status, requested_by, message)
        VALUES (${coach_id}, ${player_id}, 'pending', ${decoded.id}, ${message || null})
      `;
      return res.status(201).json({ success: true });
    }

    // ── Accepter ─────────────────────────────────────────────────────────
    if (action === 'accept') {
      if (!rel_id) return res.status(400).json({ error: 'rel_id requis' });
      const rows = await sql`
        SELECT * FROM coaching_relationships WHERE id = ${rel_id} AND status = 'pending'
      `;
      if (rows.length === 0) return res.status(404).json({ error: 'Demande introuvable' });
      const rel = rows[0];
      // Seul le destinataire (celui qui N'a pas envoyé) peut accepter
      if (rel.requested_by === decoded.id) {
        return res.status(403).json({ error: 'Vous ne pouvez pas accepter votre propre demande' });
      }
      if (rel.coach_id !== decoded.id && rel.player_id !== decoded.id) {
        return res.status(403).json({ error: 'Non autorisé' });
      }
      await sql`
        UPDATE coaching_relationships SET status = 'active', updated_at = NOW() WHERE id = ${rel_id}
      `;
      return res.status(200).json({ success: true });
    }

    // ── Refuser ───────────────────────────────────────────────────────────
    if (action === 'decline') {
      if (!rel_id) return res.status(400).json({ error: 'rel_id requis' });
      const rows = await sql`
        SELECT * FROM coaching_relationships WHERE id = ${rel_id}
          AND (coach_id = ${decoded.id} OR player_id = ${decoded.id})
      `;
      if (rows.length === 0) return res.status(404).json({ error: 'Relation introuvable' });
      await sql`
        UPDATE coaching_relationships SET status = 'declined', updated_at = NOW() WHERE id = ${rel_id}
      `;
      return res.status(200).json({ success: true });
    }

    // ── Terminer ──────────────────────────────────────────────────────────
    if (action === 'end') {
      if (!rel_id) return res.status(400).json({ error: 'rel_id requis' });
      const rows = await sql`
        SELECT * FROM coaching_relationships WHERE id = ${rel_id}
          AND (coach_id = ${decoded.id} OR player_id = ${decoded.id})
      `;
      if (rows.length === 0) return res.status(404).json({ error: 'Relation introuvable' });
      await sql`
        UPDATE coaching_relationships SET status = 'ended', updated_at = NOW() WHERE id = ${rel_id}
      `;
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'action requis : request | accept | decline | end' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
