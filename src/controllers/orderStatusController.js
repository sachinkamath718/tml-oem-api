const pool = require('../config/db');

/**
 * GET /api/orders/status?trackingId=TRK...
 * Returns stage-wise tracking_info per vehicle
 */
const getOrderStatus = async (req, res) => {
    try {
        const { trackingId, order_number, vin } = req.query;

        if (!trackingId && !order_number && !vin) {
            return res.status(400).json({ err: { code: 'MISSING_PARAM', message: 'Provide trackingId, order_number, or vin.' }, data: null });
        }

        let orderRows;
        if (trackingId) {
            [orderRows] = await pool.execute(`SELECT * FROM orders WHERE tracking_id = ? LIMIT 1`, [trackingId]);
        } else if (order_number) {
            [orderRows] = await pool.execute(`SELECT * FROM orders WHERE order_number = ? LIMIT 1`, [order_number]);
        } else {
            // lookup by VIN → get order
            const [vRows] = await pool.execute(`SELECT order_id FROM order_vehicles WHERE vin = ? LIMIT 1`, [vin]);
            if (!vRows.length) return res.status(404).json({ err: { code: 404, message: 'Tracking ID not found' }, data: null });
            [orderRows] = await pool.execute(`SELECT * FROM orders WHERE id = ? LIMIT 1`, [vRows[0].order_id]);
        }

        if (!orderRows.length) {
            return res.status(404).json({ err: { code: 404, message: 'Tracking ID not found' }, data: null });
        }

        const order = orderRows[0];

        // Get vehicles
        const [vehicles] = await pool.execute(`SELECT * FROM order_vehicles WHERE order_id = ?`, [order.id]);

        // Get stage history
        const [history] = await pool.execute(
            `SELECT * FROM order_status_history WHERE order_id = ? ORDER BY created_at ASC`,
            [order.id]
        );

        // Build stage-wise tracking_info
        const tracking_info = history.map(h => ({
            stage:      h.stage || 'ORDER_CREATED',
            status:     h.to_status,
            updated_at: new Date(h.created_at).getTime(),
            metadata:   h.metadata ? (typeof h.metadata === 'string' ? JSON.parse(h.metadata) : h.metadata) : {},
        }));

        // Per-vehicle response
        const vehicleData = vehicles.map(v => ({
            vin:              v.vin,
            tracking_id:      v.tracking_id,
            ticket_id:        v.ticket_id,
            ais140_ticket_no: v.ais140_ticket_no,
            mining_ticket_no: v.mining_ticket_no,
            status:           v.status,
            dispatch_location: v.dispatch_location,
            tracking_info,
        }));

        return res.status(200).json({
            err:  null,
            data: {
                order_number:     order.order_number,
                tml_order_id:     order.tml_order_id,
                tracking_id:      order.tracking_id,
                status:           order.status,
                total_vehicles:   order.total_vehicles,
                customer_details: order.customer_details,
                vehicles:         vehicleData,
                tracking_info,
            }
        });

    } catch (err) {
        console.error('[getOrderStatus] Error:', err);
        return res.status(500).json({ err: { code: 'SERVER_ERROR', message: 'Internal server error.' }, data: null });
    }
};

module.exports = { getOrderStatus };
