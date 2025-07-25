const express = require('express');
const { check, validationResult } = require('express-validator');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const emailService = require('../utils/emailService');

const router = express.Router();

// Simulasi database (dalam production gunakan database yang sesungguhnya)
let visitors = [];
let visitorCounter = {
    VIP: 1,
    SPR: 1,
    SPK: 1,
    PTC: 1
};

const categories = {
    1: { code: 'VIP', name: 'VIP', color: '#FFD700' },
    2: { code: 'SPR', name: 'Sponsor', color: '#FF6B35' },
    3: { code: 'SPK', name: 'Speaker', color: '#4ECDC4' },
    4: { code: 'PTC', name: 'Participant', color: '#45B7D1' }
};

// POST /api/register - Registrasi peserta baru
router.post('/register', [
    check('nama_lengkap', 'Nama lengkap wajib diisi').not().isEmpty().trim(),
    check('email', 'Email tidak valid').isEmail().normalizeEmail(),
    check('phone', 'Nomor telepon wajib diisi').not().isEmpty().trim(),
    check('category_id', 'Kategori tamu wajib dipilih').isInt({ min: 1, max: 4 }),
    check('event_id', 'Event ID wajib diisi').isInt({ min: 1 })
], async (req, res) => {
    try {
        // Validasi input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                message: 'Data tidak valid',
                errors: errors.array()
            });
        }

        const {
            nama_lengkap,
            email,
            phone,
            company,
            position,
            category_id,
            event_id,
            special_requirements,
            dietary_restrictions,
            emergency_contact,
            emergency_phone
        } = req.body;

        // Cek apakah email sudah terdaftar
        const existingVisitor = visitors.find(v => v.email === email);
        if (existingVisitor) {
            return res.status(409).json({
                message: 'Email sudah terdaftar sebelumnya'
            });
        }

        // Generate registration code
        const category = categories[category_id];
        const registrationCode = `${category.code}${String(visitorCounter[category.code]).padStart(3, '0')}`;
        visitorCounter[category.code]++;

        // Generate unique visitor ID
        const visitorId = uuidv4();

        // Create visitor data
        const visitor = {
            id: visitorId,
            registration_code: registrationCode,
            nama_lengkap,
            email,
            phone,
            company: company || null,
            position: position || null,
            category_id: parseInt(category_id),
            event_id: parseInt(event_id),
            special_requirements: special_requirements || null,
            dietary_restrictions: dietary_restrictions || null,
            emergency_contact: emergency_contact || null,
            emergency_phone: emergency_phone || null,
            status: 'registered',
            registered_at: new Date().toISOString(),
            created_at: new Date().toISOString()
        };

        // Generate QR Code data
        const qrData = {
            id: visitor.id,
            registration_code: registrationCode,
            nama_lengkap,
            email,
            category: category.name,
            event_id,
            timestamp: Date.now(),
            checksum: generateChecksum(visitor.id + registrationCode + email)
        };

        // Encrypt QR data
        const encryptedData = encryptData(JSON.stringify(qrData));
        
        // Generate QR Code
        const qrCodeResult = await generateQRCode(encryptedData, registrationCode);
        
        // Update visitor with QR code info
        visitor.qr_code_data = encryptedData;
        visitor.qr_code_url = qrCodeResult.url;

        // Save visitor (dalam production, simpan ke database)
        visitors.push(visitor);

        // Send response
        res.status(201).json({
            message: 'Registrasi berhasil',
            registration_code: registrationCode,
            nama_lengkap,
            email,
            category: category.name,
            qr_code_url: qrCodeResult.url,
            status: 'registered'
        });

        // Send email with QR code
        emailService.sendRegistrationConfirmation(visitor);

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            message: 'Terjadi kesalahan server',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// GET /api/qr/:code - Download QR code
router.get('/qr/:code', async (req, res) => {
    try {
        const { code } = req.params;
        
        // Cari visitor berdasarkan registration code
        const visitor = visitors.find(v => v.registration_code === code);
        
        if (!visitor) {
            return res.status(404).json({
                message: 'Kode registrasi tidak ditemukan'
            });
        }

        const qrCodePath = path.join(__dirname, '../../../public/assets/qr-codes', `${code}.png`);
        
        // Cek apakah file QR code ada
        try {
            await fs.access(qrCodePath);
            res.sendFile(qrCodePath);
        } catch (error) {
            res.status(404).json({
                message: 'QR Code tidak ditemukan'
            });
        }

    } catch (error) {
        console.error('QR Code fetch error:', error);
        res.status(500).json({
            message: 'Terjadi kesalahan server'
        });
    }
});

// GET /api/event-info - Informasi acara
router.get('/event-info', (req, res) => {
    res.json({
        nama_acara: 'Tech Conference 2024',
        tanggal: '2024-08-15',
        waktu_mulai: '08:00',
        waktu_selesai: '18:00',
        lokasi: 'Jakarta Convention Center',
        deskripsi: 'Konferensi teknologi terbesar tahun ini',
        categories: Object.values(categories).map(cat => ({
            id: Object.keys(categories).find(key => categories[key] === cat),
            ...cat
        }))
    });
});

// GET /api/stats - Statistik publik (opsional)
router.get('/stats', (req, res) => {
    const stats = {
        total_registered: visitors.length,
        by_category: {}
    };

    Object.values(categories).forEach(cat => {
        stats.by_category[cat.name] = visitors.filter(v => v.category_id === parseInt(
            Object.keys(categories).find(key => categories[key] === cat)
        )).length;
    });

    res.json(stats);
});

// Utility functions
async function generateQRCode(data, filename) {
    try {
        // Pastikan direktori QR codes ada
        const qrDir = path.join(__dirname, '../../../public/assets/qr-codes');
        await fs.mkdir(qrDir, { recursive: true });

        const qrPath = path.join(qrDir, `${filename}.png`);
        
        // Generate QR code
        await QRCode.toFile(qrPath, data, {
            width: parseInt(process.env.QR_CODE_SIZE) || 300,
            margin: parseInt(process.env.QR_CODE_MARGIN) || 4,
            color: {
                dark: process.env.QR_CODE_COLOR_DARK || '#000000',
                light: process.env.QR_CODE_COLOR_LIGHT || '#FFFFFF'
            }
        });

        return {
            path: qrPath,
            url: `/assets/qr-codes/${filename}.png`
        };
    } catch (error) {
        throw new Error(`Failed to generate QR code: ${error.message}`);
    }
}

function encryptData(data) {
    // Simple encryption - dalam production gunakan encryption yang lebih kuat
    const cipher = crypto.createCipher('aes192', process.env.JWT_SECRET);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

function decryptData(encryptedData) {
    const decipher = crypto.createDecipher('aes192', process.env.JWT_SECRET);
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

function generateChecksum(data) {
    return crypto.createHash('md5').update(data).digest('hex').substring(0, 8);
}

module.exports = router;
