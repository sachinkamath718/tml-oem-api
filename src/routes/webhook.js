const express = require('express');
const router  = express.Router();
const { handleDeviceFitment } = require('../controllers/webhookController');

// POST /webhooks/device-fitment
// Called by iTriangle (FleetEdge) when a vehicle stage changes
router.post('/device-fitment', handleDeviceFitment);

module.exports = router;
