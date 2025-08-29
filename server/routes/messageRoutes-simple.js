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

module.exports = router;