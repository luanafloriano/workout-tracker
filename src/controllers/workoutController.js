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
            SELECT w.id, w.completed_at
            FROM workouts w
            JOIN exercise_logs el ON el.workout_id = w.id
            WHERE w.user_id = $1
              AND el.exercise_name = $2
              AND w.completed_at IS NOT NULL
            ORDER BY w.completed_at DESC
            LIMIT 1
          )
          SELECT el.set_number, el.weight, el.reps, lw.completed_at AS workout_date
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
              COUNT(el.id)::int AS total_sets,
              w.brio
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
        reps_left: log.reps_left,
        reps_right: log.reps_right,
        rir: log.rir,
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
    const { notes, brio } = req.body;
    const result = await db.query(
      `UPDATE workouts SET completed_at = NOW(), notes = COALESCE($1, notes), brio = COALESCE($2, brio)
       WHERE id = $3 AND user_id = $4 AND completed_at IS NULL
       RETURNING *`,
      [notes || null, brio || null, req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Workout not found or already completed' });

    // Detect PRs — exercises where today's max weight beats all previous workouts
    const prs = await db.query(
      `WITH today AS (
        SELECT exercise_name, MAX(weight) AS max_weight
        FROM exercise_logs WHERE workout_id = $1 AND weight IS NOT NULL
        GROUP BY exercise_name
      ),
      previous AS (
        SELECT el.exercise_name, MAX(el.weight) AS max_weight
        FROM exercise_logs el
        JOIN workouts w ON el.workout_id = w.id
        WHERE w.user_id = $2 AND w.id != $1 AND w.completed_at IS NOT NULL AND el.weight IS NOT NULL
        GROUP BY el.exercise_name
      )
      SELECT t.exercise_name, t.max_weight AS new_max, COALESCE(p.max_weight, 0) AS prev_max
      FROM today t
      LEFT JOIN previous p ON t.exercise_name = p.exercise_name
      WHERE t.max_weight > COALESCE(p.max_weight, 0)`,
      [req.params.id, req.user.id]
    );

    res.json({ ...result.rows[0], prs: prs.rows });
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
  const { exercise_name, set_number, weight, reps, reps_left, reps_right, rir, notes } = req.body;

  if (!exercise_name || !set_number) {
    return res.status(400).json({ error: 'exercise_name and set_number are required' });
  }

  try {
    const workout = await db.query(
      'SELECT id FROM workouts WHERE id = $1 AND user_id = $2 AND completed_at IS NULL',
      [req.params.id, req.user.id]
    );
    if (!workout.rows[0]) return res.status(404).json({ error: 'Active workout not found' });

    const result = await db.query(
      `INSERT INTO exercise_logs (workout_id, exercise_name, set_number, weight, reps, reps_left, reps_right, rir, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT DO NOTHING
       RETURNING *`,
      [req.params.id, exercise_name, set_number, weight || null, reps || null, reps_left || null, reps_right || null, rir ?? null, notes || null]
    );

    if (!result.rows[0]) {
      const updated = await db.query(
        `UPDATE exercise_logs SET weight = $1, reps = $2, reps_left = $3, reps_right = $4, rir = $5, notes = $6
         WHERE workout_id = $7 AND exercise_name = $8 AND set_number = $9
         RETURNING *`,
        [weight || null, reps || null, reps_left || null, reps_right || null, rir ?? null, notes || null, req.params.id, exercise_name, set_number]
      );
      return res.json(updated.rows[0]);
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to log set' });
  }
}

async function updateLog(req, res) {
  const { weight, reps, reps_left, reps_right, rir, notes } = req.body;
  try {
    const result = await db.query(
      `UPDATE exercise_logs el
       SET weight = $1, reps = $2, reps_left = $3, reps_right = $4, rir = $5, notes = $6
       FROM workouts w
       WHERE el.id = $7 AND el.workout_id = w.id AND w.user_id = $8 AND w.id = $9
       RETURNING el.*`,
      [weight ?? null, reps ?? null, reps_left ?? null, reps_right ?? null, rir ?? null, notes ?? null,
       req.params.logId, req.user.id, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Log not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update log' });
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

async function getPartner(req, res) {
  try {
    const result = await db.query(
      `SELECT w.id, w.template_name, w.completed_at, w.brio, w.notes,
              u.name AS user_name,
              COUNT(DISTINCT el.exercise_name)::int AS exercise_count,
              COUNT(el.id)::int AS total_sets
       FROM workouts w
       JOIN users u ON w.user_id = u.id
       LEFT JOIN exercise_logs el ON el.workout_id = w.id
       WHERE w.user_id != $1 AND w.completed_at IS NOT NULL
       GROUP BY w.id, u.name
       ORDER BY w.completed_at DESC
       LIMIT 20`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch partner workouts' });
  }
}

async function getPartnerWorkout(req, res) {
  try {
    const workout = await db.query(
      `SELECT w.*, u.name AS user_name FROM workouts w
       JOIN users u ON w.user_id = u.id
       WHERE w.id = $1 AND w.user_id != $2 AND w.completed_at IS NOT NULL`,
      [req.params.id, req.user.id]
    );
    if (!workout.rows[0]) return res.status(404).json({ error: 'Workout not found' });

    const logs = await db.query(
      'SELECT * FROM exercise_logs WHERE workout_id = $1 ORDER BY exercise_name, set_number',
      [req.params.id]
    );

    const exerciseMap = {};
    for (const log of logs.rows) {
      if (!exerciseMap[log.exercise_name]) {
        exerciseMap[log.exercise_name] = { exercise_name: log.exercise_name, sets: [] };
      }
      exerciseMap[log.exercise_name].sets.push({
        id: log.id, set_number: log.set_number, weight: log.weight,
        reps: log.reps, reps_left: log.reps_left, reps_right: log.reps_right,
      });
    }
    res.json({ ...workout.rows[0], exercises: Object.values(exerciseMap) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch partner workout' });
  }
}

async function getProgress(req, res) {
  try {
    const name = decodeURIComponent(req.params.name);
    const history = await db.query(
      `SELECT w.completed_at::date AS date, MAX(el.weight) AS max_weight, MAX(el.reps) AS max_reps
       FROM exercise_logs el
       JOIN workouts w ON el.workout_id = w.id
       WHERE w.user_id = $1 AND el.exercise_name = $2
         AND w.completed_at IS NOT NULL AND el.weight IS NOT NULL
       GROUP BY w.completed_at::date
       ORDER BY date ASC
       LIMIT 30`,
      [req.user.id, name]
    );
    const pr = history.rows.reduce((best, r) =>
      parseFloat(r.max_weight) > parseFloat(best?.max_weight || 0) ? r : best, null
    );
    res.json({ exercise: name, history: history.rows, pr });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
}

// ─── Feed ────────────────────────────────────────────────────────────────────

async function getFeed(req, res) {
  try {
    const result = await db.query(
      `SELECT w.id, w.template_name, w.completed_at, w.brio, w.photo_url,
              u.id AS user_id, u.name AS user_name,
              COUNT(DISTINCT wl.id)::int AS like_count,
              COUNT(DISTINCT wc.id)::int AS comment_count,
              bool_or(wl.user_id = $1) AS liked_by_me
       FROM workouts w
       JOIN users u ON w.user_id = u.id
       LEFT JOIN workout_likes wl ON wl.workout_id = w.id
       LEFT JOIN workout_comments wc ON wc.workout_id = w.id
       WHERE w.completed_at IS NOT NULL
       GROUP BY w.id, u.id
       ORDER BY w.completed_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch feed' });
  }
}

async function uploadPhoto(req, res) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    const workout = await db.query(
      'SELECT id FROM workouts WHERE id = $1 AND user_id = $2 AND completed_at IS NOT NULL',
      [req.params.id, req.user.id]
    );
    if (!workout.rows[0]) return res.status(404).json({ error: 'Workout not found' });

    const cloudinary = require('../lib/cloudinary');
    const uploaded = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'workout-tracker', resource_type: 'image' },
        (err, result) => (err ? reject(err) : resolve(result))
      );
      stream.end(req.file.buffer);
    });

    await db.query(
      'UPDATE workouts SET photo_url = $1, photo_public_id = $2 WHERE id = $3',
      [uploaded.secure_url, uploaded.public_id, req.params.id]
    );

    res.json({ photo_url: uploaded.secure_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to upload photo' });
  }
}

async function removePhoto(req, res) {
  try {
    const workout = await db.query(
      'SELECT photo_public_id FROM workouts WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!workout.rows[0]) return res.status(404).json({ error: 'Workout not found' });

    if (workout.rows[0].photo_public_id) {
      const cloudinary = require('../lib/cloudinary');
      await cloudinary.uploader.destroy(workout.rows[0].photo_public_id);
    }

    await db.query('UPDATE workouts SET photo_url = NULL, photo_public_id = NULL WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove photo' });
  }
}

async function toggleLike(req, res) {
  try {
    const existing = await db.query(
      'SELECT id FROM workout_likes WHERE workout_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (existing.rows.length > 0) {
      await db.query('DELETE FROM workout_likes WHERE workout_id = $1 AND user_id = $2', [req.params.id, req.user.id]);
      res.json({ liked: false });
    } else {
      await db.query('INSERT INTO workout_likes (workout_id, user_id) VALUES ($1, $2)', [req.params.id, req.user.id]);
      res.json({ liked: true });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to toggle like' });
  }
}

async function getComments(req, res) {
  try {
    const result = await db.query(
      `SELECT wc.id, wc.body, wc.created_at, u.name AS user_name, u.id AS user_id
       FROM workout_comments wc
       JOIN users u ON wc.user_id = u.id
       WHERE wc.workout_id = $1
       ORDER BY wc.created_at ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
}

async function postComment(req, res) {
  const { body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'Comment cannot be empty' });
  try {
    const result = await db.query(
      `INSERT INTO workout_comments (workout_id, user_id, body) VALUES ($1, $2, $3)
       RETURNING id, body, created_at`,
      [req.params.id, req.user.id, body.trim()]
    );
    res.status(201).json({ ...result.rows[0], user_name: req.user.name, user_id: req.user.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to post comment' });
  }
}

async function deleteComment(req, res) {
  try {
    const result = await db.query(
      'DELETE FROM workout_comments WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.commentId, req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Comment not found' });
    res.json({ deleted: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
}

module.exports = {
  start, getActive, list, get, complete, remove,
  addLog, updateLog, deleteLog,
  getPartner, getPartnerWorkout, getProgress,
  getFeed, uploadPhoto, removePhoto, toggleLike, getComments, postComment, deleteComment,
};
