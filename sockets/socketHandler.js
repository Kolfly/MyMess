const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

// 🔌 GESTIONNAIRE DES CONNEXIONS WEBSOCKET
// Ce fichier gère toutes les connexions en temps réel via Socket.io

const socketHandler = (io) => {
  console.log('🔌 Socket.io handler initialisé');

  // Map pour garder la trace des utilisateurs connectés
  const connectedUsers = new Map(); // userId -> { socketId, username, status }

  // Middleware d'authentification pour Socket.io
  io.use(async (socket, next) => {
    try {
      // Récupérer le token depuis les paramètres de connexion
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      
      if (!token) {
        return next(new Error('Token d\'authentification requis'));
      }

      // Vérifier le token JWT
      const decoded = verifyToken(token, 'access');
      
      // Récupérer l'utilisateur depuis la base
      const user = await User.findOne({
        where: { 
          id: decoded.userId,
          isActive: true
        }
      });
      
      if (!user) {
        return next(new Error('Utilisateur introuvable ou compte désactivé'));
      }

      // Vérifier que le compte n'est pas bloqué
      if (user.isLocked()) {
        return next(new Error('Compte temporairement bloqué'));
      }

      // Ajouter l'utilisateur au socket pour usage ultérieur
      socket.userId = user.id;
      socket.user = user;
      
      next();
    } catch (error) {
      next(new Error('Authentification socket échouée: ' + error.message));
    }
  });

  // Gestion des connexions
  io.on('connection', async (socket) => {
    const user = socket.user;
    
    console.log(`👤 Utilisateur connecté: ${user.username} (${user.id}) - Socket: ${socket.id}`);

    try {
      // Mettre à jour le statut de l'utilisateur à "online"
      await user.update({
        status: 'online',
        lastSeen: new Date()
      });

      // Ajouter à notre map des utilisateurs connectés
      connectedUsers.set(user.id, {
        socketId: socket.id,
        username: user.username,
        status: user.status,
        connectedAt: new Date()
      });

      // Informer les autres utilisateurs qu'un ami est en ligne
      socket.broadcast.emit('user:online', {
        userId: user.id,
        username: user.username,
        status: 'online'
      });

      // Envoyer à l'utilisateur la liste des utilisateurs en ligne
      const onlineUsers = Array.from(connectedUsers.values()).map(userData => ({
        userId: userData.userId,
        username: userData.username,
        status: userData.status
      }));

      socket.emit('users:online_list', {
        users: onlineUsers,
        count: onlineUsers.length
      });

    } catch (error) {
      console.error('Erreur lors de la connexion:', error);
    }

    // 💬 ÉVÉNEMENTS DE CHAT

    // Rejoindre une "room" pour les conversations privées ou de groupe
    socket.on('conversation:join', async (data) => {
      try {
        const { conversationId } = data;
        
        // TODO: Vérifier que l'utilisateur a le droit d'accéder à cette conversation
        // Pour l'instant, on fait confiance au client
        
        await socket.join(`conversation_${conversationId}`);
        console.log(`📨 ${user.username} a rejoint la conversation ${conversationId}`);
        
        socket.emit('conversation:joined', { 
          conversationId,
          message: 'Vous avez rejoint la conversation'
        });
        
      } catch (error) {
        socket.emit('error', { 
          type: 'conversation_join_failed',
          message: 'Impossible de rejoindre la conversation'
        });
      }
    });

    // Quitter une conversation
    socket.on('conversation:leave', async (data) => {
      try {
        const { conversationId } = data;
        
        await socket.leave(`conversation_${conversationId}`);
        console.log(`📤 ${user.username} a quitté la conversation ${conversationId}`);
        
        socket.emit('conversation:left', { conversationId });
        
      } catch (error) {
        socket.emit('error', {
          type: 'conversation_leave_failed', 
          message: 'Erreur lors de la sortie de conversation'
        });
      }
    });

    // Envoyer un message (placeholder - sera connecté à la base plus tard)
    socket.on('message:send', async (data) => {
      try {
        const { conversationId, content, type = 'text' } = data;
        
        // TODO: Valider et sauvegarder le message en base de données
        // Pour l'instant, on fait juste du temps réel
        
        const messageData = {
          id: Date.now(), // ID temporaire
          conversationId,
          senderId: user.id,
          senderUsername: user.username,
          content,
          type,
          timestamp: new Date().toISOString()
        };
        
        // Envoyer le message à tous les participants de la conversation
        io.to(`conversation_${conversationId}`).emit('message:received', messageData);
        
        console.log(`💬 Message de ${user.username} dans conversation ${conversationId}: ${content}`);
        
      } catch (error) {
        socket.emit('error', {
          type: 'message_send_failed',
          message: 'Impossible d\'envoyer le message'
        });
      }
    });

    // Indiquer que l'utilisateur est en train de taper
    socket.on('typing:start', (data) => {
      const { conversationId } = data;
      
      socket.to(`conversation_${conversationId}`).emit('typing:user_started', {
        userId: user.id,
        username: user.username,
        conversationId
      });
    });

    // Indiquer que l'utilisateur a arrêté de taper
    socket.on('typing:stop', (data) => {
      const { conversationId } = data;
      
      socket.to(`conversation_${conversationId}`).emit('typing:user_stopped', {
        userId: user.id,
        username: user.username,
        conversationId
      });
    });

    // 👤 ÉVÉNEMENTS DE STATUT UTILISATEUR

    // Changer son statut (online, away, busy, etc.)
    socket.on('status:change', async (data) => {
      try {
        const { status } = data;
        const validStatuses = ['online', 'away', 'busy', 'invisible'];
        
        if (!validStatuses.includes(status)) {
          return socket.emit('error', {
            type: 'invalid_status',
            message: 'Statut invalide'
          });
        }
        
        // Mettre à jour en base
        await user.update({ status });
        
        // Mettre à jour dans notre map
        const userData = connectedUsers.get(user.id);
        if (userData) {
          userData.status = status;
          connectedUsers.set(user.id, userData);
        }
        
        // Notifier les autres utilisateurs
        socket.broadcast.emit('user:status_changed', {
          userId: user.id,
          username: user.username,
          status: status
        });
        
        socket.emit('status:changed', { status });
        
      } catch (error) {
        socket.emit('error', {
          type: 'status_change_failed',
          message: 'Impossible de changer le statut'
        });
      }
    });

    // 🔌 GESTION DE LA DÉCONNEXION
    socket.on('disconnect', async (reason) => {
      console.log(`👋 Utilisateur déconnecté: ${user.username} - Raison: ${reason}`);
      
      try {
        // Mettre à jour le statut à "offline"
        await user.update({
          status: 'offline',
          lastSeen: new Date()
        });
        
        // Supprimer de notre map
        connectedUsers.delete(user.id);
        
        // Informer les autres utilisateurs
        socket.broadcast.emit('user:offline', {
          userId: user.id,
          username: user.username,
          lastSeen: new Date().toISOString()
        });
        
      } catch (error) {
        console.error('Erreur lors de la déconnexion:', error);
      }
    });

    // Gestion des erreurs de socket
    socket.on('error', (error) => {
      console.error(`❌ Erreur socket pour ${user.username}:`, error);
    });

    // Ping/pong pour maintenir la connexion
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });
  });

  // 📊 FONCTIONS UTILITAIRES

  // Obtenir la liste des utilisateurs en ligne
  const getOnlineUsers = () => {
    return Array.from(connectedUsers.entries()).map(([userId, userData]) => ({
      userId,
      username: userData.username,
      status: userData.status,
      connectedAt: userData.connectedAt
    }));
  };

  // Envoyer un message à un utilisateur spécifique
  const sendToUser = (userId, event, data) => {
    const userData = connectedUsers.get(userId);
    if (userData) {
      io.to(userData.socketId).emit(event, data);
      return true;
    }
    return false;
  };

  // Envoyer un message à tous les utilisateurs en ligne
  const broadcastToAll = (event, data) => {
    io.emit(event, data);
  };

  // Statistiques en temps réel
  const getStats = () => {
    return {
      connectedUsers: connectedUsers.size,
      totalConnections: io.engine.clientsCount,
      timestamp: new Date().toISOString()
    };
  };

  // Log périodique des statistiques (en mode développement)
  if (process.env.NODE_ENV === 'development') {
    setInterval(() => {
      const stats = getStats();
      if (stats.connectedUsers > 0) {
        console.log('📊 Socket Stats:', JSON.stringify(stats));
      }
    }, 30000); // Toutes les 30 secondes
  }

  // Exporter les fonctions utilitaires pour usage externe
  io.getOnlineUsers = getOnlineUsers;
  io.sendToUser = sendToUser;
  io.broadcastToAll = broadcastToAll;
  io.getStats = getStats;
  
  console.log('✅ Socket.io configuré avec succès');
};

module.exports = socketHandler;