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

// 🌍 ROUTES PUBLIQUES

// 📈 STATISTIQUES PUBLIQUES - GET /api/users/stats
router.get('/stats',
  optionalAuthMiddleware,
  userController.getPublicStats
);

// 👥 UTILISATEURS EN LIGNE - GET /api/users/online
router.get('/online',
  optionalAuthMiddleware,
  userController.getOnlineUsers
);

// 🔒 ROUTES PROTÉGÉES (authentification requise)

// 🔍 RECHERCHE D'UTILISATEURS - GET /api/users/search (DOIT ÊTRE AVANT /:id)
router.get('/search',
  authMiddleware,
  authValidator.getSearchUsersValidation(),
  logAuthenticatedRequests,
  userController.searchUsers
);

// 👤 PROFIL D'UN UTILISATEUR - GET /api/users/:id
router.get('/:id',
  authMiddleware,
  checkTokenExpiration,
  userController.getUserProfile
);

// ✏️ MISE À JOUR DE SON PROFIL - PUT /api/users/me
router.put('/me',
  authMiddleware,
  authValidator.getProfileUpdateValidation(),
  checkTokenExpiration,
  logAuthenticatedRequests,
  userController.updateMyProfile
);

// 🎯 MISE À JOUR DU STATUT - PUT /api/users/me/status
router.put('/me/status',
  authMiddleware,
  authValidator.getUpdateStatusValidation(),
  userController.updateMyStatus
);

// 📊 STATISTIQUES DÉTAILLÉES - GET /api/users/me/stats
router.get('/me/stats',
  authMiddleware,
  checkTokenExpiration,
  userController.getMyStats
);

// 👥 LISTE DE MES CONTACTS - GET /api/users/me/contacts
router.get('/me/contacts',
  authMiddleware,
  checkTokenExpiration,
  userController.getMyContacts
);

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

module.exports = router;