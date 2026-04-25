const { v4: uuidv4 } = require('uuid');

/**
 * Generate a unique tracking ID
 * Format: TRK-<timestamp>-<random4chars>
 * Example: TRK-1714000000000-A3F2
 */
function generateTrackingId() {
    const ts = Date.now();
    const rand = uuidv4().replace(/-/g, '').substring(0, 6).toUpperCase();
    return `TRK-${ts}-${rand}`;
}

/**
 * Generate a unique ticket ID per VIN
 * Format: TKT-<random8chars>
 * Example: TKT-3F2A9B1C
 */
function generateTicketId() {
    return `TKT-${uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase()}`;
}

/**
 * Generate a unique order number
 * Format: ORD-<YYYYMMDD>-<random6>
 * Example: ORD-20250424-9A1B2C
 */
function generateOrderNumber() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = uuidv4().replace(/-/g, '').substring(0, 6).toUpperCase();
    return `ORD-${date}-${rand}`;
}

module.exports = { generateTrackingId, generateTicketId, generateOrderNumber };
