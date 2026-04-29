const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host:               process.env.DB_HOST     || 'localhost',
    port:               parseInt(process.env.DB_PORT || '3306'),
    user:               process.env.DB_USER     || 'root',
    password:           process.env.DB_PASSWORD || '',
    database:           process.env.DB_NAME     || 'railway',
    waitForConnections: true,
    connectionLimit:    2,      // Keep low for serverless
    queueLimit:         0,
    connectTimeout:     30000,  // 30s timeout for cold starts
    timezone:           '+00:00', // Always read/write timestamps as UTC — toIST() converts to IST for responses
    ssl:                { rejectUnauthorized: false }, // Required for Railway
});

module.exports = pool;

