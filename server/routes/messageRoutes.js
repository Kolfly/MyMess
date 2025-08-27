const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// 🚧 ROUTES MESSAGES - EN DÉVELOPPEMENT  
// Ces routes seront implémentées pour la gestion des conversations et messages

// Placeholder pour les futures routes messages
router.get('/', authMiddleware, (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Les routes messages sont en cours de développement',
    code: 'MESSAGES_MODULE_NOT_IMPLEMENTED',
    plannedRoutes: [
      'GET /api/messages/ - Liste des conversations',
      'GET /api/messages/conversation/:id - Messages d\'une conversation',
      'POST /api/messages/ - Envoyer un nouveau message',
      'PUT /api/messages/:id - Modifier un message',
      'DELETE /api/messages/:id - Supprimer un message',
      'POST /api/messages/conversation - Créer une nouvelle conversation'
    ]
  });
});

router.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route message non trouvée',
    code: 'MESSAGE_ROUTE_NOT_FOUND'
  });
});

module.exports = router;