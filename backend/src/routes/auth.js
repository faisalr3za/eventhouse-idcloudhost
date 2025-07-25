// Basic login route for admin
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');

const router = express.Router();

// Dummy user data (Replace with your database logic)
const users = [
    {
        id: 1,
        username: 'admin',
        full_name: 'Administrator',
        password_hash: '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36UmzA6TUfbiFNjxpXIf3Gm', // password "password"
        role: 'penyelenggara'
    },
    {
        id: 2,
        username: 'panitia1',
        full_name: 'Event Staff',
        password_hash: '$2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36UmzA6TUfbiFNjxpXIf3Gm', // password "password"
        role: 'panitia'
    }
];

// POST /api/auth/login
router.post('/login',
    [
        check('username', 'Username tidak boleh kosong').not().isEmpty(),
        check('password', 'Password tidak boleh kosong').not().isEmpty()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        // Check user data
        const { username, password } = req.body;
        const user = users.find(u => u.username === username);

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }

        // Generate JWT token
        const payload = {
            user: {
                id: user.id,
                role: user.role
            }
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                role: user.role
            }
        });
    }
);

// GET /api/auth/verify
// This can be used to check if the token is still valid
router.get('/verify', (req, res) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        res.json(decoded);
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
});

module.exports = router;
