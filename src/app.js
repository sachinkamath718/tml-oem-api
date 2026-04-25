require('dotenv').config();
const express = require('express');

const authRoutes  = require('./routes/auth');
const orderRoutes = require('./routes/orders');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ──────────────────────────────────────────────────
app.use('/api/auth',   authRoutes);
app.use('/api/orders', orderRoutes);

// ─── Health check ─────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'TML OEM API', time: new Date().toISOString() });
});

// ─── Landing page ─────────────────────────────────────────────
app.get('/', (_req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>TML OEM API</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; padding: 40px 20px; }
    .container { max-width: 820px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 48px; }
    .badge { display: inline-block; background: #10b981; color: #fff; font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 99px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; }
    h1 { font-size: 36px; font-weight: 800; color: #f8fafc; margin-bottom: 8px; }
    .subtitle { color: #94a3b8; font-size: 16px; }
    .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #64748b; margin-bottom: 16px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 12px; overflow: hidden; margin-bottom: 12px; }
    .endpoint { display: flex; align-items: flex-start; gap: 16px; padding: 20px 24px; }
    .endpoint:not(:last-child) { border-bottom: 1px solid #334155; }
    .badge-method { font-size: 11px; font-weight: 800; padding: 3px 10px; border-radius: 6px; min-width: 52px; text-align: center; flex-shrink: 0; margin-top: 2px; }
    .post { background: #14532d; color: #4ade80; }
    .get  { background: #1e3a5f; color: #60a5fa; }
    .path { font-family: monospace; font-size: 15px; color: #f1f5f9; font-weight: 600; margin-bottom: 4px; }
    .desc { font-size: 13px; color: #94a3b8; }
    .status { display: flex; align-items: center; justify-content: space-between; background: #134e4a; border: 1px solid #0f766e; border-radius: 10px; padding: 16px 24px; margin-top: 32px; }
    .status-dot { width: 10px; height: 10px; background: #10b981; border-radius: 50%; display: inline-block; margin-right: 8px; animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="badge">v1.0.0</div>
      <h1>TML OEM API</h1>
      <p class="subtitle">Tata Motors / OEM Integration — Orders, Shipment, Installation, AIS140, Mining</p>
    </div>

    <p class="section-title">Authentication</p>
    <div class="card">
      <div class="endpoint">
        <span class="badge-method post">POST</span>
        <div>
          <div class="path">/api/auth/token</div>
          <div class="desc">Generate a Bearer JWT token using client_id + client_secret. Valid for 12 hours.</div>
        </div>
      </div>
    </div>

    <p class="section-title" style="margin-top:24px">Orders</p>
    <div class="card">
      <div class="endpoint">
        <span class="badge-method post">POST</span>
        <div>
          <div class="path">/api/orders/create</div>
          <div class="desc">Create a new order with multiple vehicles (VINs). Auto-generates 1 tracking ID + 1 ticket per VIN. Supports multiple dispatch locations.</div>
        </div>
      </div>
      <div class="endpoint">
        <span class="badge-method get">GET</span>
        <div>
          <div class="path">/api/orders/status?order_number=ORD-...</div>
          <div class="desc">Get full order status, all vehicle tickets, dispatch summary, and audit history. Query by <code style="color:#818cf8">order_number</code>, <code style="color:#818cf8">tracking_id</code>, or <code style="color:#818cf8">vin</code>.</div>
        </div>
      </div>
    </div>

    <p class="section-title" style="margin-top:24px">Utilities</p>
    <div class="card">
      <div class="endpoint">
        <span class="badge-method get">GET</span>
        <div>
          <div class="path">/health</div>
          <div class="desc">Service health check. Returns status and current timestamp.</div>
        </div>
      </div>
    </div>

    <div class="status">
      <span><span class="status-dot"></span><strong>API is running</strong> on port ${process.env.PORT || 3000}</span>
      <span style="color:#94a3b8;font-size:13px">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</span>
    </div>
  </div>
</body>
</html>`);
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

// ─── Start server ─────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`TML OEM API running on http://localhost:${PORT}`);
    console.log(`Available endpoints:`);
    console.log(`  POST  /api/auth/token       → Generate token`);
    console.log(`  POST  /api/orders/create    → Create order`);
    console.log(`  GET   /api/orders/status    → Get order status`);
    console.log(`  GET   /health               → Health check`);
});
