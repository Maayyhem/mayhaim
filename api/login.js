const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticator } = require('otplib');

function setCors(req, res) {
  const o = req.headers.origin || '';
  const a = process.env.ALLOWED_ORIGIN || 'https://mayhaim.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', (o===a||/^https:\/\/mayhaim[^.]*\.vercel\.app$/.test(o))?o:a);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { action } = req.query || {};
  const sql = neon(process.env.DATABASE_URL);

  try {
    // ── Step 2 : vérifier le code TOTP ───────────────────────────────
    if (action === 'mfa-verify') {
      const { partial_token, code } = req.body || {};
      if (!partial_token || !code) {
        return res.status(400).json({ error: 'Token et code requis' });
      }

      let decoded;
      try { decoded = jwt.verify(partial_token, process.env.JWT_SECRET); }
      catch { return res.status(401).json({ error: 'Session expirée, reconnecte-toi' }); }

      if (!decoded.partial) return res.status(401).json({ error: 'Token invalide' });

      const rows = await sql`
        SELECT id, email, username, role, mfa_secret, mfa_enabled
        FROM users WHERE id = ${decoded.id}
      `;
      if (rows.length === 0) return res.status(401).json({ error: 'Utilisateur introuvable' });

      const user = rows[0];
      if (!user.mfa_secret || !user.mfa_enabled) {
        return res.status(400).json({ error: 'MFA non configuré' });
      }

      const valid = authenticator.verify({
        token: String(code).replace(/\s/g, ''),
        secret: user.mfa_secret
      });
      if (!valid) return res.status(401).json({ error: 'Code incorrect ou expiré' });

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, mfa_verified: true },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.status(200).json({
        token,
        user: { id: user.id, email: user.email, username: user.username, role: user.role }
      });
    }

    // ── Step 1 : email + mot de passe ────────────────────────────────
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const result = await sql`
      SELECT id, email, username, password_hash, role, mfa_secret, mfa_enabled,
             failed_attempts, locked_until
      FROM users WHERE email = ${email}
    `;
    if (result.length === 0) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const user = result[0];

    // Account lockout check
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      const mins = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      return res.status(429).json({ error: `Compte temporairement bloqué. Réessaie dans ${mins} min.` });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const attempts = (user.failed_attempts || 0) + 1;
      if (attempts >= 5) {
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000);
        await sql`UPDATE users SET failed_attempts = ${attempts}, locked_until = ${lockUntil} WHERE id = ${user.id}`;
        return res.status(429).json({ error: 'Trop de tentatives. Compte bloqué 15 minutes.' });
      }
      await sql`UPDATE users SET failed_attempts = ${attempts} WHERE id = ${user.id}`;
      return res.status(401).json({ error: `Email ou mot de passe incorrect (${5 - attempts} essai${5 - attempts > 1 ? 's' : ''} restant${5 - attempts > 1 ? 's' : ''})` });
    }

    // Reset on success
    await sql`UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ${user.id}`;

    const isPrivileged = user.role === 'coach' || user.role === 'admin';

    // Student sans MFA → accès direct
    if (!isPrivileged && !user.mfa_enabled) {
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, mfa_verified: true },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.status(200).json({
        token,
        user: { id: user.id, email: user.email, username: user.username, role: user.role }
      });
    }

    // Sinon : étape MFA (partial token 10 min)
    const partial_token = jwt.sign(
      { id: user.id, partial: true },
      process.env.JWT_SECRET,
      { expiresIn: '10m' }
    );

    if (user.mfa_enabled) {
      return res.status(200).json({ mfa_required: true, partial_token });
    } else {
      // Coach/admin sans MFA → configuration obligatoire
      return res.status(200).json({ mfa_setup_required: true, partial_token });
    }

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};
