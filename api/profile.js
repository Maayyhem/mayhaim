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

async function fetchHenrik(path, timeoutMs = 8000) {
  const key = process.env.HENRIK_API_KEY;
  const headers = key ? { 'Authorization': key } : {};
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://api.henrikdev.xyz${path}`, { headers, signal: controller.signal });
    let data;
    try { data = await res.json(); } catch { data = {}; }
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}

// Fetch the full stored-matches history using batched parallel pagination.
// Returns an array of raw stored-match rows (later fed through _normalizeStoredMatch).
// Terminates early on: rate-limit (429), error, empty page, or short page (end of history).
// NB: stored-matches has less detail (no round events) → plants/defuses/clutches/KAST are null.
async function fetchStoredMatchesAll(region, name, tag, {
  maxPages  = 40,   // ~1000 matches absolute cap
  pageSize  = 25,   // Henrik's per-page cap for this endpoint
  batchSize = 4,    // concurrent requests per round
  deadlineMs = 9000 // budget within the serverless invocation (Vercel hobby = 10s)
} = {}) {
  const all = [];
  const started = Date.now();
  let stop = false;
  const basePath = `/valorant/v1/stored-matches/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;

  for (let first = 1; first <= maxPages && !stop; first += batchSize) {
    if (Date.now() - started > deadlineMs) break;   // hard stop before Vercel kills us
    const pages = [];
    for (let p = first; p < first + batchSize && p <= maxPages; p++) pages.push(p);
    const results = await Promise.all(pages.map(p =>
      fetchHenrik(`${basePath}?size=${pageSize}&page=${p}`, 8000).catch(() => ({ status: 0, data: null }))
    ));
    // Process in page order; stop as soon as one batch page is short/empty/errored
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 429 || r.status !== 200) { stop = true; break; }
      const rows = Array.isArray(r.data?.data) ? r.data.data : [];
      if (rows.length === 0) { stop = true; break; }
      all.push(...rows);
      if (rows.length < pageSize) { stop = true; break; }
    }
  }
  return all;
}

// Normalize a stored-matches row into the same shape as _processHenrikMatches.recent items.
// Round-level fields (plants/defuses/clutches/kast/multikills/ability_casts) are left null/0.
function _normalizeStoredMatch(row) {
  const meta   = row?.meta || {};
  const stats  = row?.stats || {};
  const teams  = row?.teams || {};
  const shotsObj = stats.shots || {};
  const headshots = shotsObj.head || 0;
  const bodyshots = shotsObj.body || 0;
  const legshots  = shotsObj.leg  || 0;
  const totalShots = headshots + bodyshots + legshots;

  const myTeam = (stats.team || '').toLowerCase();
  const rRed   = teams.red  ?? 0;
  const rBlue  = teams.blue ?? 0;
  const rTotal = rRed + rBlue;
  const myR    = myTeam === 'blue' ? rBlue : rRed;
  const oppR   = myTeam === 'blue' ? rRed  : rBlue;
  const won    = myR > oppR;

  const agent  = (typeof stats.character === 'object' && stats.character !== null)
    ? (stats.character.name || 'Unknown')
    : (stats.character || 'Unknown');
  const mapName = (typeof meta.map === 'object' && meta.map !== null)
    ? (meta.map.name || 'Unknown')
    : (meta.map || 'Unknown');
  const seasonId = meta.season?.id || meta.season?.short || meta.season_id || null;

  const acs   = rTotal > 0 ? Math.round((stats.score || 0) / rTotal) : 0;
  const hsPct = totalShots > 0 ? Math.round((headshots / totalShots) * 100) : 0;
  const dmgMade = stats.damage?.made ?? stats.damage_made ?? 0;
  const dmgRcv  = stats.damage?.received ?? stats.damage_received ?? 0;
  const dpr    = rTotal > 0 ? Math.round(dmgMade / rTotal) : null;
  const dprRcv = rTotal > 0 ? Math.round(dmgRcv  / rTotal) : null;

  return {
    match_id: meta.id || null,
    map: mapName,
    agent,
    mode: meta.mode || 'Competitive',
    result: won ? 'WIN' : 'LOSS',
    score: `${myR}-${oppR}`,
    kills: stats.kills || 0,
    deaths: stats.deaths || 0,
    assists: stats.assists || 0,
    acs,
    hs_pct: hsPct,
    damage: dpr,
    damage_received: dprRcv,
    multikills: { twoK: 0, threeK: 0, fourK: 0, aces: 0 },
    first_blood: false,
    kast: null,
    rr_change: null,
    ability_casts: { c: 0, q: 0, e: 0, x: 0 },
    plants: null, defuses: null, clutches: null, first_death: null,
    season_id: seasonId,
    date: meta.started_at || null,
    _source: 'stored',
    _shots: totalShots, _hs: headshots, _score: stats.score || 0, _rounds: rTotal,
    _dmg: dmgMade, _dmgRcv: dmgRcv,
  };
}

// Aggregate stats + top_agents + top_maps from a merged normalized match list.
// Keeps nullable fields nullable in the aggregate (e.g. avg_kast = null if no v3 data).
function _aggregateFromRecent(recent) {
  let wins=0, losses=0, tK=0, tD=0, tA=0, tHS=0, tSh=0, tSc=0, tRd=0, tDmg=0;
  let tPlants=0, tDefuses=0, tClutches=0, tFirstDeaths=0, tFirstBloods=0, tKastSum=0, tKastGames=0;
  const agentMap={}, mapMap={};
  for (const m of (recent || [])) {
    if (m.result === 'WIN') wins++; else losses++;
    tK += m.kills||0; tD += m.deaths||0; tA += m.assists||0;
    tHS += m._hs||0; tSh += m._shots||0; tSc += m._score||0; tRd += m._rounds||0; tDmg += m._dmg||0;
    const agent = m.agent || 'Unknown';
    if (!agentMap[agent]) agentMap[agent] = {games:0,wins:0,kills:0,deaths:0,score:0,rounds:0,hs:0,shots:0,kast_sum:0,kast_games:0};
    agentMap[agent].games++; if (m.result==='WIN') agentMap[agent].wins++;
    agentMap[agent].kills += m.kills||0; agentMap[agent].deaths += m.deaths||0;
    agentMap[agent].score += m._score||0; agentMap[agent].rounds += m._rounds||0;
    agentMap[agent].hs += m._hs||0; agentMap[agent].shots += m._shots||0;
    if (m.kast != null) { agentMap[agent].kast_sum += m.kast; agentMap[agent].kast_games++; tKastSum += m.kast; tKastGames++; }
    const map = m.map || 'Unknown';
    if (!mapMap[map]) mapMap[map] = {games:0,wins:0};
    mapMap[map].games++; if (m.result==='WIN') mapMap[map].wins++;
    if (typeof m.plants  === 'number') tPlants  += m.plants;
    if (typeof m.defuses === 'number') tDefuses += m.defuses;
    if (typeof m.clutches=== 'number') tClutches+= m.clutches;
    if (m.first_death === true) tFirstDeaths++;
    if (m.first_blood === true) tFirstBloods++;
  }
  const n = wins + losses;
  return {
    stats: {
      matches_analyzed: n, wins, losses,
      win_rate: n > 0 ? Math.round(wins/n*100) : 0,
      kda: tD > 0 ? parseFloat(((tK + tA*0.5)/tD).toFixed(2)) : tK,
      avg_acs: tRd > 0 ? Math.round(tSc/tRd) : 0,
      avg_hs_pct: tSh > 0 ? Math.round(tHS/tSh*100) : 0,
      avg_damage: tRd > 0 ? Math.round(tDmg/tRd) : 0,
      avg_kast: tKastGames > 0 ? Math.round(tKastSum / tKastGames) : null,
      total_plants: tPlants, total_defuses: tDefuses,
      total_clutches: tClutches, total_first_bloods: tFirstBloods, total_first_deaths: tFirstDeaths,
    },
    top_agents: Object.entries(agentMap).map(([agent, d]) => ({
      agent, games: d.games, wins: d.wins, kills: d.kills, deaths: d.deaths,
      avg_acs: d.rounds > 0 ? Math.round(d.score / d.rounds) : null,
      avg_hs_pct: d.shots > 0 ? Math.round(d.hs / d.shots * 100) : null,
      avg_kast: d.kast_games > 0 ? Math.round(d.kast_sum / d.kast_games) : null,
    })).sort((a,b) => b.games - a.games).slice(0, 5),
    top_maps: Object.entries(mapMap).map(([map,d]) => ({map,...d})).sort((a,b)=>b.games-a.games).slice(0,5),
    recent_matches: recent,
  };
}

// Merge v3 (detailed) + stored (basic) match lists by match_id. v3 wins on conflict.
// Returns a deduped array sorted by date descending.
function _mergeMatchLists(v3List, storedList) {
  const byId = new Map();
  for (const m of (v3List || [])) {
    if (m.match_id) byId.set(m.match_id, m);
  }
  for (const m of (storedList || [])) {
    if (m.match_id && !byId.has(m.match_id)) byId.set(m.match_id, m);
  }
  const merged = [...byId.values()];
  merged.sort((a,b) => (b.date || '').localeCompare(a.date || ''));
  return merged;
}

// ── Shared match processor (Henrik v3) ────────────────────────────────
// rrMap: { matchId -> rr_change } — optional, from MMR history
function _processHenrikMatches(matches, name, tag, rrMap) {
  let wins=0, losses=0, tK=0, tD=0, tA=0, tHS=0, tSh=0, tSc=0, tRd=0, tDmg=0;
  let tPlants=0, tDefuses=0, tClutches=0, tFirstDeaths=0, tFirstBloods=0, tKastSum=0, tKastGames=0;
  const agentMap={}, mapMap={}, recent=[];

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
    tK += st.kills||0; tD += st.deaths||0; tA += st.assists||0; tHS += st.headshots||0;
    const shots = (st.headshots||0) + (st.bodyshots||0) + (st.legshots||0);
    tSh += shots; tSc += st.score||0; tRd += rTotal; tDmg += me.damage_made||0;
    const agent = me.character || 'Unknown', map = m.metadata?.map || 'Unknown';
    const queueMode = m.metadata?.mode || 'Competitive';
    const matchId = m.metadata?.matchid || null;
    const seasonId = m.metadata?.season_id || m.metadata?.season || null;

    // Per-agent aggregation
    if (!agentMap[agent]) agentMap[agent] = {games:0,wins:0,kills:0,deaths:0,score:0,rounds:0,hs:0,shots:0,kast_sum:0,kast_games:0};
    agentMap[agent].games++; if(won) agentMap[agent].wins++;
    agentMap[agent].kills += st.kills||0; agentMap[agent].deaths += st.deaths||0;
    agentMap[agent].score += st.score||0; agentMap[agent].rounds += rTotal;
    agentMap[agent].hs += st.headshots||0; agentMap[agent].shots += shots;
    if (!mapMap[map]) mapMap[map] = {games:0,wins:0};
    mapMap[map].games++; if(won) mapMap[map].wins++;

    // Derived per-match stats
    const acs     = rTotal > 0 ? Math.round((st.score||0) / rTotal) : 0;
    const hsPct   = shots  > 0 ? Math.round(((st.headshots||0) / shots) * 100) : 0;
    const dpr     = rTotal > 0 ? Math.round((me.damage_made||0) / rTotal) : null;
    const dprRcv  = rTotal > 0 ? Math.round((me.damage_received||0) / rTotal) : null;
    const myR     = myTeam === 'blue' ? rBlue : rRed;
    const oppR    = myTeam === 'blue' ? rRed  : rBlue;

    // Multi-kills from kill events (kills array on match)
    const killsByRound = {};
    for (const k of (m.kills || [])) {
      if (k.killer_puuid && k.killer_puuid === me.puuid) {
        killsByRound[k.round] = (killsByRound[k.round] || 0) + 1;
      }
    }
    const vals    = Object.values(killsByRound);
    const twoK   = vals.filter(v => v === 2).length;
    const threeK = vals.filter(v => v === 3).length;
    const fourK  = vals.filter(v => v === 4).length;
    const aces   = vals.filter(v => v >= 5).length;

    // First blood: earliest kill in the match by this player
    const matchKills = [...(m.kills || [])].sort((a, b) => (a.kill_time_in_match||0) - (b.kill_time_in_match||0));
    const firstBlood = matchKills.length > 0 && matchKills[0].killer_puuid === me.puuid;

    // Pre-bucket kills by their `round` key (Henrik sometimes emits 0-indexed,
    // sometimes 1-indexed depending on endpoint/version). We detect the base
    // by looking at the min key and map array index → round key accordingly.
    const killsByRoundKey = new Map();
    for (const k of (m.kills || [])) {
      if (typeof k.round !== 'number') continue;
      if (!killsByRoundKey.has(k.round)) killsByRoundKey.set(k.round, []);
      killsByRoundKey.get(k.round).push(k);
    }
    const roundKeys = [...killsByRoundKey.keys()];
    const minRoundKey = roundKeys.length ? Math.min(...roundKeys) : 0;
    const rdKeyFor = (i) => i + minRoundKey;

    // KAST% — per round: did player Kill / Assist / Survive / get Traded?
    // Only count rounds that actually have logged kill events, to avoid
    // inflating KAST on rounds Henrik didn't instrument.
    let kastRounds = 0;
    let kastEligibleRounds = 0;
    if (m.rounds && m.rounds.length > 0) {
      const myPuuid = me.puuid;
      for (let i = 0; i < m.rounds.length; i++) {
        const rdKills = killsByRoundKey.get(rdKeyFor(i)) || [];
        if (rdKills.length === 0) continue;
        kastEligibleRounds++;
        const hadKill   = rdKills.some(k => k.killer_puuid === myPuuid);
        const hadAssist = rdKills.some(k => (k.assistants || []).some(a => a.assistant_puuid === myPuuid));
        const myDeath   = rdKills.find(k => k.victim_puuid === myPuuid);
        const survived  = !myDeath;
        let traded = false;
        if (myDeath) {
          const killerPuuid = myDeath.killer_puuid;
          const tradeWindow = (myDeath.kill_time_in_round || 0) + 3000;
          traded = rdKills.some(k =>
            k.victim_puuid === killerPuuid &&
            (k.kill_time_in_round || 0) > (myDeath.kill_time_in_round || 0) &&
            (k.kill_time_in_round || 0) <= tradeWindow &&
            k.killer_puuid !== myPuuid
          );
        }
        if (hadKill || hadAssist || survived || traded) kastRounds++;
      }
    }
    const kastPct = kastEligibleRounds > 0 ? Math.round(kastRounds / kastEligibleRounds * 100) : null;

    // Update per-agent KAST
    if (kastPct != null) { agentMap[agent].kast_sum += kastPct; agentMap[agent].kast_games++; }

    // Round-level stats: plants, defuses, clutches, first deaths
    let matchPlants = 0, matchDefuses = 0, matchClutches = 0, matchFirstDeaths = 0;
    if (m.rounds && m.rounds.length > 0) {
      const myPuuid = me.puuid;
      const allPlayers = m.players?.all_players || [];
      const teammates = allPlayers
        .filter(p => (p.team||'').toLowerCase() === myTeam && p.puuid !== myPuuid)
        .map(p => p.puuid);

      for (let i = 0; i < m.rounds.length; i++) {
        const rd = m.rounds[i];
        const rdKills = killsByRoundKey.get(rdKeyFor(i)) || [];
        const sortedRdKills = [...rdKills].sort((a,b) => (a.kill_time_in_round||0) - (b.kill_time_in_round||0));

        // Plant (try both v3 and v2 property paths)
        const plantPuuid = rd.plant?.planted_by?.puuid ?? rd.plant_events?.planted_by?.puuid;
        if (plantPuuid && plantPuuid === myPuuid) matchPlants++;

        // Defuse (try both v3 and v2 property paths)
        const defusePuuid = rd.defuse?.defused_by?.puuid ?? rd.defuse_events?.defused_by?.puuid;
        if (defusePuuid && defusePuuid === myPuuid) matchDefuses++;

        // First death in this round
        if (sortedRdKills.length > 0 && sortedRdKills[0].victim_puuid === myPuuid) matchFirstDeaths++;

        // Clutch: my team won, I survived, ALL teammates died
        const winningTeam = (rd.winning_team || '').toLowerCase();
        if (winningTeam === myTeam && teammates.length > 0) {
          const iSurvived = !rdKills.some(k => k.victim_puuid === myPuuid);
          if (iSurvived) {
            const deadTm = rdKills.filter(k => teammates.includes(k.victim_puuid)).length;
            if (deadTm >= teammates.length) matchClutches++;
          }
        }
      }
    }
    tPlants += matchPlants; tDefuses += matchDefuses;
    tClutches += matchClutches; tFirstDeaths += matchFirstDeaths;
    if (firstBlood) tFirstBloods++;
    if (kastPct != null) { tKastSum += kastPct; tKastGames++; }

    // Ability casts
    const ab = me.ability_casts || {};

    // RR change from MMR history
    const rrChange = (rrMap && matchId) ? (rrMap[matchId] ?? null) : null;

    recent.push({
      match_id: matchId,
      map, agent, mode: queueMode, result: won ? 'WIN' : 'LOSS', score: `${myR}-${oppR}`,
      kills: st.kills||0, deaths: st.deaths||0, assists: st.assists||0,
      acs, hs_pct: hsPct, damage: dpr, damage_received: dprRcv,
      multikills: { twoK, threeK, fourK, aces },
      first_blood: firstBlood,
      kast: kastPct,
      rr_change: rrChange,
      ability_casts: { c: ab.c_cast||0, q: ab.q_cast||0, e: ab.e_cast||0, x: ab.x_cast||0 },
      plants: matchPlants, defuses: matchDefuses, clutches: matchClutches, first_death: matchFirstDeaths > 0,
      season_id: seasonId,
      date: m.metadata?.game_start ? new Date(m.metadata.game_start * 1000).toISOString() : null,
      // raw fields for client-side re-aggregation
      _shots: shots, _hs: st.headshots||0, _score: st.score||0, _rounds: rTotal,
      _dmg: me.damage_made||0, _dmgRcv: me.damage_received||0,
    });
  }

  const n = wins + losses;
  const topAgents = Object.entries(agentMap).map(([agent, d]) => ({
    agent, games: d.games, wins: d.wins, kills: d.kills, deaths: d.deaths,
    avg_acs: d.rounds > 0 ? Math.round(d.score / d.rounds) : null,
    avg_hs_pct: d.shots > 0 ? Math.round(d.hs / d.shots * 100) : null,
    avg_kast: d.kast_games > 0 ? Math.round(d.kast_sum / d.kast_games) : null,
  })).sort((a,b) => b.games - a.games).slice(0, 5);

  return {
    stats: {
      matches_analyzed: n, wins, losses,
      win_rate: n > 0 ? Math.round(wins/n*100) : 0,
      kda: tD > 0 ? parseFloat(((tK + tA*0.5)/tD).toFixed(2)) : tK,
      avg_acs: tRd > 0 ? Math.round(tSc/tRd) : 0,
      avg_hs_pct: tSh > 0 ? Math.round(tHS/tSh*100) : 0,
      avg_damage: tRd > 0 ? Math.round(tDmg/tRd) : 0,
      avg_kast: tKastGames > 0 ? Math.round(tKastSum / tKastGames) : null,
      total_plants: tPlants, total_defuses: tDefuses,
      total_clutches: tClutches, total_first_bloods: tFirstBloods, total_first_deaths: tFirstDeaths,
    },
    top_agents: topAgents,
    top_maps: Object.entries(mapMap).map(([map,d]) => ({map,...d})).sort((a,b)=>b.games-a.games).slice(0,5),
    recent_matches: recent,
  };
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
        // Parallel: v3 matches (detailed, last 25) + stored-matches (full history, paginated)
        //        + MMR rank + MMR history (for RR per game)
        const [matchResult, storedRows, mmrResult, mmrHistResult] = await Promise.all([
          fetchHenrik(`/valorant/v3/matches/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?size=25`),
          fetchStoredMatchesAll(region, name, tag),
          fetchHenrik(`/valorant/v2/mmr/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`),
          fetchHenrik(`/valorant/v3/mmr/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`),
        ]);

        if (matchResult.status === 429 || mmrResult.status === 429) {
          return res.status(429).json({ error: 'Trop de requêtes, réessaie dans 1 minute' });
        }
        if (matchResult.status !== 200 && (!storedRows || storedRows.length === 0)) {
          return res.status(502).json({ error: `API indisponible (${matchResult.status})` });
        }

        // Rank + peak rank
        let rank = null, lp = null, peakRank = null;
        if (mmrResult.status === 200 && mmrResult.data?.data?.current_data) {
          rank     = mmrResult.data.data.current_data.currenttierpatched || null;
          lp       = mmrResult.data.data.current_data.ranking_in_tier   ?? null;
          peakRank = mmrResult.data.data.highest_rank?.patched_tier     ?? null;
        }

        // RR history map: matchId → rr_change
        const rrMap = {};
        for (const h of (mmrHistResult.data?.data?.history || [])) {
          if (h.match_id && h.last_change != null) rrMap[h.match_id] = h.last_change;
        }

        const v3Processed = _processHenrikMatches(matchResult.data?.data || [], name, tag, rrMap);
        const storedNorm  = (storedRows || []).map(_normalizeStoredMatch).filter(x => x.match_id);
        // Apply rrMap to stored matches too
        for (const m of storedNorm) if (rrMap[m.match_id] != null) m.rr_change = rrMap[m.match_id];
        const merged = _mergeMatchLists(v3Processed.recent_matches, storedNorm);
        const aggregated = _aggregateFromRecent(merged);
        return res.status(200).json({ account: { gamename: name, tagline: tag, rank, lp, peak_rank: peakRank }, ...aggregated });
      } catch(err) {
        return res.status(502).json({ error: `Service indisponible: ${err.message}` });
      }
    }

    // ── Match detail (public, no auth) ───────────────────────────────
    if (action === 'tracker-match') {
      const { matchId } = req.query || {};
      if (!matchId) return res.status(400).json({ error: 'matchId requis' });
      try {
        const r = await fetchHenrik(`/valorant/v2/match/${encodeURIComponent(matchId)}`);
        if (r.status === 429) return res.status(429).json({ error: 'Trop de requêtes, réessaie dans 1 minute' });
        if (r.status !== 200) return res.status(502).json({ error: `Match introuvable (${r.status})` });
        const d = r.data?.data || r.data || {};
        const meta = d.metadata || {};
        const allPlayers = d.players?.all_players || [];
        const teams = d.teams || {};
        const kills = d.kills || [];
        const rounds = d.rounds || [];

        // Pre-bucket kills by their k.round value once (shared across all players).
        // Henrik's round objects have no stable id field, so we align by kill.round
        // and detect 0- vs 1-based indexing from the minimum key observed.
        const killsByRoundKey = new Map();
        for (const k of kills) {
          if (typeof k.round !== 'number') continue;
          if (!killsByRoundKey.has(k.round)) killsByRoundKey.set(k.round, []);
          killsByRoundKey.get(k.round).push(k);
        }
        const _rkKeys = [...killsByRoundKey.keys()];
        const _rkMin  = _rkKeys.length ? Math.min(..._rkKeys) : 0;
        const rdKeyForIdx = (i) => i + _rkMin;

        // Build scoreboard: all 10 players with full stats
        const scoreboard = allPlayers.map(p => {
          const st = p.stats || {};
          const shots = (st.headshots||0) + (st.bodyshots||0) + (st.legshots||0);
          const rTotal = (teams?.blue?.rounds_won||0) + (teams?.red?.rounds_won||0);
          const acs = rTotal > 0 ? Math.round((st.score||0) / rTotal) : 0;
          const hsPct = shots > 0 ? Math.round(((st.headshots||0) / shots) * 100) : 0;
          const dpr = rTotal > 0 ? Math.round((p.damage_made||0) / rTotal) : null;
          const dprRcv = rTotal > 0 ? Math.round((p.damage_received||0) / rTotal) : null;
          const kd = (st.deaths||0) > 0 ? parseFloat(((st.kills||0)/(st.deaths||0)).toFixed(2)) : (st.kills||0);
          // Multi-kills
          const mkByRound = {};
          for (const k of kills) {
            if (k.killer_puuid === p.puuid) mkByRound[k.round] = (mkByRound[k.round]||0) + 1;
          }
          const mkVals = Object.values(mkByRound);
          const multikills = { twoK: mkVals.filter(v=>v===2).length, threeK: mkVals.filter(v=>v===3).length, fourK: mkVals.filter(v=>v===4).length, aces: mkVals.filter(v=>v>=5).length };
          // KAST per player — align kills with round index via detected base,
          // skip rounds with no logged kill events to avoid inflating the ratio.
          let kastRounds = 0;
          let kastEligible = 0;
          for (let i = 0; i < rounds.length; i++) {
            const rdKills = killsByRoundKey.get(rdKeyForIdx(i)) || [];
            if (rdKills.length === 0) continue;
            kastEligible++;
            const K = rdKills.some(k => k.killer_puuid === p.puuid);
            const A = rdKills.some(k => (k.assistants||[]).some(a => a.assistant_puuid === p.puuid));
            const myDeath = rdKills.find(k => k.victim_puuid === p.puuid);
            const survived = !myDeath;
            let T = false;
            if (myDeath) {
              const tradeWin = (myDeath.kill_time_in_round||0) + 3000;
              T = rdKills.some(k =>
                k.victim_puuid === myDeath.killer_puuid &&
                (k.kill_time_in_round||0) > (myDeath.kill_time_in_round||0) &&
                (k.kill_time_in_round||0) <= tradeWin &&
                k.killer_puuid !== p.puuid
              );
            }
            if (K || A || survived || T) kastRounds++;
          }
          const kast = kastEligible > 0 ? Math.round(kastRounds / kastEligible * 100) : null;
          // First blood
          const sortedKills = [...kills].sort((a,b)=>(a.kill_time_in_match||0)-(b.kill_time_in_match||0));
          const firstBlood = sortedKills.length > 0 && sortedKills[0].killer_puuid === p.puuid;
          const ab = p.ability_casts || {};
          return {
            puuid: p.puuid, name: p.name, tag: p.tag, agent: p.character,
            team: (p.team||'').toLowerCase(),
            rank: p.currenttier_patched || null, rank_tier: p.currenttier || 0,
            level: p.level || 0,
            kills: st.kills||0, deaths: st.deaths||0, assists: st.assists||0,
            acs, kd, hs_pct: hsPct, damage: dpr, damage_received: dprRcv,
            score: st.score||0, kast, first_blood: firstBlood, multikills,
            ability_casts: { c: ab.c_cast||0, q: ab.q_cast||0, e: ab.e_cast||0, x: ab.x_cast||0 },
            headshots: st.headshots||0, bodyshots: st.bodyshots||0, legshots: st.legshots||0,
          };
        }).sort((a,b) => b.acs - a.acs);

        // Round summary
        const roundSummary = rounds.map((rd, idx) => ({
          round: rd.round_num ?? idx,
          winning_team: (rd.winning_team||'').toLowerCase(),
          end_type: rd.end_type || null,
          plant: rd.plant ? { site: rd.plant.site, time: rd.plant.plant_time_in_round } : null,
          defuse: rd.defuse ? { time: rd.defuse.defuse_time_in_round } : null,
          player_economies: (rd.player_economies || []).map(e => ({
            puuid: e.puuid, loadout_value: e.loadout_value||0, spent: e.spent||0,
            remaining: e.remaining||0, weapon: e.weapon?.name || null, armor: e.armor?.name || null,
          })),
        }));

        return res.status(200).json({
          match_id: matchId,
          map: meta.map || 'Unknown',
          mode: meta.mode || 'Competitive',
          date: meta.game_start ? new Date(meta.game_start * 1000).toISOString() : null,
          duration: meta.game_length || null,
          blue: { rounds_won: teams?.blue?.rounds_won||0, has_won: teams?.blue?.has_won||false },
          red:  { rounds_won: teams?.red?.rounds_won ||0, has_won: teams?.red?.has_won ||false },
          scoreboard,
          round_summary: roundSummary,
        });
      } catch(err) {
        return res.status(502).json({ error: `Service indisponible: ${err.message}` });
      }
    }

    // ── Tracker Valorant ──────────────────────────────────────────────
    if (action === 'tracker') {
      const decoded = verifyToken(req, false);
      if (!decoded) return res.status(401).json({ error: 'Non autorisé' });
      // mode filtering is handled client-side

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
        const regionList = (shard && shard !== 'null') ? [shard] : ['eu', 'na', 'ap', 'br', 'latam', 'kr'];
        let matchResult = null, foundRegion = shard || 'eu';
        for (const r of regionList) {
          const attempt = await fetchHenrik(`/valorant/v3/matches/${r}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?size=25`);
          if (attempt.status === 200) { matchResult = attempt; foundRegion = r; break; }
          if (attempt.status === 429) return res.status(429).json({ error: 'Trop de requêtes, réessaie dans 1 minute' });
        }
        if (!matchResult || matchResult.status !== 200) return res.status(502).json({ error: 'Joueur introuvable. Relie ton compte à nouveau.' });

        // Fetch MMR history + v2 peak rank in parallel (best effort)
        const rrMap = {};
        let peakRank = null;
        try {
          const [mmrH, mmrV2] = await Promise.all([
            fetchHenrik(`/valorant/v3/mmr/${foundRegion}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`),
            fetchHenrik(`/valorant/v2/mmr/${foundRegion}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`),
          ]);
          for (const h of (mmrH.data?.data?.history || [])) {
            if (h.match_id && h.last_change != null) rrMap[h.match_id] = h.last_change;
          }
          if (mmrV2.status === 200) {
            peakRank = mmrV2.data?.data?.highest_rank?.patched_tier ?? null;
          }
        } catch {}

        // Fetch full history via paginated stored-matches, merge with v3 detailed
        let storedRows = [];
        try { storedRows = await fetchStoredMatchesAll(foundRegion, name, tag); } catch {}

        const v3Processed = _processHenrikMatches(matchResult.data?.data || [], name, tag, rrMap);
        const storedNorm  = (storedRows || []).map(_normalizeStoredMatch).filter(x => x.match_id);
        for (const m of storedNorm) if (rrMap[m.match_id] != null) m.rr_change = rrMap[m.match_id];
        const merged = _mergeMatchLists(v3Processed.recent_matches, storedNorm);
        const aggregated = _aggregateFromRecent(merged);
        return res.status(200).json({ account: { gamename: name, tagline: tag, rank, lp, peak_rank: peakRank }, ...aggregated });
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
