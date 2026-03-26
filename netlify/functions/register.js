const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { email, password, username } = JSON.parse(event.body);

    if (!email || !password || !username) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email, mot de passe et pseudo requis' }) };
    }
    if (password.length < 6) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Mot de passe minimum 6 caracteres' }) };
    }

    const sql = neon(process.env.DATABASE_URL);

    // Check if email exists
    const existing = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existing.length > 0) {
      return { statusCode: 409, headers, body: JSON.stringify({ error: 'Cet email est deja utilise' }) };
    }

    // Hash password and insert
    const hash = await bcrypt.hash(password, 10);
    const result = await sql`
      INSERT INTO users (email, username, password_hash, role)
      VALUES (${email}, ${username}, ${hash}, 'student')
      RETURNING id, email, username, role
    `;

    const user = result[0];
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({ token, user: { id: user.id, email: user.email, username: user.username, role: user.role } }),
    };
  } catch (err) {
    console.error('Register error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erreur serveur' }) };
  }
};
