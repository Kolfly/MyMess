const express = require('express');
const userController = require('../controllers/userController');
const authValidator = require('../validators/authValidator');
const { 
  authMiddleware, 
  optionalAuthMiddleware,
  logAuthenticatedRequests,
  checkTokenExpiration
} = require('../middleware/authMiddleware');

const router = express.Router();

// 🧪 ROUTE DE TEST - GET /api/users/test
router.get('/test',
  authMiddleware,
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Routes utilisateur fonctionnelles !',
      data: {
        authenticatedUser: {
          id: req.user.id,
          username: req.user.username,
          email: req.user.email
        },
        timestamp: new Date().toISOString()
      }
    });
  }
);

// 📈 STATISTIQUES PUBLIQUES - GET /api/users/stats
router.get('/stats',
  optionalAuthMiddleware,
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Statistiques utilisateur',
      data: {
        totalUsers: 100,
        onlineUsers: 25
      },
      timestamp: new Date().toISOString()
    });
  }
);

// 🔍 RECHERCHE AVEC VALIDATION ET USERCONTROLLER - GET /api/users/search
router.get('/search',
  authMiddleware,
  authValidator.getSearchUsersValidation(),
  logAuthenticatedRequests,
  userController.searchUsers
);

// 📊 ROUTE AVEC TOUS LES MIDDLEWARES - GET /api/users/me/stats
router.get('/me/stats',
  authMiddleware,
  checkTokenExpiration,
  logAuthenticatedRequests,
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Route avec tous les middlewares fonctionne',
      user: {
        id: req.user.id,
        username: req.user.username
      },
      timestamp: new Date().toISOString()
    });
  }
);

// 📈 TEST AVEC USER CONTROLLER - GET /api/users/online
router.get('/online',
  optionalAuthMiddleware,
  userController.getOnlineUsers
);

// 📊 STATISTIQUES UTILISATEUR - GET /api/users/statistics
router.get('/statistics',
  authMiddleware,
  checkTokenExpiration,
  userController.getUserStatistics
);

// 👤 PROFIL UTILISATEUR PAR ID - GET /api/users/:userId
router.get('/:userId',
  authMiddleware,
  checkTokenExpiration,
  userController.getUserById
);

// ✏️ MISE À JOUR PROFIL - PUT /api/users/profile
router.put('/profile',
  authMiddleware,
  authValidator.getProfileUpdateValidation(),
  logAuthenticatedRequests,
  userController.updateUserProfile
);

// 🎯 MISE À JOUR STATUT - PUT /api/users/status
router.put('/status',
  authMiddleware,
  authValidator.getUpdateStatusValidation(),
  userController.updateUserStatus
);

// 🌍 PROFIL PUBLIC - GET /api/users/public/:userId
router.get('/public/:userId',
  optionalAuthMiddleware,
  userController.getPublicProfile
);

// ✅ VÉRIFICATION USERNAME - GET /api/users/check/username/:username
router.get('/check/username/:username',
  userController.checkUsernameAvailability
);

// ✅ VÉRIFICATION EMAIL - GET /api/users/check/email/:email
router.get('/check/email/:email',
  userController.checkEmailAvailability
);

// 🔄 MISE À JOUR LAST SEEN - PUT /api/users/last-seen
router.put('/last-seen',
  authMiddleware,
  userController.updateLastSeen
);

module.exports = router;