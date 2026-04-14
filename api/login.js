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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

let _discordColReady = false;
async function ensureDiscordColumn(sql) {
  if (_discordColReady) return;
  try { await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS discord_id TEXT UNIQUE`; } catch(e) {}
  _discordColReady = true;
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query || {};
  const SITE_URL = process.env.SITE_URL || 'https://mayhaim.vercel.app';

  // ── Discord: redirect vers la page d'autorisation ──────────────────
  if (req.method === 'GET' && action === 'discord') {
    if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_REDIRECT_URI) {
      res.setHeader('Location', `${SITE_URL}?discord_error=${encodeURIComponent('Discord non configuré')}`);
      return res.status(302).end();
    }
    const params = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      redirect_uri: process.env.DISCORD_REDIRECT_URI,
      response_type: 'code',
      scope: 'identify email',
    });
    res.setHeader('Location', `https://discord.com/api/oauth2/authorize?${params}`);
    return res.status(302).end();
  }

  // ── Discord: callback après autorisation ───────────────────────────
  if (req.method === 'GET' && action === 'discord-callback') {
    const { code, error } = req.query;
    if (error || !code) {
      res.setHeader('Location', `${SITE_URL}?discord_error=${encodeURIComponent(error || 'Accès refusé')}`);
      return res.status(302).end();
    }
    try {
      const sql = neon(process.env.DATABASE_URL);
      await ensureDiscordColumn(sql);

      // Échange du code contre un access token Discord
      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.DISCORD_CLIENT_ID,
          client_secret: process.env.DISCORD_CLIENT_SECRET,
          grant_type: 'authorization_code',
          code,
          redirect_uri: process.env.DISCORD_REDIRECT_URI,
        }).toString(),
      });
      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) throw new Error('Token Discord invalide');

      // Récupération du profil Discord
      const discordRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const discordUser = await discordRes.json();

      const discordId    = String(discordUser.id);
      const discordEmail = discordUser.email || null;
      const rawName      = discordUser.global_name || discordUser.username || '';
      const discordName  = rawName.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 20) || `user${discordId.slice(-6)}`;

      let user = null;

      // 1. Compte existant lié par discord_id
      const byId = await sql`
        SELECT id, email, username, role, current_rank, peak_elo, objective
        FROM users WHERE discord_id = ${discordId}
      `;
      if (byId.length > 0) user = byId[0];

      // 2. Compte existant par email → on le lie
      if (!user && discordEmail) {
        const byEmail = await sql`
          SELECT id, email, username, role, current_rank, peak_elo, objective
          FROM users WHERE email = ${discordEmail}
        `;
        if (byEmail.length > 0) {
          user = byEmail[0];
          await sql`UPDATE users SET discord_id = ${discordId} WHERE id = ${user.id}`;
        }
      }

      // 3. Création d'un nouveau compte
      if (!user) {
        let username = discordName.length >= 3 ? discordName : `user${discordId.slice(-6)}`;
        const taken = await sql`SELECT id FROM users WHERE username = ${username}`;
        if (taken.length > 0) username = `${username.slice(0, 15)}_${discordId.slice(-4)}`;

        const email    = discordEmail || `discord_${discordId}@mayhaim.local`;
        const randomPw = await bcrypt.hash(`${discordId}_${Date.now()}_${Math.random()}`, 10);

        const inserted = await sql`
          INSERT INTO users (email, username, password_hash, role, current_rank, discord_id)
          VALUES (${email}, ${username}, ${randomPw}, 'student', 'Non défini', ${discordId})
          RETURNING id, email, username, role, current_rank, peak_elo, objective
        `;
        user = inserted[0];
      }

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role, mfa_verified: true },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.setHeader('Location', `${SITE_URL}?discord_token=${encodeURIComponent(token)}`);
      return res.status(302).end();

    } catch (err) {
      console.error('Discord callback error:', err);
      res.setHeader('Location', `${SITE_URL}?discord_error=${encodeURIComponent('Erreur de connexion Discord')}`);
      return res.status(302).end();
    }
  }

  // ── Toutes les autres routes nécessitent POST ──────────────────────
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
        SELECT id, email, username, role, mfa_secret, mfa_enabled, current_rank, peak_elo, objective
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
        user: { id: user.id, email: user.email, username: user.username, role: user.role, current_rank: user.current_rank, peak_elo: user.peak_elo, objective: user.objective }
      });
    }

    // ── Step 1 : email + mot de passe ────────────────────────────────
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const result = await sql`
      SELECT id, email, username, password_hash, role, mfa_secret, mfa_enabled,
             failed_attempts, locked_until, current_rank, peak_elo, objective
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
        user: { id: user.id, email: user.email, username: user.username, role: user.role, current_rank: user.current_rank, peak_elo: user.peak_elo, objective: user.objective }
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
