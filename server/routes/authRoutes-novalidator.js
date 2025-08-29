const express = require('express');
const authController = require('../controllers/authController');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// ================================================
// ROUTES DE BASE SANS VALIDATORS
// ================================================

// 📝 INSCRIPTION - SANS VALIDATION pour test
router.post('/register', 
  authController.register
);

// 🔐 CONNEXION - SANS VALIDATION pour test
router.post('/login',
  authController.login
);

// 👤 PROFIL UTILISATEUR
router.get('/me',
  authMiddleware,
  authController.getMe
);

// 👋 DÉCONNEXION
router.post('/logout',
  authMiddleware,
  authController.logout
);

module.exports = router;