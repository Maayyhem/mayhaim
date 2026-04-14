const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');

let _riotColReady = false;
async function ensureRiotColumns(sql) {
  if (_riotColReady) return;
  try {
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS riot_gamename TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS riot_tagline TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS riot_puuid TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS riot_rank TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS riot_lp INTEGER`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS riot_region TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS riot_rank_synced_at TIMESTAMPTZ`;
  } catch(e) {}
  _riotColReady = true;
}

async function fetchHenrik(path) {
  const key = process.env.HENRIK_API_KEY;
  const headers = key ? { 'Authorization': key } : {};
  const res = await fetch(`https://api.henrikdev.tech${path}`, { headers, signal: AbortSignal.timeout(8000) });
  return { status: res.status, data: await res.json() };
}

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

  await ensureRiotColumns(sql);

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
      SELECT id, email, username, role, mfa_enabled, current_rank, peak_elo, objective,
             riot_gamename, riot_tagline, riot_rank, riot_lp, riot_region, riot_rank_synced_at
      FROM users WHERE id = ${decoded.id}
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

    // ── Lier compte Riot ─────────────────────────────────────────────
    if (action === 'link-riot') {
      const decoded = verifyToken(req, false);
      if (!decoded) return res.status(401).json({ error: 'Non autorisé' });

      const { riot_id } = req.body || {};
      if (!riot_id) return res.status(400).json({ error: 'Riot ID requis (ex: Pseudo#EUW)' });

      const parts = riot_id.trim().split('#');
      if (parts.length !== 2 || !parts[0].trim() || !parts[1].trim()) {
        return res.status(400).json({ error: 'Format invalide — utilise Pseudo#TAG' });
      }
      const [gameName, tagLine] = [parts[0].trim(), parts[1].trim()];

      try {
        const acc = await fetchHenrik(`/valorant/v1/account/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`);
        if (acc.status === 404) return res.status(404).json({ error: 'Compte Riot introuvable' });
        if (acc.status === 429) return res.status(429).json({ error: 'Trop de requêtes, réessaie dans 1 minute' });
        if (acc.status !== 200 || !acc.data?.data?.puuid) return res.status(502).json({ error: 'API Riot indisponible, réessaie plus tard' });

        const puuid  = acc.data.data.puuid;
        const region = acc.data.data.region || 'eu';
        const name   = acc.data.data.name;
        const tag    = acc.data.data.tag;

        const mmr = await fetchHenrik(`/valorant/v2/mmr/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
        let rank = null, lp = null;
        if (mmr.status === 200 && mmr.data?.data?.current_data) {
          rank = mmr.data.data.current_data.currenttierpatched || null;
          lp   = mmr.data.data.current_data.ranking_in_tier   ?? null;
        }

        await sql`
          UPDATE users SET
            riot_gamename = ${name}, riot_tagline = ${tag}, riot_puuid = ${puuid},
            riot_rank = ${rank}, riot_lp = ${lp}, riot_region = ${region},
            riot_rank_synced_at = NOW()
          WHERE id = ${decoded.id}
        `;
        return res.status(200).json({ success: true, riot: { gamename: name, tagline: tag, rank, lp, region } });
      } catch(err) {
        console.error('link-riot error:', err);
        return res.status(502).json({ error: 'API Riot indisponible, réessaie plus tard' });
      }
    }

    // ── Synchroniser le rang Riot ─────────────────────────────────────
    if (action === 'sync-riot') {
      const decoded = verifyToken(req, false);
      if (!decoded) return res.status(401).json({ error: 'Non autorisé' });

      const rows = await sql`SELECT riot_gamename, riot_tagline, riot_region FROM users WHERE id = ${decoded.id}`;
      if (!rows.length || !rows[0].riot_gamename) {
        return res.status(400).json({ error: 'Aucun compte Riot lié' });
      }
      const { riot_gamename, riot_tagline, riot_region } = rows[0];

      try {
        const mmr = await fetchHenrik(`/valorant/v2/mmr/${riot_region}/${encodeURIComponent(riot_gamename)}/${encodeURIComponent(riot_tagline)}`);
        if (mmr.status === 429) return res.status(429).json({ error: 'Trop de requêtes, réessaie dans 1 minute' });
        let rank = null, lp = null;
        if (mmr.status === 200 && mmr.data?.data?.current_data) {
          rank = mmr.data.data.current_data.currenttierpatched || null;
          lp   = mmr.data.data.current_data.ranking_in_tier   ?? null;
        }
        await sql`
          UPDATE users SET riot_rank = ${rank}, riot_lp = ${lp}, riot_rank_synced_at = NOW()
          WHERE id = ${decoded.id}
        `;
        return res.status(200).json({ success: true, riot: { gamename: riot_gamename, tagline: riot_tagline, rank, lp } });
      } catch(err) {
        console.error('sync-riot error:', err);
        return res.status(502).json({ error: 'API Riot indisponible' });
      }
    }

    // ── Délier compte Riot ────────────────────────────────────────────
    if (action === 'unlink-riot') {
      const decoded = verifyToken(req, false);
      if (!decoded) return res.status(401).json({ error: 'Non autorisé' });
      await sql`
        UPDATE users SET riot_gamename=NULL, riot_tagline=NULL, riot_puuid=NULL,
          riot_rank=NULL, riot_lp=NULL, riot_region=NULL, riot_rank_synced_at=NULL
        WHERE id = ${decoded.id}
      `;
      return res.status(200).json({ success: true });
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
