// 💬 CONTROLLER MESSAGES - GESTION DES REQUÊTES
// Contrôleur pour toutes les actions liées aux messages et conversations

const messageService = require('../services/messageService');
const groupManagementService = require('../services/groupManagementService');
const { validationResult } = require('express-validator');

class MessageController {

  // ================================================
  // GESTION DES CONVERSATIONS
  // ================================================

  // 📋 RÉCUPÉRER TOUTES LES CONVERSATIONS DE L'UTILISATEUR
  async getUserConversations(req, res) {
    try {
      console.log(`📋 [${req.method}] ${req.originalUrl} - Utilisateur: ${req.user.id}`);

      const { limit, offset, includeArchived } = req.query;
      
      const result = await messageService.getUserConversations(req.user.id, {
        limit: limit || 20,
        offset: offset || 0,
        includeArchived: includeArchived || false
      });

      res.status(200).json({
        success: true,
        message: 'Conversations récupérées avec succès',
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur getUserConversations:', error.message);
      res.status(500).json({
        success: false,
        message: error.message,
        code: 'GET_CONVERSATIONS_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // 💬 CRÉER UNE CONVERSATION PRIVÉE
  async createPrivateConversation(req, res) {
    try {
      console.log(`💬 [${req.method}] ${req.originalUrl} - Utilisateur: ${req.user.id}`);

      const { otherUserId } = req.body;

      // Vérifier que ce n'est pas avec soi-même
      if (otherUserId === req.user.id) {
        return res.status(400).json({
          success: false,
          message: 'Vous ne pouvez pas créer une conversation avec vous-même',
          code: 'SELF_CONVERSATION_ERROR',
          timestamp: new Date().toISOString()
        });
      }

      const conversation = await messageService.createPrivateConversation(
        req.user.id, 
        otherUserId
      );

      // Notifier le destinataire via WebSocket qu'il a reçu une demande de conversation
      if (global.socketHandler) {
        // Récupérer les sockets du destinataire
        const targetUserSockets = global.socketHandler.userSockets.get(otherUserId);
        if (targetUserSockets && targetUserSockets.size > 0) {
          for (const socketId of targetUserSockets) {
            const socket = global.io.sockets.sockets.get(socketId);
            if (socket) {
              socket.emit('conversation:request_received', {
                conversation,
                requestFrom: {
                  id: req.user.id,
                  username: req.user.username,
                  displayName: req.user.firstName && req.user.lastName 
                    ? `${req.user.firstName} ${req.user.lastName}`
                    : req.user.username
                },
                timestamp: new Date().toISOString()
              });
              console.log(`📨 Demande de conversation envoyée à ${otherUserId} (socket: ${socketId})`);
            }
          }
        } else {
          console.log(`📭 Utilisateur ${otherUserId} non connecté - demande en attente`);
        }
      }

      res.status(201).json({
        success: true,
        message: 'Conversation privée créée avec succès',
        data: conversation,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur createPrivateConversation:', error.message);
      res.status(400).json({
        success: false,
        message: error.message,
        code: 'CREATE_PRIVATE_CONVERSATION_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // 👥 CRÉER UNE CONVERSATION GROUPE
  async createGroupConversation(req, res) {
    try {
      console.log(`👥 [${req.method}] ${req.originalUrl} - Utilisateur: ${req.user.id}`);

      const { name, description, memberIds } = req.body;

      const conversation = await messageService.createGroupConversation(
        req.user.id,
        name,
        description,
        memberIds || []
      );

      res.status(201).json({
        success: true,
        message: 'Groupe créé avec succès',
        data: conversation,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur createGroupConversation:', error.message);
      res.status(400).json({
        success: false,
        message: error.message,
        code: 'CREATE_GROUP_CONVERSATION_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // 📄 RÉCUPÉRER LES DÉTAILS D'UNE CONVERSATION
  async getConversationDetails(req, res) {
    try {
      console.log(`📄 [${req.method}] ${req.originalUrl} - Utilisateur: ${req.user.id}`);

      const { conversationId } = req.params;

      const conversation = await messageService.getConversationDetails(
        conversationId,
        req.user.id
      );

      res.status(200).json({
        success: true,
        message: 'Détails de la conversation récupérés',
        data: conversation,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur getConversationDetails:', error.message);
      
      const statusCode = error.message.includes('non trouvée') ? 404 :
                        error.message.includes('non autorisé') ? 403 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: 'GET_CONVERSATION_DETAILS_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // ================================================
  // GESTION DES MESSAGES
  // ================================================

  // 📝 ENVOYER UN MESSAGE
  async sendMessage(req, res) {
    try {
      console.log(`📝 [${req.method}] ${req.originalUrl} - Utilisateur: ${req.user.id}`);

      const { content, conversationId, messageType, replyToId, metadata } = req.body;

      const message = await messageService.sendMessage(
        req.user.id,
        conversationId,
        content,
        { messageType, replyToId, metadata }
      );

      res.status(201).json({
        success: true,
        message: 'Message envoyé avec succès',
        data: message,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur sendMessage:', error.message);
      
      const statusCode = error.message.includes('non trouvée') ? 404 :
                        error.message.includes('pas membre') ? 403 : 400;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: 'SEND_MESSAGE_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // 📋 RÉCUPÉRER LES MESSAGES D'UNE CONVERSATION
  async getConversationMessages(req, res) {
    try {
      console.log(`📋 [${req.method}] ${req.originalUrl} - Utilisateur: ${req.user.id}`);

      const { conversationId } = req.params;
      const { limit, offset, before, after } = req.query;

      const result = await messageService.getConversationMessages(
        conversationId,
        req.user.id,
        { limit, offset, before, after }
      );

      res.status(200).json({
        success: true,
        message: 'Messages récupérés avec succès',
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur getConversationMessages:', error.message);
      
      const statusCode = error.message.includes('non trouvée') ? 404 :
                        error.message.includes('non autorisé') ? 403 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: 'GET_MESSAGES_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // ✏️ MODIFIER UN MESSAGE
  async editMessage(req, res) {
    try {
      console.log(`✏️ [${req.method}] ${req.originalUrl} - Utilisateur: ${req.user.id}`);

      const { messageId } = req.params;
      const { content } = req.body;

      const message = await messageService.editMessage(
        messageId,
        req.user.id,
        content
      );

      res.status(200).json({
        success: true,
        message: 'Message modifié avec succès',
        data: message,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur editMessage:', error.message);
      
      const statusCode = error.message.includes('non trouvé') ? 404 :
                        error.message.includes('pas modifier') ? 403 :
                        error.message.includes('trop ancien') ? 410 : 400;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: 'EDIT_MESSAGE_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // 🗑️ SUPPRIMER UN MESSAGE
  async deleteMessage(req, res) {
    try {
      console.log(`🗑️ [${req.method}] ${req.originalUrl} - Utilisateur: ${req.user.id}`);

      const { messageId } = req.params;

      await messageService.deleteMessage(messageId, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Message supprimé avec succès',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur deleteMessage:', error.message);
      
      const statusCode = error.message.includes('non trouvé') ? 404 :
                        error.message.includes('pas supprimer') ? 403 : 400;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: 'DELETE_MESSAGE_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // 📖 MARQUER LES MESSAGES COMME LUS
  async markAsRead(req, res) {
    try {
      console.log(`📖 [${req.method}] ${req.originalUrl} - Utilisateur: ${req.user.id}`);

      const { conversationId } = req.params;
      const { messageId } = req.body;

      await messageService.markAsRead(conversationId, req.user.id, messageId);

      res.status(200).json({
        success: true,
        message: 'Messages marqués comme lus',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur markAsRead:', error.message);
      
      const statusCode = error.message.includes('pas membre') ? 403 : 400;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: 'MARK_AS_READ_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // ================================================
  // ROUTES UTILITAIRES
  // ================================================

  // 🔍 RECHERCHER DANS LES MESSAGES (PLACEHOLDER)
  async searchMessages(req, res) {
    try {
      console.log(`🔍 [${req.method}] ${req.originalUrl} - Utilisateur: ${req.user.id}`);

      // TODO: Implémenter la recherche full-text dans les messages
      res.status(501).json({
        success: false,
        message: 'Recherche de messages en cours de développement',
        code: 'SEARCH_NOT_IMPLEMENTED',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur searchMessages:', error.message);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la recherche',
        code: 'SEARCH_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // 📊 STATISTIQUES DES MESSAGES
  async getMessageStats(req, res) {
    try {
      console.log(`📊 [${req.method}] ${req.originalUrl} - Utilisateur: ${req.user.id}`);

      // TODO: Implémenter les statistiques des messages
      res.status(200).json({
        success: true,
        message: 'Statistiques des messages',
        data: {
          totalConversations: 0,
          totalMessages: 0,
          unreadMessages: 0,
          placeholder: 'Statistiques en développement'
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur getMessageStats:', error.message);
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques',
        code: 'STATS_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // ================================================
  // DEMANDES DE CONVERSATION (US022)
  // ================================================

  // 📋 RÉCUPÉRER LES DEMANDES EN ATTENTE
  async getPendingConversations(req, res) {
    try {
      console.log(`📋 [${req.method}] ${req.originalUrl} - Utilisateur: ${req.user.id}`);

      const result = await messageService.getPendingConversations(req.user.id);

      res.status(200).json({
        success: true,
        message: 'Demandes en attente récupérées avec succès',
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur getPendingConversations:', error.message);
      res.status(500).json({
        success: false,
        message: error.message,
        code: 'GET_PENDING_CONVERSATIONS_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // ================================================
  // GESTION DES STATUTS DE LECTURE (US009)
  // ================================================

  // 👁️ MARQUER UN MESSAGE COMME LU
  async markMessageAsRead(req, res) {
    try {
      console.log(`👁️ [${req.method}] ${req.originalUrl} - Utilisateur: ${req.user.id}`);

      const { messageId } = req.params;

      const result = await messageService.markMessageAsRead(messageId, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Message marqué comme lu',
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur markMessageAsRead:', error.message);
      
      const statusCode = error.message.includes('non trouvé') ? 404 :
                        error.message.includes('non autorisé') ? 403 : 400;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: 'MARK_MESSAGE_READ_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // 👁️ MARQUER UNE CONVERSATION COMME LUE
  async markConversationAsRead(req, res) {
    try {
      console.log(`👁️ [${req.method}] ${req.originalUrl} - Utilisateur: ${req.user.id}`);

      const { conversationId } = req.params;
      const { lastMessageId } = req.body;

      const result = await messageService.markConversationAsRead(
        conversationId, 
        req.user.id, 
        lastMessageId
      );

      res.status(200).json({
        success: true,
        message: 'Conversation marquée comme lue',
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur markConversationAsRead:', error.message);
      
      const statusCode = error.message.includes('non trouvée') ? 404 :
                        error.message.includes('non autorisé') ? 403 : 400;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: 'MARK_CONVERSATION_READ_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // 📊 OBTENIR LES STATUTS DE LECTURE
  async getReadStatuses(req, res) {
    try {
      console.log(`📊 [${req.method}] ${req.originalUrl} - Utilisateur: ${req.user.id}`);

      const { messageIds } = req.body;

      if (!Array.isArray(messageIds) || messageIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Liste des IDs de messages requise',
          code: 'INVALID_MESSAGE_IDS',
          timestamp: new Date().toISOString()
        });
      }

      const statuses = await messageService.getReadStatusForMessages(messageIds, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Statuts de lecture récupérés',
        data: { statuses },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur getReadStatuses:', error.message);
      res.status(500).json({
        success: false,
        message: error.message,
        code: 'GET_READ_STATUSES_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // 👥 OBTENIR LES LECTEURS D'UN MESSAGE
  async getMessageReaders(req, res) {
    try {
      console.log(`👥 [${req.method}] ${req.originalUrl} - Utilisateur: ${req.user.id}`);

      const { messageId } = req.params;

      const readers = await messageService.getMessageReaders(messageId);

      res.status(200).json({
        success: true,
        message: 'Lecteurs du message récupérés',
        data: { readers },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur getMessageReaders:', error.message);
      res.status(500).json({
        success: false,
        message: error.message,
        code: 'GET_MESSAGE_READERS_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // 📋 OBTENIR LES MESSAGES NON LUS
  async getUnreadMessages(req, res) {
    try {
      console.log(`📋 [${req.method}] ${req.originalUrl} - Utilisateur: ${req.user.id}`);

      const { conversationId } = req.params;

      const unreadMessages = await messageService.getUnreadMessages(conversationId, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Messages non lus récupérés',
        data: { unreadMessages },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur getUnreadMessages:', error.message);
      res.status(500).json({
        success: false,
        message: error.message,
        code: 'GET_UNREAD_MESSAGES_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // ✅ ACCEPTER UNE CONVERSATION
  async acceptConversation(req, res) {
    try {
      console.log(`✅ [${req.method}] ${req.originalUrl} - Utilisateur: ${req.user.id}`);

      const { conversationId } = req.params;

      const conversation = await messageService.acceptConversation(
        conversationId,
        req.user.id
      );

      res.status(200).json({
        success: true,
        message: 'Conversation acceptée avec succès',
        data: conversation,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur acceptConversation:', error.message);
      
      const statusCode = error.message.includes('non trouvée') ? 404 :
                        error.message.includes('pas membre') ? 403 :
                        error.message.includes('déjà acceptée') ? 409 : 400;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: 'ACCEPT_CONVERSATION_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // ❌ REFUSER UNE CONVERSATION
  async rejectConversation(req, res) {
    try {
      console.log(`❌ [${req.method}] ${req.originalUrl} - Utilisateur: ${req.user.id}`);

      const { conversationId } = req.params;

      await messageService.rejectConversation(
        conversationId,
        req.user.id
      );

      res.status(200).json({
        success: true,
        message: 'Conversation refusée avec succès',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur rejectConversation:', error.message);
      
      const statusCode = error.message.includes('non trouvée') ? 404 :
                        error.message.includes('pas membre') ? 403 :
                        error.message.includes('déjà') ? 409 : 400;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: 'REJECT_CONVERSATION_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // 🧪 TEST DE CONNEXION
  async testMessages(req, res) {
    res.status(200).json({
      success: true,
      message: 'Controller messages fonctionnel !',
      data: {
        user: {
          id: req.user.id,
          username: req.user.username,
          email: req.user.email
        },
        availableActions: [
          'GET /conversations - Mes conversations',
          'POST /conversations/private - Créer conversation privée', 
          'POST /conversations/group - Créer groupe',
          'GET /conversations/:id - Détails conversation',
          'GET /conversations/:id/messages - Messages',
          'POST /conversations/:id/read - Marquer comme lu',
          'GET /conversations/pending - Demandes en attente',
          'POST /conversations/:id/accept - Accepter conversation',
          'POST /conversations/:id/reject - Refuser conversation',
          'POST /messages - Envoyer message',
          'PUT /messages/:id - Modifier message',
          'DELETE /messages/:id - Supprimer message'
        ],
        timestamp: new Date().toISOString()
      }
    });
  }

  // ================================================
  // GESTION DES CONVERSATIONS (US023 & US025)
  // ================================================

  // 🗑️ SUPPRIMER UNE CONVERSATION
  async deleteConversation(req, res) {
    try {
      console.log(`🗑️ [${req.method}] ${req.originalUrl} - Utilisateur: ${req.user.id}`);

      const { conversationId } = req.params;

      const result = await messageService.deleteConversation(conversationId, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Conversation supprimée avec succès',
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur deleteConversation:', error.message);
      
      const statusCode = error.message.includes('non trouvée') ? 404 :
                        error.message.includes('non autorisé') ? 403 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: 'DELETE_CONVERSATION_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
}

console.log('✅ MessageController créé');

module.exports = new MessageController();