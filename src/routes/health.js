const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const logger = require('../utils/logger');

/**
 * GET /health
 * Health check endpoint untuk monitoring aplikasi
 */
router.get('/', async (req, res) => {
    const healthCheck = {
        uptime: process.uptime(),
        message: 'OK',
        timestamp: new Date().toISOString(),
        checks: {
            database: 'unknown',
            memory: 'ok',
            disk: 'ok'
        }
    };

    try {
        // Check database connection
        const dbResult = await pool.query('SELECT 1 as test');
        if (dbResult.rows.length > 0) {
            healthCheck.checks.database = 'ok';
        } else {
            healthCheck.checks.database = 'error';
        }
    } catch (error) {
        logger.error('Database health check failed:', error);
        healthCheck.checks.database = 'error';
        healthCheck.message = 'Database connection failed';
    }

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    healthCheck.memory = {
        used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
        total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
        external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
    };

    // Determine overall health status
    const isHealthy = Object.values(healthCheck.checks).every(check => check === 'ok');
    
    if (isHealthy) {
        res.status(200).json(healthCheck);
    } else {
        res.status(503).json(healthCheck);
    }
});

/**
 * GET /health/ready
 * Readiness probe untuk Kubernetes
 */
router.get('/ready', async (req, res) => {
    try {
        // Check if database is ready
        await pool.query('SELECT 1');
        
        res.status(200).json({
            status: 'ready',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Readiness check failed:', error);
        res.status(503).json({
            status: 'not ready',
            error: 'Database not available',
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /health/live
 * Liveness probe untuk Kubernetes
 */
router.get('/live', (req, res) => {
    res.status(200).json({
        status: 'alive',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
