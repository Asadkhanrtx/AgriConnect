const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken, requireRole } = require('agriconnect-shared/middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authenticateToken, authController.getMe);

// Admin only
router.get('/admin/stats', authenticateToken, requireRole(['ADMIN']), authController.getAdminStats);
router.get('/admin/users', authenticateToken, requireRole(['ADMIN']), authController.getAdminUsers);

module.exports = router;
