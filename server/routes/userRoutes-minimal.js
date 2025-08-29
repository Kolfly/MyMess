const express = require('express');
const userController = require('../controllers/userController-minimal');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// 📊 STATISTIQUES PUBLIQUES
router.get('/statistics',
  optionalAuthMiddleware,
  userController.getUserStatistics
);

// 🌐 UTILISATEURS EN LIGNE
router.get('/online',
  authMiddleware,
  userController.getOnlineUsers
);

// Fallback pour autres routes
router.all('*', userController.fallback);

module.exports = router;