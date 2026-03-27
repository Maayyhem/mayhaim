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

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Token invalide ou expire' });
    }

    const sql = neon(process.env.DATABASE_URL);
    const result = await sql`SELECT id, email, username, role FROM users WHERE id = ${decoded.id}`;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouve' });
    }

    return res.status(200).json({ user: result[0] });
  } catch (err) {
    console.error('Profile error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};
