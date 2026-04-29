const pool = require('../config/db');

const mapStatus = (s) => ({
    'pending':     'PENDING',
    'in_progress': 'IN_PROGRESS',
    'completed':   'COMPLETED',
    'on_hold':     'ON_HOLD',
    'failed':      'FAILED',
})[s] || 'PENDING';

/**
 * Converts a MySQL datetime string (UTC) to IST ISO string.
 * MySQL CONVERT_TZ handles this at DB level, so this is just a formatter.
 */
const fmtIST = (s) => {
    if (!s) return null;
    // s comes from SQL as already-IST string via CONVERT_TZ, just add offset suffix
    return String(s).replace(' ', 'T') + '+05:30';
};

/**
 * GET /order/status?trackingId={vehicleTrackingId}
 * Returns status for ALL vehicles in the order.
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

        // Find the order via vehicle tracking_id, convert timestamps to IST in SQL
        const [vehicleLookup] = await pool.execute(
            `SELECT ov.order_id,
                    o.tracking_id AS order_tracking_id,
                    o.tml_order_id, o.order_number, o.created_by,
                    DATE_FORMAT(CONVERT_TZ(o.created_at, '+00:00', '+05:30'), '%Y-%m-%d %H:%i:%s') AS created_at_ist
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

        // Fetch ALL vehicles for this order
        const [vehicles] = await pool.execute(
            `SELECT vin, tracking_id AS vehicle_tracking_id,
                    ais140_ticket_no, mining_ticket_no
             FROM order_vehicles
             WHERE order_id = ? ORDER BY created_at ASC`,
            [order.order_id]
        );

        const data = [];

        for (const v of vehicles) {
            const vTid = v.vehicle_tracking_id;

            // Fetch tickets — convert timestamps to IST in SQL
            const [shipRows] = await pool.execute(
                `SELECT status, courier, awb_number,
                        DATE_FORMAT(CONVERT_TZ(updated_at, '+00:00', '+05:30'), '%Y-%m-%d %H:%i:%s') AS updated_at_ist,
                        DATE_FORMAT(CONVERT_TZ(expected_delivery, '+00:00', '+05:30'), '%Y-%m-%d') AS expected_delivery_ist,
                        DATE_FORMAT(CONVERT_TZ(dispatched_at, '+00:00', '+05:30'), '%Y-%m-%d %H:%i:%s') AS dispatched_at_ist
                 FROM shipment_tickets WHERE tracking_id = ? LIMIT 1`, [vTid]
            );
            const [delRows] = await pool.execute(
                `SELECT status, delivered_to,
                        DATE_FORMAT(CONVERT_TZ(updated_at, '+00:00', '+05:30'), '%Y-%m-%d %H:%i:%s') AS updated_at_ist,
                        DATE_FORMAT(CONVERT_TZ(delivery_date, '+00:00', '+05:30'), '%Y-%m-%d') AS delivery_date_ist
                 FROM delivery_tickets WHERE tracking_id = ? LIMIT 1`, [vTid]
            );
            const [instRows] = await pool.execute(
                `SELECT status, technician_name,
                        DATE_FORMAT(CONVERT_TZ(updated_at, '+00:00', '+05:30'), '%Y-%m-%d %H:%i:%s') AS updated_at_ist,
                        DATE_FORMAT(CONVERT_TZ(scheduled_date, '+00:00', '+05:30'), '%Y-%m-%d') AS scheduled_date_ist
                 FROM installation_tickets WHERE tracking_id = ? LIMIT 1`, [vTid]
            );

            const ship = shipRows[0] || null;
            const del  = delRows[0]  || null;
            const inst = instRows[0] || null;

            const tracking_info = [
                {
                    stage:      'ORDER_CREATED',
                    status:     'COMPLETED',
                    updated_at: fmtIST(order.created_at_ist),
                    metadata: {
                        order_id:          order.tml_order_id || order.order_number,
                        order_tracking_id: order.order_tracking_id,
                        created_by:        order.created_by || 'system',
                    },
                },
                {
                    stage:      'TCU_SHIPPED',
                    status:     ship ? mapStatus(ship.status) : 'PENDING',
                    updated_at: ship ? fmtIST(ship.updated_at_ist) : null,
                    metadata:   ship ? {
                        courier:           ship.courier || null,
                        tracking_number:   ship.awb_number || null,
                        expected_delivery: ship.expected_delivery_ist || null,
                        dispatched_at:     fmtIST(ship.dispatched_at_ist),
                    } : {},
                },
                {
                    stage:      'TCU_DELIVERED',
                    status:     del ? mapStatus(del.status) : 'PENDING',
                    updated_at: del ? fmtIST(del.updated_at_ist) : null,
                    metadata:   del ? {
                        delivered_to:  del.delivered_to || null,
                        delivery_date: del.delivery_date_ist || null,
                    } : {},
                },
                {
                    stage:      'DEVICE_INSTALLED',
                    status:     inst ? mapStatus(inst.status) : 'PENDING',
                    updated_at: inst ? fmtIST(inst.updated_at_ist) : null,
                    metadata:   inst ? {
                        technician_name: inst.technician_name || null,
                        scheduled_date:  inst.scheduled_date_ist || null,
                    } : {},
                },
            ];

            data.push({
                vin:               v.vin,
                order_tracking_id: v.ais140_ticket_no || vTid,
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
