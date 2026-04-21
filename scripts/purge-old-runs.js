// Purge benchmark_runs older than RETENTION_DAYS (default 90).
//
// Pourquoi : la table benchmark_runs grossit vite (un grinder fait ~500
// runs/jour). À 10 000 runs/mois × 12 mois × 100 users = 12M lignes/an ce qui
// ralentit les agrégats. On garde :
//   • TOUS les runs benchmark (is_benchmark = true) récents (< 90j) pour les
//     percentiles et le graphe d'évolution
//   • Les best-of-all-time par (user_id, scenario, difficulty) pour que la
//     progression longue-durée reste visible sur le profil
//   • Les runs free-play (is_benchmark = false) récents (< 30j) — moins utiles
//     historiquement, on les purge plus agressivement
//
// Usage manuel :
//   DATABASE_URL=... node scripts/purge-old-runs.js
//   DATABASE_URL=... RETENTION_DAYS=180 node scripts/purge-old-runs.js
//   DATABASE_URL=... DRY_RUN=1 node scripts/purge-old-runs.js   (compte sans supprimer)
//
// Idempotent : peut être rejoué sans effet de bord. Prévu pour être appelé
// depuis un cron Vercel (voir vercel.json → crons) ou un GitHub Action nightly.

const { neon } = require('@neondatabase/serverless');

async function purge() {
  if (!process.env.DATABASE_URL) {
    console.error('[purge] DATABASE_URL manquant');
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);
  const retention = Math.max(parseInt(process.env.RETENTION_DAYS) || 90, 7);
  const freePlayRetention = Math.max(parseInt(process.env.FREE_PLAY_RETENTION_DAYS) || 30, 7);
  const dry = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

  console.log(`[purge] retention=${retention}j (benchmark) / ${freePlayRetention}j (free-play) · dry_run=${dry}`);

  // ── 1. Compter l'existant ────────────────────────────────────────────────
  const totalBefore = await sql`SELECT COUNT(*)::int AS c FROM benchmark_runs`;
  console.log(`[purge] total runs avant : ${totalBefore[0].c}`);

  // ── 2. Identifier les best-of-all-time à PRÉSERVER ───────────────────────
  // Top 1 par (user_id, scenario, difficulty) parmi les runs benchmark.
  // Ces IDs sont exemptés de la purge pour garder la progression longue.
  const keepers = await sql`
    SELECT DISTINCT ON (user_id, scenario, difficulty) id
    FROM benchmark_runs
    WHERE is_benchmark = true
    ORDER BY user_id, scenario, difficulty, score DESC, played_at DESC
  `;
  const keeperIds = keepers.map(r => r.id);
  console.log(`[purge] best-of-all-time préservés : ${keeperIds.length}`);

  // ── 3. Cibles de purge : runs benchmark anciens hors "keepers" ───────────
  const oldBenchmark = await sql`
    SELECT COUNT(*)::int AS c FROM benchmark_runs
    WHERE is_benchmark = true
      AND played_at < NOW() - (${retention} || ' days')::interval
      AND NOT (id = ANY(${keeperIds}))
  `;
  console.log(`[purge] benchmark runs > ${retention}j (hors best) : ${oldBenchmark[0].c}`);

  // ── 4. Cibles de purge : free-play anciens (plus agressif) ───────────────
  const oldFreePlay = await sql`
    SELECT COUNT(*)::int AS c FROM benchmark_runs
    WHERE is_benchmark = false
      AND played_at < NOW() - (${freePlayRetention} || ' days')::interval
  `;
  console.log(`[purge] free-play runs > ${freePlayRetention}j : ${oldFreePlay[0].c}`);

  if (dry) {
    console.log('[purge] DRY_RUN — aucune suppression effectuée');
    return;
  }

  // ── 5. DELETE ────────────────────────────────────────────────────────────
  const delBench = await sql`
    DELETE FROM benchmark_runs
    WHERE is_benchmark = true
      AND played_at < NOW() - (${retention} || ' days')::interval
      AND NOT (id = ANY(${keeperIds}))
    RETURNING id
  `;
  console.log(`[purge] ✓ supprimé ${delBench.length} benchmark runs anciens`);

  const delFree = await sql`
    DELETE FROM benchmark_runs
    WHERE is_benchmark = false
      AND played_at < NOW() - (${freePlayRetention} || ' days')::interval
    RETURNING id
  `;
  console.log(`[purge] ✓ supprimé ${delFree.length} free-play runs anciens`);

  const totalAfter = await sql`SELECT COUNT(*)::int AS c FROM benchmark_runs`;
  console.log(`[purge] total runs après : ${totalAfter[0].c}  (−${totalBefore[0].c - totalAfter[0].c})`);
}

purge().catch(e => {
  console.error('[purge] erreur :', e);
  process.exit(1);
});
