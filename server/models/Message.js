// 💬 MODÈLE MESSAGE - SEQUELIZE
// Modèle pour représenter un message dans le système de chat

const { DataTypes } = require('sequelize');
const sequelize = require('../database/config/database');

const Message = sequelize.define('Message', {
  // 🔑 ID unique du message
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    comment: 'Identifiant unique du message'
  },

  // 📝 CONTENU DU MESSAGE
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Le contenu du message ne peut pas être vide'
      },
      len: {
        args: [1, 2000],
        msg: 'Le message doit faire entre 1 et 2000 caractères'
      }
    },
    comment: 'Contenu textuel du message'
  },

  // 📎 TYPE DE MESSAGE
  messageType: {
    type: DataTypes.ENUM('text', 'image', 'file', 'system'),
    defaultValue: 'text',
    allowNull: false,
    comment: 'Type de message: text, image, file, system'
  },

  // 👤 EXPÉDITEUR (référence vers User)
  senderId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE',
    comment: 'ID de l\'utilisateur qui a envoyé le message'
  },

  // 💬 CONVERSATION (référence vers Conversation)
  conversationId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'conversations',
      key: 'id'
    },
    onDelete: 'CASCADE',
    comment: 'ID de la conversation à laquelle appartient le message'
  },

  // 📅 STATUT DU MESSAGE
  status: {
    type: DataTypes.ENUM('sent', 'delivered', 'read'),
    defaultValue: 'sent',
    allowNull: false,
    comment: 'Statut de livraison du message'
  },

  // ✏️ MESSAGE MODIFIÉ
  isEdited: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: 'Indique si le message a été modifié'
  },

  editedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Date de dernière modification du message'
  },

  // 📎 MÉTADONNÉES POUR FILES/IMAGES
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Métadonnées du message (taille fichier, dimensions image, etc.)'
  },

  // 💬 RÉPONSE À UN MESSAGE
  replyToId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'messages',
      key: 'id'
    },
    onDelete: 'SET NULL',
    comment: 'ID du message auquel celui-ci répond (optionnel)'
  }

}, {
  // ⚙️ OPTIONS DU MODÈLE
  tableName: 'messages',
  timestamps: true, // createdAt, updatedAt automatiques
  
  // 📊 INDEX POUR PERFORMANCES
  indexes: [
    {
      fields: ['conversation_id', 'created_at'],
      name: 'idx_messages_conversation_date'
    },
    {
      fields: ['sender_id'],
      name: 'idx_messages_sender'
    },
    {
      fields: ['status'],
      name: 'idx_messages_status'
    }
  ],

  // 🕐 HOOKS
  hooks: {
    beforeUpdate: (message, options) => {
      // Si le contenu change, marquer comme édité
      if (message.changed('content')) {
        message.isEdited = true;
        message.editedAt = new Date();
      }
    }
  }
});

// 📋 MÉTHODES D'INSTANCE
Message.prototype.toJSON = function() {
  const values = { ...this.get() };
  
  // Ajouter des champs calculés
  values.isRecent = (Date.now() - new Date(values.createdAt)) < (5 * 60 * 1000); // 5 minutes
  
  return values;
};

// 📋 MÉTHODES STATIQUES
Message.getRecentMessages = async function(conversationId, limit = 50) {
  return await this.findAll({
    where: { conversationId },
    order: [['createdAt', 'DESC']],
    limit,
    include: [
      {
        association: 'sender',
        attributes: ['id', 'username', 'firstName', 'lastName', 'status']
      },
      {
        association: 'replyTo',
        attributes: ['id', 'content', 'senderId', 'createdAt']
      }
    ]
  });
};

Message.markAsRead = async function(messageIds, userId) {
  return await this.update(
    { status: 'read' },
    { 
      where: { 
        id: messageIds,
        senderId: { [require('sequelize').Op.ne]: userId } // Ne pas marquer ses propres messages
      }
    }
  );
};

Message.getUnreadCount = async function(conversationId, userId) {
  return await this.count({
    where: {
      conversationId,
      senderId: { [require('sequelize').Op.ne]: userId },
      status: { [require('sequelize').Op.ne]: 'read' }
    }
  });
};


module.exports = Message;