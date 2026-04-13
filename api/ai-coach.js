// /api/ai-coach — Plan hebdomadaire personnalisé via Claude
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

// Lundi de la semaine courante (UTC) → YYYY-MM-DD
function getWeekStart(d = new Date()) {
  const day = d.getUTCDay(); // 0=dim
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setUTCDate(d.getUTCDate() + diff);
  mon.setUTCHours(0, 0, 0, 0);
  return mon.toISOString().slice(0, 10);
}

// Lundi de la semaine prochaine
function getNextWeekStart() {
  const next = new Date();
  next.setUTCDate(next.getUTCDate() + (8 - (next.getUTCDay() || 7)));
  next.setUTCHours(0, 0, 0, 0);
  return next.toISOString().slice(0, 10);
}

// Jours restants avant lundi prochain
function daysUntilNextWeek() {
  const now = new Date();
  const day = now.getUTCDay(); // 0=dim
  return day === 0 ? 1 : 8 - day;
}

// Libellé "Semaine du 7 avril"
function weekLabel(weekStart) {
  return 'Semaine du ' + new Date(weekStart).toLocaleDateString('fr-FR', { day:'numeric', month:'long', timeZone:'UTC' });
}

const BENCH_SCENARIOS = {
  control_tracking: ['whisphereraw','whisphere','smoothbot','leaptrack','ctrlsphere_aim','vt_ctrlsphere','air_angelic','cloverraw','ctrlsphere_far','pgti','air_celestial','whisphere_slow'],
  reactive_tracking: ['ground_plaza','ctrlsphere_ow','flicker_plaza','polarized_hell','air_pure','air_voltaic'],
  flick_tech:        ['pokeball_frenzy','w1w3ts_reload','vox_ts2','beants','floatts','waldots','devts','domiswitch','tamts'],
  click_timing:      ['pasu_reload','vt_bounceshot','ctrlsphere_clk','popcorn_mv','pasu_angelic','pasu_perfected','pasu_micro','floatheads_t','vox_click']
};

const CAT_LABELS = { control_tracking:'Control Tracking', reactive_tracking:'Reactive Tracking', flick_tech:'Flick Tech', click_timing:'Click Timing' };

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

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const decoded = verifyToken(req);
  if (!decoded) return res.status(401).json({ error: 'Non authentifié' });

  const sql = neon(process.env.DATABASE_URL);
  const uid = decoded.id;

  // Table unique pour les plans hebdomadaires (historique complet)
  await sql`CREATE TABLE IF NOT EXISTS ai_coach_plans (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL,
    week_start  DATE NOT NULL,
    analysis    JSONB NOT NULL,
    generated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, week_start)
  )`;

  const thisWeek = getWeekStart();
  const nextWeek = getNextWeekStart();
  const daysLeft = daysUntilNextWeek();

  // ── GET : plan de la semaine courante (ou historique) ──────────────────
  if (req.method === 'GET') {
    const view = req.query?.view;

    // Historique des semaines passées
    if (view === 'history') {
      const rows = await sql`
        SELECT week_start::text, generated_at,
               analysis->>'titre' AS titre,
               analysis->>'diagnostic' AS diagnostic
        FROM ai_coach_plans
        WHERE user_id = ${uid}
        ORDER BY week_start DESC
        LIMIT 8
      `;
      return res.status(200).json({ history: rows });
    }

    // Plan de la semaine courante
    const existing = await sql`
      SELECT analysis, generated_at, week_start::text
      FROM ai_coach_plans
      WHERE user_id = ${uid} AND week_start = ${thisWeek}
    `;

    if (existing.length > 0) {
      return res.status(200).json({
        analysis:      existing[0].analysis,
        generated_at:  existing[0].generated_at,
        week_start:    existing[0].week_start,
        week_label:    weekLabel(existing[0].week_start),
        next_week:     nextWeek,
        days_until_next: daysLeft,
        already_generated: true
      });
    }

    // Aucun plan cette semaine → informer le client
    // (la génération se fait en POST)
    return res.status(200).json({
      analysis: null,
      week_start: thisWeek,
      week_label: weekLabel(thisWeek),
      next_week: nextWeek,
      days_until_next: daysLeft,
      already_generated: false
    });
  }

  // ── POST : générer le plan de la semaine ────────────────────────────────
  if (req.method === 'POST') {
    // Un seul plan par semaine
    const existing = await sql`
      SELECT id FROM ai_coach_plans WHERE user_id = ${uid} AND week_start = ${thisWeek}
    `;
    if (existing.length > 0) {
      return res.status(409).json({
        error: 'Plan déjà généré pour cette semaine',
        days_until_next: daysLeft,
        next_week: nextWeek
      });
    }

    // ── Collecter les données du joueur ──────────────────────────────────
    const [userRow, statsRow, recent20, modeBreakdown, rankRow, weekCmp, voltaicBench, lastWeekPlan] = await Promise.all([
      sql`SELECT username, current_rank, objective FROM users WHERE id = ${uid}`,

      sql`SELECT COUNT(*)::int AS total_games,
            COALESCE(MAX(score),0)::int AS best_score,
            COALESCE(ROUND(AVG(score)),0)::int AS avg_score,
            COALESCE(ROUND(AVG(accuracy)::numeric,1),0) AS avg_accuracy,
            COALESCE(ROUND(AVG(NULLIF(avg_reaction,0)))::int,0) AS avg_reaction,
            COALESCE(MAX(best_combo),0)::int AS best_combo_ever
          FROM game_history WHERE user_id = ${uid}`,

      sql`SELECT mode, score, accuracy, hits, misses, avg_reaction, best_combo, played_at
          FROM game_history WHERE user_id = ${uid}
          ORDER BY played_at DESC LIMIT 20`,

      sql`SELECT mode, MAX(score)::int AS best_score, ROUND(AVG(score))::int AS avg_score,
            ROUND(AVG(accuracy)::numeric,1) AS avg_acc, COUNT(*)::int AS plays,
            ROUND(AVG(NULLIF(avg_reaction,0)))::int AS avg_react
          FROM game_history WHERE user_id = ${uid}
          GROUP BY mode ORDER BY plays DESC`,

      sql`SELECT rank FROM (
            SELECT user_id, RANK() OVER (ORDER BY SUM(score) DESC)::int AS rank
            FROM game_history GROUP BY user_id
          ) t WHERE user_id = ${uid}`,

      // Comparaison semaine courante vs semaine passée
      sql`SELECT
            COUNT(*) FILTER (WHERE played_at >= ${thisWeek}::date)::int AS this_week,
            COUNT(*) FILTER (WHERE played_at >= ${getWeekStart(new Date(Date.now()-7*86400000))}::date AND played_at < ${thisWeek}::date)::int AS last_week,
            COALESCE(ROUND(AVG(score) FILTER (WHERE played_at >= ${thisWeek}::date)),0)::int AS avg_score_this_week,
            COALESCE(ROUND(AVG(score) FILTER (WHERE played_at >= ${getWeekStart(new Date(Date.now()-7*86400000))}::date AND played_at < ${thisWeek}::date)),0)::int AS avg_score_last_week,
            COALESCE(ROUND(AVG(accuracy) FILTER (WHERE played_at >= ${thisWeek}::date)::numeric,1),0) AS avg_acc_this_week
          FROM game_history WHERE user_id = ${uid}`,

      sql`SELECT rank_name, rank_idx, scenarios, played_at
          FROM voltaic_benchmarks WHERE user_id = ${uid}
          ORDER BY played_at DESC LIMIT 1`,

      // Plan de la semaine dernière pour le suivi
      sql`SELECT analysis->>'titre' AS titre, analysis->>'focus' AS focus,
               analysis->'plan' AS plan_items, week_start::text
          FROM ai_coach_plans WHERE user_id = ${uid}
          ORDER BY week_start DESC LIMIT 1`
    ]);

    const streakRows = await sql`
      WITH days AS (SELECT DISTINCT DATE(played_at) AS d FROM game_history WHERE user_id = ${uid} ORDER BY d DESC),
      numbered AS (SELECT d, ROW_NUMBER() OVER (ORDER BY d DESC) - 1 AS rn FROM days)
      SELECT COUNT(*)::int AS streak FROM numbered
      WHERE d = (CURRENT_DATE - (rn || ' days')::interval)::date`;

    const user   = userRow[0] || {};
    const stats  = statsRow[0] || {};
    const streak = streakRows[0]?.streak || 0;
    const rank   = rankRow[0]?.rank || null;
    const wk     = weekCmp[0] || {};
    const vBench = voltaicBench[0] || null;
    const prevPlan = lastWeekPlan[0] || null;

    const benchMap = {};
    modeBreakdown.forEach(m => { benchMap[m.mode] = m; });

    // Tendances last 5 vs prev 5
    const last5    = recent20.slice(0, 5);
    const prev5    = recent20.slice(5, 10);
    const avg5score = last5.length ? Math.round(last5.reduce((s,g)=>s+g.score,0)/last5.length) : 0;
    const avgP5score= prev5.length ? Math.round(prev5.reduce((s,g)=>s+g.score,0)/prev5.length) : 0;
    const avg5acc   = last5.length ? (last5.reduce((s,g)=>s+Number(g.accuracy),0)/last5.length).toFixed(1) : 0;
    const trendScore = avgP5score > 0 ? Math.round((avg5score - avgP5score)/avgP5score*100) : null;

    // Répartition catégories
    const catCounts = { control_tracking:0, reactive_tracking:0, flick_tech:0, click_timing:0 };
    modeBreakdown.forEach(m => {
      const cat = Object.entries(BENCH_SCENARIOS).find(([,keys]) => keys.includes(m.mode))?.[0];
      if (cat) catCounts[cat] += m.plays;
    });
    const totalBenchPlays = Object.values(catCounts).reduce((a,b)=>a+b,0) || 1;
    const catPct = Object.fromEntries(Object.entries(catCounts).map(([k,v])=>[k,Math.round(v/totalBenchPlays*100)]));
    const benchCats = Object.keys(catCounts).sort((a,b)=>catCounts[b]-catCounts[a]);
    const dominant  = benchCats[0], neglected = benchCats[benchCats.length-1];

    // Benchmark détaillé
    let benchSection = '';
    let hasAnyBench = false;
    for (const [cat, keys] of Object.entries(BENCH_SCENARIOS)) {
      const lines = [];
      keys.forEach(k => {
        const d = benchMap[k];
        if (!d) return;
        hasAnyBench = true;
        const reactStr = d.avg_react ? `, réaction ${d.avg_react}ms` : '';
        lines.push(`  • ${SCENARIO_LABELS[k]||k}: best ${Number(d.best_score).toLocaleString()} pts, moy. ${Number(d.avg_score).toLocaleString()} pts, ${d.avg_acc}% préc., ${d.plays} partie${d.plays>1?'s':''}${reactStr}`);
      });
      if (lines.length) benchSection += `\n${CAT_LABELS[cat]} (${catPct[cat]}% des parties):\n${lines.join('\n')}\n`;
    }

    // Voltaic
    let voltaicStr = 'Non effectué.';
    if (vBench) {
      const scenarios = typeof vBench.scenarios === 'string' ? JSON.parse(vBench.scenarios) : (vBench.scenarios || []);
      const maxThreads = scenarios.reduce((s,sc) => s+(sc.threads||0), 0);
      voltaicStr = `Rang: ${vBench.rank_name||'Unranked'} (index ${vBench.rank_idx}/8) — ${maxThreads} threads (évalué le ${new Date(vBench.played_at).toLocaleDateString('fr-FR')})`;
    }

    // 10 dernières parties
    const recentStr = recent20.slice(0,10).map(g => {
      const date = new Date(g.played_at).toLocaleDateString('fr-FR');
      const reactStr = g.avg_reaction ? `, réaction ${g.avg_reaction}ms` : '';
      const comboStr = g.best_combo > 1 ? `, combo x${g.best_combo}` : '';
      return `  • ${SCENARIO_LABELS[g.mode]||g.mode}: ${Number(g.score).toLocaleString()} pts, ${g.accuracy}% préc.${reactStr}${comboStr} (${date})`;
    }).join('\n');

    // Semaine courante vs semaine passée
    const weekTrendScore = wk.avg_score_last_week > 0
      ? Math.round((wk.avg_score_this_week - wk.avg_score_last_week) / wk.avg_score_last_week * 100)
      : null;
    const weekStr = `${wk.this_week||0} parties cette semaine (vs ${wk.last_week||0} la semaine précédente)${weekTrendScore !== null ? `, score moy. ${weekTrendScore>0?'+':''}${weekTrendScore}% vs semaine précédente` : ''}`;
    const trendStr = trendScore !== null
      ? `Last 5 parties vs les 5 précédentes : score moyen ${trendScore>0?'+':''}${trendScore}%, précision moy. récente ${avg5acc}%`
      : `Score moyen sur les 5 dernières parties : ${avg5score.toLocaleString()} pts`;

    // Plan semaine précédente (pour suivi)
    let prevPlanStr = '';
    if (prevPlan) {
      const items = Array.isArray(prevPlan.plan_items) ? prevPlan.plan_items : [];
      prevPlanStr = `\n═══ PLAN DE LA SEMAINE PRÉCÉDENTE (${prevPlan.week_start}) ═══\nTitre: ${prevPlan.titre||'?'}\nFocus conseillé: ${prevPlan.focus||'?'}\nScénarios prescrits: ${items.map(s=>s.label||s.key).join(', ')||'N/A'}\n(Compare les scores actuels du joueur sur ces scénarios pour évaluer la progression)`;
    }

    // ── Prompt ────────────────────────────────────────────────────────────
    const prompt = `Tu es Coach Mayhaim, coach aim training expert et analytique.
Tu génères un PLAN HEBDOMADAIRE personnalisé pour la ${weekLabel(thisWeek)}.
Ce plan sera suivi pendant 7 jours, puis remplacé par un nouveau la semaine prochaine.
Sois précis, cite des chiffres réels, propose un plan réaliste pour 7 jours.

═══ PROFIL ═══
Pseudo: ${user.username||'Joueur'}
Rang Valorant: ${user.current_rank||'Non renseigné'}
Objectif: ${user.objective||'Non renseigné'}
Classement global: ${rank ? '#'+rank : 'Non classé'}
Voltaic Benchmark: ${voltaicStr}

═══ STATISTIQUES ═══
Parties totales: ${stats.total_games||0} | Best: ${Number(stats.best_score||0).toLocaleString()} pts | Moy: ${Number(stats.avg_score||0).toLocaleString()} pts
Précision moy: ${stats.avg_accuracy||0}% | Réaction moy: ${stats.avg_reaction?stats.avg_reaction+'ms':'N/A'} | Best combo: x${stats.best_combo_ever||0}
Streak: ${streak} jour${streak!==1?'s':''}

═══ ACTIVITÉ ═══
${weekStr}
${trendStr}

═══ RÉPARTITION BENCHMARK ═══
Control Tracking: ${catCounts.control_tracking} parties (${catPct.control_tracking}%)
Reactive Tracking: ${catCounts.reactive_tracking} parties (${catPct.reactive_tracking}%)
Flick Tech: ${catCounts.flick_tech} parties (${catPct.flick_tech}%)
Click Timing: ${catCounts.click_timing} parties (${catPct.click_timing}%)
→ Dominant: ${CAT_LABELS[dominant]||dominant} | Négligé: ${CAT_LABELS[neglected]||neglected}

═══ SCORES PAR SCÉNARIO ═══
${hasAnyBench ? benchSection.trim() : 'Aucun scénario joué encore.'}

═══ 10 DERNIÈRES PARTIES ═══
${recentStr||'Aucune partie.'}
${prevPlanStr}

Génère UNIQUEMENT un JSON valide, sans markdown :
{
  "titre": "Titre percutant pour la semaine (15 mots max)",
  "diagnostic": "Analyse 3-4 phrases citant chiffres réels, tendances, catégorie négligée, comparaison semaine précédente si dispo",
  "forces": ["force concrète avec chiffre ou scénario précis", "deuxième force"],
  "axes": ["axe précis avec nom de scénario + score actuel", "deuxième axe chiffré"],
  "plan": [
    {"key":"scenario_key","label":"Nom","reps":4,"conseil":"Conseil précis et actionnable (20 mots max)"},
    {"key":"scenario_key2","label":"Nom","reps":3,"conseil":"Conseil"},
    {"key":"scenario_key3","label":"Nom","reps":3,"conseil":"Conseil"},
    {"key":"scenario_key4","label":"Nom","reps":2,"conseil":"Conseil"}
  ],
  "focus": "Conseil technique prioritaire pour cette semaine, justifié par les données (1 phrase)",
  "objectif_semaine": "Objectif mesurable et réaliste pour la semaine (ex: atteindre X pts sur Y, ou améliorer la précision de Z%)",
  "motivation": "Message motivant personnalisé avec chiffres concrets (2 phrases max)"
}

Clés valides pour plan: ${Object.keys(SCENARIO_LABELS).join(', ')}
4 scénarios dans le plan pour une semaine complète. reps = nombre de sessions conseillées sur la semaine.`;

    // ── Appeler Claude ──────────────────────────────────────────────────
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    let analysis;
    try {
      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1800,
        messages: [{ role: 'user', content: prompt }]
      });
      const raw = message.content[0]?.text || '{}';
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(raw);
    } catch(e) {
      return res.status(500).json({ error: 'Erreur génération IA: ' + e.message });
    }

    // Sauvegarder le plan
    await sql`
      INSERT INTO ai_coach_plans (user_id, week_start, analysis)
      VALUES (${uid}, ${thisWeek}, ${JSON.stringify(analysis)})
      ON CONFLICT (user_id, week_start) DO UPDATE SET analysis = EXCLUDED.analysis, generated_at = NOW()
    `;

    return res.status(200).json({
      analysis,
      generated_at:    new Date().toISOString(),
      week_start:      thisWeek,
      week_label:      weekLabel(thisWeek),
      next_week:       nextWeek,
      days_until_next: daysLeft,
      already_generated: true
    });
  }

  return res.status(405).json({ error: 'Méthode non supportée' });
};
