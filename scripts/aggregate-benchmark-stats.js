// Aggregate benchmark_runs → benchmark_stats_daily.
//
// Pourquoi : calculer PERCENTILE_CONT à la volée devient lent au-delà de
// quelques millions de runs (scan complet + tri in-memory). On pré-agrège par
// (scenario, difficulty, jour) pour que les badges de percentile et l'onglet
// admin Analytics restent cheap.
//
// Idempotent. Upsert ON CONFLICT DO UPDATE sur (scenario, difficulty, day) —
// peut être rejoué autant de fois que voulu pour recalculer un jour, et le
// mode par défaut (hier) peut tourner plusieurs fois dans la même journée
// sans effet de bord. Seuls les runs is_benchmark = true sont agrégés — les
// free-play ne comptent pas pour les percentiles.
//
// Usage :
//   DATABASE_URL=... node scripts/aggregate-benchmark-stats.js
//     → agrège hier (en UTC) + aujourd'hui (pour capturer les runs en cours)
//
//   DATABASE_URL=... BACKFILL_DAYS=90 node scripts/aggregate-benchmark-stats.js
//     → recalcule les 90 derniers jours (utile après correction de données)
//
//   DATABASE_URL=... FULL_BACKFILL=1 node scripts/aggregate-benchmark-stats.js
//     → recalcule tout depuis la première entrée de benchmark_runs
//
//   DATABASE_URL=... DAY=2026-04-15 node scripts/aggregate-benchmark-stats.js
//     → recalcule uniquement ce jour
//
// Prévu pour tourner en cron Vercel quotidien (ex. à 3h UTC) OU via une
// GitHub Action nightly avec le secret DATABASE_URL.

const { neon } = require('@neondatabase/serverless');

async function ensureSchema(sql) {
  // Crée la table et ses index si setup-db.js n'a pas été rejoué depuis
  // le bump 2.2.0. Rend ce script self-contained.
  await sql`
    CREATE TABLE IF NOT EXISTS benchmark_stats_daily (
      id           SERIAL PRIMARY KEY,
      scenario     TEXT NOT NULL,
      difficulty   TEXT NOT NULL DEFAULT 'medium',
      day          DATE NOT NULL,
      run_count    INTEGER NOT NULL,
      unique_users INTEGER NOT NULL,
      avg_score    NUMERIC(10,2) NOT NULL,
      max_score    INTEGER NOT NULL,
      p10          NUMERIC(10,2),
      p25          NUMERIC(10,2),
      p50          NUMERIC(10,2),
      p75          NUMERIC(10,2),
      p90          NUMERIC(10,2),
      avg_accuracy NUMERIC(5,1),
      computed_at  TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(scenario, difficulty, day)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_stats_daily_scen_diff ON benchmark_stats_daily(scenario, difficulty, day DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_stats_daily_day ON benchmark_stats_daily(day DESC)`;
}

async function aggregateDay(sql, day) {
  // Upsert : on recalcule puis on écrase. Pas de delete-then-insert pour
  // éviter les race conditions si un cron et un backfill manuel se croisent.
  const result = await sql`
    INSERT INTO benchmark_stats_daily (
      scenario, difficulty, day,
      run_count, unique_users, avg_score, max_score,
      p10, p25, p50, p75, p90, avg_accuracy, computed_at
    )
    SELECT
      scenario,
      difficulty,
      ${day}::date,
      COUNT(*)::int,
      COUNT(DISTINCT user_id)::int,
      ROUND(AVG(score)::numeric, 2),
      MAX(score)::int,
      ROUND(PERCENTILE_CONT(0.10) WITHIN GROUP (ORDER BY score)::numeric, 2),
      ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY score)::numeric, 2),
      ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY score)::numeric, 2),
      ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY score)::numeric, 2),
      ROUND(PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY score)::numeric, 2),
      ROUND(AVG(accuracy)::numeric, 1),
      NOW()
    FROM benchmark_runs
    WHERE DATE(played_at) = ${day}::date
      AND is_benchmark = true
    GROUP BY scenario, difficulty
    ON CONFLICT (scenario, difficulty, day) DO UPDATE SET
      run_count    = EXCLUDED.run_count,
      unique_users = EXCLUDED.unique_users,
      avg_score    = EXCLUDED.avg_score,
      max_score    = EXCLUDED.max_score,
      p10          = EXCLUDED.p10,
      p25          = EXCLUDED.p25,
      p50          = EXCLUDED.p50,
      p75          = EXCLUDED.p75,
      p90          = EXCLUDED.p90,
      avg_accuracy = EXCLUDED.avg_accuracy,
      computed_at  = NOW()
    RETURNING id
  `;
  return result.length;
}

async function daysToProcess(sql) {
  if (process.env.DAY) {
    return [process.env.DAY];
  }
  if (process.env.FULL_BACKFILL === '1' || process.env.FULL_BACKFILL === 'true') {
    const rows = await sql`
      SELECT DISTINCT DATE(played_at)::text AS d
      FROM benchmark_runs
      WHERE is_benchmark = true
      ORDER BY d
    `;
    return rows.map(r => r.d);
  }
  const days = Math.max(parseInt(process.env.BACKFILL_DAYS) || 0, 0);
  if (days > 0) {
    const out = [];
    for (let i = days; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }
  // Mode par défaut : hier + aujourd'hui (aujourd'hui étant partiel, on veut
  // quand même le matérialiser pour que les lectures à J ne se cassent pas)
  const today = new Date();
  const yesterday = new Date(today); yesterday.setUTCDate(today.getUTCDate() - 1);
  return [yesterday.toISOString().slice(0, 10), today.toISOString().slice(0, 10)];
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('[aggregate] DATABASE_URL manquant');
    process.exit(1);
  }
  const sql = neon(process.env.DATABASE_URL);
  await ensureSchema(sql);

  const days = await daysToProcess(sql);
  console.log(`[aggregate] ${days.length} jour(s) à traiter`);
  if (days.length === 0) {
    console.log('[aggregate] rien à faire');
    return;
  }

  let totalRows = 0;
  for (const d of days) {
    const n = await aggregateDay(sql, d);
    totalRows += n;
    // Log compact : un seul caractère par jour traité en mode backfill
    if (days.length > 10) {
      process.stdout.write(n > 0 ? '.' : '·');
    } else {
      console.log(`[aggregate] ${d} → ${n} (scenario, difficulty) groupes`);
    }
  }
  if (days.length > 10) process.stdout.write('\n');
  console.log(`[aggregate] ✓ ${totalRows} lignes upsertées dans benchmark_stats_daily`);
}

main().catch(e => {
  console.error('[aggregate] erreur :', e);
  process.exit(1);
});
