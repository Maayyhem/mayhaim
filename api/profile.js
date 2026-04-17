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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://api.henrikdev.xyz${path}`, { headers, signal: controller.signal });
    let data;
    try { data = await res.json(); } catch { data = {}; }
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

// ── Official Riot Games API ────────────────────────────────────────────
const TIER_MAP = {
  0:'Unranked', 3:'Iron 1', 4:'Iron 2', 5:'Iron 3',
  6:'Bronze 1', 7:'Bronze 2', 8:'Bronze 3',
  9:'Silver 1', 10:'Silver 2', 11:'Silver 3',
  12:'Gold 1', 13:'Gold 2', 14:'Gold 3',
  15:'Platinum 1', 16:'Platinum 2', 17:'Platinum 3',
  18:'Diamond 1', 19:'Diamond 2', 20:'Diamond 3',
  21:'Ascendant 1', 22:'Ascendant 2', 23:'Ascendant 3',
  24:'Immortal 1', 25:'Immortal 2', 26:'Immortal 3', 27:'Radiant'
};
const MAP_NAMES = {
  'Ascent':'Ascent','Duality':'Bind','Triad':'Haven','Bonsai':'Split',
  'Canyon':'Fracture','Foxtrot':'Breeze','Port':'Icebox','Pitt':'Pearl',
  'Jam':'Lotus','Juliett':'Sunset','Infinity':'Abyss'
};
function getMapName(id) { const k = (id || '').split('/').pop(); return MAP_NAMES[k] || k || 'Unknown'; }

let _agentCache = null;
async function getAgentNames(shard) {
  if (_agentCache) return _agentCache;
  try {
    const r = await fetchRiot('/val/content/v1/contents?locale=en-US', shard);
    if (r.status === 200 && r.data?.characters) {
      _agentCache = {};
      for (const c of r.data.characters) _agentCache[c.id.toLowerCase()] = c.name;
    }
  } catch {}
  return _agentCache || {};
}

async function fetchRiot(path, routing) {
  const key = process.env.RIOT_API_KEY;
  if (!key) return { status: 401, data: { message: 'RIOT_API_KEY non configuré' } };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://${routing}.api.riotgames.com${path}`, {
      headers: { 'X-Riot-Token': key },
      signal: controller.signal
    });
    let data; try { data = await res.json(); } catch { data = {}; }
    return { status: res.status, data };
  } finally { clearTimeout(timer); }
}

async function riotGetRankFromMatches(puuid, shard) {
  try {
    const mlR = await fetchRiot(`/val/match/v1/matchlists/by-puuid/${puuid}`, shard);
    if (mlR.status !== 200) return null;
    const comp = (mlR.data.history || []).find(m => m.queueId === 'competitive');
    if (!comp) return null;
    const mr = await fetchRiot(`/val/match/v1/matches/${comp.matchId}`, shard);
    const me = (mr.data?.players || []).find(p => p.puuid === puuid);
    return me?.competitiveTier ? (TIER_MAP[me.competitiveTier] || null) : null;
  } catch { return null; }
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

  // Auto-create sync table
  await sql`CREATE TABLE IF NOT EXISTS user_sync_data (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  // ── GET ────────────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { action } = req.query || {};

    // Cloud sync — pull server data
    if (action === 'sync-pull') {
      const decoded = verifyToken(req, false);
      if (!decoded) return res.status(401).json({ error: 'Non autorisé' });
      const rows = await sql`SELECT data, updated_at FROM user_sync_data WHERE user_id = ${decoded.id} LIMIT 1`;
      if (rows.length === 0) return res.status(200).json({ data: {}, updated_at: null });
      return res.status(200).json({ data: rows[0].data, updated_at: rows[0].updated_at });
    }

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

    // ── Tracker Search (public, no auth) ────────────────────────────
    if (action === 'tracker-search') {
      const { name, tag } = req.query || {};
      const region = (['eu','na','ap','br','latam','kr'].includes(req.query?.region)) ? req.query.region : 'eu';
      if (!name || !tag) return res.status(400).json({ error: 'Paramètres name et tag requis' });

      try {
        // 1. Fetch rank
        const mmr = await fetchHenrik(`/valorant/v2/mmr/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
        if (mmr.status === 429) return res.status(429).json({ error: 'Trop de requêtes, réessaie dans 1 minute' });
        let rank = null, lp = null;
        if (mmr.status === 200 && mmr.data?.data?.current_data) {
          rank = mmr.data.data.current_data.currenttierpatched || null;
          lp   = mmr.data.data.current_data.ranking_in_tier   ?? null;
        }

        // 2. Fetch matches
        const result = await fetchHenrik(
          `/valorant/v3/matches/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?filter=competitive&size=10`
        );
        if (result.status === 429) return res.status(429).json({ error: 'Trop de requêtes, réessaie dans 1 minute' });
        if (result.status !== 200) return res.status(502).json({ error: `API indisponible (${result.status})` });

        // 3. Process matches (same as Henrik fallback)
        const matches = result.data.data || [];
        let wins = 0, losses = 0, totalKills = 0, totalDeaths = 0, totalAssists = 0;
        let totalHS = 0, totalShots = 0, totalScore = 0, totalRounds = 0, totalDamage = 0;
        const agentMap = {}, mapMap = {}, recent = [];

        for (const m of matches) {
          const me = (m.players?.all_players || []).find(
            p => p.name?.toLowerCase() === name.toLowerCase() && p.tag?.toLowerCase() === tag.toLowerCase()
          );
          if (!me) continue;
          const myTeam = (me.team || '').toLowerCase();
          const won = m.teams?.[myTeam]?.has_won ?? false;
          const rBlue = m.teams?.blue?.rounds_won ?? 0, rRed = m.teams?.red?.rounds_won ?? 0;
          const rTotal = rBlue + rRed;
          if (won) wins++; else losses++;
          const st = me.stats || {};
          totalKills += st.kills || 0; totalDeaths += st.deaths || 0; totalAssists += st.assists || 0;
          totalHS += st.headshots || 0;
          const shots = (st.headshots || 0) + (st.bodyshots || 0) + (st.legshots || 0);
          totalShots += shots; totalScore += st.score || 0; totalRounds += rTotal; totalDamage += me.damage_made || 0;
          const agent = me.character || 'Unknown', map = m.metadata?.map || 'Unknown';
          if (!agentMap[agent]) agentMap[agent] = { games: 0, wins: 0 };
          agentMap[agent].games++; if (won) agentMap[agent].wins++;
          if (!mapMap[map]) mapMap[map] = { games: 0, wins: 0 };
          mapMap[map].games++; if (won) mapMap[map].wins++;
          const acs = rTotal > 0 ? Math.round((st.score || 0) / rTotal) : 0;
          const hsPct = shots > 0 ? Math.round(((st.headshots || 0) / shots) * 100) : 0;
          const myR = myTeam === 'blue' ? rBlue : rRed, oppR = myTeam === 'blue' ? rRed : rBlue;
          recent.push({ map, agent, result: won ? 'WIN' : 'LOSS', score: `${myR}-${oppR}`, kills: st.kills || 0, deaths: st.deaths || 0, assists: st.assists || 0, acs, hs_pct: hsPct, date: m.metadata?.game_start ? new Date(m.metadata.game_start * 1000).toISOString() : null });
        }

        const n = wins + losses;
        return res.status(200).json({
          account: { gamename: name, tagline: tag, rank, lp },
          stats: { matches_analyzed: n, wins, losses, win_rate: n > 0 ? Math.round(wins / n * 100) : 0, kda: totalDeaths > 0 ? parseFloat(((totalKills + totalAssists * 0.5) / totalDeaths).toFixed(2)) : totalKills, avg_acs: totalRounds > 0 ? Math.round(totalScore / totalRounds) : 0, avg_hs_pct: totalShots > 0 ? Math.round(totalHS / totalShots * 100) : 0, avg_damage: n > 0 ? Math.round(totalDamage / n) : 0 },
          top_agents: Object.entries(agentMap).map(([agent, d]) => ({ agent, ...d })).sort((a,b) => b.games - a.games).slice(0, 5),
          top_maps:   Object.entries(mapMap).map(([map, d])     => ({ map,   ...d })).sort((a,b) => b.games - a.games).slice(0, 5),
          recent_matches: recent,
        });
      } catch(err) {
        return res.status(502).json({ error: `Service indisponible: ${err.message}` });
      }
    }

    // ── Tracker Valorant ──────────────────────────────────────────────
    if (action === 'tracker') {
      const decoded = verifyToken(req, false);
      if (!decoded) return res.status(401).json({ error: 'Non autorisé' });

      const rows = await sql`
        SELECT riot_gamename, riot_tagline, riot_region, riot_rank, riot_lp, riot_puuid
        FROM users WHERE id = ${decoded.id}
      `;
      if (!rows.length || !rows[0].riot_gamename) {
        return res.status(400).json({ error: 'Aucun compte Riot lié' });
      }
      const { riot_gamename: name, riot_tagline: tag, riot_region: shard, riot_rank: rank, riot_lp: lp, riot_puuid: puuid } = rows[0];

      // ── Official Riot API path ───────────────────────────────────────
      if (process.env.RIOT_API_KEY) {
        try {
          if (!puuid) return res.status(400).json({ error: 'Relie ton compte à nouveau pour activer le tracker' });
          const mlR = await fetchRiot(`/val/match/v1/matchlists/by-puuid/${puuid}`, shard || 'eu');
          if (mlR.status === 429) return res.status(429).json({ error: 'Trop de requêtes, réessaie dans 1 minute' });
          if (mlR.status !== 200) return res.status(502).json({ error: `Riot API: ${mlR.data?.status?.message || mlR.status}` });

          const compIds = (mlR.data.history || []).filter(m => m.queueId === 'competitive').slice(0, 10).map(m => m.matchId);
          if (compIds.length === 0) {
            return res.status(200).json({ account: { gamename: name, tagline: tag, rank, lp }, stats: { matches_analyzed: 0, wins: 0, losses: 0, win_rate: 0, kda: 0, avg_acs: 0, avg_hs_pct: 0, avg_damage: 0 }, top_agents: [], top_maps: [], recent_matches: [] });
          }

          const matchResults = await Promise.all(compIds.map(id => fetchRiot(`/val/match/v1/matches/${id}`, shard || 'eu')));
          const agentNames = await getAgentNames(shard || 'eu');

          let wins = 0, losses = 0, totalKills = 0, totalDeaths = 0, totalAssists = 0, totalScore = 0, totalRounds = 0;
          const agentMap = {}, mapMap = {}, recent = [];

          for (const mr of matchResults) {
            if (mr.status !== 200 || !mr.data?.players) continue;
            const me = mr.data.players.find(p => p.puuid === puuid);
            if (!me) continue;

            const myTeamId = (me.teamId || '').toLowerCase();
            const teams = {};
            for (const t of mr.data.teams || []) teams[(t.teamId || '').toLowerCase()] = t;
            const won = teams[myTeamId]?.won ?? false;
            const myR = teams[myTeamId]?.roundsWon ?? 0;
            const oppId = myTeamId === 'red' ? 'blue' : 'red';
            const oppR = teams[oppId]?.roundsWon ?? 0;
            const rTotal = myR + oppR;

            if (won) wins++; else losses++;
            const st = me.stats || {};
            totalKills += st.kills || 0; totalDeaths += st.deaths || 0; totalAssists += st.assists || 0;
            totalScore += st.score || 0; totalRounds += rTotal;

            const agentId = (me.characterId || '').toLowerCase();
            const agent = agentNames[agentId] || 'Unknown';
            const map = getMapName(mr.data.metadata?.mapId);
            if (!agentMap[agent]) agentMap[agent] = { games: 0, wins: 0 };
            agentMap[agent].games++; if (won) agentMap[agent].wins++;
            if (!mapMap[map]) mapMap[map] = { games: 0, wins: 0 };
            mapMap[map].games++; if (won) mapMap[map].wins++;

            const acs = rTotal > 0 ? Math.round((st.score || 0) / rTotal) : 0;
            recent.push({
              map, agent, result: won ? 'WIN' : 'LOSS', score: `${myR}-${oppR}`,
              kills: st.kills || 0, deaths: st.deaths || 0, assists: st.assists || 0,
              acs, hs_pct: null,
              date: mr.data.metadata?.gameStartMillis ? new Date(mr.data.metadata.gameStartMillis).toISOString() : null
            });
          }

          const n = wins + losses;
          return res.status(200).json({
            account: { gamename: name, tagline: tag, rank, lp },
            stats: {
              matches_analyzed: n, wins, losses,
              win_rate: n > 0 ? Math.round(wins / n * 100) : 0,
              kda: totalDeaths > 0 ? parseFloat(((totalKills + totalAssists * 0.5) / totalDeaths).toFixed(2)) : totalKills,
              avg_acs: totalRounds > 0 ? Math.round(totalScore / totalRounds) : 0,
              avg_hs_pct: null, avg_damage: null,
            },
            top_agents: Object.entries(agentMap).map(([agent, d]) => ({ agent, ...d })).sort((a,b) => b.games - a.games).slice(0, 5),
            top_maps:   Object.entries(mapMap).map(([map, d])     => ({ map,   ...d })).sort((a,b) => b.games - a.games).slice(0, 5),
            recent_matches: recent,
          });
        } catch(err) {
          return res.status(502).json({ error: err.name === 'AbortError' ? 'Timeout — réessaie' : `Erreur réseau: ${err.message}` });
        }
      }

      // ── Henrik API fallback ──────────────────────────────────────────
      try {
        // Try stored region first; if missing/invalid, probe all regions
        const regionList = (shard && shard !== 'null') ? [shard] : ['eu', 'na', 'ap', 'br', 'latam', 'kr'];
        let result = null;
        let foundRegion = shard || 'eu';
        for (const r of regionList) {
          const attempt = await fetchHenrik(
            `/valorant/v3/matches/${r}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?filter=competitive&size=10`
          );
          if (attempt.status === 200) { result = attempt; foundRegion = r; break; }
          if (attempt.status === 429) return res.status(429).json({ error: 'Trop de requêtes, réessaie dans 1 minute' });
        }
        if (!result || result.status !== 200) return res.status(502).json({ error: `Joueur introuvable sur toutes les régions. Relie ton compte à nouveau.` });

        const matches = result.data.data || [];
        let wins = 0, losses = 0, totalKills = 0, totalDeaths = 0, totalAssists = 0;
        let totalHS = 0, totalShots = 0, totalScore = 0, totalRounds = 0, totalDamage = 0;
        const agentMap = {}, mapMap = {}, recent = [];

        for (const m of matches) {
          const me = (m.players?.all_players || []).find(
            p => p.name?.toLowerCase() === name.toLowerCase() && p.tag?.toLowerCase() === tag.toLowerCase()
          );
          if (!me) continue;
          const myTeam = (me.team || '').toLowerCase();
          const won = m.teams?.[myTeam]?.has_won ?? false;
          const rBlue = m.teams?.blue?.rounds_won ?? 0, rRed = m.teams?.red?.rounds_won ?? 0;
          const rTotal = rBlue + rRed;
          if (won) wins++; else losses++;
          const st = me.stats || {};
          totalKills += st.kills || 0; totalDeaths += st.deaths || 0; totalAssists += st.assists || 0;
          totalHS += st.headshots || 0;
          const shots = (st.headshots || 0) + (st.bodyshots || 0) + (st.legshots || 0);
          totalShots += shots; totalScore += st.score || 0; totalRounds += rTotal; totalDamage += me.damage_made || 0;
          const agent = me.character || 'Unknown', map = m.metadata?.map || 'Unknown';
          if (!agentMap[agent]) agentMap[agent] = { games: 0, wins: 0 };
          agentMap[agent].games++; if (won) agentMap[agent].wins++;
          if (!mapMap[map]) mapMap[map] = { games: 0, wins: 0 };
          mapMap[map].games++; if (won) mapMap[map].wins++;
          const acs = rTotal > 0 ? Math.round((st.score || 0) / rTotal) : 0;
          const hsPct = shots > 0 ? Math.round(((st.headshots || 0) / shots) * 100) : 0;
          const myR = myTeam === 'blue' ? rBlue : rRed, oppR = myTeam === 'blue' ? rRed : rBlue;
          recent.push({ map, agent, result: won ? 'WIN' : 'LOSS', score: `${myR}-${oppR}`, kills: st.kills || 0, deaths: st.deaths || 0, assists: st.assists || 0, acs, hs_pct: hsPct, date: m.metadata?.game_start ? new Date(m.metadata.game_start * 1000).toISOString() : null });
        }

        const n = wins + losses;
        return res.status(200).json({
          account: { gamename: name, tagline: tag, rank, lp },
          stats: { matches_analyzed: n, wins, losses, win_rate: n > 0 ? Math.round(wins / n * 100) : 0, kda: totalDeaths > 0 ? parseFloat(((totalKills + totalAssists * 0.5) / totalDeaths).toFixed(2)) : totalKills, avg_acs: totalRounds > 0 ? Math.round(totalScore / totalRounds) : 0, avg_hs_pct: totalShots > 0 ? Math.round(totalHS / totalShots * 100) : 0, avg_damage: n > 0 ? Math.round(totalDamage / n) : 0 },
          top_agents: Object.entries(agentMap).map(([agent, d]) => ({ agent, ...d })).sort((a,b) => b.games - a.games).slice(0, 5),
          top_maps:   Object.entries(mapMap).map(([map, d])     => ({ map,   ...d })).sort((a,b) => b.games - a.games).slice(0, 5),
          recent_matches: recent,
        });
      } catch(err) {
        return res.status(502).json({ error: `Service indisponible: ${err.message}` });
      }
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

      // ── Official Riot API ──────────────────────────────────────────
      if (process.env.RIOT_API_KEY) {
        try {
          // 1. Account lookup (try all routing clusters)
          let account = null;
          for (const cluster of ['europe', 'americas', 'asia']) {
            const r = await fetchRiot(`/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`, cluster);
            if (r.status === 200 && r.data?.puuid) { account = r.data; break; }
            if (r.status === 404) break;
          }
          if (!account) return res.status(404).json({ error: 'Compte Riot introuvable — vérifie le Pseudo#TAG' });

          const { puuid, gameName: name, tagLine: tag } = account;

          // 2. Find shard (where the player's matches are)
          let shard = 'eu';
          for (const s of ['eu', 'na', 'ap', 'br', 'latam', 'kr']) {
            const r = await fetchRiot(`/val/match/v1/matchlists/by-puuid/${puuid}`, s);
            if (r.status === 200) { shard = s; break; }
          }

          // 3. Get rank from most recent competitive match
          const rank = await riotGetRankFromMatches(puuid, shard);

          await sql`
            UPDATE users SET
              riot_gamename = ${name}, riot_tagline = ${tag}, riot_puuid = ${puuid},
              riot_rank = ${rank}, riot_lp = NULL, riot_region = ${shard},
              riot_rank_synced_at = NOW()
            WHERE id = ${decoded.id}
          `;
          return res.status(200).json({ success: true, riot: { gamename: name, tagline: tag, rank, lp: null, region: shard } });
        } catch(err) {
          return res.status(502).json({ error: err.name === 'AbortError' ? 'Timeout — réessaie' : `Erreur réseau: ${err.message}` });
        }
      }

      // ── Henrik API fallback ────────────────────────────────────────
      try {
        const acc = await fetchHenrik(`/valorant/v1/account/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`);
        if (acc.status === 404) return res.status(404).json({ error: 'Compte Riot introuvable — vérifie le Pseudo#TAG' });
        if (acc.status === 429) return res.status(429).json({ error: 'Trop de requêtes, réessaie dans 1 minute' });
        if (acc.status !== 200 || !acc.data?.data?.puuid) {
          const msg = acc.data?.errors?.[0]?.message || acc.data?.message || `Erreur ${acc.status}`;
          return res.status(502).json({ error: `Henrik API: ${msg}`, detail: JSON.stringify(acc.data).slice(0, 300) });
        }
        const puuid = acc.data.data.puuid;
        const region = (acc.data.data.region || 'eu').toLowerCase();
        const name = acc.data.data.name, tag = acc.data.data.tag;
        const mmr = await fetchHenrik(`/valorant/v2/mmr/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`);
        let rank = null, lp = null;
        if (mmr.status === 200 && mmr.data?.data?.current_data) {
          rank = mmr.data.data.current_data.currenttierpatched || null;
          lp   = mmr.data.data.current_data.ranking_in_tier   ?? null;
        }
        await sql`UPDATE users SET riot_gamename=${name}, riot_tagline=${tag}, riot_puuid=${puuid}, riot_rank=${rank}, riot_lp=${lp}, riot_region=${region}, riot_rank_synced_at=NOW() WHERE id=${decoded.id}`;
        return res.status(200).json({ success: true, riot: { gamename: name, tagline: tag, rank, lp, region } });
      } catch(err) {
        return res.status(502).json({ error: err.name === 'AbortError' ? 'Timeout — réessaie' : `Erreur réseau: ${err.message}` });
      }
    }

    // ── Synchroniser le rang Riot ─────────────────────────────────────
    if (action === 'sync-riot') {
      const decoded = verifyToken(req, false);
      if (!decoded) return res.status(401).json({ error: 'Non autorisé' });

      const rows = await sql`SELECT riot_gamename, riot_tagline, riot_region, riot_puuid FROM users WHERE id = ${decoded.id}`;
      if (!rows.length || !rows[0].riot_gamename) {
        return res.status(400).json({ error: 'Aucun compte Riot lié' });
      }
      const { riot_gamename, riot_tagline, riot_region, riot_puuid } = rows[0];

      if (process.env.RIOT_API_KEY) {
        try {
          const rank = riot_puuid ? await riotGetRankFromMatches(riot_puuid, riot_region || 'eu') : null;
          await sql`UPDATE users SET riot_rank=${rank}, riot_lp=NULL, riot_rank_synced_at=NOW() WHERE id=${decoded.id}`;
          return res.status(200).json({ success: true, riot: { gamename: riot_gamename, tagline: riot_tagline, rank, lp: null } });
        } catch(err) {
          return res.status(502).json({ error: `Erreur réseau: ${err.message}` });
        }
      }

      try {
        const mmr = await fetchHenrik(`/valorant/v2/mmr/${riot_region}/${encodeURIComponent(riot_gamename)}/${encodeURIComponent(riot_tagline)}`);
        if (mmr.status === 429) return res.status(429).json({ error: 'Trop de requêtes, réessaie dans 1 minute' });
        let rank = null, lp = null;
        if (mmr.status === 200 && mmr.data?.data?.current_data) {
          rank = mmr.data.data.current_data.currenttierpatched || null;
          lp   = mmr.data.data.current_data.ranking_in_tier   ?? null;
        }
        await sql`UPDATE users SET riot_rank=${rank}, riot_lp=${lp}, riot_rank_synced_at=NOW() WHERE id=${decoded.id}`;
        return res.status(200).json({ success: true, riot: { gamename: riot_gamename, tagline: riot_tagline, rank, lp } });
      } catch(err) {
        return res.status(502).json({ error: `Erreur réseau: ${err.message}` });
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

    // Cloud sync — push + merge
    if (action === 'sync-push') {
      const decoded = verifyToken(req, false);
      if (!decoded) return res.status(401).json({ error: 'Non autorisé' });
      const { client_data } = req.body || {};
      if (!client_data || typeof client_data !== 'object') return res.status(400).json({ error: 'client_data requis' });
      const rows = await sql`SELECT data FROM user_sync_data WHERE user_id = ${decoded.id} LIMIT 1`;
      const serverData = rows.length > 0 ? rows[0].data : {};
      const merged = _mergeSync(serverData, client_data);
      const result = await sql`
        INSERT INTO user_sync_data (user_id, data, updated_at) VALUES (${decoded.id}, ${JSON.stringify(merged)}::jsonb, NOW())
        ON CONFLICT (user_id) DO UPDATE SET data = ${JSON.stringify(merged)}::jsonb, updated_at = NOW()
        RETURNING updated_at
      `;
      return res.status(200).json({ data: merged, updated_at: result[0].updated_at });
    }

    return res.status(400).json({ error: 'Action inconnue' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};

function _mergeSync(server, client) {
  const merged = {};
  for (const tier of ['bench_medium', 'bench_hard', 'bench_easier']) {
    const s = server[tier] || {}, c = client[tier] || {};
    merged[tier] = { ...s };
    for (const [k, v] of Object.entries(c)) {
      if (!merged[tier][k] || (v.score || 0) > (merged[tier][k].score || 0)) merged[tier][k] = v;
    }
  }
  const sRuns = server.runs || {}, cRuns = client.runs || {};
  merged.runs = {};
  for (const mode of new Set([...Object.keys(sRuns), ...Object.keys(cRuns)])) {
    const map = new Map();
    for (const r of [...(sRuns[mode]||[]), ...(cRuns[mode]||[])]) {
      const key = r.date || r.ts || JSON.stringify(r);
      if (!map.has(key) || (r.score||0) > (map.get(key).score||0)) map.set(key, r);
    }
    merged.runs[mode] = [...map.values()].sort((a,b) => new Date(b.date||b.ts||0) - new Date(a.date||a.ts||0)).slice(0, 50);
  }
  const sAch = server.ach_stats || {}, cAch = client.ach_stats || {};
  merged.ach_stats = { ...sAch };
  for (const [k, v] of Object.entries(cAch)) merged.ach_stats[k] = Math.max(merged.ach_stats[k] || 0, v || 0);
  merged.ach_unlocked = [...new Set([...(server.ach_unlocked || []), ...(client.ach_unlocked || [])])];
  const sWk = server.weekly_challenges || {}, cWk = client.weekly_challenges || {};
  const sT = (sWk.challenges || []).reduce((s,c) => s + (c.progress||0), 0);
  const cT = (cWk.challenges || []).reduce((s,c) => s + (c.progress||0), 0);
  merged.weekly_challenges = cT >= sT ? cWk : sWk;
  merged.xp = Math.max(server.xp || 0, client.xp || 0);
  merged.missions = (client.missions||[]).length >= (server.missions||[]).length ? client.missions||[] : server.missions||[];
  merged.settings = client.settings || server.settings || {};
  return merged;
}
