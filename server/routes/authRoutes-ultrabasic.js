const express = require('express');

const router = express.Router();

// Route de test ultra-basique sans aucun import complexe
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'Route auth ultra-basique fonctionne'
  });
});

// Route POST basique
router.post('/test-post', (req, res) => {
  res.json({
    success: true,
    message: 'POST auth basique fonctionne',
    body: req.body
  });
});

module.exports = router;