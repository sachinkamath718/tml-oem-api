const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host:               process.env.DB_HOST     || 'localhost',
    port:               parseInt(process.env.DB_PORT || '3306'),
    user:               process.env.DB_USER     || 'root',
    password:           process.env.DB_PASSWORD || '',
    database:           process.env.DB_NAME     || 'railway',
    waitForConnections: true,
    connectionLimit:    2,
    queueLimit:         0,
    connectTimeout:     30000,
    timezone:           '+00:00',    // DB stores/sends timestamps in UTC
    dateStrings:        true,        // Return ALL dates as strings → toIST() handles conversion
    ssl:                { rejectUnauthorized: false },
});

module.exports = pool;

