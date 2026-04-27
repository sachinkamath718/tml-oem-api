const express = require('express');
const router  = express.Router();
const authenticate                = require('../middleware/auth');
const { createMiningRequest }     = require('../controllers/miningController');

router.post('/', authenticate, createMiningRequest);

module.exports = router;

