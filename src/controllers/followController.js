const db = require('../db');

// Lista todos os usuários com status de follow em relação ao usuário logado
async function listUsers(req, res) {
  try {
    const result = await db.query(
      `SELECT u.id, u.name,
        EXISTS(SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id) AS i_follow,
        EXISTS(SELECT 1 FROM follows WHERE follower_id = u.id AND following_id = $1) AS follows_me
       FROM users u
       WHERE u.id != $1
       ORDER BY u.name ASC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
}

async function follow(req, res) {
  const targetId = parseInt(req.params.id);
  if (targetId === req.user.id) return res.status(400).json({ error: 'Cannot follow yourself' });

  try {
    await db.query(
      'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [req.user.id, targetId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to follow' });
  }
}

async function unfollow(req, res) {
  const targetId = parseInt(req.params.id);
  try {
    await db.query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [req.user.id, targetId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to unfollow' });
  }
}

module.exports = { listUsers, follow, unfollow };
