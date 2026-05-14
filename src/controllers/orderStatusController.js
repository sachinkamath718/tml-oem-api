const pool = require('../config/db');

const mapStatus = (s) => ({
    'pending':     'PENDING',
    'in_progress': 'IN_PROGRESS',
    'completed':   'COMPLETED',
    'on_hold':     'ON_HOLD',
    'failed':      'FAILED',
})[s] || 'PENDING';

/** Convert UTC timestamp → Unix epoch milliseconds (IST display) */
const toEpoch = (d) => {
    if (!d) return null;
    return new Date(d).getTime();
};

const getOrderStatus = async (req, res) => {
    try {
        const { trackingId } = req.query;

        if (!trackingId) {
            return res.status(404).json({ err: { code: 404, message: 'Tracking ID not found' }, data: null });
        }

        // Find order via vehicle tracking_id
        const lookupResult = await pool.query(
            `SELECT ov.order_id,
                    o.tracking_id AS order_tracking_id,
                    o.tml_order_id, o.order_number, o.created_by,
                    o.created_at
             FROM order_vehicles ov
             JOIN orders o ON ov.order_id = o.id
             WHERE ov.tracking_id = $1 LIMIT 1`,
            [trackingId]
        );

        if (lookupResult.rows.length === 0) {
            return res.status(404).json({ err: { code: 404, message: 'Tracking ID not found' }, data: null });
        }

        const order = lookupResult.rows[0];

        // Fetch ALL vehicles for this order
        const vehiclesResult = await pool.query(
            `SELECT vin, tracking_id AS vehicle_tracking_id, ais140_ticket_no, mining_ticket_no
             FROM order_vehicles WHERE order_id = $1 ORDER BY created_at ASC`,
            [order.order_id]
        );

        const data = [];

        for (const v of vehiclesResult.rows) {
            const vTid = v.vehicle_tracking_id;

            const shipResult = await pool.query(
                `SELECT status, courier, awb_number, updated_at, expected_delivery, dispatched_at
                 FROM shipment_tickets WHERE tracking_id = $1 LIMIT 1`, [vTid]
            );
            const delResult = await pool.query(
                `SELECT status, delivered_to, updated_at, delivery_date
                 FROM delivery_tickets WHERE tracking_id = $1 LIMIT 1`, [vTid]
            );
            const instResult = await pool.query(
                `SELECT status, technician_name, updated_at, scheduled_date
                 FROM installation_tickets WHERE tracking_id = $1 LIMIT 1`, [vTid]
            );

            const ship = shipResult.rows[0] || null;
            const del  = delResult.rows[0]  || null;
            const inst = instResult.rows[0] || null;

            const tracking_info = [
                {
                    stage:      'ORDER_CREATED',
                    status:     'COMPLETED',
                    updated_at: toEpoch(order.created_at),
                    metadata: {
                        order_id:          order.tml_order_id || order.order_number,
                        order_tracking_id: order.order_tracking_id,
                        created_by:        order.created_by || 'system',
                    },
                },
                {
                    stage:      'TCU_SHIPPED',
                    status:     ship ? mapStatus(ship.status) : 'PENDING',
                    updated_at: ship ? toEpoch(ship.updated_at) : null,
                    metadata:   ship ? {
                        courier:           ship.courier || null,
                        tracking_number:   ship.awb_number || null,
                        expected_delivery: ship.expected_delivery || null,
                        dispatched_at:     toEpoch(ship.dispatched_at),
                    } : {},
                },
                {
                    stage:      'TCU_DELIVERED',
                    status:     del ? mapStatus(del.status) : 'PENDING',
                    updated_at: del ? toEpoch(del.updated_at) : null,
                    metadata:   del ? {
                        delivered_to:  del.delivered_to || null,
                        delivery_date: del.delivery_date || null,
                    } : {},
                },
                {
                    stage:      'DEVICE_INSTALLED',
                    status:     inst ? mapStatus(inst.status) : 'PENDING',
                    updated_at: inst ? toEpoch(inst.updated_at) : null,
                    metadata:   inst ? {
                        technician_name: inst.technician_name || null,
                        scheduled_date:  inst.scheduled_date || null,
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
        return res.status(500).json({ err: { code: 'SERVER_ERROR', message: 'Internal server error.' }, data: null });
    }
};

module.exports = { getOrderStatus };
