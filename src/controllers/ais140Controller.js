const pool    = require('../config/db');
const { generateTrackingId, generateTicketId } = require('../utils/idGenerator');

const validateAIS140Vehicle = (vd) => {
    const errors = [];
    if (!vd.vin)              errors.push('Invalid VIN');
    if (!vd.iccid)            errors.push('Missing POI document');
    if (!vd.device_imei)      errors.push('Missing device IMEI');
    if (!vd.rto_office_code)  errors.push('Invalid RTO code');
    if (!vd.rto_state)        errors.push('Invalid RTO state');
    if (!vd.sim_expiry_date)  errors.push('Missing SIM expiry date');
    if (!vd.certificate_validity_duration_in_year) errors.push('Missing certificate validity duration');
    return errors;
};

/** Maps DB status → spec uppercase status */
const mapStatus = (s) => ({
    'pending':                        'PENDING',
    'in_progress':                    'IN_PROGRESS',
    'completed':                      'COMPLETED',
    'on_hold':                        'ON_HOLD',
    'failed':                         'FAILED',
    'cancelled':                      'CANCELLED',
    'cancelled_due_to_change_request':'CANCELLED_DUE_TO_CHANGE_REQUEST',
})[s] || 'PENDING';

/**
 * POST /ais140
 */
const createAIS140Request = async (req, res) => {
    try {
        const vehicles = req.body;

        if (!Array.isArray(vehicles) || vehicles.length === 0) {
            return res.status(400).json({ err: { code: 'INVALID_DATA', message: 'Request body must be a non-empty array.' }, data: null });
        }

        const results      = [];
        let   hasErrors    = false;
        let   hasSuccesses = false;

        for (const item of vehicles) {
            const vd  = item.vehicle_details  || {};
            const cd  = item.customer_details || {};
            const vin = vd.vin;

            const validationErrors = validateAIS140Vehicle(vd);
            if (validationErrors.length > 0) {
                results.push({ vin: vin || null, ticket_no: null, validation_errors: validationErrors });
                hasErrors = true;
                continue;
            }

            // Check if VIN already in order → use same tracking_id
            let trackingId      = generateTrackingId();
            let orderTrackingId = null;

            const [existing] = await pool.execute(
                `SELECT tracking_id, ais140_ticket_no FROM order_vehicles WHERE vin = ? LIMIT 1`, [vin]
            );

            if (existing.length) {
                trackingId      = existing[0].tracking_id;
                orderTrackingId = existing[0].tracking_id;

                if (existing[0].ais140_ticket_no) {
                    results.push({ vin, ticket_no: existing[0].ais140_ticket_no, validation_errors: null });
                    hasSuccesses = true;
                    continue;
                }
            }

            const ticketNo = `AIS-TKT-${generateTicketId()}`;

            await pool.execute(
                `INSERT INTO ais140_tickets
                 (ticket_no, vin, tracking_id, order_tracking_id, vehicle_details, customer_details, status)
                 VALUES (?,?,?,?,?,?,'pending')`,
                [ticketNo, vin, trackingId, orderTrackingId, JSON.stringify(vd), JSON.stringify(cd)]
            );

            if (existing.length) {
                await pool.execute(`UPDATE order_vehicles SET ais140_ticket_no=? WHERE vin=?`, [ticketNo, vin]);
            }

            results.push({ vin, ticket_no: ticketNo, validation_errors: null });
            hasSuccesses = true;
        }

        const statusCode = hasErrors && hasSuccesses ? 206 : hasErrors ? 400 : 200;
        return res.status(statusCode).json({ err: null, data: results });

    } catch (err) {
        console.error('[createAIS140Request] Error:', err);
        return res.status(500).json({ err: { code: 'SERVER_ERROR', message: 'Internal server error.' }, data: null });
    }
};

/**
 * POST /ais140/ticket-status
 * Body: [{ "vin_no": "...", "ticket_no": "..." }]
 *
 * Response: { "err": null, "data": [{ vin, ticket_no, status, remark, handler,
 *   handler_contact, process_datetime, certification_registration_datetime,
 *   certification_expiry_date, certificate_file_location, certificate_file_names, metadata }] }
 */
const getAIS140TicketStatus = async (req, res) => {
    try {
        const requests = req.body;

        if (!Array.isArray(requests) || requests.length === 0) {
            return res.status(400).json({
                err:  { code: 'INVALID_DATA', message: 'Request body must be a non-empty array of { vin_no, ticket_no }.' },
                data: null,
            });
        }

        const results = [];

        for (const item of requests) {
            const { vin_no, ticket_no } = item;

            if (!vin_no && !ticket_no) {
                results.push({
                    vin: null, ticket_no: null, status: null,
                    remark: null, handler: null, handler_contact: null,
                    process_datetime: null, certification_registration_datetime: null,
                    certification_expiry_date: null, certificate_file_location: null,
                    certificate_file_names: [], metadata: {},
                    error: 'vin_no or ticket_no required',
                });
                continue;
            }

            let rows;
            if (ticket_no) {
                [rows] = await pool.execute(
                    `SELECT * FROM ais140_tickets WHERE ticket_no = ? LIMIT 1`, [ticket_no]
                );
            } else {
                [rows] = await pool.execute(
                    `SELECT * FROM ais140_tickets WHERE vin = ? ORDER BY created_at DESC LIMIT 1`, [vin_no]
                );
            }

            if (!rows.length) {
                results.push({
                    vin: vin_no || null, ticket_no: ticket_no || null,
                    status: null, remark: null, handler: null, handler_contact: null,
                    process_datetime: null, certification_registration_datetime: null,
                    certification_expiry_date: null, certificate_file_location: null,
                    certificate_file_names: [], metadata: {},
                    error: 'Ticket not found',
                });
                continue;
            }

            const t = rows[0];

            // Build certificate_file_names array
            const certFileNames = [];
            if (t.certificate_file_name) certFileNames.push(t.certificate_file_name);

            // Parse metadata from handler_details
            let metadata = {};
            if (t.handler_details) {
                metadata = typeof t.handler_details === 'string'
                    ? JSON.parse(t.handler_details)
                    : t.handler_details;
            }

            results.push({
                vin:                                t.vin,
                ticket_no:                          t.ticket_no,
                status:                             mapStatus(t.status),
                remark:                             t.remark || null,
                handler:                            t.handler || null,
                handler_contact:                    t.handler_contact || null,
                process_datetime:                   t.process_datetime
                    ? new Date(t.process_datetime).toISOString().replace('Z', '')
                    : null,
                polling_datetime:                   t.polling_datetime
                    ? new Date(t.polling_datetime).toISOString().replace('Z', '')
                    : null,
                certification_registration_datetime: t.certification_registration_datetime
                    ? new Date(t.certification_registration_datetime).toISOString().replace('Z', '')
                    : null,
                certification_expiry_date:          t.certification_expiry_date
                    ? t.certification_expiry_date.toISOString().split('T')[0]
                    : null,
                certificate_file_location:          t.certificate_file_location || t.certificate_file_path || null,
                certificate_file_names:             certFileNames,
                metadata,
            });
        }

        return res.status(200).json({ err: null, data: results });

    } catch (err) {
        console.error('[getAIS140TicketStatus] Error:', err);
        return res.status(500).json({ err: { code: 'SERVER_ERROR', message: 'Internal server error.' }, data: null });
    }
};

module.exports = { createAIS140Request, getAIS140TicketStatus };
