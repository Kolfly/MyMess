const express = require('express');
const authController = require('../controllers/authController');
const authValidator = require('../validators/authValidator');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// ================================================
// ROUTES DE BASE QUI FONCTIONNENT
// ================================================

// 📝 INSCRIPTION
router.post('/register', 
  authValidator.getRegisterValidation(),
  authController.register
);

// 🔐 CONNEXION
router.post('/login',
  authValidator.getLoginValidation(),
  authController.login
);

// 🔄 RENOUVELLEMENT DE TOKEN
router.post('/refresh',
  authValidator.getRefreshTokenValidation(),
  authController.refreshToken
);

// 📧 RENVOI D'EMAIL DE VÉRIFICATION
router.post('/resend-verification',
  authValidator.getResendVerificationValidation(),
  authController.resendVerification
);

// ================================================
// ROUTES PROTÉGÉES
// ================================================

// 👤 PROFIL UTILISATEUR
router.get('/me',
  authMiddleware,
  authController.getMe
);

// ✏️ MISE À JOUR DU PROFIL
router.put('/profile',
  authMiddleware,
  authValidator.getProfileUpdateValidation(),
  authController.updateProfile
);

// 🔐 CHANGEMENT DE MOT DE PASSE
router.put('/change-password',
  authMiddleware,
  authValidator.getChangePasswordValidation(),
  authController.changePassword
);

// 🎯 MISE À JOUR DU STATUT
router.put('/status',
  authMiddleware,
  authValidator.getUpdateStatusValidation(),
  authController.updateStatus
);

// 👋 DÉCONNEXION
router.post('/logout',
  authMiddleware,
  authController.logout
);

// 📊 STATISTIQUES DU COMPTE - Temporairement désactivé pour debug
/*
router.get('/stats',
  authMiddleware,
  authController.getAccountStats
);
*/

module.exports = router;