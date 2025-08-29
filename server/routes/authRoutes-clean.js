const express = require('express');
const authController = require('../controllers/authController');
const authValidator = require('../validators/authValidator');
const { 
  authMiddleware, 
  optionalAuthMiddleware, 
  logAuthenticatedRequests,
  checkTokenExpiration
} = require('../middleware/authMiddleware');

const router = express.Router();

// 🌍 ROUTES PUBLIQUES (pas d'authentification requise)

// 📝 INSCRIPTION - POST /api/auth/register
router.post('/register', 
  authValidator.getRegisterValidation(),
  authController.register
);

// 🔐 CONNEXION - POST /api/auth/login
router.post('/login',
  authValidator.getLoginValidation(),
  authController.login
);

// 🔄 RENOUVELLEMENT DE TOKEN - POST /api/auth/refresh
router.post('/refresh',
  authValidator.getRefreshTokenValidation(),
  authController.refreshToken
);

// 📧 RENVOI D'EMAIL DE VÉRIFICATION - POST /api/auth/resend-verification
router.post('/resend-verification',
  authValidator.getResendVerificationValidation(),
  authController.resendVerification
);

// 🔒 ROUTES PROTÉGÉES (authentification requise)

// 👤 PROFIL UTILISATEUR - GET /api/auth/me
router.get('/me',
  authMiddleware,
  checkTokenExpiration,
  logAuthenticatedRequests,
  authController.getMe
);

// ✏️ MISE À JOUR DU PROFIL - PUT /api/auth/profile
router.put('/profile',
  authMiddleware,
  authValidator.getProfileUpdateValidation(),
  checkTokenExpiration,
  logAuthenticatedRequests,
  authController.updateProfile
);

// 🔐 CHANGEMENT DE MOT DE PASSE - PUT /api/auth/change-password
router.put('/change-password',
  authMiddleware,
  authValidator.getChangePasswordValidation(),
  logAuthenticatedRequests,
  authController.changePassword
);

// 🎯 MISE À JOUR DU STATUT - PUT /api/auth/status
router.put('/status',
  authMiddleware,
  authValidator.getUpdateStatusValidation(),
  authController.updateStatus
);

// 👋 DÉCONNEXION - POST /api/auth/logout
router.post('/logout',
  authMiddleware,
  logAuthenticatedRequests,
  authController.logout
);

// 📊 STATISTIQUES DU COMPTE - GET /api/auth/stats
router.get('/stats',
  authMiddleware,
  checkTokenExpiration,
  authController.getAccountStats
);

// 🔍 RECHERCHE D'UTILISATEURS - GET /api/auth/search
router.get('/search',
  authMiddleware,
  authValidator.getSearchUsersValidation(),
  async (req, res) => {
    try {
      const authService = require('../services/authService');
      const { q: query, limit = 10, offset = 0 } = req.query;
      
      const results = await authService.searchUsers(query, req.user.id, parseInt(limit));
      
      res.status(200).json({
        success: true,
        data: results,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: results.count
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Erreur recherche utilisateurs:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la recherche d\'utilisateurs',
        code: 'SEARCH_ERROR'
      });
    }
  }
);

// 📈 STATISTIQUES GLOBALES - GET /api/auth/global-stats
router.get('/global-stats',
  optionalAuthMiddleware,
  async (req, res) => {
    try {
      const authService = require('../services/authService');
      const stats = await authService.getUserStats();
      
      if (!req.user) {
        res.status(200).json({
          success: true,
          data: {
            totalUsers: stats.totalUsers,
            onlineUsers: stats.onlineUsers
          },
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(200).json({
          success: true,
          data: stats,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Erreur statistiques globales:', error);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques',
        code: 'GLOBAL_STATS_ERROR'
      });
    }
  }
);

// 🧪 ROUTE DE TEST - GET /api/auth/test
router.get('/test',
  authMiddleware,
  (req, res) => {
    res.status(200).json({
      success: true,
      message: 'Authentification fonctionnelle !',
      data: {
        authenticatedUser: {
          id: req.user.id,
          username: req.user.username,
          email: req.user.email,
          status: req.user.status
        },
        token: {
          type: req.token.type,
          issuedAt: new Date(req.token.iat * 1000).toISOString(),
          expiresAt: new Date(req.token.exp * 1000).toISOString()
        },
        server: {
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV
        }
      }
    });
  }
);

module.exports = router;