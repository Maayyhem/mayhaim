const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

function setCors(req, res) {
  const o = req.headers.origin || '';
  const a = process.env.ALLOWED_ORIGIN || 'https://mayhaim.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', (o===a||/^https:\/\/mayhaim[^.]*\.vercel\.app$/.test(o))?o:a);
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

    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin requis' });
    }

    const sql = neon(process.env.DATABASE_URL);

    // ── POST: déverrouiller un compte ────────────────────────────────────────
    if (req.body?.action === 'unlock') {
      const userId = req.body?.userId;
      if (!userId) return res.status(400).json({ error: 'userId requis' });
      await sql`UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ${userId}`;
      return res.status(200).json({ success: true });
    }

    // ── POST: reset MFA ────────────────────────────────────────────────────
    if (req.body?.action === 'reset-mfa') {
      const userId = req.body?.userId;
      if (!userId) return res.status(400).json({ error: 'userId requis' });
      await sql`UPDATE users SET mfa_secret = NULL, mfa_enabled = FALSE WHERE id = ${userId}`;
      return res.status(200).json({ success: true });
    }

    // ── DELETE: supprimer un compte utilisateur ──────────────────────────────
    if (req.method === 'DELETE' || req.body?.action === 'delete') {
      const userId = req.body?.userId || req.query?.userId;
      if (!userId) return res.status(400).json({ error: 'userId requis' });
      if (String(userId) === String(decoded.id)) {
        return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
      }
      // Cascade: supprimer les relations coaching puis le compte
      await sql`DELETE FROM coaching_relationships WHERE coach_id = ${userId} OR player_id = ${userId}`;
      await sql`DELETE FROM users WHERE id = ${userId}`;
      return res.status(200).json({ success: true });
    }

    // ── POST: changer le rôle ────────────────────────────────────────────────
    const { userId, role } = req.body;
    if (!userId || !['student', 'coach', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'userId et role valide requis (student/coach/admin)' });
    }
    await sql`UPDATE users SET role = ${role} WHERE id = ${userId}`;
    return res.status(200).json({ success: true });

  } catch (err) {
    console.error('Update role error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};
