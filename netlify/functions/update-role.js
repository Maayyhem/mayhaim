const { neon } = require('@neondatabase/serverless');
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

    // Admin only
    if (decoded.role !== 'admin') {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Admin requis' }) };
    }

    const { userId, role } = JSON.parse(event.body);
    if (!userId || !['student', 'coach', 'admin'].includes(role)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'userId et role valide requis (student/coach/admin)' }) };
    }

    const sql = neon(process.env.DATABASE_URL);
    await sql`UPDATE users SET role = ${role} WHERE id = ${userId}`;

    return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
  } catch (err) {
    console.error('Update role error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erreur serveur' }) };
  }
};
