const express = require('express');
const router = express.Router();

// Placeholder admin routes
// TODO: Implement full admin functionality

router.get('/dashboard', (req, res) => {
    res.json({ message: 'Admin dashboard endpoint - coming soon' });
});

router.get('/visitors', (req, res) => {
    res.json({ message: 'Admin visitors endpoint - coming soon' });
});

router.post('/checkin', (req, res) => {
    res.json({ message: 'Admin checkin endpoint - coming soon' });
});

module.exports = router;
