const db = require('../db');

async function list(req, res) {
  try {
    const result = await db.query(
      `SELECT t.*, COUNT(te.id)::int AS exercise_count
       FROM workout_templates t
       LEFT JOIN template_exercises te ON te.template_id = t.id
       WHERE t.user_id = $1
       GROUP BY t.id
       ORDER BY t.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
}

async function get(req, res) {
  try {
    const template = await db.query(
      'SELECT * FROM workout_templates WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!template.rows[0]) return res.status(404).json({ error: 'Template not found' });

    const exercises = await db.query(
      'SELECT * FROM template_exercises WHERE template_id = $1 ORDER BY sort_order, id',
      [req.params.id]
    );

    res.json({ ...template.rows[0], exercises: exercises.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch template' });
  }
}

async function create(req, res) {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Template name is required' });

  try {
    const result = await db.query(
      'INSERT INTO workout_templates (user_id, name, description) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, name, description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create template' });
  }
}

async function update(req, res) {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Template name is required' });

  try {
    const result = await db.query(
      `UPDATE workout_templates SET name = $1, description = $2
       WHERE id = $3 AND user_id = $4 RETURNING *`,
      [name, description || null, req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Template not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update template' });
  }
}

async function remove(req, res) {
  try {
    const result = await db.query(
      'DELETE FROM workout_templates WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Template not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete template' });
  }
}

async function addExercise(req, res) {
  const { name, default_sets, is_unilateral } = req.body;
  if (!name) return res.status(400).json({ error: 'Exercise name is required' });

  try {
    const template = await db.query(
      'SELECT id FROM workout_templates WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!template.rows[0]) return res.status(404).json({ error: 'Template not found' });

    const orderResult = await db.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM template_exercises WHERE template_id = $1',
      [req.params.id]
    );
    const sortOrder = orderResult.rows[0].next_order;

    const result = await db.query(
      'INSERT INTO template_exercises (template_id, name, default_sets, sort_order, is_unilateral) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.params.id, name, default_sets || 3, sortOrder, is_unilateral === true || is_unilateral === 'true']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add exercise' });
  }
}

async function updateExercise(req, res) {
  const { name, default_sets } = req.body;

  try {
    const result = await db.query(
      `UPDATE template_exercises te SET name = COALESCE($1, te.name), default_sets = COALESCE($2, te.default_sets)
       FROM workout_templates t
       WHERE te.id = $3 AND te.template_id = t.id AND t.user_id = $4 AND t.id = $5
       RETURNING te.*`,
      [name, default_sets, req.params.exerciseId, req.user.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Exercise not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update exercise' });
  }
}

async function removeExercise(req, res) {
  try {
    const result = await db.query(
      `DELETE FROM template_exercises te
       USING workout_templates t
       WHERE te.id = $1 AND te.template_id = t.id AND t.user_id = $2 AND t.id = $3
       RETURNING te.id`,
      [req.params.exerciseId, req.user.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Exercise not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove exercise' });
  }
}

async function reorderExercises(req, res) {
  const { order } = req.body; // array of exercise IDs in desired order
  if (!Array.isArray(order)) return res.status(400).json({ error: 'order must be an array of exercise IDs' });

  try {
    // Verify template ownership
    const template = await db.query(
      'SELECT id FROM workout_templates WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!template.rows[0]) return res.status(404).json({ error: 'Template not found' });

    for (let i = 0; i < order.length; i++) {
      await db.query(
        'UPDATE template_exercises SET sort_order = $1 WHERE id = $2 AND template_id = $3',
        [i, order[i], req.params.id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reorder exercises' });
  }
}

module.exports = { list, get, create, update, remove, addExercise, updateExercise, removeExercise, reorderExercises };
