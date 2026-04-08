// /api/ai-coach — Génère un coaching personnalisé via Claude
const Anthropic = require('@anthropic-ai/sdk');
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
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try { return jwt.verify(h.slice(7), process.env.JWT_SECRET); } catch { return null; }
}

const CAT_LABELS = {
  control_tracking: 'Control Tracking',
  reactive_tracking: 'Reactive Tracking',
  flick_tech: 'Flick Tech',
  click_timing: 'Click Timing'
};

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Non authentifié' });

  const sql = neon(process.env.DATABASE_URL);
  const uid = decoded.id;

  // ── GET : retourne l'analyse en cache (si < 6h) ou génère une nouvelle ──
  if (req.method === 'GET') {
    const force = req.query?.force === '1';

    // Vérifier le cache DB
    await sql`CREATE TABLE IF NOT EXISTS ai_coach_cache (
      user_id INTEGER PRIMARY KEY,
      analysis JSONB,
      generated_at TIMESTAMP DEFAULT NOW()
    )`;

    if (!force) {
      const cached = await sql`
        SELECT analysis, generated_at FROM ai_coach_cache
        WHERE user_id = ${uid} AND generated_at > NOW() - INTERVAL '6 hours'
      `;
      if (cached.length > 0) {
        return res.status(200).json({
          analysis: cached[0].analysis,
          generated_at: cached[0].generated_at,
          cached: true
        });
      }
    }

    // Récupérer toutes les données du joueur
    const [userRow, statsRow, activity7, recent10, modeBreakdown, rankRow] = await Promise.all([
      sql`SELECT username, current_rank, objective FROM users WHERE id = ${uid}`,
      sql`SELECT COUNT(*)::int AS total_games, COALESCE(MAX(score),0)::int AS best_score,
            COALESCE(ROUND(AVG(score)),0)::int AS avg_score,
            COALESCE(ROUND(AVG(accuracy)::numeric,1),0) AS avg_accuracy
          FROM game_history WHERE user_id = ${uid}`,
      sql`SELECT DATE(played_at)::text AS day, COUNT(*)::int AS games, MAX(score)::int AS best
          FROM game_history WHERE user_id = ${uid} AND played_at >= NOW() - INTERVAL '7 days'
          GROUP BY DATE(played_at) ORDER BY day`,
      sql`SELECT mode, score, accuracy, played_at FROM game_history
          WHERE user_id = ${uid} ORDER BY played_at DESC LIMIT 10`,
      sql`SELECT mode, MAX(score)::int AS best_score, ROUND(AVG(accuracy)::numeric,1) AS avg_acc, COUNT(*)::int AS plays
          FROM game_history WHERE user_id = ${uid}
          GROUP BY mode ORDER BY best_score DESC`,
      sql`SELECT rank FROM (
            SELECT user_id, RANK() OVER (ORDER BY SUM(score) DESC)::int AS rank
            FROM game_history GROUP BY user_id
          ) t WHERE user_id = ${uid}`
    ]);

    const streakRows = await sql`
      WITH days AS (SELECT DISTINCT DATE(played_at) AS d FROM game_history WHERE user_id = ${uid} ORDER BY d DESC),
      numbered AS (SELECT d, ROW_NUMBER() OVER (ORDER BY d DESC) - 1 AS rn FROM days)
      SELECT COUNT(*)::int AS streak FROM numbered
      WHERE d = (CURRENT_DATE - (rn || ' days')::interval)::date`;

    const weekCmp = await sql`
      SELECT
        COUNT(*) FILTER (WHERE played_at >= NOW() - INTERVAL '7 days')::int AS this_week,
        COUNT(*) FILTER (WHERE played_at >= NOW() - INTERVAL '14 days' AND played_at < NOW() - INTERVAL '7 days')::int AS last_week
      FROM game_history WHERE user_id = ${uid}`;

    const user = userRow[0] || {};
    const stats = statsRow[0] || {};
    const streak = streakRows[0]?.streak || 0;
    const rank = rankRow[0]?.rank || null;
    const thisWeek = weekCmp[0]?.this_week || 0;
    const lastWeek = weekCmp[0]?.last_week || 0;

    // Construire le résumé benchmark depuis game_history
    const benchMap = {};
    modeBreakdown.forEach(m => { benchMap[m.mode] = m; });

    // Scénarios benchmark connus avec catégories
    const BENCH_SCENARIOS = {
      control_tracking: ['whisphereraw','whisphere','smoothbot','leaptrack','ctrlsphere_aim','vt_ctrlsphere','air_angelic','cloverraw','ctrlsphere_far','pgti','air_celestial','whisphere_slow'],
      reactive_tracking: ['ground_plaza','ctrlsphere_ow','flicker_plaza','polarized_hell','air_pure','air_voltaic'],
      flick_tech: ['pokeball_frenzy','w1w3ts_reload','vox_ts2','beants','floatts','waldots','devts','domiswitch','tamts'],
      click_timing: ['pasu_reload','vt_bounceshot','ctrlsphere_clk','popcorn_mv','pasu_angelic','pasu_perfected','pasu_micro','floatheads_t','vox_click']
    };

    const SCENARIO_LABELS = {
      whisphereraw:'WhisphereRawControl', whisphere:'Whisphere', smoothbot:'SmoothBot Goated', leaptrack:'Leaptrack Goated',
      ctrlsphere_aim:'Controlsphere rAim', vt_ctrlsphere:'VT Controlsphere', air_angelic:'Air Angelic 4', cloverraw:'Cloverrawcontrol',
      ctrlsphere_far:'Controlsphere Far', pgti:'PGTI Voltaic Easy', air_celestial:'Air CELESTIAL', whisphere_slow:'Whisphere Slow',
      ground_plaza:'Ground Plaza Sparky', ctrlsphere_ow:'Controlsphere OW', flicker_plaza:'Flicker Plaza rAim',
      polarized_hell:'Polarized Hell', air_pure:'Air Pure', air_voltaic:'Air Voltaic',
      pokeball_frenzy:'Pokeball Frenzy', w1w3ts_reload:'1w3ts Reload', vox_ts2:'voxTargetSwitch 2',
      beants:'BeanTS', floatts:'FloatTS', waldots:'WaldoTS', devts:'devTS', domiswitch:'domiSwitch', tamts:'tamTargetSwitch',
      pasu_reload:'Pasu Reload', vt_bounceshot:'VT Bounceshot', ctrlsphere_clk:'Controlsphere Click',
      popcorn_mv:'Popcorn MV', pasu_angelic:'Pasu Angelic', pasu_perfected:'1w2ts Pasu Perfected',
      pasu_micro:'1w3ts Pasu Perfected Micro', floatheads_t:'Floating Heads Timing', vox_click:'voxTargetClick'
    };

    // Résumé benchmark par catégorie
    let benchSummary = '';
    let allScored = [];
    for (const [cat, keys] of Object.entries(BENCH_SCENARIOS)) {
      const catLabel = CAT_LABELS[cat] || cat;
      const lines = keys.map(k => {
        const d = benchMap[k];
        if (!d) return null;
        const score = d.best_score;
        const label = SCENARIO_LABELS[k] || k;
        return `  - ${label}: ${score.toLocaleString()} pts (${d.plays} partie${d.plays>1?'s':''}, ${d.avg_acc}% préc.)`;
      }).filter(Boolean);
      if (lines.length > 0) {
        benchSummary += `${catLabel}:\n${lines.join('\n')}\n`;
        lines.forEach((_, i) => allScored.push({ key: keys[i], cat, label: SCENARIO_LABELS[keys[i]] || keys[i], data: benchMap[keys[i]] }));
      }
    }

    // 10 dernières parties
    const recentStr = recent10.map(g => {
      const date = new Date(g.played_at).toLocaleDateString('fr-FR');
      return `  - ${SCENARIO_LABELS[g.mode]||g.mode}: ${Number(g.score).toLocaleString()} pts, ${g.accuracy}% préc. (${date})`;
    }).join('\n');

    // Activité semaine
    const activityStr = `${thisWeek} parties cette semaine (vs ${lastWeek} la semaine précédente)`;

    // Calculer points forts/faibles depuis les données
    const scoredModes = modeBreakdown.filter(m => SCENARIO_LABELS[m.mode]);
    const byAcc = [...scoredModes].sort((a, b) => b.avg_acc - a.avg_acc);
    const byPlays = [...scoredModes].sort((a, b) => b.plays - a.plays);

    const prompt = `Tu es Coach Mayhaim, un coach aim training expert et bienveillant.
Analyse les données de jeu suivantes et génère un coaching personnalisé, précis et motivant en français.

JOUEUR: ${user.username || 'Joueur'}
Rang global: ${rank ? '#'+rank : 'Non classé'}
Objectif déclaré: ${user.objective || 'Non renseigné'}
Rang Valorant actuel: ${user.current_rank || 'Non renseigné'}

STATISTIQUES GLOBALES:
- Parties totales: ${stats.total_games || 0}
- Meilleur score: ${Number(stats.best_score||0).toLocaleString()} pts
- Score moyen: ${Number(stats.avg_score||0).toLocaleString()} pts
- Précision moyenne: ${stats.avg_accuracy || 0}%
- Streak actuel: ${streak} jour${streak!==1?'s':''}
- Activité: ${activityStr}

HISTORIQUE BENCHMARK (scores et précision par scénario joué):
${benchSummary || 'Aucun scénario benchmark joué encore.'}

10 DERNIÈRES PARTIES:
${recentStr || 'Aucune partie encore.'}

Réponds UNIQUEMENT avec un objet JSON valide (pas de markdown, pas de texte avant/après), avec cette structure exacte:
{
  "titre": "Accroche personnalisée et percutante pour ce joueur (15 mots max)",
  "diagnostic": "Analyse de 2-3 phrases sur l'état réel du joueur, ses tendances, ce qui ressort des données",
  "forces": ["force concrète basée sur les données", "deuxième force"],
  "axes": ["axe d'amélioration précis avec scénario nommé", "deuxième axe"],
  "plan": [
    {"key": "scenario_key", "label": "Nom du scénario", "reps": 3, "conseil": "Conseil technique très précis (20 mots max)"},
    {"key": "scenario_key2", "label": "Nom", "reps": 2, "conseil": "Conseil"},
    {"key": "scenario_key3", "label": "Nom", "reps": 2, "conseil": "Conseil"}
  ],
  "focus": "Le conseil technique le plus important et urgent (1 phrase, très précis)",
  "motivation": "Message court, percutant, personnalisé selon le profil et les données (2 phrases max)"
}

Les scenario keys dans "plan" doivent être parmi: ${Object.keys(SCENARIO_LABELS).join(', ')}
Analyse les données réellement — ne sois pas générique. Si le joueur a un streak, mentionne-le. Si sa précision est excellente mais ses scores bas, dis-le. Sois honnête et bienveillant.`;

    // Appeler Claude
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    let analysis;
    try {
      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      });

      const raw = message.content[0]?.text || '{}';
      // Extraire le JSON (au cas où il y aurait du texte autour)
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(raw);
    } catch(e) {
      return res.status(500).json({ error: 'Erreur génération IA: ' + e.message });
    }

    // Sauvegarder en cache
    await sql`
      INSERT INTO ai_coach_cache (user_id, analysis, generated_at)
      VALUES (${uid}, ${JSON.stringify(analysis)}, NOW())
      ON CONFLICT (user_id) DO UPDATE SET analysis = EXCLUDED.analysis, generated_at = NOW()
    `;

    return res.status(200).json({ analysis, generated_at: new Date().toISOString(), cached: false });
  }

  return res.status(405).json({ error: 'Méthode non supportée' });
};
