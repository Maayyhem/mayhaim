// Run this once to set up the full database schema on Neon
// Usage: DATABASE_URL=... node scripts/setup-db.js

const { neon } = require('@neondatabase/serverless');

async function setup() {
  const sql = neon(process.env.DATABASE_URL);

  // ── Core ─────────────────────────────────────────────────────────────────

  console.log('[1/7] users...');
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

  console.log('[2/7] coaching_stats (legacy)...');
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

  console.log('[3/7] game_history...');
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

  console.log('[4/7] coaching_relationships...');
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

  console.log('[5/7] benchmark_runs...');
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

  console.log('[6/7] training_plans...');
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

  console.log('[7/7] feedback...');
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

  console.log('\nDone! All tables created.');
}

setup().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
