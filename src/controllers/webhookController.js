const pool = require('../config/db');

/**
 * POST /webhooks/device-fitment
 *
 * Handles inbound stages from iTriangle (FleetEdge):
 *   ORDER_CREATED    → creates pending tickets in all 3 modules
 *   TCU_SHIPPED      → shipment_ticket → in_progress
 *   TCU_DELIVERED    → delivery_ticket → completed
 *   DEVICE_INSTALLED → installation_ticket → completed, saves iccId
 */
const handleDeviceFitment = async (req, res) => {
    const { trackingId, vin, stage, updatedAt, meta = {}, metadata = {} } = req.body;
    const metaData = Object.keys(meta).length ? meta : metadata; // accept both key names

    if (!trackingId || !vin || !stage) {
        return res.status(400).json({
            err:  { code: 400, message: 'trackingId, vin and stage are required' },
            data: null,
        });
    }

    console.log(`[webhook] stage=${stage} vin=${vin} trackingId=${trackingId}`);

    try {
        switch (stage) {
            case 'ORDER_CREATED':   return await handleOrderCreated({ trackingId, vin, updatedAt, metadata: metaData }, res);
            case 'TCU_SHIPPED':     return await handleTcuShipped({ trackingId, vin, metadata: metaData }, res);
            case 'TCU_DELIVERED':   return await handleTcuDelivered({ trackingId, vin, metadata: metaData }, res);
            case 'DEVICE_INSTALLED':return await handleDeviceInstalled({ trackingId, vin, updatedAt, metadata: metaData }, res);
            default:
                return res.status(200).json({
                    err:  null,
                    data: { acknowledged: true, stage, action: 'no_op' },
                });
        }
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
 * – Ensure order_vehicles row exists
 * – Upsert installation_ticket, ais140_ticket, mining_ticket (all pending)
 */
async function handleOrderCreated({ trackingId, vin, updatedAt }, res) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [existing] = await conn.execute(
            'SELECT id, order_id FROM order_vehicles WHERE tracking_id = ? LIMIT 1',
            [trackingId]
        );

        let orderId;

        if (existing.length === 0) {
            // Get or create api_clients row for itriangle
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

            const orderNo = `WH-${trackingId}`;
            const [orderResult] = await conn.execute(
                `INSERT INTO orders
                   (order_number, tml_order_id, tracking_id, client_ref_id, created_by, status)
                 VALUES (?, ?, ?, ?, 'SYSTEM', 'pending')
                 ON DUPLICATE KEY UPDATE id=LAST_INSERT_ID(id)`,
                [orderNo, orderNo, trackingId, clientRefId]
            );
            orderId = orderResult.insertId;

            await conn.execute(
                `INSERT INTO order_vehicles (order_id, vin, tracking_id, ticket_id, status)
                 VALUES (?, ?, ?, ?, 'pending')
                 ON DUPLICATE KEY UPDATE id=id`,
                [orderId, vin, trackingId, `TKT-${trackingId}`]
            );
        } else {
            orderId = existing[0].order_id;
        }

        // Upsert shipment_ticket
        const shpNo = `SHP-${trackingId}`;
        await conn.execute(
            `INSERT INTO shipment_tickets (ticket_no, vin, tracking_id, order_tracking_id, status)
             VALUES (?, ?, ?, ?, 'pending')
             ON DUPLICATE KEY UPDATE status=IF(status='pending','pending',status)`,
            [shpNo, vin, trackingId, trackingId]
        );

        // Upsert delivery_ticket
        const dlvNo = `DLV-${trackingId}`;
        await conn.execute(
            `INSERT INTO delivery_tickets (ticket_no, vin, tracking_id, order_tracking_id, status)
             VALUES (?, ?, ?, ?, 'pending')
             ON DUPLICATE KEY UPDATE status=IF(status='pending','pending',status)`,
            [dlvNo, vin, trackingId, trackingId]
        );

        // Upsert installation_ticket
        const instNo = `INS-${trackingId}`;
        await conn.execute(
            `INSERT INTO installation_tickets (ticket_no, vin, tracking_id, order_tracking_id, status)
             VALUES (?, ?, ?, ?, 'pending')
             ON DUPLICATE KEY UPDATE status=IF(status='pending','pending',status)`,
            [instNo, vin, trackingId, trackingId]
        );

        // Upsert ais140_ticket
        const aisNo = `AIS-${trackingId}`;
        await conn.execute(
            `INSERT INTO ais140_tickets (ticket_no, vin, tracking_id, order_tracking_id, status)
             VALUES (?, ?, ?, ?, 'pending')
             ON DUPLICATE KEY UPDATE status=IF(status='pending','pending',status)`,
            [aisNo, vin, trackingId, trackingId]
        );
        await conn.execute(
            `UPDATE order_vehicles SET ais140_ticket_no=? WHERE tracking_id=?`,
            [aisNo, trackingId]
        );

        // Upsert mining_ticket
        const minNo = `MIN-${trackingId}`;
        await conn.execute(
            `INSERT INTO mining_tickets (mining_ticket_no, vin, tracking_id, order_tracking_id, status)
             VALUES (?, ?, ?, ?, 'pending')
             ON DUPLICATE KEY UPDATE status=IF(status='pending','pending',status)`,
            [minNo, vin, trackingId, trackingId]
        );
        await conn.execute(
            `UPDATE order_vehicles SET mining_ticket_no=? WHERE tracking_id=?`,
            [minNo, trackingId]
        );

        await conn.commit();
        console.log(`[webhook] ORDER_CREATED: tickets created for vin=${vin} tracking=${trackingId}`);

        return res.status(200).json({
            err:  null,
            data: {
                stage:     'ORDER_CREATED',
                vin,
                trackingId,
                tickets:   { shipment: shpNo, delivery: dlvNo, installation: instNo, ais140: aisNo, mining: minNo },
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
 * TCU_SHIPPED
 * – Update shipment_ticket → in_progress
 * – Save courier/AWB from meta
 */
async function handleTcuShipped({ trackingId, vin, metadata }, res) {
    const { iccId, courier, courierTrackingNumber, expectedDelivery, remarks } = metadata;

    await pool.execute(
        `UPDATE shipment_tickets
         SET status='in_progress', iccid=?, courier=?, awb_number=?, expected_delivery=?,
             remark=?, updated_at=NOW()
         WHERE tracking_id=? AND vin=?`,
        [iccId || null, courier || null, courierTrackingNumber || null,
         expectedDelivery || null, remarks || null, trackingId, vin]
    );

    console.log(`[webhook] TCU_SHIPPED: vin=${vin} tracking=${trackingId}`);
    return res.status(200).json({
        err:  null,
        data: { stage: 'TCU_SHIPPED', vin, trackingId, updated: 'shipment_ticket → in_progress' },
    });
}

/**
 * TCU_DELIVERED
 * – Update delivery_ticket → completed
 */
async function handleTcuDelivered({ trackingId, vin, metadata }, res) {
    const { remarks } = metadata;

    await pool.execute(
        `UPDATE delivery_tickets
         SET status='completed', remark=?, updated_at=NOW()
         WHERE tracking_id=? AND vin=?`,
        [remarks || null, trackingId, vin]
    );

    // Also mark shipment as completed if still in_progress
    await pool.execute(
        `UPDATE shipment_tickets SET status='completed', updated_at=NOW()
         WHERE tracking_id=? AND vin=? AND status='in_progress'`,
        [trackingId, vin]
    );

    console.log(`[webhook] TCU_DELIVERED: vin=${vin} tracking=${trackingId}`);
    return res.status(200).json({
        err:  null,
        data: { stage: 'TCU_DELIVERED', vin, trackingId, updated: 'delivery_ticket → completed' },
    });
}

/**
 * DEVICE_INSTALLED
 * – Update installation_ticket → completed
 * – Save iccId to order_vehicles
 */
async function handleDeviceInstalled({ trackingId, vin, metadata }, res) {
    const { iccId, technicianName, installationDate, deviceSerial, kycMobileNo, kycCustomerType, remarks } = metadata;

    await pool.execute(
        `UPDATE installation_tickets
         SET status='completed', technician_name=?, scheduled_date=?, device_serial=?,
             kyc_mobile_no=?, kyc_customer_type=?, remark=?, updated_at=NOW()
         WHERE tracking_id=? AND vin=?`,
        [technicianName || null, installationDate || null, deviceSerial || null,
         kycMobileNo || null, kycCustomerType || null, remarks || null, trackingId, vin]
    );

    if (iccId) {
        await pool.execute(
            `UPDATE order_vehicles SET iccid=? WHERE tracking_id=? AND vin=?`,
            [iccId, trackingId, vin]
        );
    }

    console.log(`[webhook] DEVICE_INSTALLED: vin=${vin} tracking=${trackingId} iccId=${iccId}`);
    return res.status(200).json({
        err:  null,
        data: {
            stage:     'DEVICE_INSTALLED',
            vin,
            trackingId,
            updated:   'installation_ticket → completed',
            iccId:     iccId || null,
        },
    });
}

/**
 * POST /webhooks/v2/ais140-requests
 * Inbound from iTriangle: { vin, ticketNo, status, remark, handler, handlerContact,
 *   processEndDateTime, certificationRegistrationDateTime, certificationExpiryDate,
 *   certificateFileLocation, certificateFileNames, metadata }
 */
const handleAis140Update = async (req, res) => {
    const {
        vin, ticketNo, status, remark, handler, handlerContact,
        processEndDateTime, certificationRegistrationDateTime,
        certificationExpiryDate, certificateFileLocation, certificateFileNames,
        metadata = {},
    } = req.body;

    if (!ticketNo && !vin) {
        return res.status(400).json({ err: { code: 400, message: 'ticketNo or vin is required' }, data: null });
    }
    if (!status) {
        return res.status(400).json({ err: { code: 400, message: 'status is required' }, data: null });
    }

    const RAW_STATUS_MAP = {
        PENDING:   'pending', IN_PROGRESS: 'in_progress', COMPLETED: 'completed',
        ON_HOLD:   'on_hold', CANCELLED:   'cancelled',
        CANCELLED_DUE_TO_CHANGE_REQUEST: 'cancelled_due_to_change_request',
    };
    const rawStatus = RAW_STATUS_MAP[status] || status.toLowerCase();

    try {
        const certNames = Array.isArray(certificateFileNames) ? certificateFileNames.join(',') : (certificateFileNames || null);

        let query, params;
        if (ticketNo) {
            query = `UPDATE ais140_tickets
                     SET status=?, remark=?, handler=?, handler_contact=?,
                         process_datetime=?, certification_registration_datetime=?,
                         certification_expiry_date=?, certificate_file_location=?,
                         certificate_file_name=?, handler_details=?, updated_at=NOW()
                     WHERE ticket_no=?`;
            params = [rawStatus, remark || null, handler || null, handlerContact || null,
                      processEndDateTime || null, certificationRegistrationDateTime || null,
                      certificationExpiryDate || null, certificateFileLocation || null,
                      certNames, JSON.stringify(metadata), ticketNo];
        } else {
            query = `UPDATE ais140_tickets
                     SET status=?, remark=?, handler=?, handler_contact=?,
                         process_datetime=?, certification_registration_datetime=?,
                         certification_expiry_date=?, certificate_file_location=?,
                         certificate_file_name=?, handler_details=?, updated_at=NOW()
                     WHERE vin=? ORDER BY created_at DESC LIMIT 1`;
            params = [rawStatus, remark || null, handler || null, handlerContact || null,
                      processEndDateTime || null, certificationRegistrationDateTime || null,
                      certificationExpiryDate || null, certificateFileLocation || null,
                      certNames, JSON.stringify(metadata), vin];
        }

        await pool.execute(query, params);
        console.log(`[webhook] AIS140 updated: ticketNo=${ticketNo} vin=${vin} status=${rawStatus}`);

        return res.status(200).json({
            err:  null,
            data: { acknowledged: true, ticketNo, vin, status: rawStatus },
        });
    } catch (err) {
        console.error('[handleAis140Update] Error:', err);
        return res.status(500).json({ err: { code: 'SERVER_ERROR', message: err.message }, data: null });
    }
};

/**
 * POST /webhooks/mining-requests
 * Inbound from iTriangle: { vin, ticketNo, status, remark, handler, handlerContact,
 *   expiryDate, department, metadata }
 */
const handleMiningUpdate = async (req, res) => {
    const {
        vin, ticketNo, status, remark, handler, handlerContact,
        expiryDate, department, metadata = {},
    } = req.body;

    if (!ticketNo && !vin) {
        return res.status(400).json({ err: { code: 400, message: 'ticketNo or vin is required' }, data: null });
    }
    if (!status) {
        return res.status(400).json({ err: { code: 400, message: 'status is required' }, data: null });
    }

    const RAW_STATUS_MAP = {
        PENDING: 'pending', IN_PROGRESS: 'in_progress', COMPLETED: 'completed',
        ON_HOLD: 'on_hold', CANCELLED: 'cancelled',
        CANCELLED_DUE_TO_CHANGE_REQUEST: 'cancelled_due_to_change_request',
    };
    const rawStatus = RAW_STATUS_MAP[status] || status.toLowerCase();

    try {
        let query, params;
        if (ticketNo) {
            query = `UPDATE mining_tickets
                     SET status=?, remark=?, handler=?, handler_contact=?,
                         process_datetime=NOW(), polling_datetime=NOW(),
                         handler_details=?, updated_at=NOW()
                     WHERE mining_ticket_no=?`;
            params = [rawStatus, remark || null, handler || null, handlerContact || null,
                      JSON.stringify({ expiryDate, department, ...metadata }), ticketNo];
        } else {
            query = `UPDATE mining_tickets
                     SET status=?, remark=?, handler=?, handler_contact=?,
                         process_datetime=NOW(), polling_datetime=NOW(),
                         handler_details=?, updated_at=NOW()
                     WHERE vin=? ORDER BY created_at DESC LIMIT 1`;
            params = [rawStatus, remark || null, handler || null, handlerContact || null,
                      JSON.stringify({ expiryDate, department, ...metadata }), vin];
        }

        await pool.execute(query, params);
        console.log(`[webhook] Mining updated: ticketNo=${ticketNo} vin=${vin} status=${rawStatus}`);

        return res.status(200).json({
            err:  null,
            data: { acknowledged: true, ticketNo, vin, status: rawStatus },
        });
    } catch (err) {
        console.error('[handleMiningUpdate] Error:', err);
        return res.status(500).json({ err: { code: 'SERVER_ERROR', message: err.message }, data: null });
    }
};

module.exports = { handleDeviceFitment, handleAis140Update, handleMiningUpdate };
