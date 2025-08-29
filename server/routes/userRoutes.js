const express = require('express');
const userController = require('../controllers/userController');
const authValidator = require('../validators/authValidator');
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// ================================================
// ROUTES UTILISATEURS PUBLIQUES
// ================================================

// 👁️ PROFIL PUBLIC D'UN UTILISATEUR - GET /api/users/profile/:username
router.get('/profile/:username',
  // Pas d'authentification requise pour voir un profil public
  userController.getPublicProfile
);

// ✅ VÉRIFIER LA DISPONIBILITÉ D'UN USERNAME - GET /api/users/check/username/:username
router.get('/check/username/:username',
  optionalAuthMiddleware, // Optionnel car utile pendant l'inscription
  userController.checkUsernameAvailability
);

// ✅ VÉRIFIER LA DISPONIBILITÉ D'UN EMAIL - GET /api/users/check/email/:email
router.get('/check/email/:email',
  optionalAuthMiddleware, // Optionnel car utile pendant l'inscription
  userController.checkEmailAvailability
);

// 📊 STATISTIQUES PUBLIQUES - GET /api/users/statistics
router.get('/statistics',
  optionalAuthMiddleware, // Optionnel - plus d'infos si connecté
  userController.getUserStatistics
);

// 🌐 UTILISATEURS EN LIGNE - GET /api/users/online
router.get('/online',
  authMiddleware, // Authentification requise
  userController.getOnlineUsers
);

// ================================================
// ROUTES UTILISATEURS PROTÉGÉES
// ================================================

// 🔍 RECHERCHER DES UTILISATEURS - GET /api/users/search
router.get('/search',
  authMiddleware,
  authValidator.getSearchUsersValidation(),
  userController.searchUsers
);

// ✏️ METTRE À JOUR SON PROFIL - PUT /api/users/profile
router.put('/profile',
  authMiddleware,
  authValidator.getProfileUpdateValidation(),
  userController.updateUserProfile
);

// 🔄 METTRE À JOUR SON STATUT - PUT /api/users/status
router.put('/status',
  authMiddleware,
  authValidator.getUpdateStatusValidation(),
  userController.updateUserStatus
);

// 👁️ METTRE À JOUR LA DERNIÈRE ACTIVITÉ - PUT /api/users/activity
router.put('/activity',
  authMiddleware,
  userController.updateLastSeen
);

// 👤 PROFIL UTILISATEUR SPÉCIFIQUE - GET /api/users/:userId
// IMPORTANT: Cette route doit être EN DERNIER car elle capture tout ce qui ne correspond pas aux routes spécifiques ci-dessus
router.get('/:userId',
  authMiddleware,
  userController.getUserById
);

// ================================================
// GESTION DES ERREURS
// ================================================

// 🚫 GESTION DES MÉTHODES NON AUTORISÉES
router.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} non trouvée`,
    code: 'USER_ROUTE_NOT_FOUND',
    availableRoutes: [
      'GET /api/users/profile/:username - Profil public',
      'GET /api/users/check/username/:username - Vérifier username',
      'GET /api/users/check/email/:email - Vérifier email',
      'GET /api/users/statistics - Statistiques',
      'GET /api/users/online - Utilisateurs en ligne',
      'GET /api/users/search - Rechercher',
      'GET /api/users/:userId - Profil utilisateur',
      'PUT /api/users/profile - Mettre à jour profil',
      'PUT /api/users/status - Mettre à jour statut',
      'PUT /api/users/activity - Mettre à jour activité'
    ]
  });
});

module.exports = router;