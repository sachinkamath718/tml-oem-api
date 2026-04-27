const express = require('express');
const router  = express.Router();
const authenticate          = require('../middleware/auth');
const { createOrder }       = require('../controllers/orderController');
const { getOrderStatus }    = require('../controllers/orderStatusController');
const { updateSpoc }        = require('../controllers/spocController');

router.post('/create',          authenticate, createOrder);
router.get('/status',           authenticate, getOrderStatus);
router.put('/fitment/spoc',     authenticate, updateSpoc);

module.exports = router;
