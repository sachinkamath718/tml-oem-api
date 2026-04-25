const jwt = require('jsonwebtoken');

/**
 * Middleware: Verify Bearer JWT token
 * Usage: router.get('/route', authenticate, handler)
 */
function authenticate(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'Authorization token missing or invalid format. Use: Bearer <token>',
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.client = decoded; // { client_id, client_name, client_ref_id }
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ success: false, message: 'Token expired. Please generate a new token.' });
        }
        return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
}

module.exports = { authenticate };
