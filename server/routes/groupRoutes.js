// 👥 ROUTES GESTION DE GROUPE - US012
// Routes pour toutes les opérations de gestion des groupes

const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { authenticateToken } = require('../middleware/authMiddleware');

// ================================================
// MIDDLEWARE D'AUTHENTIFICATION
// ================================================
router.use(authenticateToken);

// ================================================
// ROUTES DE GESTION DES GROUPES
// ================================================

// 👤 AJOUTER DES MEMBRES À UN GROUPE
// POST /api/groups/:conversationId/members
router.post('/:conversationId/members', groupController.addMembers);

// ❌ SUPPRIMER UN MEMBRE D'UN GROUPE  
// DELETE /api/groups/:conversationId/members/:memberId
router.delete('/:conversationId/members/:memberId', groupController.removeMember);

// ⚙️ MODIFIER LES PARAMÈTRES D'UN GROUPE
// PUT /api/groups/:conversationId/settings
router.put('/:conversationId/settings', groupController.updateSettings);

// 👑 MODIFIER LE RÔLE D'UN MEMBRE
// PATCH /api/groups/:conversationId/members/:memberId/role
router.patch('/:conversationId/members/:memberId/role', groupController.updateMemberRole);

// 📋 OBTENIR LES DÉTAILS D'UN GROUPE
// GET /api/groups/:conversationId/details
router.get('/:conversationId/details', groupController.getDetails);

// 🚪 QUITTER UN GROUPE
// POST /api/groups/:conversationId/leave
router.post('/:conversationId/leave', groupController.leaveGroup);

console.log('✅ Routes de gestion de groupe configurées');

module.exports = router;