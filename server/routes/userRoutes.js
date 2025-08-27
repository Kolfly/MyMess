const express = require('express');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// 🚧 ROUTES UTILISATEURS - EN DÉVELOPPEMENT
// Ces routes seront implémentées dans les prochaines étapes du projet

// Placeholder pour les futures routes utilisateurs
router.get('/', authMiddleware, (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Les routes utilisateurs sont en cours de développement',
    code: 'USERS_MODULE_NOT_IMPLEMENTED',
    plannedRoutes: [
      'GET /api/users/ - Liste des utilisateurs',
      'GET /api/users/:id - Profil d\'un utilisateur',
      'PUT /api/users/:id - Modifier un profil utilisateur',
      'DELETE /api/users/:id - Désactiver un compte',
      'GET /api/users/:id/conversations - Conversations d\'un utilisateur'
    ]
  });
});

router.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route utilisateur non trouvée',
    code: 'USER_ROUTE_NOT_FOUND'
  });
});

module.exports = router;