const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const workouts = require('../controllers/workoutController');
const upload = require('../middleware/upload');

router.use(authenticate);

router.post('/start', workouts.start);
router.get('/', workouts.list);
router.get('/active', workouts.getActive);

// Must be before /:id
router.get('/feed', workouts.getFeed);
router.get('/partner', workouts.getPartner);
router.get('/partner/:id', workouts.getPartnerWorkout);
router.get('/progress/:name', workouts.getProgress);

router.get('/:id', workouts.get);
router.patch('/:id/complete', workouts.complete);
router.delete('/:id', workouts.remove);

router.post('/:id/photo', upload.single('photo'), workouts.uploadPhoto);
router.delete('/:id/photo', workouts.removePhoto);
router.post('/:id/like', workouts.toggleLike);
router.get('/:id/comments', workouts.getComments);
router.post('/:id/comments', workouts.postComment);
router.delete('/:id/comments/:commentId', workouts.deleteComment);

router.post('/:id/logs', workouts.addLog);
router.put('/:id/logs/:logId', workouts.updateLog);
router.delete('/:id/logs/:logId', workouts.deleteLog);

module.exports = router;
