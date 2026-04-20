const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

function setCors(req, res) {
  const o = req.headers.origin || '';
  const a = process.env.ALLOWED_ORIGIN || 'https://mayhaim.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', o === a ? o : a);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, password, username, current_rank, peak_elo, objective } = req.body;

    if (!email || !password || !username || !current_rank) {
      return res.status(400).json({ error: 'Email, pseudo, mot de passe et rang requis' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Adresse email invalide' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Mot de passe minimum 8 caractères' });
    }
    if (!/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins un chiffre' });
    }
    if (username.length < 3) {
      return res.status(400).json({ error: 'Pseudo minimum 3 caractères' });
    }

    const sql = neon(process.env.DATABASE_URL);

    const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }

    const existingUser = await sql`SELECT id FROM users WHERE username = ${username}`;
    if (existingUser.length > 0) {
      return res.status(409).json({ error: 'Ce pseudo est déjà pris' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await sql`
      INSERT INTO users (email, username, password_hash, role, current_rank, peak_elo, objective)
      VALUES (${email}, ${username}, ${hash}, 'student', ${current_rank}, ${peak_elo||null}, ${objective||null})
      RETURNING id, email, username, role, current_rank, peak_elo, objective
    `;

    const user = result[0];
    // Students get a full token directly — MFA not required
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, mfa_verified: true },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.status(201).json({
      token,
      user: { id: user.id, email: user.email, username: user.username, role: user.role, current_rank: user.current_rank, peak_elo: user.peak_elo, objective: user.objective }
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};
