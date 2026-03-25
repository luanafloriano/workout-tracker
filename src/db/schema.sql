-- Run this once against your PostgreSQL database to set up the schema.
-- On Railway: use the built-in query editor or psql to run this file.

CREATE TABLE IF NOT EXISTS users (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(255) NOT NULL,
  email        VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at   TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workout_templates (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS template_exercises (
  id          SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  default_sets INTEGER DEFAULT 3,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workouts (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id   INTEGER REFERENCES workout_templates(id) ON DELETE SET NULL,
  template_name VARCHAR(255) NOT NULL,  -- snapshot so history survives template deletion
  notes         TEXT,
  started_at    TIMESTAMP DEFAULT NOW(),
  completed_at  TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exercise_logs (
  id            SERIAL PRIMARY KEY,
  workout_id    INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_name VARCHAR(255) NOT NULL,
  set_number    INTEGER NOT NULL DEFAULT 1,
  weight        NUMERIC(7,2),           -- kg or lbs, user decides
  reps          INTEGER,
  notes         TEXT,
  logged_at     TIMESTAMP DEFAULT NOW()
);

-- Brio mode per workout
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS brio VARCHAR(20);

-- Unilateral exercises (left/right reps)
ALTER TABLE template_exercises ADD COLUMN IF NOT EXISTS is_unilateral BOOLEAN DEFAULT FALSE;
ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS reps_left INTEGER;
ALTER TABLE exercise_logs ADD COLUMN IF NOT EXISTS reps_right INTEGER;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_workout_templates_user ON workout_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_template_exercises_template ON template_exercises(template_id);
CREATE INDEX IF NOT EXISTS idx_workouts_user ON workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_workout ON exercise_logs(workout_id);
CREATE INDEX IF NOT EXISTS idx_exercise_logs_lookup ON exercise_logs(workout_id, exercise_name);
