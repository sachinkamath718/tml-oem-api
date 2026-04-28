const pool = require('../config/db');

/**
 * Maps DB status to spec status string
 */
const mapStatus = (s) => ({
    'pending':     'PENDING',
    'in_progress': 'IN_PROGRESS',
    'completed':   'COMPLETED',
    'on_hold':     'ON_HOLD',
    'failed':      'FAILED',
})[s] || 'PENDING';

/**
 * Converts a date to Unix timestamp in milliseconds
 */
const toMs = (d) => d ? new Date(d).getTime() : null;

/**
 * GET /order/status?trackingId={trackingId}
 *
 * Response:
 * {
 *   "err": null,
 *   "data": {
 *     "tracking_id": "TRK...",
 *     "vin": "MA3...",
 *     "tracking_info": [
 *       { "stage": "ORDER_CREATED",  "status": "COMPLETED",   "updated_at": 1710158400000, "metadata": {...} },
 *       { "stage": "TCU_SHIPPED",    "status": "COMPLETED",   "updated_at": 1710244800000, "metadata": {...} },
 *       { "stage": "TCU_DELIVERED",  "status": "COMPLETED",   "updated_at": 1710331200000, "metadata": {...} },
 *       { "stage": "DEVICE_INSTALLED","status": "IN_PROGRESS","updated_at": 1710417600000, "metadata": {...} }
 *     ]
 *   }
 * }
 */
const getOrderStatus = async (req, res) => {
    try {
        const { trackingId } = req.query;

        if (!trackingId) {
            return res.status(400).json({
                err:  { code: 'INVALID_DATA', message: 'trackingId is required' },
                data: null,
            });
        }

        // ── Fetch order ───────────────────────────────────────────
        const [orderRows] = await pool.execute(
            `SELECT * FROM orders WHERE tracking_id = ? LIMIT 1`, [trackingId]
        );

        if (!orderRows.length) {
            return res.status(404).json({
                err:  { code: 404, message: 'Tracking ID not found' },
                data: null,
            });
        }

        const order = orderRows[0];

        // ── Fetch first vehicle for this order ─────────────────────
        const [vehicleRows] = await pool.execute(
            `SELECT vin, status, stage_metadata, created_at FROM order_vehicles
             WHERE tracking_id = ? ORDER BY created_at ASC LIMIT 1`,
            [trackingId]
        );

        const vehicle = vehicleRows[0] || {};
        const vin     = vehicle.vin || null;

        // ── Fetch ticket records for each stage ────────────────────
        const [[shipRows]]   = await Promise.all([
            pool.execute(`SELECT status, created_at, updated_at, courier, awb_number, expected_delivery, dispatched_at, metadata FROM shipment_tickets WHERE tracking_id = ? ORDER BY created_at ASC LIMIT 1`, [trackingId]),
        ]);
        const [[delRows]]    = await Promise.all([
            pool.execute(`SELECT status, created_at, updated_at, delivered_to, delivery_date, metadata FROM delivery_tickets WHERE tracking_id = ? ORDER BY created_at ASC LIMIT 1`, [trackingId]),
        ]);
        const [[instRows]]   = await Promise.all([
            pool.execute(`SELECT status, created_at, updated_at, technician_name, scheduled_date, metadata FROM installation_tickets WHERE tracking_id = ? ORDER BY created_at ASC LIMIT 1`, [trackingId]),
        ]);

        const ship = shipRows || null;
        const del  = delRows  || null;
        const inst = instRows || null;

        // ── Build tracking_info stages ─────────────────────────────
        const tracking_info = [
            {
                stage:      'ORDER_CREATED',
                status:     'COMPLETED',
                updated_at: toMs(order.created_at),
                metadata: {
                    order_id:   order.tml_order_id || order.order_number,
                    created_by: order.created_by || 'system',
                },
            },
            {
                stage:      'TCU_SHIPPED',
                status:     ship ? mapStatus(ship.status) : 'PENDING',
                updated_at: ship ? toMs(ship.updated_at || ship.created_at) : null,
                metadata:   ship ? {
                    courier:           ship.courier           || null,
                    tracking_number:   ship.awb_number        || null,
                    expected_delivery: ship.expected_delivery ? ship.expected_delivery.toISOString().split('T')[0] : null,
                } : {},
            },
            {
                stage:      'TCU_DELIVERED',
                status:     del ? mapStatus(del.status) : 'PENDING',
                updated_at: del ? toMs(del.updated_at || del.created_at) : null,
                metadata:   del ? {
                    delivered_to:  del.delivered_to  || null,
                    delivery_date: del.delivery_date ? del.delivery_date.toISOString().split('T')[0] : null,
                } : {},
            },
            {
                stage:      'DEVICE_INSTALLED',
                status:     inst ? mapStatus(inst.status) : 'PENDING',
                updated_at: inst ? toMs(inst.updated_at || inst.created_at) : null,
                metadata:   inst ? {
                    technician_name: inst.technician_name || null,
                    scheduled_date:  inst.scheduled_date ? inst.scheduled_date.toISOString().split('T')[0] : null,
                } : {},
            },
        ];

        return res.status(200).json({
            err:  null,
            data: {
                tracking_id:   order.tracking_id,
                vin,
                tracking_info,
            },
        });

    } catch (err) {
        console.error('[getOrderStatus] Error:', err);
        return res.status(500).json({
            err:  { code: 'SERVER_ERROR', message: 'Internal server error.' },
            data: null,
        });
    }
};

module.exports = { getOrderStatus };
