const express = require('express');
const authController = require('../controllers/authController');
const authValidator = require('../validators/authValidator');
const { 
  authMiddleware, 
  optionalAuthMiddleware, 
  logAuthenticatedRequests,
  checkTokenExpiration  // MIDDLEWARE SUSPECT !
} = require('../middleware/authMiddleware');

const router = express.Router();

// Test avec PLUSIEURS validators pour identifier le problème
router.post('/register', 
  authValidator.getRegisterValidation(),
  authController.register
);

// TEST : Ajouter le validator login
router.post('/login',
  authValidator.getLoginValidation(),
  authController.login
);

// TEST : Ajouter le validator refresh token
router.post('/refresh',
  authValidator.getRefreshTokenValidation(),
  authController.refreshToken
);

// TEST : Ajouter les validators qui pourraient poser problème
router.post('/resend-verification',
  authValidator.getResendVerificationValidation(),
  authController.resendVerification
);

router.put('/profile',
  authValidator.getProfileUpdateValidation(),
  authController.updateProfile
);

// TEST : La route SUSPECTE avec require() inline
router.get('/search',
  authValidator.getSearchUsersValidation(),
  async (req, res) => {
    try {
      const authService = require('../services/authService');  // LIGNE SUSPECTE !
      res.json({ success: true, message: 'Search avec authService OK' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

router.put('/status',
  authValidator.getUpdateStatusValidation(),
  (req, res) => { res.json({ success: true, message: 'Status validator OK' }); }
);

// TEST : Route avec paramètre URL (SUSPECT !)
router.get('/verify/:token', 
  (req, res) => { 
    res.json({ success: true, message: 'Route avec paramètre :token fonctionne', token: req.params.token }); 
  }
);

// TEST FINAL : Route avec TOUS les middlewares suspects
router.get('/test-middleware', 
  authMiddleware,
  checkTokenExpiration,
  logAuthenticatedRequests,
  (req, res) => { 
    res.json({ success: true, message: 'Tous les middlewares fonctionnent' }); 
  }
);

// Route de secours sans validator
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Route test sans validator fonctionne' });
});

module.exports = router;