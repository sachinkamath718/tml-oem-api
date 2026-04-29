const { v4: uuidv4 } = require('uuid');

/** Returns current IST time as ISO string (UTC+5:30) */
function nowIST() {
    const d = new Date();
    const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().replace('Z', '+05:30');
}

/** Converts any date to IST ISO string */
function toIST(date) {
    if (!date) return null;
    const ist = new Date(new Date(date).getTime() + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().replace('Z', '+05:30');
}

/** Returns IST datetime as Unix ms (for numeric updated_at fields) */
function toISTMs(date) {
    if (!date) return null;
    return new Date(date).getTime(); // keep as UTC ms, display IST in string fields
}

function generateTrackingId() {
    const ts   = Date.now();
    const rand = uuidv4().replace(/-/g, '').substring(0, 6).toUpperCase();
    return `TRK-${ts}-${rand}`;
}

function generateTicketId() {
    return uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
}

function generateOrderNumber() {
    // Use IST date for order number
    const ist  = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000);
    const date = ist.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = uuidv4().replace(/-/g, '').substring(0, 6).toUpperCase();
    return `ORD-${date}-${rand}`;
}

module.exports = { generateTrackingId, generateTicketId, generateOrderNumber, nowIST, toIST, toISTMs };
