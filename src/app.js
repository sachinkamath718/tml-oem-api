require('dotenv').config();
const express = require('express');

const authRoutes   = require('./routes/auth');
const orderRoutes  = require('./routes/orders');
const ais140Routes = require('./routes/ais140');
const miningRoutes = require('./routes/mining');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ──────────────────────────────────────────────────
app.use('/api/auth',   authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/ais140', ais140Routes);
app.use('/api/mining', miningRoutes);

// ─── Health check ─────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'TML OEM API', time: new Date().toISOString() });
});

// ─── API info ─────────────────────────────────────────────────
app.get('/', (_req, res) => {
    res.json({
        service:  'TML OEM API',
        version:  'v1.0.0',
        status:   'running',
        endpoints: {
            auth:         'POST /api/auth/token',
            create_order: 'POST /api/orders/create',
            order_status: 'GET  /api/orders/status',
            spoc_update:  'PUT  /api/orders/fitment/spoc',
            ais140:       'POST /api/ais140',
            mining:       'POST /api/mining',
            health:       'GET  /health',
        }
    });
});

// ─── 404 handler ──────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` });
});

// ─── Global error handler ─────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error('[UNHANDLED ERROR]', err);
    res.status(500).json({ success: false, message: 'Internal server error.' });
});

// ─── Start server (local only) ────────────────────────────────
// On Vercel, the app is exported and used as a serverless function.
// Locally, it starts a normal HTTP server.
if (process.env.VERCEL !== '1') {
    app.listen(PORT, () => {
        console.log(`TML OEM API running on http://localhost:${PORT}`);
        console.log(`Available endpoints:`);
        console.log(`  POST  /api/auth/token       → Generate token`);
        console.log(`  POST  /api/orders/create    → Create order`);
        console.log(`  GET   /api/orders/status    → Get order status`);
        console.log(`  GET   /health               → Health check`);
    });
}

module.exports = app;
