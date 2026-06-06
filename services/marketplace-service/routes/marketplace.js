const express = require('express');
const router = express.Router();
const marketplaceController = require('../controllers/marketplaceController');
const { authenticateToken, requireRole } = require('agriconnect-shared/middleware/auth');

// Public
router.get('/listings', marketplaceController.getAllListings);
router.get('/listings/:id', marketplaceController.getListingById);
router.get('/categories', marketplaceController.getCategories);

// Farmer only
router.get('/my-listings', authenticateToken, requireRole(['FARMER']), marketplaceController.getMyListings);
router.post('/listings', authenticateToken, requireRole(['FARMER']), marketplaceController.createListing);
router.put('/listings/:id', authenticateToken, requireRole(['FARMER']), marketplaceController.updateListing);
router.delete('/listings/:id', authenticateToken, requireRole(['FARMER']), marketplaceController.deleteListing);
router.put('/bids/:id/accept', authenticateToken, requireRole(['FARMER']), marketplaceController.acceptBid);
router.put('/bids/:id/reject', authenticateToken, requireRole(['FARMER']), marketplaceController.rejectBid);

// Buyer only
router.post('/bids', authenticateToken, requireRole(['BUYER']), marketplaceController.createBid);
router.get('/my-bids', authenticateToken, requireRole(['BUYER']), marketplaceController.getMyBids);

// Farmer & Buyer
router.get('/bids/:listingId', authenticateToken, marketplaceController.getBidsForListing);

module.exports = router;
