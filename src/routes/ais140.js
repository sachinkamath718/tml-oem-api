const express = require('express');
const router  = express.Router();
const { authenticate }                                       = require('../middleware/auth');
const { createAIS140Request, getAIS140TicketStatus }         = require('../controllers/ais140Controller');

router.post('/',              authenticate, createAIS140Request);
router.post('/ticket-status', authenticate, getAIS140TicketStatus);

module.exports = router;
