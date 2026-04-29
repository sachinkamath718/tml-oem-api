const pool = require('../config/db');
const { toIST } = require('../utils/idGenerator');

const mapStatus = (s) => ({
    'pending':     'PENDING',
    'in_progress': 'IN_PROGRESS',
    'completed':   'COMPLETED',
    'on_hold':     'ON_HOLD',
    'failed':      'FAILED',
})[s] || 'PENDING';

/** Convert date to IST Unix ms */
const toMs = (d) => d ? new Date(d).getTime() + (5.5 * 60 * 60 * 1000) : null;

/**
 * GET /order/status?trackingId={vehicleTrackingId}
 *
 * trackingId = vehicle-level tracking ID returned by POST /orders/create
 * (each vehicle has its own unique tracking ID since the fix)
 *
 * Response:
 * {
 *   "err": null,
 *   "data": {
 *     "order_tracking_id": "TRK-...",   <- order-level
 *     "tracking_id":       "TRK-...",   <- vehicle-level
 *     "vin":               "MA3...",
 *     "tracking_info": [
 *       { "stage": "ORDER_CREATED",   "status": "COMPLETED",   "updated_at": "2025-01-01T10:30:00+05:30", "metadata": {} },
 *       { "stage": "TCU_SHIPPED",     "status": "PENDING",     "updated_at": null, "metadata": {} },
 *       { "stage": "TCU_DELIVERED",   "status": "PENDING",     "updated_at": null, "metadata": {} },
 *       { "stage": "DEVICE_INSTALLED","status": "PENDING",     "updated_at": null, "metadata": {} }
 *     ]
 *   }
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

        // ── Look up by vehicle-level tracking_id ──────────────────
        const [vehicleRows] = await pool.execute(
            `SELECT ov.vin, ov.tracking_id AS vehicle_tracking_id, ov.status AS vehicle_status,
                    ov.created_at AS vehicle_created_at,
                    o.id AS order_id, o.tracking_id AS order_tracking_id,
                    o.tml_order_id, o.order_number, o.created_by, o.created_at AS order_created_at
             FROM order_vehicles ov
             JOIN orders o ON ov.order_id = o.id
             WHERE ov.tracking_id = ? LIMIT 1`,
            [trackingId]
        );

        if (!vehicleRows.length) {
            return res.status(404).json({
                err:  { code: 404, message: 'Tracking ID not found' },
                data: null,
            });
        }

        const v                = vehicleRows[0];
        const vin              = v.vin;
        const vehicleTrackingId = v.vehicle_tracking_id;

        // ── Fetch all ticket stages for this vehicle ───────────────
        const [[shipRows]]  = await Promise.all([pool.execute(
            `SELECT status, created_at, updated_at, courier, awb_number, expected_delivery, dispatched_at, metadata
             FROM shipment_tickets WHERE tracking_id = ? ORDER BY created_at ASC LIMIT 1`, [vehicleTrackingId]
        )]);
        const [[delRows]]   = await Promise.all([pool.execute(
            `SELECT status, created_at, updated_at, delivered_to, delivery_date, metadata
             FROM delivery_tickets WHERE tracking_id = ? ORDER BY created_at ASC LIMIT 1`, [vehicleTrackingId]
        )]);
        const [[instRows]]  = await Promise.all([pool.execute(
            `SELECT status, created_at, updated_at, technician_name, scheduled_date, metadata
             FROM installation_tickets WHERE tracking_id = ? ORDER BY created_at ASC LIMIT 1`, [vehicleTrackingId]
        )]);

        const ship = shipRows || null;
        const del  = delRows  || null;
        const inst = instRows || null;

        // ── Build tracking_info with IST timestamps ────────────────
        const tracking_info = [
            {
                stage:      'ORDER_CREATED',
                status:     'COMPLETED',
                updated_at: toIST(v.order_created_at),
                metadata: {
                    order_id:          v.tml_order_id || v.order_number,
                    order_tracking_id: v.order_tracking_id,
                    created_by:        v.created_by || 'system',
                },
            },
            {
                stage:      'TCU_SHIPPED',
                status:     ship ? mapStatus(ship.status) : 'PENDING',
                updated_at: ship ? toIST(ship.updated_at || ship.created_at) : null,
                metadata:   ship ? {
                    courier:           ship.courier           || null,
                    tracking_number:   ship.awb_number        || null,
                    expected_delivery: ship.expected_delivery
                        ? toIST(ship.expected_delivery).split('T')[0] : null,
                    dispatched_at:     toIST(ship.dispatched_at),
                } : {},
            },
            {
                stage:      'TCU_DELIVERED',
                status:     del ? mapStatus(del.status) : 'PENDING',
                updated_at: del ? toIST(del.updated_at || del.created_at) : null,
                metadata:   del ? {
                    delivered_to:  del.delivered_to  || null,
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

        return res.status(200).json({
            err:  null,
            data: {
                order_tracking_id: v.order_tracking_id,   // order-level
                tracking_id:       vehicleTrackingId,      // vehicle-level
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
