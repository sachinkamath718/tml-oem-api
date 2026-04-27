const express = require('express');
const router  = express.Router();
const { authenticate }                                       = require('../middleware/auth');
const { createMiningRequest, getMiningTicketStatus }         = require('../controllers/miningController');

router.post('/',              authenticate, createMiningRequest);
router.post('/ticket-status', authenticate, getMiningTicketStatus);

module.exports = router;
