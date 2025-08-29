// 👁️ MODÈLE MESSAGE READ - SEQUELIZE  
// Modèle pour tracker les statuts de lecture des messages

const { DataTypes } = require('sequelize');
const sequelize = require('../database/config/database');

const MessageRead = sequelize.define('MessageRead', {
  // 🔑 ID unique du statut de lecture
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    comment: 'Identifiant unique du statut de lecture'
  },

  // 📝 MESSAGE ASSOCIÉ
  messageId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'messages',
      key: 'id'
    },
    onDelete: 'CASCADE',
    comment: 'ID du message lu'
  },

  // 👤 UTILISATEUR QUI A LU
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE',
    comment: 'ID de l\'utilisateur qui a lu le message'
  },

  // 🕒 DATE DE LECTURE
  readAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'Date et heure de lecture du message'
  }

}, {
  // ⚙️ OPTIONS DU MODÈLE
  tableName: 'message_reads',
  timestamps: false, // Nous gérons readAt manuellement
  
  // 📊 INDEX POUR PERFORMANCES
  indexes: [
    {
      fields: ['message_id'],
      name: 'idx_message_reads_message'
    },
    {
      fields: ['user_id'],
      name: 'idx_message_reads_user'
    },
    {
      unique: true,
      fields: ['message_id', 'user_id'],
      name: 'idx_message_reads_unique'
    },
    {
      fields: ['read_at'],
      name: 'idx_message_reads_date'
    }
  ]
});

// 📋 MÉTHODES STATIQUES
MessageRead.markAsRead = async function(messageId, userId) {
  // Éviter les doublons - utiliser findOrCreate
  const [readStatus, created] = await this.findOrCreate({
    where: {
      messageId,
      userId
    },
    defaults: {
      messageId,
      userId,
      readAt: new Date()
    }
  });

  return { readStatus, wasAlreadyRead: !created };
};

MessageRead.getReadStatusForMessages = async function(messageIds, userId) {
  if (!messageIds || messageIds.length === 0) return {};
  
  const readStatuses = await this.findAll({
    where: {
      messageId: messageIds,
      userId
    },
    attributes: ['messageId', 'readAt']
  });

  // Convertir en map pour faciliter l'accès
  const statusMap = {};
  readStatuses.forEach(status => {
    statusMap[status.messageId] = {
      isRead: true,
      readAt: status.readAt
    };
  });

  return statusMap;
};

MessageRead.getMessageReadCount = async function(messageId) {
  return await this.count({
    where: { messageId }
  });
};

MessageRead.getMessageReaders = async function(messageId) {
  const User = require('./User');
  
  return await this.findAll({
    where: { messageId },
    include: [{
      model: User,
      as: 'reader',
      attributes: ['id', 'username', 'firstName', 'lastName']
    }],
    order: [['readAt', 'ASC']]
  });
};

// Obtenir les messages non lus pour un utilisateur dans une conversation
MessageRead.getUnreadMessagesInConversation = async function(conversationId, userId) {
  const Message = require('./Message');
  
  const messages = await Message.findAll({
    where: {
      conversationId,
      senderId: { [sequelize.Sequelize.Op.ne]: userId } // Exclure ses propres messages
    },
    attributes: ['id', 'createdAt']
  });

  if (messages.length === 0) return [];

  const messageIds = messages.map(m => m.id);
  const readStatuses = await this.findAll({
    where: {
      messageId: messageIds,
      userId
    },
    attributes: ['messageId']
  });

  const readMessageIds = readStatuses.map(r => r.messageId);
  
  // Retourner les messages non lus
  return messages.filter(m => !readMessageIds.includes(m.id));
};

console.log('✅ Modèle MessageRead défini');

module.exports = MessageRead;