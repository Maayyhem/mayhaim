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
  try { return jwt.verify(h.split(' ')[1], process.env.JWT_SECRET); } catch { return null; }
}

function mergeData(server, client) {
  const merged = {};

  // Benchmark best scores (bench_medium, bench_hard, bench_easier)
  // Each is { scenarioKey: { score, accuracy, energy, rank, date } }
  // Keep the HIGHER score for each scenario
  for (const tier of ['bench_medium', 'bench_hard', 'bench_easier']) {
    const s = server[tier] || {};
    const c = client[tier] || {};
    merged[tier] = { ...s };
    for (const [k, v] of Object.entries(c)) {
      if (!merged[tier][k] || (v.score || 0) > (merged[tier][k].score || 0)) {
        merged[tier][k] = v;
      }
    }
  }

  // Run history per mode — union, deduplicate by timestamp, keep last 50
  // runs = { modeKey: [ {score, acc, date, ...}, ... ] }
  const sRuns = server.runs || {};
  const cRuns = client.runs || {};
  merged.runs = {};
  const allModes = new Set([...Object.keys(sRuns), ...Object.keys(cRuns)]);
  for (const mode of allModes) {
    const sArr = sRuns[mode] || [];
    const cArr = cRuns[mode] || [];
    // Merge by date uniqueness
    const map = new Map();
    for (const r of [...sArr, ...cArr]) {
      const key = r.date || r.ts || JSON.stringify(r);
      if (!map.has(key) || (r.score||0) > (map.get(key).score||0)) map.set(key, r);
    }
    merged.runs[mode] = [...map.values()].sort((a,b) => new Date(b.date||b.ts||0) - new Date(a.date||a.ts||0)).slice(0, 50);
  }

  // Achievement stats — take MAX of each stat
  const sAch = server.ach_stats || {};
  const cAch = client.ach_stats || {};
  merged.ach_stats = { ...sAch };
  for (const [k, v] of Object.entries(cAch)) {
    merged.ach_stats[k] = Math.max(merged.ach_stats[k] || 0, v || 0);
  }

  // Unlocked achievements — union (array of string IDs)
  merged.ach_unlocked = [...new Set([...(server.ach_unlocked || []), ...(client.ach_unlocked || [])])];

  // Weekly challenges — take the one with highest total progress
  const sWk = server.weekly_challenges || {};
  const cWk = client.weekly_challenges || {};
  const sTotal = (sWk.challenges || []).reduce((s,c) => s + (c.progress||0), 0);
  const cTotal = (cWk.challenges || []).reduce((s,c) => s + (c.progress||0), 0);
  merged.weekly_challenges = cTotal >= sTotal ? cWk : sWk;

  // XP — take MAX
  merged.xp = Math.max(server.xp || 0, client.xp || 0);

  // Missions — take the set with more completed missions
  const sMis = server.missions || [];
  const cMis = client.missions || [];
  merged.missions = cMis.length >= sMis.length ? cMis : sMis;

  // Settings — client always wins (latest device preference)
  merged.settings = client.settings || server.settings || {};

  return merged;
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Non autorisé' });
  const sql = neon(process.env.DATABASE_URL);

  // Auto-create table
  await sql`CREATE TABLE IF NOT EXISTS user_sync_data (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`;

  if (req.method === 'GET') {
    const rows = await sql`
      SELECT data, updated_at FROM user_sync_data WHERE user_id = ${decoded.id} LIMIT 1
    `;
    if (rows.length === 0) return res.status(200).json({ data: {}, updated_at: null });
    return res.status(200).json({ data: rows[0].data, updated_at: rows[0].updated_at });
  }

  if (req.method === 'POST') {
    const { client_data } = req.body || {};
    if (!client_data || typeof client_data !== 'object') {
      return res.status(400).json({ error: 'client_data is required' });
    }

    // Read current server data
    const rows = await sql`
      SELECT data FROM user_sync_data WHERE user_id = ${decoded.id} LIMIT 1
    `;
    const serverData = rows.length > 0 ? rows[0].data : {};

    // Merge
    const merged = mergeData(serverData, client_data);

    // Upsert
    const result = await sql`
      INSERT INTO user_sync_data (user_id, data, updated_at)
      VALUES (${decoded.id}, ${JSON.stringify(merged)}::jsonb, NOW())
      ON CONFLICT (user_id) DO UPDATE SET data = ${JSON.stringify(merged)}::jsonb, updated_at = NOW()
      RETURNING updated_at
    `;

    return res.status(200).json({ data: merged, updated_at: result[0].updated_at });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
