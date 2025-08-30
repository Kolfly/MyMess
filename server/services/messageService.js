// 💬 SERVICE MESSAGES - LOGIQUE MÉTIER
// Gère toute la logique des messages et conversations

const { User, Conversation, Message, ConversationMember, MessageRead } = require('../models/associations');
const { Op } = require('sequelize');

class MessageService {

  // ================================================
  // GESTION DES CONVERSATIONS
  // ================================================

  // 📋 RÉCUPÉRER LES CONVERSATIONS D'UN UTILISATEUR
  async getUserConversations(userId, options = {}) {
    try {
      const { limit = 20, offset = 0, includeArchived = false, status = 'accepted' } = options;


      // Construire la clause where pour le statut
      const whereClause = includeArchived ? {} : { isArchived: false };
      
      // Filtrer par statut (par défaut, seulement les conversations acceptées)
      if (status === 'all') {
        // Récupérer toutes les conversations
      } else if (Array.isArray(status)) {
        whereClause.status = { [Op.in]: status };
      } else {
        whereClause.status = status;
      }

      // Récupérer les conversations
      const conversations = await Conversation.findAll({
        include: [
          {
            model: ConversationMember,
            as: 'members',
            where: { userId, leftAt: null },
            required: true
          },
          {
            model: ConversationMember,
            as: 'allMembers',
            where: { leftAt: null },
            required: false,
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'username', 'firstName', 'lastName', 'status', 'lastSeen']
              }
            ]
          },
          {
            model: Message,
            as: 'lastMessage',
            required: false,
            include: [
              {
                model: User,
                as: 'sender',
                attributes: ['id', 'username', 'firstName', 'lastName']
              }
            ]
          }
        ],
        where: whereClause,
        order: [['lastActivityAt', 'DESC']],
        limit,
        offset
      });

      // Ajouter le nombre de messages non lus pour chaque conversation
      const conversationsWithUnread = await Promise.all(
        conversations.map(async (conv) => {
          try {
            // Utiliser la nouvelle méthode avec MessageRead
            const unreadMessages = await MessageRead.getUnreadMessagesInConversation(conv.id, userId);
            const unreadCount = unreadMessages.length;
            const convData = conv.toJSON();
            
            // Ajouter displayName au lastMessage.sender si présent
            if (convData.lastMessage && convData.lastMessage.sender) {
              convData.lastMessage.sender.displayName = conv.lastMessage.sender.getFullName();
            }
            
            return {
              ...convData,
              unreadCount
            };
          } catch (err) {
            const convData = conv.toJSON();
            
            // Ajouter displayName même en cas d'erreur
            if (convData.lastMessage && convData.lastMessage.sender) {
              convData.lastMessage.sender.displayName = conv.lastMessage.sender.getFullName();
            }
            
            return {
              ...convData,
              unreadCount: 0
            };
          }
        })
      );

      return {
        conversations: conversationsWithUnread,
        total: conversationsWithUnread.length,
        hasMore: conversationsWithUnread.length === limit
      };

    } catch (error) {
      throw new Error('Erreur lors de la récupération des conversations');
    }
  }

  // 💬 CRÉER UNE CONVERSATION PRIVÉE
  async createPrivateConversation(user1Id, user2Id) {
    try {

      // Vérifier si une conversation privée existe déjà (incluant celles refusées/en attente)
      const existingConv = await Conversation.findPrivateConversation(user1Id, user2Id);
      if (existingConv) {
        // Si elle est rejetée, on peut la réactiver en statut pending MAIS avec le nouveau créateur
        if (existingConv.status === 'rejected') {
          await existingConv.update({ 
            status: 'pending',
            createdBy: user1Id // Mettre à jour le créateur pour la nouvelle demande
          });
          return await this.getConversationDetails(existingConv.id, user1Id, { skipMemberCheck: true });
        }
        
        // Si elle est déjà en pending ou acceptée, retourner les détails avec le bon contexte
        if (existingConv.status === 'pending') {
          // Si c'est la même personne qui refait la demande, retourner la conversation
          if (existingConv.createdBy === user1Id) {
            return await this.getConversationDetails(existingConv.id, user1Id, { skipMemberCheck: true });
          }
          // Si c'est l'autre personne, cela signifie qu'ils veulent tous les deux se parler
          // On pourrait auto-accepter la conversation
          await existingConv.update({ status: 'accepted' });
          return await this.getConversationDetails(existingConv.id, user1Id, { skipMemberCheck: true });
        }
        
        // Si elle est acceptée, la retourner
        return await this.getConversationDetails(existingConv.id, user1Id, { skipMemberCheck: true });
      }

      // Vérifier que les deux utilisateurs existent
      const users = await User.findAll({
        where: { id: [user1Id, user2Id] },
        attributes: ['id', 'username', 'firstName', 'lastName']
      });

      if (users.length !== 2) {
        throw new Error('Un ou plusieurs utilisateurs n\'existent pas');
      }

      // Créer la conversation avec statut 'pending'
      const conversation = await Conversation.create({
        type: 'private',
        status: 'pending', // Nouveau: toutes les conversations privées commencent en pending
        createdBy: user1Id
      });

      // Ajouter les deux membres
      await ConversationMember.bulkCreate([
        {
          conversationId: conversation.id,
          userId: user1Id,
          role: 'member'
        },
        {
          conversationId: conversation.id,
          userId: user2Id,
          role: 'member'
        }
      ]);

      return await this.getConversationDetails(conversation.id, user1Id, { skipMemberCheck: true });

    } catch (error) {
      throw new Error(error.message || 'Erreur lors de la création de la conversation privée');
    }
  }

  // 👥 CRÉER UNE CONVERSATION GROUPE
  async createGroupConversation(creatorId, name, description, memberIds = []) {
    try {

      // Vérifier que le nom n'est pas vide
      if (!name || name.trim().length === 0) {
        throw new Error('Le nom du groupe est requis');
      }

      // Créer la conversation
      const conversation = await Conversation.create({
        type: 'group',
        name: name.trim(),
        description: description?.trim(),
        createdBy: creatorId
      });

      // Ajouter le créateur comme owner
      const members = [
        {
          conversationId: conversation.id,
          userId: creatorId,
          role: 'owner'
        }
      ];

      // Ajouter les autres membres
      const uniqueMemberIds = [...new Set(memberIds.filter(id => id !== creatorId))];
      for (const memberId of uniqueMemberIds) {
        members.push({
          conversationId: conversation.id,
          userId: memberId,
          role: 'member',
          invitedBy: creatorId
        });
      }

      await ConversationMember.bulkCreate(members);

      return await this.getConversationDetails(conversation.id, creatorId);

    } catch (error) {
      throw new Error(error.message || 'Erreur lors de la création du groupe');
    }
  }

  // 📄 RÉCUPÉRER LES DÉTAILS D'UNE CONVERSATION
  async getConversationDetails(conversationId, userId, options = {}) {
    try {

      const conversation = await Conversation.findByPk(conversationId, {
        include: [
          {
            model: ConversationMember,
            as: 'allMembers',
            where: { leftAt: null },
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['id', 'username', 'firstName', 'lastName', 'status', 'lastSeen']
              }
            ]
          },
          {
            model: Message,
            as: 'lastMessage',
            include: [
              {
                model: User,
                as: 'sender',
                attributes: ['id', 'username', 'firstName', 'lastName']
              }
            ]
          }
        ]
      });

      if (!conversation) {
        throw new Error('Conversation non trouvée');
      }

      // Vérifier que l'utilisateur est membre (sauf si skipMemberCheck est activé)
      if (userId && !options.skipMemberCheck) {
        const isMember = await conversation.hasMember(userId);
        if (!isMember) {
          throw new Error('Accès non autorisé à cette conversation');
        }
      }

      return conversation;

    } catch (error) {
      throw new Error(error.message || 'Erreur lors de la récupération des détails');
    }
  }

  // ================================================
  // GESTION DES MESSAGES
  // ================================================

  // 📝 ENVOYER UN MESSAGE
  async sendMessage(senderId, conversationId, content, options = {}) {
    try {
      const { messageType = 'text', replyToId = null, metadata = null } = options;


      // Vérifier que l'utilisateur est membre de la conversation
      const conversation = await Conversation.findByPk(conversationId);
      if (!conversation) {
        throw new Error('Conversation non trouvée');
      }

      const isMember = await conversation.hasMember(senderId);
      if (!isMember) {
        throw new Error('Vous n\'êtes pas membre de cette conversation');
      }

      // Créer le message
      const message = await Message.create({
        content: content.trim(),
        messageType,
        senderId,
        conversationId,
        replyToId,
        metadata,
        status: 'sent'
      });

      // Mettre à jour la conversation
      await conversation.update({
        lastMessageId: message.id,
        lastActivityAt: new Date()
      });

      // Récupérer le message complet avec les associations
      const fullMessage = await Message.findByPk(message.id, {
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'username', 'firstName', 'lastName', 'status']
          },
          {
            model: Message,
            as: 'replyTo',
            attributes: ['id', 'content', 'senderId', 'createdAt'],
            include: [
              {
                model: User,
                as: 'sender',
                attributes: ['id', 'username', 'firstName', 'lastName']
              }
            ]
          }
        ]
      });

      // Ajouter le displayName pour le sender
      if (fullMessage && fullMessage.sender) {
        fullMessage.sender.dataValues.displayName = fullMessage.sender.getFullName();
      }

      // Ajouter le displayName pour le replyTo sender si présent
      if (fullMessage && fullMessage.replyTo && fullMessage.replyTo.sender) {
        fullMessage.replyTo.sender.dataValues.displayName = fullMessage.replyTo.sender.getFullName();
      }


      return fullMessage;

    } catch (error) {
      throw new Error(error.message || 'Erreur lors de l\'envoi du message');
    }
  }

  // 📋 RÉCUPÉRER LES MESSAGES D'UNE CONVERSATION
  async getConversationMessages(conversationId, userId, options = {}) {
    try {
      const { limit = 50, offset = 0, before = null, after = null } = options;


      // Vérifier l'accès
      const conversation = await Conversation.findByPk(conversationId);
      if (!conversation) {
        throw new Error('Conversation non trouvée');
      }

      const isMember = await conversation.hasMember(userId);
      if (!isMember) {
        throw new Error('Accès non autorisé à cette conversation');
      }

      // Construire la requête
      const whereClause = { conversationId };
      
      if (before) {
        whereClause.createdAt = { [Op.lt]: new Date(before) };
      }
      if (after) {
        whereClause.createdAt = { [Op.gt]: new Date(after) };
      }

      const messages = await Message.findAll({
        where: whereClause,
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'username', 'firstName', 'lastName', 'status']
          },
          {
            model: Message,
            as: 'replyTo',
            attributes: ['id', 'content', 'senderId', 'createdAt'],
            include: [
              {
                model: User,
                as: 'sender',
                attributes: ['id', 'username', 'firstName', 'lastName']
              }
            ]
          },
          {
            model: MessageRead,
            as: 'readBy',
            attributes: ['userId', 'readAt'],
            include: [
              {
                model: User,
                as: 'reader',
                attributes: ['id', 'username', 'firstName', 'lastName']
              }
            ]
          }
        ]
      });

      // Ajouter displayName et statuts de lecture à tous les messages
      messages.forEach(message => {
        if (message.sender) {
          message.sender.dataValues.displayName = message.sender.getFullName();
        }
        if (message.replyTo && message.replyTo.sender) {
          message.replyTo.sender.dataValues.displayName = message.replyTo.sender.getFullName();
        }
        
        // Ajouter les statuts de lecture
        message.dataValues.isReadByCurrentUser = message.readBy?.some(read => read.userId === userId) || false;
        message.dataValues.readByCount = message.readBy?.length || 0;
        message.dataValues.readers = message.readBy?.map(read => ({
          userId: read.userId,
          readAt: read.readAt,
          user: {
            id: read.reader.id,
            username: read.reader.username,
            displayName: read.reader.getFullName()
          }
        })) || [];
      });

      return {
        messages: messages.reverse(), // Remettre dans l'ordre chronologique
        total: messages.length,
        hasMore: messages.length === limit
      };

    } catch (error) {
      throw new Error(error.message || 'Erreur lors de la récupération des messages');
    }
  }

  // ✏️ MODIFIER UN MESSAGE
  async editMessage(messageId, userId, newContent) {
    try {

      const message = await Message.findByPk(messageId);
      if (!message) {
        throw new Error('Message non trouvé');
      }

      if (message.senderId !== userId) {
        throw new Error('Vous ne pouvez modifier que vos propres messages');
      }

      // Vérifier que le message n'est pas trop ancien (exemple: 24h)
      const maxEditTime = 24 * 60 * 60 * 1000; // 24 heures
      if (Date.now() - new Date(message.createdAt) > maxEditTime) {
        throw new Error('Ce message est trop ancien pour être modifié');
      }

      await message.update({
        content: newContent.trim()
      });

      
      const updatedMessage = await Message.findByPk(messageId, {
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'username', 'firstName', 'lastName']
          }
        ]
      });

      // 🔌 ÉMETTRE ÉVÉNEMENT WEBSOCKET
      if (global.io && updatedMessage) {
        global.io.to(`conversation:${updatedMessage.conversationId}`).emit('message:edited', {
          message: updatedMessage,
          timestamp: new Date().toISOString()
        });
      }

      return updatedMessage;

    } catch (error) {
      throw new Error(error.message || 'Erreur lors de la modification du message');
    }
  }

  // 🗑️ SUPPRIMER UN MESSAGE
  async deleteMessage(messageId, userId) {
    try {

      const message = await Message.findByPk(messageId);
      if (!message) {
        throw new Error('Message non trouvé');
      }

      if (message.senderId !== userId) {
        throw new Error('Vous ne pouvez supprimer que vos propres messages');
      }

      const conversationId = message.conversationId;
      await message.destroy();

      
      // 🔌 ÉMETTRE ÉVÉNEMENT WEBSOCKET
      if (global.io) {
        global.io.to(`conversation:${conversationId}`).emit('message:deleted', {
          messageId,
          conversationId,
          deletedBy: userId,
          timestamp: new Date().toISOString()
        });
      }

      return true;

    } catch (error) {
      throw new Error(error.message || 'Erreur lors de la suppression du message');
    }
  }

  // 📖 MARQUER LES MESSAGES COMME LUS
  async markAsRead(conversationId, userId, messageId = null) {
    try {

      // Récupérer le membre
      const member = await ConversationMember.findOne({
        where: {
          conversationId,
          userId,
          leftAt: null
        }
      });

      if (!member) {
        throw new Error('Vous n\'êtes pas membre de cette conversation');
      }

      // Si pas de messageId spécifique, prendre le dernier message
      let targetMessageId = messageId;
      if (!targetMessageId) {
        const lastMessage = await Message.findOne({
          where: { conversationId },
          order: [['createdAt', 'DESC']]
        });
        targetMessageId = lastMessage ? lastMessage.id : null;
      }

      if (targetMessageId) {
        await member.markAsRead(targetMessageId);
      }

      return true;

    } catch (error) {
      throw new Error(error.message || 'Erreur lors du marquage des messages');
    }
  }

  // ================================================
  // GESTION DES DEMANDES DE CONVERSATION
  // ================================================

  // ✅ ACCEPTER UNE CONVERSATION
  async acceptConversation(conversationId, userId) {
    try {

      const conversation = await Conversation.findByPk(conversationId);
      if (!conversation) {
        throw new Error('Conversation non trouvée');
      }

      // Vérifier que l'utilisateur est membre
      const isMember = await conversation.hasMember(userId);
      if (!isMember) {
        throw new Error('Vous n\'êtes pas membre de cette conversation');
      }

      // Vérifier que la conversation est en attente
      if (conversation.status !== 'pending') {
        throw new Error('Cette conversation n\'est pas en attente d\'acceptation');
      }

      // Accepter la conversation
      await conversation.update({ 
        status: 'accepted',
        lastActivityAt: new Date()
      });


      // Retourner la conversation complète
      return await this.getConversationDetails(conversationId, userId);

    } catch (error) {
      throw new Error(error.message || 'Erreur lors de l\'acceptation de la conversation');
    }
  }

  // ❌ REFUSER UNE CONVERSATION
  async rejectConversation(conversationId, userId) {
    try {

      const conversation = await Conversation.findByPk(conversationId);
      if (!conversation) {
        throw new Error('Conversation non trouvée');
      }

      // Vérifier que l'utilisateur est membre
      const isMember = await conversation.hasMember(userId);
      if (!isMember) {
        throw new Error('Vous n\'êtes pas membre de cette conversation');
      }

      // Vérifier que la conversation est en attente
      if (conversation.status !== 'pending') {
        throw new Error('Cette conversation n\'est pas en attente d\'acceptation');
      }

      // Refuser la conversation
      await conversation.update({ 
        status: 'rejected',
        lastActivityAt: new Date()
      });

      return { success: true, message: 'Conversation refusée' };

    } catch (error) {
      throw new Error(error.message || 'Erreur lors du refus de la conversation');
    }
  }

  // 📋 RÉCUPÉRER LES CONVERSATIONS EN ATTENTE
  async getPendingConversations(userId) {
    try {
      
      const result = await this.getUserConversations(userId, { status: 'pending' });
      
      result.conversations.forEach(conv => {
      });
      
      return result;

    } catch (error) {
      throw new Error(error.message || 'Erreur lors de la récupération des demandes en attente');
    }
  }

  // ================================================
  // GESTION DES CONVERSATIONS (US023)
  // ================================================

  // 🗑️ SUPPRIMER UNE CONVERSATION
  async deleteConversation(conversationId, userId) {
    try {

      // Vérifier que la conversation existe et que l'utilisateur en fait partie
      const conversation = await Conversation.findByPk(conversationId, {
        include: [{
          model: ConversationMember,
          as: 'members',
          where: { userId, leftAt: null },
          required: true
        }]
      });

      if (!conversation) {
        throw new Error('Conversation non trouvée ou accès non autorisé');
      }

      // Pour les conversations privées : marquer comme archivée pour cet utilisateur seulement
      if (conversation.type === 'private') {
        // Marquer le membre comme ayant quitté la conversation
        await ConversationMember.update(
          { leftAt: new Date() },
          { 
            where: { 
              conversationId, 
              userId 
            } 
          }
        );

        return { action: 'archived', type: 'private' };
      }

      // Pour les groupes : utiliser la méthode leaveGroup
      if (conversation.type === 'group') {
        const groupManagementService = require('./groupManagementService');
        return await groupManagementService.leaveGroup(conversationId, userId);
      }

    } catch (error) {
      throw new Error(error.message || 'Erreur lors de la suppression de la conversation');
    }
  }

  // ================================================
  // GESTION DES STATUTS DE LECTURE (US009)
  // ================================================

  // 👁️ MARQUER UN MESSAGE COMME LU
  async markMessageAsRead(messageId, userId) {
    try {

      // Vérifier que le message existe
      const message = await Message.findByPk(messageId, {
        include: [{
          model: Conversation,
          as: 'conversation'
        }]
      });

      if (!message) {
        throw new Error('Message non trouvé');
      }

      // Vérifier que l'utilisateur est membre de la conversation
      const isMember = await message.conversation.hasMember(userId);
      if (!isMember) {
        throw new Error('Vous n\'êtes pas autorisé à lire ce message');
      }

      // Ne pas marquer ses propres messages comme lus
      if (message.senderId === userId) {
        return { success: false, message: 'Impossible de marquer ses propres messages comme lus' };
      }

      // Marquer comme lu
      const { readStatus, wasAlreadyRead } = await MessageRead.markAsRead(messageId, userId);

      return { 
        success: true, 
        wasAlreadyRead,
        readAt: readStatus.readAt 
      };

    } catch (error) {
      throw new Error(error.message || 'Erreur lors du marquage du message');
    }
  }

  // 👁️ MARQUER TOUS LES MESSAGES D'UNE CONVERSATION COMME LUS
  async markConversationAsRead(conversationId, userId, lastMessageId = null) {
    try {

      // Vérifier que la conversation existe et que l'utilisateur est membre
      const conversation = await Conversation.findByPk(conversationId);
      if (!conversation) {
        throw new Error('Conversation non trouvée');
      }

      const isMember = await conversation.hasMember(userId);
      if (!isMember) {
        throw new Error('Vous n\'êtes pas membre de cette conversation');
      }

      // Récupérer les messages non lus de la conversation (excluant les propres messages)
      let whereClause = {
        conversationId,
        senderId: { [Op.ne]: userId } // Exclure ses propres messages
      };

      // Si un lastMessageId est fourni, marquer seulement jusqu'à ce message
      if (lastMessageId) {
        const lastMessage = await Message.findByPk(lastMessageId);
        if (lastMessage) {
          whereClause.createdAt = { [Op.lte]: lastMessage.createdAt };
        }
      }

      const unreadMessages = await Message.findAll({
        where: whereClause,
        attributes: ['id']
      });


      let markedCount = 0;
      for (const message of unreadMessages) {
        const { wasAlreadyRead } = await MessageRead.markAsRead(message.id, userId);
        if (!wasAlreadyRead) {
          markedCount++;
        }
      }

      return { success: true, markedCount, totalProcessed: unreadMessages.length };

    } catch (error) {
      throw new Error(error.message || 'Erreur lors du marquage de la conversation');
    }
  }

  // 📊 OBTENIR LES STATUTS DE LECTURE POUR DES MESSAGES
  async getReadStatusForMessages(messageIds, userId) {
    try {
      
      const readStatuses = await MessageRead.getReadStatusForMessages(messageIds, userId);
      
      // Ajouter les statuts pour les messages non lus
      const statusMap = {};
      messageIds.forEach(id => {
        statusMap[id] = readStatuses[id] || { isRead: false, readAt: null };
      });
      
      return statusMap;

    } catch (error) {
      throw new Error(error.message || 'Erreur lors de la récupération des statuts');
    }
  }

  // 📊 OBTENIR LE NOMBRE DE LECTEURS D'UN MESSAGE
  async getMessageReadCount(messageId) {
    try {
      const count = await MessageRead.getMessageReadCount(messageId);
      return count;
    } catch (error) {
      throw new Error('Erreur lors du comptage des lecteurs');
    }
  }

  // 👥 OBTENIR LA LISTE DES LECTEURS D'UN MESSAGE
  async getMessageReaders(messageId) {
    try {
      const readers = await MessageRead.getMessageReaders(messageId);
      return readers;
    } catch (error) {
      throw new Error('Erreur lors de la récupération des lecteurs');
    }
  }

  // 📋 OBTENIR LES MESSAGES NON LUS D'UNE CONVERSATION
  async getUnreadMessages(conversationId, userId) {
    try {
      
      const unreadMessages = await MessageRead.getUnreadMessagesInConversation(conversationId, userId);
      
      return unreadMessages;
    } catch (error) {
      throw new Error('Erreur lors de la récupération des messages non lus');
    }
  }
}


module.exports = new MessageService();