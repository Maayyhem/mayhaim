const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token manquant' });
    }

    let decoded;
    try {
      decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Token invalide' });
    }

    if (decoded.role !== 'admin' && decoded.role !== 'coach') {
      return res.status(403).json({ error: 'Acces refuse' });
    }

    const sql = neon(process.env.DATABASE_URL);
    const students = await sql`
      SELECT id, email, username, role, created_at
      FROM users
      ORDER BY created_at DESC
    `;

    return res.status(200).json({ students });
  } catch (err) {
    console.error('Students error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};
