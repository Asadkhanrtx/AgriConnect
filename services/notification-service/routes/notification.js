const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('agriconnect-shared/middleware/auth');

router.get('/', authenticateToken, notificationController.getNotifications);
router.post('/send', authenticateToken, notificationController.sendNotification); // Internal simulation endpoint
router.put('/:id/read', authenticateToken, notificationController.markAsRead);

module.exports = router;
