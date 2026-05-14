const express = require('express');
const router  = express.Router();
const { handleDeviceFitment, handleAis140Update, handleMiningUpdate } = require('../controllers/webhookController');

// POST /webhooks/device-fitment
// Inbound from iTriangle: ORDER_CREATED, TCU_SHIPPED, TCU_DELIVERED, DEVICE_INSTALLED
router.post('/device-fitment', handleDeviceFitment);

// POST /webhooks/v2/ais140-requests
// Inbound from iTriangle: AIS140 ticket status update (IN_PROGRESS, COMPLETED, etc.)
router.post('/v2/ais140-requests', handleAis140Update);

// POST /webhooks/mining-requests
// Inbound from iTriangle: Mining ticket status update (IN_PROGRESS, COMPLETED, etc.)
router.post('/mining-requests', handleMiningUpdate);

module.exports = router;
