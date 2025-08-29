const express = require('express');
const authController = require('../controllers/authController');
const authValidator = require('../validators/authValidator');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// Routes de base pour tester
router.post('/register', 
  authValidator.getRegisterValidation(),
  authController.register
);

router.post('/login',
  authValidator.getLoginValidation(),
  authController.login
);

router.post('/logout',
  authMiddleware,
  authController.logout
);

router.get('/me',
  authMiddleware,
  authController.getMe
);

module.exports = router;