const { Pool } = require('pg');
const logger = require('../src/utils/logger');

class Database {
    constructor() {
        this.pool = null;
        this.init();
    }

    init() {
        const config = {
            host: process.env.DB_HOST,
            port: parseInt(process.env.DB_PORT) || 5432,
            database: process.env.DB_NAME,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            max: parseInt(process.env.DB_POOL_MAX) || 20,
            idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT) || 30000,
            connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 2000,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        };

        this.pool = new Pool(config);

        this.pool.on('connect', () => {
            logger.info('Database connected successfully');
        });

        this.pool.on('error', (err) => {
            logger.error('Database connection error:', err);
        });
    }

    async query(text, params) {
        const start = Date.now();
        try {
            const res = await this.pool.query(text, params);
            const duration = Date.now() - start;
            logger.debug('Query executed', { text, duration, rows: res.rowCount });
            return res;
        } catch (error) {
            logger.error('Database query error:', { text, error: error.message });
            throw error;
        }
    }

    async getClient() {
        return await this.pool.connect();
    }

    async close() {
        await this.pool.end();
    }

    // Health check
    async healthCheck() {
        try {
            const result = await this.query('SELECT NOW()');
            return { status: 'healthy', timestamp: result.rows[0].now };
        } catch (error) {
            return { status: 'unhealthy', error: error.message };
        }
    }
}

module.exports = new Database();
