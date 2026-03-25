const db = require('../db');

// Start a workout from a template — preloads exercises with last-used weight/reps
async function start(req, res) {
  const { template_id } = req.body;
  if (!template_id) return res.status(400).json({ error: 'template_id is required' });

  try {
    const template = await db.query(
      'SELECT * FROM workout_templates WHERE id = $1 AND user_id = $2',
      [template_id, req.user.id]
    );
    if (!template.rows[0]) return res.status(404).json({ error: 'Template not found' });

    const workout = await db.query(
      'INSERT INTO workouts (user_id, template_id, template_name) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, template_id, template.rows[0].name]
    );

    const exercises = await db.query(
      'SELECT * FROM template_exercises WHERE template_id = $1 ORDER BY sort_order, id',
      [template_id]
    );

    // For each exercise, fetch the sets from the last completed workout
    const exercisesWithHistory = await Promise.all(
      exercises.rows.map(async (exercise) => {
        const lastSets = await db.query(
          `WITH last_workout AS (
            SELECT w.id
            FROM workouts w
            JOIN exercise_logs el ON el.workout_id = w.id
            WHERE w.user_id = $1
              AND el.exercise_name = $2
              AND w.completed_at IS NOT NULL
            ORDER BY w.completed_at DESC
            LIMIT 1
          )
          SELECT el.set_number, el.weight, el.reps
          FROM exercise_logs el
          JOIN last_workout lw ON el.workout_id = lw.id
          WHERE el.exercise_name = $2
          ORDER BY el.set_number ASC`,
          [req.user.id, exercise.name]
        );

        return { ...exercise, last_sets: lastSets.rows };
      })
    );

    res.status(201).json({ workout: workout.rows[0], exercises: exercisesWithHistory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start workout' });
  }
}

// Get active (incomplete) workout for the current user
async function getActive(req, res) {
  try {
    const result = await db.query(
      `SELECT w.*, json_agg(
        json_build_object(
          'id', el.id, 'exercise_name', el.exercise_name,
          'set_number', el.set_number, 'weight', el.weight,
          'reps', el.reps, 'notes', el.notes
        ) ORDER BY el.exercise_name, el.set_number
      ) FILTER (WHERE el.id IS NOT NULL) AS logs
      FROM workouts w
      LEFT JOIN exercise_logs el ON el.workout_id = w.id
      WHERE w.user_id = $1 AND w.completed_at IS NULL
      GROUP BY w.id
      ORDER BY w.started_at DESC
      LIMIT 1`,
      [req.user.id]
    );
    res.json(result.rows[0] || null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch active workout' });
  }
}

async function list(req, res) {
  try {
    const result = await db.query(
      `SELECT w.id, w.template_name, w.started_at, w.completed_at, w.notes,
              COUNT(DISTINCT el.exercise_name)::int AS exercise_count,
              COUNT(el.id)::int AS total_sets
       FROM workouts w
       LEFT JOIN exercise_logs el ON el.workout_id = w.id
       WHERE w.user_id = $1 AND w.completed_at IS NOT NULL
       GROUP BY w.id
       ORDER BY w.completed_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch workouts' });
  }
}

async function get(req, res) {
  try {
    const workout = await db.query(
      'SELECT * FROM workouts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!workout.rows[0]) return res.status(404).json({ error: 'Workout not found' });

    const logs = await db.query(
      'SELECT * FROM exercise_logs WHERE workout_id = $1 ORDER BY exercise_name, set_number',
      [req.params.id]
    );

    // Group logs by exercise name
    const exerciseMap = {};
    for (const log of logs.rows) {
      if (!exerciseMap[log.exercise_name]) {
        exerciseMap[log.exercise_name] = { exercise_name: log.exercise_name, sets: [] };
      }
      exerciseMap[log.exercise_name].sets.push({
        id: log.id,
        set_number: log.set_number,
        weight: log.weight,
        reps: log.reps,
        notes: log.notes,
      });
    }

    res.json({ ...workout.rows[0], exercises: Object.values(exerciseMap) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch workout' });
  }
}

async function complete(req, res) {
  try {
    const result = await db.query(
      `UPDATE workouts SET completed_at = NOW(), notes = COALESCE($1, notes)
       WHERE id = $2 AND user_id = $3 AND completed_at IS NULL
       RETURNING *`,
      [req.body.notes || null, req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Workout not found or already completed' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to complete workout' });
  }
}

async function remove(req, res) {
  try {
    const result = await db.query(
      'DELETE FROM workouts WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Workout not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete workout' });
  }
}

async function addLog(req, res) {
  const { exercise_name, set_number, weight, reps, notes } = req.body;

  if (!exercise_name || !set_number) {
    return res.status(400).json({ error: 'exercise_name and set_number are required' });
  }

  try {
    // Verify workout belongs to user and is active
    const workout = await db.query(
      'SELECT id FROM workouts WHERE id = $1 AND user_id = $2 AND completed_at IS NULL',
      [req.params.id, req.user.id]
    );
    if (!workout.rows[0]) return res.status(404).json({ error: 'Active workout not found' });

    // Upsert: if this set was already logged, update it
    const result = await db.query(
      `INSERT INTO exercise_logs (workout_id, exercise_name, set_number, weight, reps, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [req.params.id, exercise_name, set_number, weight || null, reps || null, notes || null]
    );

    if (!result.rows[0]) {
      // Row already existed — update it
      const updated = await db.query(
        `UPDATE exercise_logs SET weight = $1, reps = $2, notes = $3
         WHERE workout_id = $4 AND exercise_name = $5 AND set_number = $6
         RETURNING *`,
        [weight || null, reps || null, notes || null, req.params.id, exercise_name, set_number]
      );
      return res.json(updated.rows[0]);
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to log set' });
  }
}

async function deleteLog(req, res) {
  try {
    const result = await db.query(
      `DELETE FROM exercise_logs el
       USING workouts w
       WHERE el.id = $1 AND el.workout_id = w.id AND w.user_id = $2 AND w.id = $3
       RETURNING el.id`,
      [req.params.logId, req.user.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Log not found' });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete log' });
  }
}

module.exports = { start, getActive, list, get, complete, remove, addLog, deleteLog };
