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
    const { email, password } = JSON.parse(event.body);

    if (!email || !password) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Email et mot de passe requis' }) };
    }

    const sql = neon(process.env.DATABASE_URL);
    const result = await sql`SELECT id, email, username, password_hash, role FROM users WHERE email = ${email}`;

    if (result.length === 0) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Email ou mot de passe incorrect' }) };
    }

    const user = result[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Email ou mot de passe incorrect' }) };
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ token, user: { id: user.id, email: user.email, username: user.username, role: user.role } }),
    };
  } catch (err) {
    console.error('Login error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erreur serveur' }) };
  }
};
