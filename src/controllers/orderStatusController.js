const pool = require('../config/db');
const { toIST } = require('../utils/idGenerator');

const mapStatus = (s) => ({
    'pending':     'PENDING',
    'in_progress': 'IN_PROGRESS',
    'completed':   'COMPLETED',
    'on_hold':     'ON_HOLD',
    'failed':      'FAILED',
})[s] || 'PENDING';

/**
 * GET /order/status?trackingId={orderTrackingId}
 *
 * trackingId = order_tracking_id returned by POST /orders/create
 * Returns status for ALL vehicles in that order.
 *
 * Response:
 * {
 *   "err": null,
 *   "data": [
 *     {
 *       "vin": "VIN1",
 *       "order_tracking_id": "TRK-...",
 *       "ais140_ticket_no": "TRK-...",
 *       "mining_ticket_no": "TRK-...",
 *       "tracking_info": [...]
 *     },
 *     ...
 *   ]
 * }
 */
const getOrderStatus = async (req, res) => {
    try {
        const { trackingId } = req.query;

        if (!trackingId) {
            return res.status(404).json({
                err:  { code: 404, message: 'Tracking ID not found' },
                data: null,
            });
        }

        // ── Find the order via any vehicle's tracking_id ───────────
        const [vehicleLookup] = await pool.execute(
            `SELECT ov.order_id, o.tracking_id AS order_tracking_id,
                    o.tml_order_id, o.order_number, o.created_by, o.created_at
             FROM order_vehicles ov
             JOIN orders o ON ov.order_id = o.id
             WHERE ov.tracking_id = ? LIMIT 1`,
            [trackingId]
        );

        if (!vehicleLookup.length) {
            return res.status(404).json({
                err:  { code: 404, message: 'Tracking ID not found' },
                data: null,
            });
        }

        const order = vehicleLookup[0];

        // ── Fetch ALL vehicles for this order ──────────────────────
        const [vehicles] = await pool.execute(
            `SELECT vin, tracking_id AS vehicle_tracking_id,
                    ais140_ticket_no, mining_ticket_no, created_at
             FROM order_vehicles
             WHERE order_id = ? ORDER BY created_at ASC`,
            [order.id]
        );

        // ── Build status data for each vehicle ─────────────────────
        const data = [];

        for (const v of vehicles) {
            const vTid = v.vehicle_tracking_id; // vehicle-level, used to look up tickets

            // Fetch tickets for this vehicle
            const [[ship]]  = await Promise.all([pool.execute(
                `SELECT status, created_at, updated_at, courier, awb_number,
                        expected_delivery, dispatched_at
                 FROM shipment_tickets WHERE tracking_id = ? LIMIT 1`, [vTid]
            )]);
            const [[del]]   = await Promise.all([pool.execute(
                `SELECT status, created_at, updated_at, delivered_to, delivery_date
                 FROM delivery_tickets WHERE tracking_id = ? LIMIT 1`, [vTid]
            )]);
            const [[inst]]  = await Promise.all([pool.execute(
                `SELECT status, created_at, updated_at, technician_name, scheduled_date
                 FROM installation_tickets WHERE tracking_id = ? LIMIT 1`, [vTid]
            )]);

            const tracking_info = [
                {
                    stage:      'ORDER_CREATED',
                    status:     'COMPLETED',
                    updated_at: toIST(order.created_at),
                    metadata: {
                        order_id:          order.tml_order_id || order.order_number,
                        order_tracking_id: order.order_tracking_id,
                        created_by:        order.created_by || 'system',
                    },
                },
                {
                    stage:      'TCU_SHIPPED',
                    status:     ship ? mapStatus(ship.status) : 'PENDING',
                    updated_at: ship ? toIST(ship.updated_at || ship.created_at) : null,
                    metadata:   ship ? {
                        courier:           ship.courier || null,
                        tracking_number:   ship.awb_number || null,
                        expected_delivery: ship.expected_delivery ? toIST(ship.expected_delivery).split('T')[0] : null,
                        dispatched_at:     toIST(ship.dispatched_at),
                    } : {},
                },
                {
                    stage:      'TCU_DELIVERED',
                    status:     del ? mapStatus(del.status) : 'PENDING',
                    updated_at: del ? toIST(del.updated_at || del.created_at) : null,
                    metadata:   del ? {
                        delivered_to:  del.delivered_to || null,
                        delivery_date: del.delivery_date ? toIST(del.delivery_date).split('T')[0] : null,
                    } : {},
                },
                {
                    stage:      'DEVICE_INSTALLED',
                    status:     inst ? mapStatus(inst.status) : 'PENDING',
                    updated_at: inst ? toIST(inst.updated_at || inst.created_at) : null,
                    metadata:   inst ? {
                        technician_name: inst.technician_name || null,
                        scheduled_date:  inst.scheduled_date ? toIST(inst.scheduled_date).split('T')[0] : null,
                    } : {},
                },
            ];

            data.push({
                vin:               v.vin,
                order_tracking_id: v.ais140_ticket_no || vTid, // same as ais/mining ticket
                ais140_ticket_no:  v.ais140_ticket_no,
                mining_ticket_no:  v.mining_ticket_no,
                tracking_info,
            });
        }

        return res.status(200).json({ err: null, data });

    } catch (err) {
        console.error('[getOrderStatus] Error:', err);
        return res.status(500).json({
            err:  { code: 'SERVER_ERROR', message: 'Internal server error.' },
            data: null,
        });
    }
};

module.exports = { getOrderStatus };
