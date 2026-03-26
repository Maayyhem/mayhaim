const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'GET') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const authHeader = event.headers.authorization || event.headers.Authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token manquant' }) };
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token invalide ou expire' }) };
    }

    const sql = neon(process.env.DATABASE_URL);
    const result = await sql`SELECT id, email, username, role FROM users WHERE id = ${decoded.id}`;

    if (result.length === 0) {
      return { statusCode: 404, headers, body: JSON.stringify({ error: 'Utilisateur non trouve' }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ user: result[0] }),
    };
  } catch (err) {
    console.error('Profile error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erreur serveur' }) };
  }
};
