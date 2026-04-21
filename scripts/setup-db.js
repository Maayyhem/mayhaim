// Run this once to set up the full database schema on Neon
// Usage: DATABASE_URL=... node scripts/setup-db.js

const { neon } = require('@neondatabase/serverless');

async function setup() {
  const sql = neon(process.env.DATABASE_URL);

  // ── Core ─────────────────────────────────────────────────────────────────

  console.log('[1/8] users...');
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      username      TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT DEFAULT 'student',   -- student | coach | admin
      bio           TEXT,
      avatar_url    TEXT,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // ── Legacy (kept for compatibility) ──────────────────────────────────────

  console.log('[2/8] coaching_stats (legacy)...');
  await sql`
    CREATE TABLE IF NOT EXISTS coaching_stats (
      id                  SERIAL PRIMARY KEY,
      user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
      sessions_count      INTEGER DEFAULT 0,
      scenarios_completed TEXT    DEFAULT '[]',
      vods_watched        TEXT    DEFAULT '[]',
      updated_at          TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  console.log('[3/8] game_history...');
  await sql`
    CREATE TABLE IF NOT EXISTS game_history (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL,
      username      VARCHAR(100),
      mode          VARCHAR(100) NOT NULL,
      score         INTEGER DEFAULT 0,
      accuracy      INTEGER DEFAULT 0,
      hits          INTEGER DEFAULT 0,
      misses        INTEGER DEFAULT 0,
      avg_reaction  INTEGER,
      best_combo    INTEGER DEFAULT 0,
      duration      INTEGER DEFAULT 60,
      played_at     TIMESTAMP DEFAULT NOW()
    )
  `;

  // ── Coach ↔ Player ────────────────────────────────────────────────────────

  console.log('[4/8] coaching_relationships...');
  await sql`
    CREATE TABLE IF NOT EXISTS coaching_relationships (
      id            SERIAL PRIMARY KEY,
      coach_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
      player_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      status        TEXT DEFAULT 'pending',     -- pending | active | declined | ended
      requested_by  INTEGER REFERENCES users(id),
      message       TEXT,                        -- message d'invitation optionnel
      created_at    TIMESTAMPTZ DEFAULT NOW(),
      updated_at    TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(coach_id, player_id)
    )
  `;

  // ── Benchmark ─────────────────────────────────────────────────────────────

  console.log('[5/8] benchmark_runs...');
  await sql`
    CREATE TABLE IF NOT EXISTS benchmark_runs (
      id           SERIAL PRIMARY KEY,
      user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
      scenario     TEXT NOT NULL,
      score        INTEGER DEFAULT 0,
      accuracy     INTEGER DEFAULT 0,
      hits         INTEGER DEFAULT 0,
      misses       INTEGER DEFAULT 0,
      energy       FLOAT   DEFAULT 0,
      rank_name    TEXT,
      difficulty   TEXT    DEFAULT 'medium',
      duration     INTEGER DEFAULT 60,
      is_benchmark BOOLEAN DEFAULT false,
      played_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_benchmark_runs_user ON benchmark_runs(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_benchmark_runs_scenario ON benchmark_runs(scenario)`;

  // ── Plans d'entraînement ──────────────────────────────────────────────────

  console.log('[6/8] training_plans...');
  await sql`
    CREATE TABLE IF NOT EXISTS training_plans (
      id               SERIAL PRIMARY KEY,
      coach_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
      player_id        INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title            TEXT NOT NULL,
      description      TEXT,
      scenarios        JSONB DEFAULT '[]',   -- [{scenario, reps, note, difficulty, done}]
      status           TEXT DEFAULT 'active', -- active | completed | archived
      target_energy    FLOAT,
      target_scenario  TEXT,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // ── Feedback coach ────────────────────────────────────────────────────────

  console.log('[7/8] feedback...');
  await sql`
    CREATE TABLE IF NOT EXISTS feedback (
      id             SERIAL PRIMARY KEY,
      coach_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
      player_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
      run_id         INTEGER REFERENCES benchmark_runs(id) ON DELETE SET NULL,
      content        TEXT NOT NULL,
      strengths      TEXT,
      weaknesses     TEXT,
      week_objective TEXT,
      created_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // ── Agrégats benchmark par jour (pré-calculé) ─────────────────────────────
  // Alimenté par scripts/aggregate-benchmark-stats.js. Sert aux badges de
  // percentile sur les profils et à l'onglet admin Analytics. Le calcul des
  // percentiles à la volée devient coûteux quand la table benchmark_runs
  // dépasse quelques millions de lignes — ce snapshot quotidien garde les
  // lectures cheap (index sur (scenario, difficulty, day DESC)).

  console.log('[8/8] benchmark_stats_daily...');
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

  console.log('\nDone! All tables created.');
}

setup().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
