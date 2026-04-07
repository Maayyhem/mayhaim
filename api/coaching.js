// /api/coaching — gestion des relations coach ↔ joueur
// Actions : request | accept | decline | end
// Vues    : my-players | my-coach | pending

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

  // Auto-create tables
  await Promise.all([
    sql`CREATE TABLE IF NOT EXISTS voltaic_benchmarks (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      rank_idx INTEGER NOT NULL,
      rank_name TEXT NOT NULL,
      scenarios JSONB NOT NULL,
      played_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    sql`CREATE TABLE IF NOT EXISTS announcements (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'info',
      active BOOLEAN DEFAULT TRUE,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ
    )`,
    sql`CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      actor_id INTEGER,
      actor_email TEXT,
      action TEXT NOT NULL,
      target_id INTEGER,
      target_username TEXT,
      details TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`,
    sql`CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      rel_id INTEGER NOT NULL REFERENCES coaching_relationships(id) ON DELETE CASCADE,
      sender_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`
  ]);

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const view = req.query?.view;
    const userId = decoded.id;
    const userRole = decoded.role;

    // Coach : liste ses joueurs actifs
    if (view === 'my-players') {
      if (decoded.role !== 'coach' && decoded.role !== 'admin') {
        return res.status(403).json({ error: 'Rôle coach requis' });
      }
      const rows = await sql`
        SELECT
          r.id AS rel_id, r.status, r.created_at,
          u.id, u.username, u.email, u.current_rank, u.peak_elo, u.objective
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
          u.id, u.username, u.email
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
          c.id AS coach_id, c.username AS coach_username,
          p.id AS player_id, p.username AS player_username
        FROM coaching_relationships r
        JOIN users c ON c.id = r.coach_id
        JOIN users p ON p.id = r.player_id
        WHERE r.status = 'pending'
          AND (r.coach_id = ${decoded.id} OR r.player_id = ${decoded.id})
        ORDER BY r.created_at DESC
      `;
      return res.status(200).json({ pending: rows });
    }

    // Admin : tous les utilisateurs
    if (view === 'all-users') {
      if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin requis' });
      const rows = await sql`
        SELECT id, email, username, role, mfa_enabled, failed_attempts, locked_until,
               current_rank, peak_elo, objective, created_at
        FROM users ORDER BY created_at DESC
      `;
      return res.status(200).json({ users: rows, students: rows });
    }

    // Admin : stats globales
    if (view === 'admin-stats') {
      if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin requis' });
      const [userStats, sessions, rels, topScore] = await Promise.all([
        sql`SELECT
          COUNT(*)::int AS total_users,
          COUNT(*) FILTER (WHERE role = 'student')::int AS students,
          COUNT(*) FILTER (WHERE role = 'coach')::int AS coaches,
          COUNT(*) FILTER (WHERE role = 'admin')::int AS admins,
          COUNT(*) FILTER (WHERE mfa_enabled = true)::int AS mfa_enabled,
          COUNT(*) FILTER (WHERE locked_until > NOW())::int AS locked
        FROM users`,
        sql`SELECT COUNT(*)::int AS sessions FROM game_history`,
        sql`SELECT COUNT(*) FILTER (WHERE status = 'active')::int AS active_relations FROM coaching_relationships`,
        sql`SELECT MAX(score)::int AS top_score FROM game_history`
      ]);
      return res.status(200).json({
        ...userStats[0],
        sessions: sessions[0].sessions,
        active_relations: rels[0].active_relations,
        top_score: topScore[0].top_score
      });
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

    // Annonces actives (tous les utilisateurs connectés)
    if (view === 'announcements') {
      const rows = await sql`
        SELECT id, title, content, type, created_at
        FROM announcements
        WHERE active = TRUE AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY created_at DESC
      `;
      return res.status(200).json({ announcements: rows });
    }

    // Admin : toutes les annonces
    if (view === 'all-announcements') {
      if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin requis' });
      const rows = await sql`SELECT * FROM announcements ORDER BY created_at DESC`;
      return res.status(200).json({ announcements: rows });
    }

    // Admin : logs d'activité
    if (view === 'audit-logs') {
      if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin requis' });
      const rows = await sql`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200`;
      return res.status(200).json({ logs: rows });
    }

    // Conversations (coach ou joueur)
    if (view === 'conversations') {
      const rows = await sql`
        SELECT
          r.id AS rel_id,
          CASE WHEN r.coach_id = ${decoded.id} THEN p.username ELSE c.username END AS other_username,
          CASE WHEN r.coach_id = ${decoded.id} THEN p.id       ELSE c.id       END AS other_id,
          m.content AS last_message,
          m.created_at AS last_message_at,
          (SELECT COUNT(*)::int FROM messages WHERE rel_id = r.id AND read = FALSE AND sender_id != ${decoded.id}) AS unread
        FROM coaching_relationships r
        JOIN users c ON c.id = r.coach_id
        JOIN users p ON p.id = r.player_id
        LEFT JOIN LATERAL (
          SELECT content, created_at FROM messages WHERE rel_id = r.id ORDER BY created_at DESC LIMIT 1
        ) m ON TRUE
        WHERE (r.coach_id = ${decoded.id} OR r.player_id = ${decoded.id}) AND r.status = 'active'
        ORDER BY COALESCE(m.created_at, r.created_at) DESC
      `;
      return res.status(200).json({ conversations: rows });
    }

    // Messages d'une relation
    if (view === 'messages') {
      const relId = req.query?.rel_id;
      if (!relId) return res.status(400).json({ error: 'rel_id requis' });
      const rel = await sql`SELECT * FROM coaching_relationships WHERE id = ${relId} AND (coach_id = ${decoded.id} OR player_id = ${decoded.id})`;
      if (!rel.length) return res.status(403).json({ error: 'Non autorisé' });
      await sql`UPDATE messages SET read = TRUE WHERE rel_id = ${relId} AND sender_id != ${decoded.id}`;
      const msgs = await sql`
        SELECT m.*, u.username AS sender_username
        FROM messages m JOIN users u ON u.id = m.sender_id
        WHERE m.rel_id = ${relId} ORDER BY m.created_at ASC
      `;
      return res.status(200).json({ messages: msgs });
    }

    // Historique de jeu d'un joueur (coach uniquement)
    if (view === 'player-history') {
      const playerId = req.query?.player_id;
      if (!playerId) return res.status(400).json({ error: 'player_id requis' });
      const rel = await sql`SELECT id FROM coaching_relationships WHERE coach_id = ${decoded.id} AND player_id = ${playerId} AND status = 'active'`;
      if (!rel.length && decoded.role !== 'admin') return res.status(403).json({ error: 'Non autorisé' });
      const rows = await sql`SELECT * FROM game_history WHERE user_id = ${playerId} ORDER BY played_at DESC LIMIT 50`;
      return res.status(200).json({ history: rows });
    }

    // Dashboard stats (utilisateur connecté)
    if (view === 'dashboard-stats') {
      const uid = decoded.id;
      const [statsRow, activity, lastGame, rankRow, planRow, feedbackRow] = await Promise.all([
        sql`SELECT
              COUNT(*)::int AS total_games,
              COALESCE(MAX(score),0)::int AS best_score,
              COALESCE(ROUND(AVG(score)),0)::int AS avg_score,
              COALESCE(ROUND(AVG(accuracy)::numeric,1),0) AS avg_accuracy
            FROM game_history WHERE user_id = ${uid}`,
        sql`SELECT DATE(played_at) AS day, COUNT(*)::int AS games, MAX(score)::int AS best
            FROM game_history
            WHERE user_id = ${uid} AND played_at >= NOW() - INTERVAL '7 days'
            GROUP BY DATE(played_at) ORDER BY day`,
        sql`SELECT mode, score, accuracy, played_at FROM game_history
            WHERE user_id = ${uid} ORDER BY played_at DESC LIMIT 1`,
        sql`SELECT rank FROM (
              SELECT user_id, RANK() OVER (ORDER BY SUM(score) DESC)::int AS rank
              FROM game_history GROUP BY user_id
            ) t WHERE user_id = ${uid}`,
        sql`SELECT title, description, scenarios, target_scenario FROM training_plans
            WHERE player_id = ${uid} AND status = 'active'
            ORDER BY created_at DESC LIMIT 1`,
        sql`SELECT f.content, f.week_objective, f.created_at, u.username AS coach_username
            FROM feedback f JOIN users u ON u.id = f.coach_id
            WHERE f.player_id = ${uid} ORDER BY f.created_at DESC LIMIT 1`
      ]);

      const streakRows = await sql`
        WITH days AS (
          SELECT DISTINCT DATE(played_at) AS d
          FROM game_history WHERE user_id = ${uid}
          ORDER BY d DESC
        ),
        numbered AS (
          SELECT d, ROW_NUMBER() OVER (ORDER BY d DESC) - 1 AS rn FROM days
        )
        SELECT COUNT(*)::int AS streak FROM numbered
        WHERE d = (CURRENT_DATE - (rn || ' days')::interval)::date`;

      const stats = statsRow[0] || {};
      const scenarios = planRow[0]?.scenarios
        ? (typeof planRow[0].scenarios === 'string' ? JSON.parse(planRow[0].scenarios) : planRow[0].scenarios)
        : [];
      const done = scenarios.filter(s => s.done).length;

      return res.status(200).json({
        stats: { ...stats, streak: streakRows[0]?.streak || 0 },
        activity,
        last_game: lastGame[0] || null,
        rank: rankRow[0]?.rank || null,
        plan: planRow[0] ? { ...planRow[0], scenarios_done: done, scenarios_total: scenarios.length } : null,
        last_feedback: feedbackRow[0] || null
      });
    }

    // Daily Challenge — mode du jour + classement + best perso
    if (view === 'daily-challenge') {
      const DAILY_POOL = ['ground_plaza','flicker_plaza','air_pure','pokeball_frenzy','pasu_reload','vox_ts2','ctrlsphere_aim','air_voltaic','beants','floatts','pasu_angelic','ctrlsphere_clk','whisphere','smoothbot','vt_bounceshot','popcorn_mv','vox_click','waldots','polarized_hell','pasu_perfected'];
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 0);
      const dayOfYear = Math.floor((now - start) / 86400000);
      const dailyMode = DAILY_POOL[dayOfYear % DAILY_POOL.length];
      const [board, userBest] = await Promise.all([
        sql`SELECT u.username, MAX(gh.score)::int AS score, MAX(gh.accuracy)::int AS accuracy, COUNT(*)::int AS attempts
            FROM game_history gh JOIN users u ON u.id = gh.user_id
            WHERE gh.mode = ${dailyMode} AND DATE(gh.played_at AT TIME ZONE 'UTC') = CURRENT_DATE
            GROUP BY u.id, u.username ORDER BY score DESC LIMIT 10`,
        sql`SELECT MAX(score)::int AS best_today, COUNT(*)::int AS attempts
            FROM game_history
            WHERE user_id = ${decoded.id} AND mode = ${dailyMode} AND DATE(played_at AT TIME ZONE 'UTC') = CURRENT_DATE`
      ]);
      return res.status(200).json({ daily_mode: dailyMode, leaderboard: board, user: userBest[0] || { best_today: null, attempts: 0 } });
    }

    // PB history — meilleur score par mode par jour
    if (view === 'pb-history') {
      const rows = await sql`
        SELECT mode, DATE(played_at)::text AS day, MAX(score)::int AS best, MAX(accuracy)::int AS accuracy
        FROM game_history WHERE user_id = ${decoded.id}
        GROUP BY mode, DATE(played_at) ORDER BY mode, day ASC`;
      return res.status(200).json({ pb_history: rows });
    }

    if (view === 'leaderboard') {
      const mode = url.searchParams.get('mode') || 'gridshot';
      const { rows } = await sql`
        SELECT u.username, h.score, h.accuracy, h.hits, h.misses,
               TO_CHAR(h.played_at, 'DD/MM/YY') AS day
        FROM game_history h
        JOIN users u ON u.id = h.user_id
        WHERE h.mode = ${mode}
        ORDER BY h.score DESC
        LIMIT 15
      `;
      return res.json({ rows });
    }

    if (view === 'benchmark-history') {
      const { rows } = await sql`
        SELECT id, rank_idx, rank_name, scenarios,
               TO_CHAR(played_at, 'DD/MM/YY') AS day,
               played_at
        FROM voltaic_benchmarks
        WHERE user_id = ${userId}
        ORDER BY played_at DESC
        LIMIT 20
      `;
      return res.json({ rows });
    }

    if (view === 'benchmark-all') {
      if (userRole !== 'coach' && userRole !== 'admin') return res.status(403).json({ error: 'Forbidden' });
      const { rows } = await sql`
        SELECT DISTINCT ON (vb.user_id)
          u.username, u.id AS user_id,
          vb.rank_idx, vb.rank_name, vb.scenarios,
          TO_CHAR(vb.played_at, 'DD/MM/YY') AS day,
          vb.played_at
        FROM voltaic_benchmarks vb
        JOIN users u ON u.id = vb.user_id
        ORDER BY vb.user_id, vb.played_at DESC
      `;
      return res.json({ rows });
    }

    if (view === 'benchmark-player') {
      if (userRole !== 'coach' && userRole !== 'admin') return res.status(403).json({ error: 'Forbidden' });
      const targetId = req.query?.player_id;
      if (!targetId) return res.status(400).json({ error: 'Missing player_id' });
      const { rows } = await sql`
        SELECT id, rank_idx, rank_name, scenarios,
               TO_CHAR(played_at, 'DD/MM/YY') AS day
        FROM voltaic_benchmarks
        WHERE user_id = ${targetId}
        ORDER BY played_at DESC
        LIMIT 10
      `;
      return res.json({ rows });
    }

    return res.status(400).json({ error: 'view requis : my-players | my-coach | pending | all-users | all-relationships | announcements | all-announcements | audit-logs' });
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const body = req.body;
    const { action, target_username, message, rel_id } = body;
    const userId = decoded.id;
    const userRole = decoded.role;

    if (action === 'save-benchmark') {
      const { rank_idx, rank_name, scenarios } = body;
      if (rank_idx == null || !scenarios) return res.status(400).json({ error: 'Missing fields' });
      await sql`INSERT INTO voltaic_benchmarks (user_id, rank_idx, rank_name, scenarios)
        VALUES (${userId}, ${rank_idx}, ${rank_name}, ${JSON.stringify(scenarios)})`;
      return res.json({ ok: true });
    }

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
      // Notifier le demandeur
      sql`INSERT INTO notifications (user_id, type, title, body, tab)
        VALUES (${rel.requested_by}, 'coaching', 'Demande de coaching acceptée !',
                'Votre demande a été acceptée', 'ch-messages')`.catch(() => {});
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

    // ── Admin : supprimer une relation ────────────────────────────────────
    if (action === 'admin-delete-rel') {
      if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin requis' });
      if (!rel_id) return res.status(400).json({ error: 'rel_id requis' });
      await sql`DELETE FROM coaching_relationships WHERE id = ${rel_id}`;
      return res.status(200).json({ success: true });
    }

    // ── Admin : créer une annonce ─────────────────────────────────────────
    if (action === 'create-announcement') {
      if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin requis' });
      const { title, content, type, expires_at } = req.body;
      if (!title || !content) return res.status(400).json({ error: 'title et content requis' });
      const validTypes = ['info', 'warning', 'success', 'danger'];
      const annType = validTypes.includes(type) ? type : 'info';
      await sql`INSERT INTO announcements (title, content, type, created_by, expires_at)
        VALUES (${title}, ${content}, ${annType}, ${decoded.id}, ${expires_at || null})`;
      await sql`INSERT INTO audit_logs (actor_id, actor_email, action, details)
        VALUES (${decoded.id}, ${decoded.email}, ${'create-announcement'}, ${title})`;
      return res.status(201).json({ success: true });
    }

    // ── Admin : toggle annonce ────────────────────────────────────────────
    if (action === 'toggle-announcement') {
      if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin requis' });
      const { ann_id } = req.body;
      if (!ann_id) return res.status(400).json({ error: 'ann_id requis' });
      await sql`UPDATE announcements SET active = NOT active WHERE id = ${ann_id}`;
      return res.status(200).json({ success: true });
    }

    // ── Admin : supprimer une annonce ─────────────────────────────────────
    if (action === 'delete-announcement') {
      if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin requis' });
      const { ann_id } = req.body;
      if (!ann_id) return res.status(400).json({ error: 'ann_id requis' });
      await sql`DELETE FROM announcements WHERE id = ${ann_id}`;
      return res.status(200).json({ success: true });
    }

    // ── Envoyer un message ────────────────────────────────────────────────
    if (action === 'send-message') {
      const { rel_id, content } = req.body;
      if (!rel_id || !content) return res.status(400).json({ error: 'rel_id et content requis' });
      const rel = await sql`SELECT * FROM coaching_relationships WHERE id = ${rel_id} AND (coach_id = ${decoded.id} OR player_id = ${decoded.id}) AND status = 'active'`;
      if (!rel.length) return res.status(403).json({ error: 'Non autorisé' });
      const msg = await sql`INSERT INTO messages (rel_id, sender_id, content) VALUES (${rel_id}, ${decoded.id}, ${content}) RETURNING *`;
      const recipientId = rel[0].coach_id === decoded.id ? rel[0].player_id : rel[0].coach_id;
      const senderRow = await sql`SELECT username FROM users WHERE id = ${decoded.id} LIMIT 1`;
      sql`INSERT INTO notifications (user_id, type, title, body, tab)
        VALUES (${recipientId}, 'message', 'Nouveau message',
                ${`${senderRow[0]?.username || '...'}: ${content.substring(0,50)}`}, 'ch-messages')`.catch(() => {});
      return res.status(201).json({ message: msg[0] });
    }

    return res.status(400).json({ error: 'action requis : request | accept | decline | end | admin-delete-rel | create-announcement | toggle-announcement | delete-announcement' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
