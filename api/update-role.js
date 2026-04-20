const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

function setCors(req, res) {
  const o = req.headers.origin || '';
  const a = process.env.ALLOWED_ORIGIN || 'https://mayhaim.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', o === a ? o : a);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token manquant' });
    }

    let decoded;
    try {
      decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Token invalide' });
    }

    // Defense-in-depth: reject partial tokens (pre-MFA) and any full token
    // that was somehow issued without MFA verification.
    if (decoded.partial || !decoded.mfa_verified) {
      return res.status(401).json({ error: 'MFA requis' });
    }

    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin requis' });
    }

    const sql = neon(process.env.DATABASE_URL);

    // Helper audit log (non-bloquant)
    const auditLog = async (action, targetId, targetUsername, details) => {
      try {
        await sql`INSERT INTO audit_logs (actor_id, actor_email, action, target_id, target_username, details)
          VALUES (${decoded.id}, ${decoded.email}, ${action}, ${targetId || null}, ${targetUsername || null}, ${details || null})`;
      } catch {}
    };

    // Fetch target username helper
    const getTarget = async (userId) => {
      if (!userId) return null;
      const r = await sql`SELECT username FROM users WHERE id = ${userId} LIMIT 1`;
      return r[0]?.username || null;
    };

    // ── POST: verrouiller un compte (durée en minutes, défaut permanent = 100 ans) ─
    if (req.body?.action === 'lock') {
      const userId = req.body?.userId;
      if (!userId) return res.status(400).json({ error: 'userId requis' });
      if (String(userId) === String(decoded.id)) {
        return res.status(400).json({ error: 'Impossible de vous verrouiller vous-même' });
      }
      const minutes = parseInt(req.body?.minutes) || null;
      const until = minutes
        ? new Date(Date.now() + minutes * 60 * 1000).toISOString()
        : new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(); // permanent
      const targetUsername = await getTarget(userId);
      await sql`UPDATE users SET failed_attempts = 5, locked_until = ${until} WHERE id = ${userId}`;
      await auditLog('lock', userId, targetUsername, minutes ? `${minutes} min` : 'permanent');
      return res.status(200).json({ success: true, locked_until: until });
    }

    // ── POST: déverrouiller un compte ────────────────────────────────────────
    if (req.body?.action === 'unlock') {
      const userId = req.body?.userId;
      if (!userId) return res.status(400).json({ error: 'userId requis' });
      const targetUsername = await getTarget(userId);
      await sql`UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ${userId}`;
      await auditLog('unlock', userId, targetUsername, null);
      return res.status(200).json({ success: true });
    }

    // ── POST: reset MFA ────────────────────────────────────────────────────
    if (req.body?.action === 'reset-mfa') {
      const userId = req.body?.userId;
      if (!userId) return res.status(400).json({ error: 'userId requis' });
      const targetUsername = await getTarget(userId);
      await sql`UPDATE users SET mfa_secret = NULL, mfa_enabled = FALSE WHERE id = ${userId}`;
      await auditLog('reset-mfa', userId, targetUsername, null);
      return res.status(200).json({ success: true });
    }

    // ── DELETE: supprimer un compte utilisateur ──────────────────────────────
    if (req.method === 'DELETE' || req.body?.action === 'delete') {
      const userId = req.body?.userId || req.query?.userId;
      if (!userId) return res.status(400).json({ error: 'userId requis' });
      if (String(userId) === String(decoded.id)) {
        return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
      }
      const targetUsername = await getTarget(userId);
      await sql`DELETE FROM coaching_relationships WHERE coach_id = ${userId} OR player_id = ${userId}`;
      await sql`DELETE FROM users WHERE id = ${userId}`;
      await auditLog('delete-user', userId, targetUsername, null);
      return res.status(200).json({ success: true });
    }

    // ── POST: changer le rôle ────────────────────────────────────────────────
    const { userId, role } = req.body;
    if (!userId || !['student', 'coach', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'userId et role valide requis (student/coach/admin)' });
    }
    const targetUsername = await getTarget(userId);
    const oldRole = await sql`SELECT role FROM users WHERE id = ${userId} LIMIT 1`;
    await sql`UPDATE users SET role = ${role} WHERE id = ${userId}`;
    await auditLog('change-role', userId, targetUsername, `${oldRole[0]?.role} → ${role}`);
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Update role error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};
