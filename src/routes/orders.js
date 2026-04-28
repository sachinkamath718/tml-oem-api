const express = require('express');
const router  = express.Router();
const { authenticate }      = require('../middleware/auth');
const { createOrder }       = require('../controllers/orderController');
const { getOrderStatus }    = require('../controllers/orderStatusController');
const { updateSpoc }        = require('../controllers/spocController');

router.post('/',            authenticate, createOrder);      // POST /order
router.get('/status',       authenticate, getOrderStatus);   // GET  /order/status
router.put('/fitment/spoc', authenticate, updateSpoc);       // PUT  /order/fitment/spoc

module.exports = router;
