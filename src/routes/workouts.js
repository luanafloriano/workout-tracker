const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const workouts = require('../controllers/workoutController');

router.use(authenticate);

router.post('/start', workouts.start);
router.get('/', workouts.list);
router.get('/active', workouts.getActive);
router.get('/:id', workouts.get);
router.patch('/:id/complete', workouts.complete);
router.delete('/:id', workouts.remove);

router.post('/:id/logs', workouts.addLog);
router.put('/:id/logs/:logId', workouts.updateLog);
router.delete('/:id/logs/:logId', workouts.deleteLog);

module.exports = router;
