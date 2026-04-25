const pool = require('../config/db');

/**
 * GET /api/orders/status
 *
 * Headers:
 *   Authorization: Bearer <token>
 *
 * Query Params (use ONE of):
 *   ?order_number=ORD-20250424-9A1B2C
 *   ?tracking_id=TRK-1714000000000-A3F2
 *   ?vin=VIN001
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "order_number": "ORD-...",
 *     "tracking_id": "TRK-...",
 *     "status": "pending",
 *     "total_vehicles": 3,
 *     "tickets": [...],
 *     "status_history": [...]
 *   }
 * }
 */
async function getOrderStatus(req, res) {
    const { order_number, tracking_id, vin } = req.query;

    if (!order_number && !tracking_id && !vin) {
        return res.status(400).json({
            success: false,
            message: 'Provide at least one query param: order_number, tracking_id, or vin.',
        });
    }

    try {
        let order = null;

        // --- Find order by vin (look up the vehicle first) ---
        if (vin && !order_number && !tracking_id) {
            const [vinRows] = await pool.query(
                `SELECT o.* FROM orders o
                 INNER JOIN order_vehicles ov ON ov.order_id = o.id
                 WHERE ov.vin = ? LIMIT 1`,
                [vin]
            );
            if (vinRows.length > 0) order = vinRows[0];
        }

        // --- Find order by order_number or tracking_id ---
        if (!order) {
            let whereClause = '';
            let param       = '';

            if (order_number) {
                whereClause = 'WHERE o.order_number = ?';
                param       = order_number;
            } else if (tracking_id) {
                whereClause = 'WHERE o.tracking_id = ?';
                param       = tracking_id;
            }

            const [orderRows] = await pool.query(
                `SELECT o.* FROM orders o ${whereClause} LIMIT 1`,
                [param]
            );

            if (orderRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Order not found.',
                });
            }
            order = orderRows[0];
        }

        // --- Fetch all vehicle tickets for this order ---
        const [tickets] = await pool.query(
            `SELECT
               id, vin, ticket_id, tracking_id,
               dispatch_location, status,
               created_at, updated_at
             FROM order_vehicles
             WHERE order_id = ?
             ORDER BY created_at ASC`,
            [order.id]
        );

        // --- Fetch status history (audit trail) ---
        const [history] = await pool.query(
            `SELECT
               id, vin, from_status, to_status,
               changed_by, notes, metadata, created_at
             FROM order_status_history
             WHERE order_id = ?
             ORDER BY created_at ASC`,
            [order.id]
        );

        // --- Build status summary by dispatch location ---
        const locationSummary = {};
        for (const t of tickets) {
            const loc = t.dispatch_location || 'Unspecified';
            if (!locationSummary[loc]) locationSummary[loc] = { total: 0, statuses: {} };
            locationSummary[loc].total++;
            locationSummary[loc].statuses[t.status] = (locationSummary[loc].statuses[t.status] || 0) + 1;
        }

        return res.status(200).json({
            success: true,
            data: {
                order_id:        order.id,
                order_number:    order.order_number,
                tracking_id:     order.tracking_id,
                oem_name:        order.oem_name,
                status:          order.status,
                total_vehicles:  order.total_vehicles,
                created_at:      order.created_at,
                updated_at:      order.updated_at,
                dispatch_summary: locationSummary,
                tickets,
                status_history:  history,
            },
        });

    } catch (err) {
        console.error('[getOrderStatus] Error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error.' });
    }
}

module.exports = { getOrderStatus };
