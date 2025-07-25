const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

// Import routes
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const authRoutes = require('./routes/auth');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'", "https://cdn.jsdelivr.net"]
        }
    }
}));

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://your-domain.com'] 
        : ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX), // limit each IP to 100 requests per windowMs
    message: {
        error: 'Terlalu banyak request dari IP ini, silakan coba lagi nanti.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/api', limiter);

// Body parsing middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, '../../public')));
app.use('/admin', express.static(path.join(__dirname, '../../admin')));

// Logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url} - ${req.ip}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV 
    });
});

// API Routes
app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/auth', authRoutes);

// Serve main pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/index.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, '../../public/register.html'));
});

app.get('/admin', (req, res) => {
    res.redirect('/admin/login.html');
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        error: 'API endpoint tidak ditemukan',
        path: req.originalUrl
    });
});

// 404 handler for other routes
app.use('*', (req, res) => {
    res.status(404).sendFile(path.join(__dirname, '../../public/404.html'));
});

// Error handling middleware
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});

// Start server
const server = app.listen(PORT, () => {
    logger.info(`🚀 Server berjalan di port ${PORT}`);
    logger.info(`📱 Public URL: http://localhost:${PORT}`);
    logger.info(`👤 Admin URL: http://localhost:${PORT}/admin`);
    logger.info(`🔗 API Docs: http://localhost:${PORT}/api/docs`);
    logger.info(`🌍 Environment: ${process.env.NODE_ENV}`);
});

module.exports = app;
