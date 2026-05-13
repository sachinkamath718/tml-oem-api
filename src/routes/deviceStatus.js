const express = require('express');
const router  = express.Router();
const { getDeviceStatus } = require('../controllers/deviceStatusController');

// GET /device-status?vehicle-id={vin}
// Proxies to FleetEdge device-status API (iTriangle)
router.get('/', getDeviceStatus);

module.exports = router;
