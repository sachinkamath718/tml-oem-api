const express = require('express');
const router  = express.Router();
const authenticate                = require('../middleware/auth');
const { createAIS140Request }     = require('../controllers/ais140Controller');

router.post('/', authenticate, createAIS140Request);

module.exports = router;

