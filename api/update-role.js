const { neon } = require('@neondatabase/serverless');
const jwt = require('jsonwebtoken');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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

    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin requis' });
    }

    const { userId, role } = req.body;
    if (!userId || !['student', 'coach', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'userId et role valide requis (student/coach/admin)' });
    }

    const sql = neon(process.env.DATABASE_URL);
    await sql`UPDATE users SET role = ${role} WHERE id = ${userId}`;

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Update role error:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};
