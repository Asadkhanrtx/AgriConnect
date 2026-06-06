const express = require('express');
const router = express.Router();
const multer = require('multer');
const mediaController = require('../controllers/mediaController');
const { authenticateToken, requireRole } = require('agriconnect-shared/middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload/produce', authenticateToken, requireRole(['FARMER']), upload.single('image'), mediaController.uploadProduceImage);
router.post('/upload/proof', authenticateToken, requireRole(['FARMER', 'BUYER']), upload.single('image'), mediaController.uploadDeliveryProof);

module.exports = router;
