const { v4: uuidv4 } = require('uuid');

/** Returns current IST time as ISO string (UTC+5:30) */
function nowIST() {
    const utcMs = Date.now();
    const ist   = new Date(utcMs + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().replace('Z', '+05:30');
}

/**
 * Converts a MySQL TIMESTAMP/DATETIME value to IST ISO string.
 * Handles both Date objects and MySQL datetime strings ('YYYY-MM-DD HH:MM:SS').
 */
function toIST(date) {
    if (!date) return null;
    let utcMs;
    if (date instanceof Date) {
        utcMs = date.getTime();
    } else {
        // MySQL returns strings like '2026-04-29 11:48:37'
        // Append 'Z' to force UTC interpretation
        const isoStr = String(date).replace(' ', 'T').replace(/(\.\d+)?$/, 'Z');
        utcMs = new Date(isoStr).getTime();
    }
    const ist = new Date(utcMs + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().replace('Z', '+05:30');
}

/** Returns IST datetime as Unix ms (for numeric updated_at fields) */
function toISTMs(date) {
    if (!date) return null;
    return new Date(date).getTime(); // keep as UTC ms, display IST in string fields
}

function generateTrackingId() {
    const ts   = Date.now();
    const rand = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase(); // 8 chars = 32-bit randomness
    return `TRK-${ts}-${rand}`;
}

function generateTicketId() {
    return uuidv4().replace(/-/g, '').substring(0, 10).toUpperCase(); // 10 chars for extra uniqueness
}

function generateOrderNumber() {
    // Use IST date for order number
    const ist  = new Date(new Date().getTime() + 5.5 * 60 * 60 * 1000);
    const date = ist.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = uuidv4().replace(/-/g, '').substring(0, 6).toUpperCase();
    return `ORD-${date}-${rand}`;
}

module.exports = { generateTrackingId, generateTicketId, generateOrderNumber, nowIST, toIST, toISTMs };
