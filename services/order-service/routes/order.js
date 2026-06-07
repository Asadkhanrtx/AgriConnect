const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticateToken, requireRole } = require('agriconnect-shared/middleware/auth');

// Buyer
router.post('/create', authenticateToken, requireRole(['BUYER']), orderController.createOrder);
router.get('/my-orders', authenticateToken, requireRole(['BUYER']), orderController.getBuyerOrders);

// Farmer
router.get('/sales', authenticateToken, requireRole(['FARMER']), orderController.getFarmerSales);
router.put('/:id/status', authenticateToken, requireRole(['FARMER']), orderController.updateOrderStatus);

// Admin
router.get('/admin/all', authenticateToken, requireRole(['ADMIN']), orderController.getAdminOrders);

module.exports = router;
