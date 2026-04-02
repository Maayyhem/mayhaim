-- ============================================================
-- Migration complète — à exécuter dans la console SQL de Neon
-- ============================================================

-- ── 1. users ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  username      TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT DEFAULT 'student',
  bio           TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. coaching_stats (legacy) ───────────────────────────────
CREATE TABLE IF NOT EXISTS coaching_stats (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
  sessions_count      INTEGER DEFAULT 0,
  scenarios_completed TEXT    DEFAULT '[]',
  vods_watched        TEXT    DEFAULT '[]',
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. game_history ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS game_history (
  id           SERIAL PRIMARY KEY,
  user_id      INTEGER NOT NULL,
  username     VARCHAR(100),
  mode         VARCHAR(100) NOT NULL,
  score        INTEGER DEFAULT 0,
  accuracy     INTEGER DEFAULT 0,
  hits         INTEGER DEFAULT 0,
  misses       INTEGER DEFAULT 0,
  avg_reaction INTEGER,
  best_combo   INTEGER DEFAULT 0,
  duration     INTEGER DEFAULT 60,
  played_at    TIMESTAMP DEFAULT NOW()
);

-- ── 4. coaching_relationships ────────────────────────────────
CREATE TABLE IF NOT EXISTS coaching_relationships (
  id           SERIAL PRIMARY KEY,
  coach_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
  player_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT DEFAULT 'pending',
  requested_by INTEGER REFERENCES users(id),
  message      TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(coach_id, player_id)
);

-- ── 5. benchmark_runs ────────────────────────────────────────
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
);

CREATE INDEX IF NOT EXISTS idx_benchmark_runs_user     ON benchmark_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_benchmark_runs_scenario ON benchmark_runs(scenario);

-- ── 6. training_plans ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS training_plans (
  id              SERIAL PRIMARY KEY,
  coach_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  player_id       INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  scenarios       JSONB DEFAULT '[]',
  status          TEXT DEFAULT 'active',
  target_energy   FLOAT,
  target_scenario TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── 7. feedback ──────────────────────────────────────────────
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
);

-- ── Vérification ─────────────────────────────────────────────
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
