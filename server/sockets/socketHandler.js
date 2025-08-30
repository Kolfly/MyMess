// 🔌 GESTIONNAIRE WEBSOCKET - MESSAGES TEMPS RÉEL
// Gère toutes les connexions WebSocket pour le chat en temps réel

const jwt = require('jsonwebtoken');
const { User } = require('../models/associations');
const messageService = require('../services/messageService');

class SocketHandler {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map(); // socketId -> { userId, user, rooms }
    this.userSockets = new Map(); // userId -> Set of socketIds
    
    this.setupMiddleware();
    this.setupEventHandlers();
    
    console.log('🔌 SocketHandler initialisé');
  }

  // ================================================
  // MIDDLEWARE D'AUTHENTIFICATION
  // ================================================

  setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
        
        console.log('🔐 Tentative d\'authentification WebSocket');
        console.log('Token reçu:', token ? 'Oui' : 'Non');
        
        if (!token) {
          return next(new Error('Token d\'authentification requis'));
        }

        // Vérifier le token JWT
        console.log('🔍 Vérification du token JWT...');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('✅ Token décodé:', { id: decoded.id, userId: decoded.userId, username: decoded.username });
        
        // Utiliser userId du token (c'est le bon champ)
        const userId = decoded.userId || decoded.id;
        console.log(`🔍 Recherche utilisateur avec ID: ${userId}`);
        let user = await User.findByPk(userId, {
          attributes: ['id', 'username', 'firstName', 'lastName', 'email', 'status']
        });

        if (!user) {
          console.warn(`⚠️ Utilisateur avec ID ${userId} non trouvé en base. Tentative de création...`);
          
          // Essayer de créer l'utilisateur basé sur les infos du token
          try {
            user = await User.create({
              id: userId,
              username: decoded.username || `user_${userId.substring(0, 8)}`,
              email: decoded.email || `${decoded.username || 'user'}@temp.local`,
              password: 'TempPass123!', // Mot de passe qui respecte les règles
              firstName: decoded.firstName || null,
              lastName: decoded.lastName || null,
              status: 'online'
            });
            console.log(`✅ Utilisateur créé automatiquement: ${user.username}`);
          } catch (createError) {
            console.error(`❌ Erreur création utilisateur:`, createError.message);
            return next(new Error('Utilisateur non trouvé et création impossible'));
          }
        }

        // Attacher les infos à la socket
        socket.userId = user.id;
        socket.user = user;
        
        console.log(`✅ Authentification WebSocket réussie: ${user.username} (${socket.id})`);
        next();

      } catch (error) {
        console.error('❌ Erreur authentification WebSocket:', error.message);
        if (error.name === 'JsonWebTokenError') {
          next(new Error('Token JWT invalide'));
        } else if (error.name === 'TokenExpiredError') {
          next(new Error('Token JWT expiré'));
        } else {
          next(new Error('Token d\'authentification invalide'));
        }
      }
    });
  }

  // ================================================
  // GESTIONNAIRES D'ÉVÉNEMENTS
  // ================================================

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
      
      // Événements de messages
      socket.on('message:send', (data) => this.handleSendMessage(socket, data));
      socket.on('message:edit', (data) => this.handleEditMessage(socket, data));
      socket.on('message:delete', (data) => this.handleDeleteMessage(socket, data));
      
      // Événements de conversations
      socket.on('conversation:join', (data) => this.handleJoinConversation(socket, data));
      socket.on('conversation:leave', (data) => this.handleLeaveConversation(socket, data));
      // Événements indicateurs de frappe (US010)
      socket.on('typing:start', (data) => this.handleTypingStart(socket, data));
      socket.on('typing:stop', (data) => this.handleTypingStop(socket, data));
      socket.on('conversation:read', (data) => this.handleMarkConversationAsReadOld(socket, data));
      
      // Événements de demandes de conversation (US022)
      socket.on('conversation:accept', (data) => this.handleAcceptConversation(socket, data));
      socket.on('conversation:reject', (data) => this.handleRejectConversation(socket, data));
      
      // Événements statuts de lecture (US009)
      socket.on('message:markAsRead', (data) => this.handleMarkMessageAsRead(socket, data));
      socket.on('conversation:markAsRead', (data) => this.handleMarkConversationAsRead(socket, data));
      
      // Événements de statut
      socket.on('user:status', (data) => this.handleStatusChange(socket, data));
      
      // Déconnexion
      socket.on('disconnect', () => this.handleDisconnection(socket));
    });
  }

  // ================================================
  // GESTION DES CONNEXIONS
  // ================================================

  async handleConnection(socket) {
    try {
      console.log(`👤 Nouvelle connexion authentifiée: ${socket.user.username} (${socket.id})`);

      // Enregistrer la connexion
      this.connectedUsers.set(socket.id, {
        userId: socket.userId,
        user: socket.user,
        rooms: new Set(),
        connectedAt: new Date()
      });

      // Ajouter à la map des sockets par utilisateur
      if (!this.userSockets.has(socket.userId)) {
        this.userSockets.set(socket.userId, new Set());
      }
      this.userSockets.get(socket.userId).add(socket.id);

      // Mettre à jour le statut utilisateur
      await this.updateUserStatus(socket.userId, 'online');

      // Message de bienvenue personnalisé
      const displayName = socket.user.firstName && socket.user.lastName 
        ? `${socket.user.firstName} ${socket.user.lastName}`
        : socket.user.username;
      
      socket.emit('welcome', {
        message: `Bienvenue ${displayName} !`,
        socketId: socket.id,
        user: socket.user,
        timestamp: new Date().toISOString()
      });

      // Rejoindre automatiquement les conversations de l'utilisateur
      await this.joinUserConversations(socket);

      // Notifier les contacts que l'utilisateur est en ligne
      await this.notifyContactsUserOnline(socket.userId);

    } catch (error) {
      console.error('❌ Erreur handleConnection:', error);
      socket.emit('error', { message: 'Erreur lors de la connexion' });
    }
  }

  async handleDisconnection(socket) {
    try {
      console.log(`👋 Déconnexion: ${socket.user?.username} (${socket.id})`);

      // Retirer de la map des connexions
      const userConnection = this.connectedUsers.get(socket.id);
      if (userConnection) {
        this.connectedUsers.delete(socket.id);
        
        // Retirer de la map des sockets par utilisateur
        const userSocketsSet = this.userSockets.get(userConnection.userId);
        if (userSocketsSet) {
          userSocketsSet.delete(socket.id);
          
          // Si plus de sockets pour cet utilisateur, le marquer hors ligne
          if (userSocketsSet.size === 0) {
            this.userSockets.delete(userConnection.userId);
            await this.updateUserStatus(userConnection.userId, 'offline');
            await this.notifyContactsUserOffline(userConnection.userId);
          }
        }
      }

    } catch (error) {
      console.error('❌ Erreur handleDisconnection:', error);
    }
  }

  // ================================================
  // GESTION DES MESSAGES
  // ================================================

  async handleSendMessage(socket, data) {
    try {
      console.log(`📝 Nouveau message de ${socket.user.username}:`, data);

      const { conversationId, content, messageType, replyToId, metadata } = data;

      // Valider les données
      if (!conversationId || !content?.trim()) {
        return socket.emit('error', { message: 'Données de message invalides' });
      }

      // Envoyer le message via le service
      const message = await messageService.sendMessage(
        socket.userId,
        conversationId,
        content,
        { messageType, replyToId, metadata }
      );

      // Émettre le message à tous les membres de la conversation
      this.io.to(`conversation:${conversationId}`).emit('message:new', {
        message,
        conversationId,
        timestamp: new Date().toISOString()
      });

      // Notifier individuellement tous les membres de la conversation
      // (pour les nouvelles conversations où certains membres n'ont pas encore rejoint la room)
      await this.notifyConversationMembers(conversationId, 'message:new', {
        message,
        conversationId,
        timestamp: new Date().toISOString()
      });

      // Notifier également que la liste des conversations doit être mise à jour
      await this.notifyConversationMembers(conversationId, 'conversation:updated', {
        conversationId,
        action: 'new_message',
        timestamp: new Date().toISOString()
      });

      // Confirmer l'envoi à l'expéditeur
      socket.emit('message:sent', {
        tempId: data.tempId, // Pour permettre au client de matcher
        message,
        timestamp: new Date().toISOString()
      });

      console.log(`✅ Message diffusé dans conversation ${conversationId}`);

    } catch (error) {
      console.error('❌ Erreur handleSendMessage:', error);
      socket.emit('error', { 
        message: error.message || 'Erreur lors de l\'envoi du message',
        tempId: data.tempId 
      });
    }
  }

  async handleEditMessage(socket, data) {
    try {
      const { messageId, content } = data;

      const message = await messageService.editMessage(messageId, socket.userId, content);

      // Notifier tous les membres de la conversation
      const conversationRoom = `conversation:${message.conversationId}`;
      this.io.to(conversationRoom).emit('message:edited', {
        message,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur handleEditMessage:', error);
      socket.emit('error', { message: error.message });
    }
  }

  async handleDeleteMessage(socket, data) {
    try {
      const { messageId, conversationId } = data;

      await messageService.deleteMessage(messageId, socket.userId);

      // Notifier tous les membres de la conversation
      this.io.to(`conversation:${conversationId}`).emit('message:deleted', {
        messageId,
        deletedBy: socket.userId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur handleDeleteMessage:', error);
      socket.emit('error', { message: error.message });
    }
  }

  // ================================================
  // GESTION DES CONVERSATIONS
  // ================================================

  async handleJoinConversation(socket, data) {
    try {
      const { conversationId } = data;
      
      // Vérifier l'accès à la conversation
      const conversation = await messageService.getConversationDetails(conversationId, socket.userId);
      
      // Rejoindre la salle
      socket.join(`conversation:${conversationId}`);
      
      // Enregistrer dans la connexion
      const userConnection = this.connectedUsers.get(socket.id);
      if (userConnection) {
        userConnection.rooms.add(conversationId);
      }

      console.log(`👥 ${socket.user.username} a rejoint la conversation ${conversationId}`);
      
      // Notifier les autres membres
      socket.to(`conversation:${conversationId}`).emit('user:joined', {
        user: socket.user,
        conversationId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur handleJoinConversation:', error);
      socket.emit('error', { message: error.message });
    }
  }

  handleLeaveConversation(socket, data) {
    const { conversationId } = data;
    
    socket.leave(`conversation:${conversationId}`);
    
    const userConnection = this.connectedUsers.get(socket.id);
    if (userConnection) {
      userConnection.rooms.delete(conversationId);
    }

    socket.to(`conversation:${conversationId}`).emit('user:left', {
      user: socket.user,
      conversationId,
      timestamp: new Date().toISOString()
    });
  }

  // ================================================
  // GESTION DES INDICATEURS DE FRAPPE (US010)
  // ================================================

  handleTypingStart(socket, data) {
    const { conversationId } = data;
    
    console.log(`⌨️ ${socket.user.username} commence à taper dans ${conversationId}`);
    
    socket.to(`conversation:${conversationId}`).emit('typing:start', {
      user: {
        id: socket.user.id,
        username: socket.user.username,
        displayName: socket.user.firstName && socket.user.lastName 
          ? `${socket.user.firstName} ${socket.user.lastName}`
          : socket.user.username
      },
      conversationId,
      timestamp: new Date().toISOString()
    });
  }

  handleTypingStop(socket, data) {
    const { conversationId } = data;
    
    console.log(`⌨️ ${socket.user.username} arrête de taper dans ${conversationId}`);
    
    socket.to(`conversation:${conversationId}`).emit('typing:stop', {
      user: {
        id: socket.user.id,
        username: socket.user.username,
        displayName: socket.user.firstName && socket.user.lastName 
          ? `${socket.user.firstName} ${socket.user.lastName}`
          : socket.user.username
      },
      conversationId,
      timestamp: new Date().toISOString()
    });
  }

  // Ancienne méthode de marquage - maintenue pour compatibilité
  async handleMarkConversationAsReadOld(socket, data) {
    try {
      const { conversationId, messageId } = data;
      
      await messageService.markAsRead(conversationId, socket.userId, messageId);
      
      socket.to(`conversation:${conversationId}`).emit('message:read', {
        conversationId,
        messageId,
        userId: socket.userId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur handleMarkConversationAsReadOld:', error);
    }
  }

  // ================================================
  // UTILITAIRES
  // ================================================

  async joinUserConversations(socket) {
    try {
      const conversations = await messageService.getUserConversations(socket.userId);
      
      for (const conv of conversations.conversations) {
        socket.join(`conversation:${conv.id}`);
        
        const userConnection = this.connectedUsers.get(socket.id);
        if (userConnection) {
          userConnection.rooms.add(conv.id);
        }
      }

      console.log(`📚 ${socket.user.username} a rejoint ${conversations.conversations.length} conversations`);

    } catch (error) {
      console.error('❌ Erreur joinUserConversations:', error);
    }
  }

  async updateUserStatus(userId, status) {
    try {
      await User.update({ status }, { where: { id: userId } });
    } catch (error) {
      console.error('❌ Erreur updateUserStatus:', error);
    }
  }

  async notifyContactsUserOnline(userId) {
    try {
      // Récupérer les conversations de l'utilisateur pour identifier ses contacts
      const conversations = await messageService.getUserConversations(userId);
      if (!conversations || !conversations.conversations) return;

      // Extraire tous les contacts uniques (autres membres des conversations)
      const contactIds = new Set();
      for (const conv of conversations.conversations) {
        if (conv.allMembers) {
          for (const member of conv.allMembers) {
            if (member.userId !== userId) {
              contactIds.add(member.userId);
            }
          }
        }
      }

      // Notifier seulement les contacts connectés
      for (const contactId of contactIds) {
        const contactSockets = this.userSockets.get(contactId);
        if (contactSockets && contactSockets.size > 0) {
          for (const socketId of contactSockets) {
            const socket = this.io.sockets.sockets.get(socketId);
            if (socket) {
              socket.emit('user:status_changed', {
                userId,
                status: 'online',
                timestamp: new Date().toISOString()
              });
            }
          }
        }
      }

      console.log(`👥 Statut 'online' notifié à ${contactIds.size} contacts pour l'utilisateur ${userId}`);
    } catch (error) {
      console.error('❌ Erreur notifyContactsUserOnline:', error);
    }
  }

  async notifyContactsUserOffline(userId) {
    try {
      // Récupérer les conversations de l'utilisateur pour identifier ses contacts
      const conversations = await messageService.getUserConversations(userId);
      if (!conversations || !conversations.conversations) return;

      // Extraire tous les contacts uniques (autres membres des conversations)
      const contactIds = new Set();
      for (const conv of conversations.conversations) {
        if (conv.allMembers) {
          for (const member of conv.allMembers) {
            if (member.userId !== userId) {
              contactIds.add(member.userId);
            }
          }
        }
      }

      // Notifier seulement les contacts connectés
      for (const contactId of contactIds) {
        const contactSockets = this.userSockets.get(contactId);
        if (contactSockets && contactSockets.size > 0) {
          for (const socketId of contactSockets) {
            const socket = this.io.sockets.sockets.get(socketId);
            if (socket) {
              socket.emit('user:status_changed', {
                userId,
                status: 'offline',
                timestamp: new Date().toISOString()
              });
            }
          }
        }
      }

      console.log(`👥 Statut 'offline' notifié à ${contactIds.size} contacts pour l'utilisateur ${userId}`);
    } catch (error) {
      console.error('❌ Erreur notifyContactsUserOffline:', error);
    }
  }

  async handleStatusChange(socket, data) {
    const { status } = data;
    
    if (['online', 'away', 'busy', 'offline'].includes(status)) {
      await this.updateUserStatus(socket.userId, status);
      
      await this.notifyContactsUserOnline(socket.userId);
    }
  }

  // ================================================
  // MÉTHODES PUBLIQUES
  // ================================================

  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  getConnectedUsers() {
    return Array.from(this.connectedUsers.values()).map(conn => ({
      userId: conn.userId,
      username: conn.user.username,
      connectedAt: conn.connectedAt
    }));
  }

  isUserOnline(userId) {
    return this.userSockets.has(userId);
  }

  // Notifier tous les membres d'une conversation individuellement
  async notifyConversationMembers(conversationId, eventName, data) {
    try {
      // Récupérer tous les membres de la conversation
      const conversation = await messageService.getConversationDetails(conversationId, null, { skipMemberCheck: true });
      if (!conversation || !conversation.allMembers) return;

      // Notifier chaque membre connecté individuellement
      for (const member of conversation.allMembers) {
        const memberSockets = this.userSockets.get(member.userId);
        if (memberSockets && memberSockets.size > 0) {
          // Envoyer à toutes les sockets de ce membre
          for (const socketId of memberSockets) {
            const socket = this.io.sockets.sockets.get(socketId);
            if (socket) {
              socket.emit(eventName, data);
              console.log(`📨 Notification ${eventName} envoyée à ${member.user?.username} (${socketId})`);
            }
          }
        }
      }
    } catch (error) {
      console.error('❌ Erreur notifyConversationMembers:', error);
    }
  }

  // ================================================
  // GESTION DES DEMANDES DE CONVERSATION (US022)
  // ================================================

  async handleAcceptConversation(socket, data) {
    try {
      const { conversationId } = data;
      
      console.log(`✅ ${socket.user.username} accepte la conversation ${conversationId}`);

      // Accepter la conversation via le service
      const conversation = await messageService.acceptConversation(conversationId, socket.userId);
      
      // Notifier tous les membres de la conversation que celle-ci a été acceptée
      await this.notifyConversationMembers(conversationId, 'conversation:accepted', {
        conversationId,
        acceptedBy: socket.userId,
        acceptedByUser: {
          id: socket.user.id,
          username: socket.user.username,
          displayName: socket.user.firstName && socket.user.lastName 
            ? `${socket.user.firstName} ${socket.user.lastName}`
            : socket.user.username
        },
        conversation,
        timestamp: new Date().toISOString()
      });

      // Confirmer l'acceptation à l'utilisateur
      socket.emit('conversation:accepted_success', {
        conversationId,
        conversation,
        timestamp: new Date().toISOString()
      });

      console.log(`✅ Conversation ${conversationId} acceptée par ${socket.user.username}`);

    } catch (error) {
      console.error('❌ Erreur handleAcceptConversation:', error);
      socket.emit('error', { 
        message: error.message || 'Erreur lors de l\'acceptation de la conversation',
        conversationId: data.conversationId
      });
    }
  }

  async handleRejectConversation(socket, data) {
    try {
      const { conversationId } = data;
      
      console.log(`❌ ${socket.user.username} refuse la conversation ${conversationId}`);

      // Refuser la conversation via le service
      await messageService.rejectConversation(conversationId, socket.userId);
      
      // Notifier tous les membres de la conversation que celle-ci a été refusée
      await this.notifyConversationMembers(conversationId, 'conversation:rejected', {
        conversationId,
        rejectedBy: socket.userId,
        rejectedByUser: {
          id: socket.user.id,
          username: socket.user.username,
          displayName: socket.user.firstName && socket.user.lastName 
            ? `${socket.user.firstName} ${socket.user.lastName}`
            : socket.user.username
        },
        timestamp: new Date().toISOString()
      });

      // Confirmer le refus à l'utilisateur
      socket.emit('conversation:rejected_success', {
        conversationId,
        timestamp: new Date().toISOString()
      });

      console.log(`❌ Conversation ${conversationId} refusée par ${socket.user.username}`);

    } catch (error) {
      console.error('❌ Erreur handleRejectConversation:', error);
      socket.emit('error', { 
        message: error.message || 'Erreur lors du refus de la conversation',
        conversationId: data.conversationId
      });
    }
  }

  // ================================================
  // GESTION DES STATUTS DE LECTURE (US009)
  // ================================================

  async handleMarkMessageAsRead(socket, data) {
    try {
      const { messageId } = data;
      
      console.log(`👁️ ${socket.user.username} marque message ${messageId} comme lu`);

      // Marquer comme lu via le service
      const result = await messageService.markMessageAsRead(messageId, socket.userId);
      
      if (result.success) {
        // Récupérer le message pour obtenir la conversationId
        const { Message } = require('../models/associations');
        const message = await Message.findByPk(messageId, {
          attributes: ['id', 'conversationId', 'senderId']
        });

        if (message) {
          // Notifier tous les membres de la conversation du statut de lecture
          await this.notifyConversationMembers(message.conversationId, 'message:readStatus', {
            messageId,
            conversationId: message.conversationId,
            readBy: socket.userId,
            readByUser: {
              id: socket.user.id,
              username: socket.user.username,
              displayName: socket.user.firstName && socket.user.lastName 
                ? `${socket.user.firstName} ${socket.user.lastName}`
                : socket.user.username
            },
            readAt: result.readAt,
            timestamp: new Date().toISOString()
          });

          // Confirmer à l'utilisateur
          socket.emit('message:readConfirmed', {
            messageId,
            readAt: result.readAt,
            timestamp: new Date().toISOString()
          });
        }
      }

    } catch (error) {
      console.error('❌ Erreur handleMarkMessageAsRead:', error);
      socket.emit('error', { 
        message: error.message || 'Erreur lors du marquage du message',
        messageId: data.messageId
      });
    }
  }

  async handleMarkConversationAsRead(socket, data) {
    try {
      const { conversationId, lastMessageId } = data;
      
      console.log(`👁️ ${socket.user.username} marque conversation ${conversationId} comme lue`);

      // Marquer comme lu via le service
      const result = await messageService.markConversationAsRead(
        conversationId, 
        socket.userId, 
        lastMessageId
      );
      
      if (result.success) {
        // Notifier tous les membres de la conversation
        await this.notifyConversationMembers(conversationId, 'conversation:readStatus', {
          conversationId,
          readBy: socket.userId,
          readByUser: {
            id: socket.user.id,
            username: socket.user.username,
            displayName: socket.user.firstName && socket.user.lastName 
              ? `${socket.user.firstName} ${socket.user.lastName}`
              : socket.user.username
          },
          lastMessageId,
          markedCount: result.markedCount,
          totalProcessed: result.totalProcessed,
          timestamp: new Date().toISOString()
        });

        // Confirmer à l'utilisateur
        socket.emit('conversation:readConfirmed', {
          conversationId,
          markedCount: result.markedCount,
          totalProcessed: result.totalProcessed,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      console.error('❌ Erreur handleMarkConversationAsRead:', error);
      socket.emit('error', { 
        message: error.message || 'Erreur lors du marquage de la conversation',
        conversationId: data.conversationId
      });
    }
  }

  // ================================================
  // DIFFUSION DU CHANGEMENT DE STATUT UTILISATEUR
  // ================================================

  broadcastUserStatusChange(userId, newStatus, displayName) {
    try {
      console.log(`📡 Diffusion changement de statut: ${displayName} (${userId}) -> ${newStatus}`);

      // Diffuser à tous les utilisateurs connectés (sauf celui qui change)
      this.io.emit('user:statusChanged', {
        userId,
        status: newStatus,
        displayName: displayName || 'Utilisateur',
        timestamp: new Date().toISOString()
      });

      console.log(`✅ Changement de statut diffusé pour ${displayName}`);
      
    } catch (error) {
      console.error('❌ Erreur broadcastUserStatusChange:', error);
    }
  }
}

module.exports = SocketHandler;