const pool    = require('../config/db');
const { generateTrackingId, generateTicketId } = require('../utils/idGenerator');

const validateMiningVehicle = (vd) => {
    const errors = [];
    if (!vd.vin)          errors.push('vin is required');
    if (!vd.iccid)        errors.push('iccid is required');
    if (!vd.device_imei)  errors.push('device_imei is required');
    if (!vd.department)   errors.push('department is required');
    if (!vd.sim_expiry_date) errors.push('sim_expiry_date is required');
    if (!vd.duration_in_year) errors.push('duration_in_year is required');
    return errors;
};

/**
 * POST /api/mining
 * Creates Mining cert tickets per VIN
 */
const createMiningRequest = async (req, res) => {
    try {
        const vehicles = req.body;
        const clientId = req.client.client_id;

        if (!Array.isArray(vehicles) || vehicles.length === 0) {
            return res.status(400).json({ success: false, err: { code: 'INVALID_DATA', message: 'Request body must be a non-empty array.' }, data: null });
        }

        const results      = [];
        let   hasErrors    = false;
        let   hasSuccesses = false;

        for (const item of vehicles) {
            const vd  = item.vehicle_details  || {};
            const cd  = item.customer_details || {};
            const vin = vd.vin;

            const validationErrors = validateMiningVehicle(vd);
            if (validationErrors.length > 0) {
                results.push({ vin: vin || null, mining_ticket_no: null, validation_errors: validationErrors });
                hasErrors = true;
                continue;
            }

            // Case 1 / Case 2 tracking ID logic
            let trackingId      = generateTrackingId();
            let orderTrackingId = null;

            const [existing] = await pool.execute(
                `SELECT tracking_id, mining_ticket_no FROM order_vehicles WHERE vin = ? LIMIT 1`, [vin]
            );

            if (existing.length) {
                trackingId      = existing[0].tracking_id;
                orderTrackingId = existing[0].tracking_id;

                if (existing[0].mining_ticket_no) {
                    results.push({ vin, mining_ticket_no: existing[0].mining_ticket_no, validation_errors: null });
                    hasSuccesses = true;
                    continue;
                }
            }

            const miningTicketNo = `MIN-${generateTicketId()}`;

            await pool.execute(
                `INSERT INTO mining_tickets
                 (mining_ticket_no, vin, tracking_id, order_tracking_id, vehicle_details, customer_details, status)
                 VALUES (?,?,?,?,?,?,'pending')`,
                [miningTicketNo, vin, trackingId, orderTrackingId, JSON.stringify(vd), JSON.stringify(cd)]
            );

            if (existing.length) {
                await pool.execute(`UPDATE order_vehicles SET mining_ticket_no=? WHERE vin=?`, [miningTicketNo, vin]);
            }

            results.push({ vin, mining_ticket_no: miningTicketNo, validation_errors: null });
            hasSuccesses = true;
        }

        const statusCode = hasErrors && hasSuccesses ? 206 : hasErrors ? 400 : 200;
        return res.status(statusCode).json({ success: true, err: null, data: results });

    } catch (err) {
        console.error('[createMiningRequest] Error:', err);
        return res.status(500).json({ success: false, err: { code: 'SERVER_ERROR', message: 'Internal server error.' }, data: null });
    }
};

/**
 * POST /api/mining/ticket-status
 */
const getMiningTicketStatus = async (req, res) => {
    try {
        const { vin, mining_ticket_no } = req.body;

        if (!vin && !mining_ticket_no) {
            return res.status(400).json({ success: false, err: { code: 'MISSING_PARAM', message: 'Provide vin or mining_ticket_no.' }, data: null });
        }

        let rows;
        if (mining_ticket_no) {
            [rows] = await pool.execute(`SELECT * FROM mining_tickets WHERE mining_ticket_no = ? LIMIT 1`, [mining_ticket_no]);
        } else {
            [rows] = await pool.execute(`SELECT * FROM mining_tickets WHERE vin = ? ORDER BY created_at DESC`, [vin]);
        }

        if (!rows.length) {
            return res.status(404).json({ success: false, err: { code: 404, message: 'Mining ticket not found' }, data: null });
        }

        const data = rows.map(t => ({
            mining_ticket_no:       t.mining_ticket_no,
            vin:                    t.vin,
            tracking_id:            t.tracking_id,
            order_tracking_id:      t.order_tracking_id,
            status:                 t.status,
            handler_details:        t.handler_details,
            certificate_file_name:  t.certificate_file_name,
            certificate_file_path:  t.certificate_file_path,
            validation_errors:      t.validation_errors,
            created_at:             t.created_at,
            updated_at:             t.updated_at,
        }));

        return res.status(200).json({ success: true, err: null, data: mining_ticket_no ? data[0] : data });

    } catch (err) {
        console.error('[getMiningTicketStatus] Error:', err);
        return res.status(500).json({ success: false, err: { code: 'SERVER_ERROR', message: 'Internal server error.' }, data: null });
    }
};

module.exports = { createMiningRequest, getMiningTicketStatus };

