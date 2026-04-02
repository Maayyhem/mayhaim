const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ error: 'Email, mot de passe et pseudo requis' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Adresse email invalide' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Mot de passe minimum 6 caractères' });
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
      INSERT INTO users (email, username, password_hash, role)
      VALUES (${email}, ${username}, ${hash}, 'student')
      RETURNING id, email, username, role
    `;

    const user = result[0];
    // After register, return a partial token — MFA setup is required
    const partial_token = jwt.sign(
      { id: user.id, partial: true },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    return res.status(201).json({
      mfa_setup_required: true,
      partial_token,
      user: { id: user.id, email: user.email, username: user.username, role: user.role }
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};
