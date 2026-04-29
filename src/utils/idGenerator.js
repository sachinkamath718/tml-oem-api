const { v4: uuidv4 } = require('uuid');

/** Helper: format a Date as IST ISO string using Node.js IANA timezone DB */
function _formatIST(d) {
    // sv-SE locale gives 'YYYY-MM-DD HH:mm:ss' — clean to convert to ISO
    const fmt = new Intl.DateTimeFormat('sv-SE', {
        timeZone:       'Asia/Kolkata',
        year:           'numeric',
        month:          '2-digit',
        day:            '2-digit',
        hour:           '2-digit',
        minute:         '2-digit',
        second:         '2-digit',
        hour12:         false,
    });
    return fmt.format(d).replace(' ', 'T') + '+05:30';
}

/** Returns current IST time as ISO string (UTC+5:30) */
function nowIST() {
    return _formatIST(new Date());
}

/**
 * Converts a MySQL TIMESTAMP/DATETIME/Date to IST ISO string.
 * Handles both Date objects and MySQL strings ('YYYY-MM-DD HH:MM:SS').
 */
function toIST(date) {
    if (!date) return null;
    // If it's a Date object, use directly
    // If it's a MySQL string like '2026-04-29 11:52:19', append Z to parse as UTC
    const d = date instanceof Date
        ? date
        : new Date(String(date).replace(' ', 'T') + 'Z');
    if (isNaN(d.getTime())) return null;
    return _formatIST(d);
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
