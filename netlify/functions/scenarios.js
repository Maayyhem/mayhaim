const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
};

function verifyToken(event) {
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  try {
    return jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
  } catch (e) { return null; }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };

  const decoded = verifyToken(event);
  if (!decoded) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Token manquant ou invalide' }) };

  const sql = neon(process.env.DATABASE_URL);

  // GET - list all scenarios
  if (event.httpMethod === 'GET') {
    const scenarios = await sql`SELECT * FROM scenarios ORDER BY id ASC`;
    return { statusCode: 200, headers, body: JSON.stringify({ scenarios }) };
  }

  // POST - create new scenario (coach/admin only)
  if (event.httpMethod === 'POST') {
    if (decoded.role !== 'admin' && decoded.role !== 'coach') {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Coach ou Admin requis' }) };
    }

    try {
      const data = JSON.parse(event.body);
      const result = await sql`
        INSERT INTO scenarios (title, rank, map, type, difficulty, description, guide, tips, aim_mode, aim_diff, created_by)
        VALUES (${data.title}, ${data.rank}, ${data.map}, ${data.type}, ${data.difficulty || 3}, ${data.description || ''}, ${data.guide || ''}, ${data.tips || ''}, ${data.aim_mode || ''}, ${data.aim_diff || 'medium'}, ${decoded.id})
        RETURNING *
      `;
      return { statusCode: 201, headers, body: JSON.stringify({ scenario: result[0] }) };
    } catch (err) {
      console.error('Create scenario error:', err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erreur creation' }) };
    }
  }

  // PUT - update existing scenario (coach/admin only)
  if (event.httpMethod === 'PUT') {
    if (decoded.role !== 'admin' && decoded.role !== 'coach') {
      return { statusCode: 403, headers, body: JSON.stringify({ error: 'Coach ou Admin requis' }) };
    }

    try {
      const data = JSON.parse(event.body);
      if (!data.id) return { statusCode: 400, headers, body: JSON.stringify({ error: 'ID requis' }) };

      await sql`
        UPDATE scenarios SET
          title = ${data.title}, rank = ${data.rank}, map = ${data.map}, type = ${data.type},
          difficulty = ${data.difficulty || 3}, description = ${data.description || ''},
          guide = ${data.guide || ''}, tips = ${data.tips || ''},
          aim_mode = ${data.aim_mode || ''}, aim_diff = ${data.aim_diff || 'medium'},
          updated_at = NOW()
        WHERE id = ${data.id}
      `;
      return { statusCode: 200, headers, body: JSON.stringify({ success: true }) };
    } catch (err) {
      console.error('Update scenario error:', err);
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Erreur mise a jour' }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
