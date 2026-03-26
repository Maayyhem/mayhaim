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

    let decoded;
    try {
      decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    } catch (e) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token invalide' }) };
    }

    if (decoded.role !== 'admin' && decoded.role !== 'coach') {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Acces refuse' }) };
    }

    const sql = neon(process.env.DATABASE_URL);
    const students = await sql`
      SELECT id, email, username, role, created_at
      FROM users
      ORDER BY created_at DESC
    `;

    return { statusCode: 200, headers, body: JSON.stringify({ students }) };
  } catch (err) {
    console.error('Students error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erreur serveur' }) };
  }
};
