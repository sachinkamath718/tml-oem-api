const express = require('express');
const { generateToken } = require('../controllers/authController');

const router = express.Router();

/**
 * POST /api/auth/token
 * Generate Bearer JWT token using client_id + client_secret
 */
router.post('/token', generateToken);

module.exports = router;
