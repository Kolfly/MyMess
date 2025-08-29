const express = require('express');

const router = express.Router();

// Route de test très basique
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Routes utilisateur basiques fonctionnent'
  });
});

// Fallback simple
router.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route utilisateur non trouvée'
  });
});

module.exports = router;