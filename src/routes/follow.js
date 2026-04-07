const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/auth');
const follow = require('../controllers/followController');

router.use(authenticate);

router.get('/users', follow.listUsers);
router.post('/follow/:id', follow.follow);
router.delete('/follow/:id', follow.unfollow);

module.exports = router;
