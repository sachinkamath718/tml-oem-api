const pool = require('../config/db');
const { generateTrackingId, generateTicketId, generateOrderNumber } = require('../utils/idGenerator');

/**
 * POST /api/orders/create
 * Creates order with customer details, location_mappings, vehicle details, products
 */
const createOrder = async (req, res) => {
    const conn = await pool.getConnection();
    try {
        const { order_id, device_type, customer_details, location_mappings } = req.body;
        const clientId = req.client.client_id;
        const clientRefId = req.client.client_ref_id;

        if (!location_mappings || !Array.isArray(location_mappings) || location_mappings.length === 0) {
            return res.status(400).json({ success: false, err: { code: 'INVALID_DATA', message: 'location_mappings is required and must be a non-empty array.' }, data: null });
        }

        // Flatten all vehicles
        const allVehicles = [];
        for (const mapping of location_mappings) {
            const { location, spoc, vehicle_details } = mapping;
            if (!vehicle_details || !Array.isArray(vehicle_details)) continue;
            for (const v of vehicle_details) {
                if (!v.vin) return res.status(400).json({ success: false, err: { code: 'INVALID_DATA', message: 'Each vehicle must have a vin.' }, data: null });
                allVehicles.push({ ...v, location, spoc });
            }
        }

        if (allVehicles.length === 0) {
            return res.status(400).json({ success: false, err: { code: 'INVALID_DATA', message: 'No vehicles found in location_mappings.' }, data: null });
        }

        const orderNumber  = generateOrderNumber();
        const trackingId   = generateTrackingId();
        const orderCreatedAt = new Date().toISOString();

        await conn.beginTransaction();

        // Insert order
        const [orderResult] = await conn.execute(
            `INSERT INTO orders (order_number, tml_order_id, tracking_id, client_ref_id, oem_name, device_type, total_vehicles, status, customer_details, created_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
            [
                orderNumber,
                order_id || null,
                trackingId,
                clientRefId,
                customer_details?.name || null,
                device_type || null,
                allVehicles.length,
                JSON.stringify(customer_details || {}),
                clientId,
            ]
        );
        const orderId = orderResult.insertId;

        // Insert vehicles + SPOC details
        const tickets = [];
        for (const vehicle of allVehicles) {
            const ticketId = generateTicketId();
            const hasAIS140  = (vehicle.products || []).some(p => p.name === 'AIS140');
            const hasMINING  = (vehicle.products || []).some(p => p.name === 'MINING');
            const ais140TicketNo = hasAIS140 ? `AIS-${ticketId}` : null;
            const miningTicketNo = hasMINING  ? `MIN-${ticketId}` : null;

            await conn.execute(
                `INSERT INTO order_vehicles
                 (order_id, vin, ticket_id, tracking_id, dispatch_location,
                  registration_no, engine_no, model, make, variant, mfg_year,
                  fuel_type, emission_type, rto_office_code, rto_state,
                  products, ais140_ticket_no, mining_ticket_no, status)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')`,
                [
                    orderId, vehicle.vin, ticketId, trackingId,
                    vehicle.location?.address || vehicle.location?.city || null,
                    vehicle.registration_no || null,
                    vehicle.engine_no       || null,
                    vehicle.model           || null,
                    vehicle.make            || null,
                    vehicle.variant         || null,
                    vehicle.mfg_year        || null,
                    vehicle.fuel_type       || null,
                    vehicle.emission_type   || null,
                    vehicle.rto_office_code || null,
                    vehicle.rto_state       || null,
                    JSON.stringify(vehicle.products || []),
                    ais140TicketNo,
                    miningTicketNo,
                ]
            );

            // Save SPOC if provided
            if (vehicle.spoc?.name) {
                await conn.execute(
                    `INSERT INTO spoc_details (tracking_id, name, contact_no, email) VALUES (?,?,?,?)`,
                    [trackingId, vehicle.spoc.name, vehicle.spoc.contact_number || '', vehicle.spoc.email || '']
                );
            }

            tickets.push({
                vin:               vehicle.vin,
                order_tracking_id: trackingId,
                ais140_ticket_no:  ais140TicketNo,
                mining_ticket_no:  miningTicketNo,
            });
        }

        // Audit log
        await conn.execute(
            `INSERT INTO order_status_history (order_id, stage, to_status, changed_by, notes, metadata)
             VALUES (?, 'ORDER_CREATED', 'pending', ?, 'Order created', ?)`,
            [orderId, clientId, JSON.stringify({ event: 'order_created', timestamp: orderCreatedAt, total_vins: allVehicles.length })]
        );

        await conn.commit();

        return res.status(200).json({ success: true, err: null, data: tickets });

    } catch (err) {
        await conn.rollback();
        console.error('[createOrder] Error:', err);
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, err: { code: 'DUPLICATE_VIN', message: 'One or more VINs already exist in the system.' }, data: null });
        }
        return res.status(500).json({ success: false, err: { code: 'SERVER_ERROR', message: 'Internal server error.' }, data: null });
    } finally {
        conn.release();
    }
};

module.exports = { createOrder };

