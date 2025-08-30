const express = require('express');
const messageController = require('../controllers/messageController');
const messageValidator = require('../validators/messageValidator');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

// 🧪 TEST DE BASE - GET /api/messages/test
router.get('/test', authMiddleware, messageController.testMessages);

// 📝 ENVOYER UN MESSAGE - POST /api/messages/
router.post('/',
  authMiddleware,
  messageValidator.getSendMessageValidation(),
  messageController.sendMessage
);

// 📋 MES CONVERSATIONS - GET /api/messages/conversations
router.get('/conversations',
  authMiddleware,
  messageValidator.getUserConversationsValidation(),
  messageController.getUserConversations
);

// 💬 CRÉER CONVERSATION PRIVÉE - POST /api/messages/conversations/private
router.post('/conversations/private',
  authMiddleware,
  messageValidator.getCreatePrivateConversationValidation(),
  messageController.createPrivateConversation
);

// 📋 RÉCUPÉRER DEMANDES EN ATTENTE - GET /api/messages/conversations/pending
// IMPORTANT: Cette route DOIT être avant :conversationId pour éviter les conflits
router.get('/conversations/pending',
  authMiddleware,
  messageController.getPendingConversations
);

// 📄 DÉTAILS CONVERSATION - GET /api/messages/conversations/:conversationId
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

// ✏️ MODIFIER UN MESSAGE - PUT /api/messages/:messageId
router.put('/:messageId',
  authMiddleware,
  messageValidator.getEditMessageValidation(),
  messageController.editMessage
);

// 🗑️ SUPPRIMER UN MESSAGE - DELETE /api/messages/:messageId
router.delete('/:messageId',
  authMiddleware,
  messageValidator.getDeleteMessageValidation(),
  messageController.deleteMessage
);

// ✅ ACCEPTER UNE CONVERSATION - POST /api/messages/conversations/:conversationId/accept
router.post('/conversations/:conversationId/accept',
  authMiddleware,
  messageValidator.getAcceptConversationValidation(),
  messageController.acceptConversation
);

// ❌ REFUSER UNE CONVERSATION - POST /api/messages/conversations/:conversationId/reject
router.post('/conversations/:conversationId/reject',
  authMiddleware,
  messageValidator.getRejectConversationValidation(),
  messageController.rejectConversation
);

// 👥 CRÉER GROUPE - POST /api/messages/conversations/group
router.post('/conversations/group',
  authMiddleware,
  messageValidator.getCreateGroupConversationValidation(),
  messageController.createGroupConversation
);

// 📊 STATISTIQUES - GET /api/messages/stats
router.get('/stats',
  authMiddleware,
  messageController.getMessageStats
);

// 🗑️ SUPPRIMER UNE CONVERSATION - DELETE /api/messages/conversations/:conversationId
router.delete('/conversations/:conversationId',
  authMiddleware,
  messageController.deleteConversation
);

module.exports = router;