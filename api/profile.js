const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');

function setCors(req, res) {
  const o = req.headers.origin || '';
  const a = process.env.ALLOWED_ORIGIN || 'https://mayhaim.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', (o===a||/^https:\/\/mayhaim[^.]*\.vercel\.app$/.test(o))?o:a);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

function verifyToken(req, allowPartial = false) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(h.split(' ')[1], process.env.JWT_SECRET);
    if (decoded.partial) {
      return allowPartial ? decoded : null;
    }
    // Full token must have mfa_verified — rejects all pre-MFA sessions
    if (!decoded.mfa_verified) return null;
    return decoded;
  } catch { return null; }
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  // Auto-create notifications table
  await sql`CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    tab TEXT,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  // ── GET ────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { action } = req.query || {};

    // MFA setup : génère secret + QR — partial token accepté
    if (action === 'mfa-setup') {
      const decoded = verifyToken(req, true);
      if (!decoded) return res.status(401).json({ error: 'Non autorisé' });

      const rows = await sql`SELECT id, email, username, mfa_secret FROM users WHERE id = ${decoded.id}`;
      if (rows.length === 0) return res.status(404).json({ error: 'Introuvable' });

      const user = rows[0];
      let secret = user.mfa_secret;
      if (!secret) {
        secret = authenticator.generateSecret();
        await sql`UPDATE users SET mfa_secret = ${secret} WHERE id = ${decoded.id}`;
      }

      const otpauth = authenticator.keyuri(user.email, 'MayhAim', secret);
      const qr = await QRCode.toDataURL(otpauth);
      return res.status(200).json({ qr, secret, otpauth });
    }

    // Notifications
    if (action === 'notifications') {
      const decoded = verifyToken(req, false);
      if (!decoded) return res.status(401).json({ error: 'Non autorisé' });
      const rows = await sql`
        SELECT * FROM notifications WHERE user_id = ${decoded.id}
        ORDER BY read ASC, created_at DESC LIMIT 50
      `;
      const unread = rows.filter(r => !r.read).length;
      return res.status(200).json({ notifications: rows, unread });
    }

    // Profil normal — full token uniquement
    const decoded = verifyToken(req, false);
    if (!decoded) return res.status(401).json({ error: 'Non autorisé' });

    const result = await sql`
      SELECT id, email, username, role, mfa_enabled, current_rank, peak_elo, objective FROM users WHERE id = ${decoded.id}
    `;
    if (result.length === 0) return res.status(404).json({ error: 'Utilisateur non trouvé' });
    return res.status(200).json({ user: result[0] });
  }

  // ── POST ───────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { action, code } = req.body || {};

    // Activer MFA : vérifie code + active → retourne full JWT
    if (action === 'mfa-enable') {
      const decoded = verifyToken(req, true);
      if (!decoded) return res.status(401).json({ error: 'Non autorisé' });
      if (!code) return res.status(400).json({ error: 'Code requis' });

      const rows = await sql`SELECT id, email, username, role, mfa_secret FROM users WHERE id = ${decoded.id}`;
      if (rows.length === 0) return res.status(404).json({ error: 'Introuvable' });

      const user = rows[0];
      if (!user.mfa_secret) return res.status(400).json({ error: "Lance d'abord la configuration MFA" });

      const valid = authenticator.verify({
        token: String(code).replace(/\s/g, ''),
        secret: user.mfa_secret
      });
      if (!valid) return res.status(401).json({ error: 'Code incorrect' });

      await sql`UPDATE users SET mfa_enabled = true WHERE id = ${decoded.id}`;

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, mfa_verified: true },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.status(200).json({
        success: true, token,
        user: { id: user.id, email: user.email, username: user.username, role: user.role }
      });
    }

    // Désactiver MFA — full token uniquement + vérification TOTP
    if (action === 'mfa-disable') {
      const decoded = verifyToken(req, false);
      if (!decoded) return res.status(401).json({ error: 'Non autorisé' });
      if (!code) return res.status(400).json({ error: 'Code requis' });

      const rows = await sql`SELECT mfa_secret FROM users WHERE id = ${decoded.id}`;
      if (rows.length === 0) return res.status(404).json({ error: 'Introuvable' });

      const valid = authenticator.verify({
        token: String(code).replace(/\s/g, ''),
        secret: rows[0].mfa_secret
      });
      if (!valid) return res.status(401).json({ error: 'Code incorrect' });

      await sql`UPDATE users SET mfa_enabled = false, mfa_secret = null WHERE id = ${decoded.id}`;
      return res.status(200).json({ success: true });
    }

    // Mise à jour du profil (username, rang, objectif)
    if (action === 'update-profile') {
      const decoded = verifyToken(req, false);
      if (!decoded) return res.status(401).json({ error: 'Non autorisé' });

      const { username, current_rank, objective } = req.body || {};

      if (username !== undefined) {
        const trimmed = String(username).trim();
        if (trimmed.length < 3) return res.status(400).json({ error: 'Pseudo minimum 3 caractères' });
        if (trimmed.length > 32) return res.status(400).json({ error: 'Pseudo maximum 32 caractères' });
        if (!/^[a-zA-Z0-9_\-\.]+$/.test(trimmed)) return res.status(400).json({ error: 'Pseudo invalide (lettres, chiffres, _ - . uniquement)' });
        // Vérifier unicité — exclure l'utilisateur actuel
        const taken = await sql`SELECT id FROM users WHERE LOWER(username) = LOWER(${trimmed}) AND id != ${decoded.id}`;
        if (taken.length > 0) return res.status(409).json({ error: 'Ce pseudo est déjà pris' });
      }

      // Lire les valeurs actuelles puis appliquer les changements
      const current = await sql`SELECT username, current_rank, objective FROM users WHERE id = ${decoded.id}`;
      if (!current.length) return res.status(404).json({ error: 'Utilisateur introuvable' });

      const finalUsername = username     !== undefined ? String(username).trim()  : current[0].username;
      const finalRank     = current_rank !== undefined ? (current_rank || null)   : current[0].current_rank;
      const finalObj      = objective    !== undefined ? (objective    || null)   : current[0].objective;

      const updated = await sql`
        UPDATE users
        SET username = ${finalUsername}, current_rank = ${finalRank}, objective = ${finalObj}
        WHERE id = ${decoded.id}
        RETURNING id, email, username, role, current_rank, peak_elo, objective
      `;
      return res.status(200).json({ success: true, user: updated[0] });
    }

    // Marquer une notification lue
    if (action === 'mark-read') {
      const decoded = verifyToken(req, false);
      if (!decoded) return res.status(401).json({ error: 'Non autorisé' });
      const { notif_id } = req.body || {};
      if (notif_id) {
        await sql`UPDATE notifications SET read = TRUE WHERE id = ${notif_id} AND user_id = ${decoded.id}`;
      }
      return res.status(200).json({ success: true });
    }

    // Marquer toutes les notifications lues
    if (action === 'mark-all-read') {
      const decoded = verifyToken(req, false);
      if (!decoded) return res.status(401).json({ error: 'Non autorisé' });
      await sql`UPDATE notifications SET read = TRUE WHERE user_id = ${decoded.id}`;
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Action inconnue' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
