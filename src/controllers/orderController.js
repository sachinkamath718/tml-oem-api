const pool = require('../config/db');
const { generateTrackingId, generateTicketId, generateOrderNumber, nowIST } = require('../utils/idGenerator');

const createOrder = async (req, res) => {
    let conn = null;
    try {
        const { order_id, device_type, customer_details, location_mappings } = req.body;
        const clientId    = req.client.client_id;
        const clientRefId = req.client.client_ref_id;

        if (!order_id || !customer_details || !Array.isArray(location_mappings) || location_mappings.length === 0) {
            return res.status(400).json({ err: { code: 'INVALID_DATA', message: 'Invalid vehicle details provided' }, data: null });
        }
        if (!customer_details.name || !customer_details.email || !customer_details.contact_number) {
            return res.status(400).json({ err: { code: 'INVALID_DATA', message: 'Invalid vehicle details provided' }, data: null });
        }

        const allVehicles = [];
        const vinSet      = new Set();
        for (const mapping of location_mappings) {
            const { location, spoc, vehicle_details } = mapping;
            if (!Array.isArray(vehicle_details) || vehicle_details.length === 0) {
                return res.status(400).json({ err: { code: 'INVALID_DATA', message: 'Invalid vehicle details provided' }, data: null });
            }
            for (const v of vehicle_details) {
                if (!v.vin || !v.registration_no || !v.engine_no || !v.model ||
                    !v.make || !v.mfg_year || !v.fuel_type || !v.emission_type ||
                    !v.rto_office_code || !v.rto_state) {
                    return res.status(400).json({ err: { code: 'INVALID_DATA', message: 'Invalid vehicle details provided' }, data: null });
                }
                if (vinSet.has(v.vin)) {
                    return res.status(400).json({ err: { code: 'INVALID_DATA', message: 'Invalid vehicle details provided' }, data: null });
                }
                vinSet.add(v.vin);
                allVehicles.push({ ...v, location, spoc });
            }
        }

        const orderNumber     = generateOrderNumber();
        const orderTrackingId = generateTrackingId();
        const createdAtIST    = nowIST();

        conn = await pool.connect();
        await conn.query('BEGIN');

        // Insert order
        const orderResult = await conn.query(
            `INSERT INTO orders
             (order_number, tml_order_id, tracking_id, client_ref_id, oem_name, device_type,
              total_vehicles, status, customer_details, created_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',$8,$9)
             RETURNING id`,
            [
                orderNumber, order_id, orderTrackingId, clientRefId,
                customer_details.name, device_type || null,
                allVehicles.length,
                customer_details,
                clientId,
            ]
        );
        const orderId = orderResult.rows[0].id;

        // Order-level audit log
        await conn.query(
            `INSERT INTO order_status_history (order_id, ticket_id, module, to_status, changed_by, notes, metadata)
             VALUES ($1,$2,'Orders','pending',$3,'Order created',$4)`,
            [orderId, orderTrackingId, clientId, {
                event:             'order_created',
                timestamp_ist:     createdAtIST,
                total_vins:        allVehicles.length,
                order_tracking_id: orderTrackingId,
            }]
        );

        const tickets = [];

        for (const vehicle of allVehicles) {
            const vehicleTrackingId = generateTrackingId();
            const ticketNo          = `TKT-${generateTicketId()}`;
            const hasAIS140         = (vehicle.products || []).some(p => p.name === 'AIS140');
            const hasMINING         = (vehicle.products || []).some(p => p.name === 'MINING');
            const ais140TicketNo    = hasAIS140 ? vehicleTrackingId : null;
            const miningTicketNo    = hasMINING  ? vehicleTrackingId : null;

            await conn.query(
                `INSERT INTO order_vehicles
                 (order_id, vin, ticket_id, tracking_id, dispatch_location,
                  registration_no, engine_no, model, make, variant, mfg_year,
                  fuel_type, emission_type, rto_office_code, rto_state,
                  products, ais140_ticket_no, mining_ticket_no, status)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'pending')`,
                [
                    orderId, vehicle.vin, ticketNo, vehicleTrackingId,
                    vehicle.location?.address || vehicle.location?.city || null,
                    vehicle.registration_no, vehicle.engine_no, vehicle.model,
                    vehicle.make, vehicle.variant || null, vehicle.mfg_year,
                    vehicle.fuel_type, vehicle.emission_type,
                    vehicle.rto_office_code, vehicle.rto_state,
                    vehicle.products || [],
                    ais140TicketNo, miningTicketNo,
                ]
            );

            // Shipment ticket
            await conn.query(
                `INSERT INTO shipment_tickets (ticket_no, vin, tracking_id, order_id, status) VALUES ($1,$2,$3,$4,'pending')`,
                [ticketNo, vehicle.vin, vehicleTrackingId, orderId]
            );

            // Delivery ticket
            await conn.query(
                `INSERT INTO delivery_tickets (ticket_no, vin, tracking_id, order_id, status, delivery_address) VALUES ($1,$2,$3,$4,'pending',$5)`,
                [ticketNo, vehicle.vin, vehicleTrackingId, orderId, vehicle.location?.address || null]
            );

            // Installation ticket
            await conn.query(
                `INSERT INTO installation_tickets (ticket_no, vin, tracking_id, order_id, status) VALUES ($1,$2,$3,$4,'pending')`,
                [ticketNo, vehicle.vin, vehicleTrackingId, orderId]
            );

            // AIS140 ticket
            if (hasAIS140) {
                const ais140Product = vehicle.products.find(p => p.name === 'AIS140');
                await conn.query(
                    `INSERT INTO ais140_tickets
                     (ticket_no, vin, tracking_id, order_tracking_id, vehicle_details, customer_details, status)
                     VALUES ($1,$2,$3,$4,$5,$6,'pending')`,
                    [
                        ais140TicketNo, vehicle.vin, vehicleTrackingId, orderTrackingId,
                        {
                            vin: vehicle.vin, engine_no: vehicle.engine_no,
                            reg_number: vehicle.registration_no, vehicle_model: vehicle.model,
                            make: vehicle.make, mfg_year: vehicle.mfg_year,
                            fuel_type: vehicle.fuel_type, emission_type: vehicle.emission_type,
                            rto_office_code: vehicle.rto_office_code, rto_state: vehicle.rto_state,
                            certificate_validity_duration_in_year: ais140Product?.duration_in_years || 2,
                        },
                        customer_details,
                    ]
                );
            }

            // Mining ticket
            if (hasMINING) {
                const miningProduct = vehicle.products.find(p => p.name === 'MINING');
                await conn.query(
                    `INSERT INTO mining_tickets
                     (mining_ticket_no, vin, tracking_id, order_tracking_id, vehicle_details, customer_details, status)
                     VALUES ($1,$2,$3,$4,$5,$6,'pending')`,
                    [
                        miningTicketNo, vehicle.vin, vehicleTrackingId, orderTrackingId,
                        {
                            vin: vehicle.vin, engine_no: vehicle.engine_no,
                            reg_number: vehicle.registration_no, vehicle_model: vehicle.model,
                            make: vehicle.make, mfg_year: vehicle.mfg_year,
                            department: miningProduct?.metadata?.department || null,
                            duration_in_year: miningProduct?.duration_in_years || 2,
                        },
                        customer_details,
                    ]
                );
            }

            // SPOC
            if (vehicle.spoc?.name) {
                await conn.query(
                    `INSERT INTO spoc_details (tracking_id, name, contact_no, email) VALUES ($1,$2,$3,$4)`,
                    [vehicleTrackingId, vehicle.spoc.name, vehicle.spoc.contact_number || '', vehicle.spoc.email || '']
                );
            }

            // Per-vehicle history
            await conn.query(
                `INSERT INTO order_status_history (order_id, ticket_id, module, vin, to_status, changed_by, notes, metadata)
                 VALUES ($1,$2,'Orders',$3,'pending',$4,'Vehicle registered in order',$5)`,
                [orderId, vehicleTrackingId, vehicle.vin, clientId, {
                    timestamp_ist:       createdAtIST,
                    vehicle_tracking_id: vehicleTrackingId,
                    ticket_no:           ticketNo,
                    ais140_ticket_no:    ais140TicketNo,
                    mining_ticket_no:    miningTicketNo,
                }]
            );

            tickets.push({
                vin:               vehicle.vin,
                order_tracking_id: vehicleTrackingId,
                ais140_ticket_no:  ais140TicketNo,
                mining_ticket_no:  miningTicketNo,
            });
        }

        await conn.query('COMMIT');
        return res.status(200).json({ err: null, data: tickets });

    } catch (err) {
        if (conn) await conn.query('ROLLBACK');
        console.error('[createOrder] Error:', err);
        if (err.code === '23505') { // pg unique violation
            return res.status(400).json({ err: { code: 'DUPLICATE_VIN', message: 'One or more VINs already exist in the system.' }, data: null });
        }
        return res.status(500).json({ err: { code: 'SERVER_ERROR', message: 'Internal server error.' }, data: null });
    } finally {
        if (conn) conn.release();
    }
};

module.exports = { createOrder };
