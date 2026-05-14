const pool = require('../config/db');

/**
 * POST /webhooks/device-fitment
 *
 * Handles two stages from iTriangle (FleetEdge):
 *   ORDER_CREATED    → creates pending tickets in all 3 modules
 *   DEVICE_INSTALLED → marks installation ticket completed, saves iccId
 */
const handleDeviceFitment = async (req, res) => {
    const { trackingId, vin, stage, updatedAt, metadata = {} } = req.body;

    if (!trackingId || !vin || !stage) {
        return res.status(400).json({
            err:  { code: 400, message: 'trackingId, vin and stage are required' },
            data: null,
        });
    }

    console.log(`[webhook] stage=${stage} vin=${vin} trackingId=${trackingId}`);

    try {
        if (stage === 'ORDER_CREATED') {
            return await handleOrderCreated({ trackingId, vin, updatedAt, metadata }, res);
        }
        if (stage === 'DEVICE_INSTALLED') {
            return await handleDeviceInstalled({ trackingId, vin, updatedAt, metadata }, res);
        }

        // Unknown stage — acknowledge but do nothing
        return res.status(200).json({
            err:  null,
            data: { acknowledged: true, stage, action: 'no_op' },
        });

    } catch (err) {
        console.error('[webhook] Unhandled error:', err);
        return res.status(500).json({
            err:  { code: 'SERVER_ERROR', message: 'Internal server error.' },
            data: null,
        });
    }
};

/**
 * ORDER_CREATED
 * – Ensure order_vehicles row exists for this trackingId + vin
 * – Upsert installation_ticket, ais140_ticket, mining_ticket (all pending)
 */
async function handleOrderCreated({ trackingId, vin, updatedAt }, res) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        // 1. Check if order_vehicle exists for this tracking_id
        const [existing] = await conn.execute(
            'SELECT id, order_id FROM order_vehicles WHERE tracking_id = ? LIMIT 1',
            [trackingId]
        );

        let orderId;

        if (existing.length === 0) {
            // Get or create the api_clients row for itriangle
            let clientRefId;
            const [clientRows] = await conn.execute(
                `SELECT id FROM api_clients WHERE client_id = 'itriangle' LIMIT 1`
            );
            if (clientRows.length > 0) {
                clientRefId = clientRows[0].id;
            } else {
                const [clientInsert] = await conn.execute(
                    `INSERT INTO api_clients (client_id, client_secret, client_name, status)
                     VALUES ('itriangle', 'webhook-auto', 'iTriangle FleetEdge', 1)
                     ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`
                );
                clientRefId = clientInsert.insertId;
            }

            // Create a stub order so FK constraints are satisfied
            const orderNo = `WH-${trackingId}`;
            const [orderResult] = await conn.execute(
                `INSERT INTO orders
                   (order_number, tml_order_id, tracking_id, client_ref_id, created_by, status)
                 VALUES (?, ?, ?, ?, 'SYSTEM', 'pending')
                 ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
                [orderNo, orderNo, trackingId, clientRefId]
            );
            orderId = orderResult.insertId;

            // Create the order_vehicle row
            await conn.execute(
                `INSERT INTO order_vehicles (order_id, vin, tracking_id, ticket_id, status)
                 VALUES (?, ?, ?, ?, 'pending')
                 ON DUPLICATE KEY UPDATE id=id`,
                [orderId, vin, trackingId, `TKT-${trackingId}`]
            );
        } else {
            orderId = existing[0].order_id;
        }


        // 2. Upsert installation_ticket
        const instNo = `INS-${trackingId}`;
        await conn.execute(
            `INSERT INTO installation_tickets
               (ticket_no, vin, tracking_id, order_tracking_id, status)
             VALUES (?, ?, ?, ?, 'pending')
             ON DUPLICATE KEY UPDATE status=IF(status='pending', 'pending', status)`,
            [instNo, vin, trackingId, trackingId]
        );
        // Link back on order_vehicles if column exists
        await conn.execute(
            `UPDATE order_vehicles SET status='pending' WHERE tracking_id=?`,
            [trackingId]
        );

        // 3. Upsert ais140_ticket
        const aisNo = `AIS-${trackingId}`;
        await conn.execute(
            `INSERT INTO ais140_tickets
               (ticket_no, vin, tracking_id, order_tracking_id, status)
             VALUES (?, ?, ?, ?, 'pending')
             ON DUPLICATE KEY UPDATE status=IF(status='pending', 'pending', status)`,
            [aisNo, vin, trackingId, trackingId]
        );
        // Update order_vehicles.ais140_ticket_no
        await conn.execute(
            `UPDATE order_vehicles SET ais140_ticket_no=? WHERE tracking_id=?`,
            [aisNo, trackingId]
        );

        // 4. Upsert mining_ticket
        const minNo = `MIN-${trackingId}`;
        await conn.execute(
            `INSERT INTO mining_tickets
               (mining_ticket_no, vin, tracking_id, order_tracking_id, status)
             VALUES (?, ?, ?, ?, 'pending')
             ON DUPLICATE KEY UPDATE status=IF(status='pending', 'pending', status)`,
            [minNo, vin, trackingId, trackingId]
        );
        // Update order_vehicles.mining_ticket_no
        await conn.execute(
            `UPDATE order_vehicles SET mining_ticket_no=? WHERE tracking_id=?`,
            [minNo, trackingId]
        );

        await conn.commit();

        console.log(`[webhook] ORDER_CREATED: created tickets for vin=${vin} tracking=${trackingId}`);
        return res.status(200).json({
            err:  null,
            data: {
                stage:     'ORDER_CREATED',
                vin,
                trackingId,
                tickets:   { installation: instNo, ais140: aisNo, mining: minNo },
                status:    'pending',
                message:   'Tickets created in Pending. Visible in TML-OEM Kanban.',
            },
        });

    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

/**
 * DEVICE_INSTALLED
 * – Update installation_ticket status → completed
 * – Save iccId to order_vehicles
 */
async function handleDeviceInstalled({ trackingId, vin, metadata }, res) {
    const iccId = metadata?.iccId || null;

    // Update installation ticket
    await pool.execute(
        `UPDATE installation_tickets SET status='completed', updated_at=NOW()
         WHERE tracking_id=? AND vin=?`,
        [trackingId, vin]
    );

    // Save iccId to order_vehicles
    if (iccId) {
        await pool.execute(
            `UPDATE order_vehicles SET iccid=? WHERE tracking_id=? AND vin=?`,
            [iccId, trackingId, vin]
        );
    }

    console.log(`[webhook] DEVICE_INSTALLED: vin=${vin} trackingId=${trackingId} iccId=${iccId}`);
    return res.status(200).json({
        err:  null,
        data: {
            stage:     'DEVICE_INSTALLED',
            vin,
            trackingId,
            updated:   'installation_ticket → completed',
            iccId,
        },
    });
}

module.exports = { handleDeviceFitment };
