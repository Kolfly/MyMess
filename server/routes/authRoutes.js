const express = require('express');
const authController = require('../controllers/authController');
const authValidator = require('../validators/authValidator');
const { 
  authMiddleware, 
  optionalAuthMiddleware, 
  logAuthenticatedRequests,
  checkTokenExpiration
} = require('../middleware/authMiddleware');

// Créer un router Express pour les routes d'authentification
const router = express.Router();

// 📋 DOCUMENTATION DES ROUTES
// Toutes ces routes sont préfixées par /api/auth dans le serveur principal
/*
  Routes publiques (sans authentification) :
  POST   /api/auth/register          - Inscription d'un nouvel utilisateur
  POST   /api/auth/login             - Connexion d'un utilisateur
  POST   /api/auth/refresh           - Renouvellement du token d'accès
  POST   /api/auth/forgot-password   - Demande de réinitialisation de mot de passe (TODO)
  POST   /api/auth/reset-password    - Réinitialisation du mot de passe (TODO)
  
  Routes protégées (authentification requise) :
  GET    /api/auth/me                - Récupérer le profil de l'utilisateur connecté
  PUT    /api/auth/profile           - Mettre à jour le profil
  PUT    /api/auth/change-password   - Changer le mot de passe
  PUT    /api/auth/status            - Mettre à jour le statut en ligne
  POST   /api/auth/logout            - Déconnexion
  GET    /api/auth/stats             - Statistiques du compte
*/

// 🌍 ROUTES PUBLIQUES (pas d'authentification requise)

// 📝 INSCRIPTION - POST /api/auth/register
router.post('/register', 
  // Middlewares de validation (dans l'ordre d'exécution)
  authValidator.getRegisterValidation(),
  // Controller qui traite la logique métier
  authController.register
);

// 🔐 CONNEXION - POST /api/auth/login
router.post('/login',
  // Validation des données de connexion
  authValidator.getLoginValidation(),
  // Traitement de la connexion
  authController.login
);

// 🔄 RENOUVELLEMENT DE TOKEN - POST /api/auth/refresh
router.post('/refresh',
  // Validation du refresh token
  authValidator.getRefreshTokenValidation(),
  // Génération d'un nouveau token d'accès
  authController.refreshToken
);

// 📧 VÉRIFICATION D'EMAIL - GET /api/auth/verify/:token
// Temporairement commenté pour debug
/*
router.get('/verify/:token',
  // Vérification du token d'email
  authController.verifyEmail
);
*/

// 📧 RENVOI D'EMAIL DE VÉRIFICATION - POST /api/auth/resend-verification
router.post('/resend-verification',
  // Validation de l'email
  authValidator.getResendVerificationValidation(),
  // Renvoyer l'email de vérification
  authController.resendVerification
);

// 📧 DEMANDE DE RÉINITIALISATION DE MOT DE PASSE - POST /api/auth/forgot-password
// Cette route sera utile pour permettre aux utilisateurs de récupérer leur compte
/*
router.post('/forgot-password',
  authValidator.getPasswordResetRequestValidation(),
  // TODO: Implémenter le controller pour envoyer un email de reset
  (req, res) => {
    res.status(501).json({
      success: false,
      message: 'Fonctionnalité de réinitialisation de mot de passe en cours de développement',
      code: 'FEATURE_NOT_IMPLEMENTED'
    });
  }
);

// 🔑 RÉINITIALISATION DE MOT DE PASSE - POST /api/auth/reset-password/:token
router.post('/reset-password/:token',
  authValidator.getPasswordResetValidation(),
  // TODO: Implémenter le controller pour réinitialiser le mot de passe
  (req, res) => {
    res.status(501).json({
      success: false,
      message: 'Fonctionnalité de réinitialisation de mot de passe en cours de développement',
      code: 'FEATURE_NOT_IMPLEMENTED'
    });
  }
);
*/

// 🔒 ROUTES PROTÉGÉES (authentification requise)
// Toutes les routes suivantes nécessitent un token d'authentification valide

// 👤 PROFIL UTILISATEUR - GET /api/auth/me
router.get('/me',
  authMiddleware,                    // Vérifier l'authentification
  checkTokenExpiration,              // Vérifier si le token expire bientôt
  logAuthenticatedRequests,          // Logger la requête pour audit
  authController.getMe
);

// ✏️ MISE À JOUR DU PROFIL - PUT /api/auth/profile
router.put('/profile',
  authMiddleware,                    // Authentification requise
  authValidator.getProfileUpdateValidation(),  // Validation des nouvelles données
  checkTokenExpiration,
  logAuthenticatedRequests,
  authController.updateProfile
);

// 🔐 CHANGEMENT DE MOT DE PASSE - PUT /api/auth/change-password
router.put('/change-password',
  authMiddleware,
  authValidator.getChangePasswordValidation(),
  logAuthenticatedRequests,          // Important de logger les changements de mot de passe
  authController.changePassword
);

// 🎯 MISE À JOUR DU STATUT - PUT /api/auth/status
router.put('/status',
  authMiddleware,
  authValidator.getUpdateStatusValidation(),
  // Pas besoin de logger cette action (trop fréquente)
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
// Cette route permet de chercher d'autres utilisateurs (pour les ajouter à des conversations)
router.get('/search',
  authMiddleware,                    // Seuls les utilisateurs connectés peuvent chercher
  authValidator.getSearchUsersValidation(),
  // TODO: Implémenter la méthode de recherche dans le controller
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
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la recherche d\'utilisateurs',
        code: 'SEARCH_ERROR'
      });
    }
  }
);

// 📈 STATISTIQUES GLOBALES - GET /api/auth/global-stats
// Route pour obtenir des statistiques générales (nombre d'utilisateurs, etc.)
router.get('/global-stats',
  optionalAuthMiddleware,            // Authentification optionnelle
  async (req, res) => {
    try {
      const authService = require('../services/authService');
      const stats = await authService.getUserStats();
      
      // Si l'utilisateur n'est pas connecté, on donne moins d'informations
      if (!req.user) {
        res.status(200).json({
          success: true,
          data: {
            totalUsers: stats.totalUsers,
            onlineUsers: stats.onlineUsers
            // Pas les statistiques détaillées pour les visiteurs non connectés
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
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques',
        code: 'GLOBAL_STATS_ERROR'
      });
    }
  }
);

// 🧪 ROUTE DE TEST - GET /api/auth/test
// Route utile pendant le développement pour tester l'authentification
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

// 🚫 GESTION DES MÉTHODES NON AUTORISÉES
// Si quelqu'un essaie d'utiliser une méthode HTTP non supportée sur nos routes
router.all('*', (req, res) => {
  res.status(405).json({
    success: false,
    message: `Méthode ${req.method} non autorisée sur ${req.originalUrl}`,
    code: 'METHOD_NOT_ALLOWED',
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    timestamp: new Date().toISOString()
  });
});

// 📝 MIDDLEWARE DE LOGGING SPÉCIFIQUE AUX ROUTES AUTH
// Log toutes les tentatives d'accès aux routes d'authentification
router.use((req, res, next) => {
  const logData = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    userId: req.user ? req.user.id : 'anonymous'
  };
  
  next();
});

module.exports = router;