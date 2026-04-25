const express = require('express');
const { authenticate }   = require('../middleware/auth');
const { createOrder }    = require('../controllers/orderController');
const { getOrderStatus } = require('../controllers/orderStatusController');

const router = express.Router();

/**
 * POST /api/orders/create
 * Create a new order with multiple vehicles (VINs)
 */
router.post('/create', authenticate, createOrder);

/**
 * GET /api/orders/status
 * Get full order status by order_number, tracking_id, or vin
 */
router.get('/status', authenticate, getOrderStatus);

module.exports = router;
