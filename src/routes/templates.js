const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const templates = require('../controllers/templateController');

router.use(authenticate);

router.get('/', templates.list);
router.post('/', templates.create);
router.get('/:id', templates.get);
router.put('/:id', templates.update);
router.delete('/:id', templates.remove);

router.post('/:id/exercises', templates.addExercise);
router.put('/:id/exercises/:exerciseId', templates.updateExercise);
router.delete('/:id/exercises/:exerciseId', templates.removeExercise);
router.put('/:id/exercises/reorder', templates.reorderExercises);

module.exports = router;
