const express = require('express');
const messageController = require('../controllers/messageController');
const messageValidator = require('../validators/messageValidator');
const { 
  authMiddleware, 
  logAuthenticatedRequests,
  checkTokenExpiration
} = require('../middleware/authMiddleware');

const router = express.Router();

// ================================================
// ROUTES CONVERSATIONS
// ================================================

// 📋 RÉCUPÉRER MES CONVERSATIONS - GET /api/messages/conversations
router.get('/conversations',
  authMiddleware,
  messageValidator.getUserConversationsValidation(),
  messageController.getUserConversations
);

// 💬 CRÉER CONVERSATION PRIVÉE - POST /api/messages/conversations/private
router.post('/conversations/private',
  authMiddleware,
  messageValidator.getCreatePrivateConversationValidation(),
  logAuthenticatedRequests,
  messageController.createPrivateConversation
);

// 👥 CRÉER CONVERSATION GROUPE - POST /api/messages/conversations/group
router.post('/conversations/group',
  authMiddleware,
  messageValidator.getCreateGroupConversationValidation(),
  logAuthenticatedRequests,
  messageController.createGroupConversation
);

// 📋 RÉCUPÉRER DEMANDES EN ATTENTE - GET /api/messages/conversations/pending
// IMPORTANT: Cette route DOIT être avant :conversationId pour éviter les conflits
router.get('/conversations/pending',
  authMiddleware,
  messageController.getPendingConversations
);

// 📄 DÉTAILS D'UNE CONVERSATION - GET /api/messages/conversations/:conversationId
router.get('/conversations/:conversationId',
  authMiddleware,
  messageValidator.getConversationDetailsValidation(),
  messageController.getConversationDetails
);

// 📋 MESSAGES D'UNE CONVERSATION - GET /api/messages/conversations/:conversationId/messages
router.get('/conversations/:conversationId/messages',
  authMiddleware,
  messageValidator.getConversationMessagesValidation(),
  messageController.getConversationMessages
);

// 📖 MARQUER COMME LU - POST /api/messages/conversations/:conversationId/read
router.post('/conversations/:conversationId/read',
  authMiddleware,
  messageValidator.getMarkAsReadValidation(),
  messageController.markAsRead
);

// ================================================
// ROUTES DEMANDES DE CONVERSATION (US022)
// ================================================

// ✅ ACCEPTER UNE CONVERSATION - POST /api/messages/conversations/:conversationId/accept
router.post('/conversations/:conversationId/accept',
  authMiddleware,
  messageValidator.getAcceptConversationValidation(),
  logAuthenticatedRequests,
  messageController.acceptConversation
);

// ❌ REFUSER UNE CONVERSATION - POST /api/messages/conversations/:conversationId/reject
router.post('/conversations/:conversationId/reject',
  authMiddleware,
  messageValidator.getRejectConversationValidation(),
  logAuthenticatedRequests,
  messageController.rejectConversation
);

// ================================================
// ROUTES MESSAGES
// ================================================

// 📝 ENVOYER UN MESSAGE - POST /api/messages/
router.post('/',
  authMiddleware,
  messageValidator.getSendMessageValidation(),
  checkTokenExpiration,
  logAuthenticatedRequests,
  messageController.sendMessage
);

// ✏️ MODIFIER UN MESSAGE - PUT /api/messages/:messageId
router.put('/:messageId',
  authMiddleware,
  messageValidator.getEditMessageValidation(),
  logAuthenticatedRequests,
  messageController.editMessage
);

// 🗑️ SUPPRIMER UN MESSAGE - DELETE /api/messages/:messageId
router.delete('/:messageId',
  authMiddleware,
  messageValidator.getDeleteMessageValidation(),
  logAuthenticatedRequests,
  messageController.deleteMessage
);

// ================================================
// ROUTES UTILITAIRES
// ================================================

// 🔍 RECHERCHER DANS LES MESSAGES - GET /api/messages/search
router.get('/search',
  authMiddleware,
  messageValidator.getSearchMessagesValidation(),
  messageController.searchMessages
);

// 📊 STATISTIQUES DES MESSAGES - GET /api/messages/stats
router.get('/stats',
  authMiddleware,
  checkTokenExpiration,
  messageController.getMessageStats
);

// ================================================
// ROUTES STATUTS DE LECTURE (US009)
// ================================================

// 👁️ MARQUER UN MESSAGE COMME LU - POST /api/messages/:messageId/read
router.post('/:messageId/read',
  authMiddleware,
  messageValidator.getMarkMessageReadValidation(),
  logAuthenticatedRequests,
  messageController.markMessageAsRead
);

// 👁️ MARQUER CONVERSATION COMME LUE - POST /api/messages/conversations/:conversationId/mark-read  
router.post('/conversations/:conversationId/mark-read',
  authMiddleware,
  messageValidator.getMarkConversationReadValidation(),
  logAuthenticatedRequests,
  messageController.markConversationAsRead
);

// 📊 OBTENIR STATUTS DE LECTURE - POST /api/messages/read-statuses
router.post('/read-statuses',
  authMiddleware,
  messageValidator.getReadStatusesValidation(),
  messageController.getReadStatuses
);

// 👥 LECTEURS D'UN MESSAGE - GET /api/messages/:messageId/readers
router.get('/:messageId/readers',
  authMiddleware,
  messageValidator.getMessageReadersValidation(),
  messageController.getMessageReaders
);

// 📋 MESSAGES NON LUS - GET /api/messages/conversations/:conversationId/unread
router.get('/conversations/:conversationId/unread',
  authMiddleware,
  messageValidator.getUnreadMessagesValidation(),
  messageController.getUnreadMessages
);

// 🧪 TEST DE CONNEXION - GET /api/messages/test
router.get('/test',
  authMiddleware,
  messageController.testMessages
);

// ================================================
// GESTION DES ROUTES NON TROUVÉES
// ================================================

router.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} non trouvée`,
    code: 'MESSAGE_ROUTE_NOT_FOUND',
    availableRoutes: [
      'GET    /conversations                    - Mes conversations',
      'POST   /conversations/private           - Créer conversation privée',
      'POST   /conversations/group             - Créer groupe',
      'GET    /conversations/:id               - Détails conversation',
      'GET    /conversations/:id/messages      - Messages conversation',
      'POST   /conversations/:id/read          - Marquer comme lu',
      'POST   /                               - Envoyer message',
      'PUT    /:messageId                     - Modifier message',
      'DELETE /:messageId                     - Supprimer message',
      'GET    /search                         - Rechercher messages',
      'GET    /stats                          - Statistiques',
      'GET    /test                           - Test connexion'
    ],
    timestamp: new Date().toISOString()
  });
});

module.exports = router;