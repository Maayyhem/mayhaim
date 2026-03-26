// Run this once to create the users table on Neon
// Usage: DATABASE_URL=... node scripts/setup-db.js

const { neon } = require('@neondatabase/serverless');

async function setup() {
  const sql = neon(process.env.DATABASE_URL);

  console.log('Creating users table...');
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'student',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  console.log('Creating sessions tracking table...');
  await sql`
    CREATE TABLE IF NOT EXISTS coaching_stats (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      sessions_count INTEGER DEFAULT 0,
      scenarios_completed TEXT DEFAULT '[]',
      vods_watched TEXT DEFAULT '[]',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  console.log('Done! Tables created.');
}

setup().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
