const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticateToken } = require('agriconnect-shared/middleware/auth');

router.get('/', authenticateToken, notificationController.getNotifications);
router.get('/list', authenticateToken, notificationController.getNotifications);
router.get('/unread-count', authenticateToken, notificationController.getUnreadCount);
router.post('/send', authenticateToken, notificationController.sendNotification);
router.put('/read-all', authenticateToken, notificationController.markAllRead);
router.put('/:id/read', authenticateToken, notificationController.markAsRead);

module.exports = router;
