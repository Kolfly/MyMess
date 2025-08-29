// 💬 MODÈLE CONVERSATION - SEQUELIZE  
// Modèle pour représenter une conversation (chat privé ou groupe)

const { DataTypes } = require('sequelize');
const sequelize = require('../database/config/database');

const Conversation = sequelize.define('Conversation', {
  // 🔑 ID unique de la conversation
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    comment: 'Identifiant unique de la conversation'
  },

  // 📝 INFORMATIONS DE BASE
  name: {
    type: DataTypes.STRING(100),
    allowNull: true, // null pour conversations privées, nom pour groupes
    validate: {
      len: {
        args: [1, 100],
        msg: 'Le nom de la conversation doit faire entre 1 et 100 caractères'
      }
    },
    comment: 'Nom de la conversation (groupes seulement)'
  },

  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: {
        args: [0, 500],
        msg: 'La description ne peut pas dépasser 500 caractères'
      }
    },
    comment: 'Description de la conversation (groupes seulement)'
  },

  // 🏷️ TYPE DE CONVERSATION
  type: {
    type: DataTypes.ENUM('private', 'group'),
    defaultValue: 'private',
    allowNull: false,
    comment: 'Type de conversation: private (2 personnes) ou group (3+)'
  },

  // 📋 STATUT DE LA CONVERSATION (pour système de demandes)
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'rejected'),
    defaultValue: 'accepted', // Par défaut accepté (pour compatibilité avec conversations existantes)
    allowNull: false,
    comment: 'Statut de la conversation: pending (en attente), accepted (acceptée), rejected (refusée)'
  },

  // 👤 CRÉATEUR DE LA CONVERSATION
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE',
    comment: 'ID de l\'utilisateur qui a créé la conversation'
  },

  // 📸 IMAGE DE GROUPE
  avatar: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'URL de l\'avatar de la conversation (groupes seulement)'
  },

  // 🔒 PARAMÈTRES DE CONFIDENTIALITÉ
  isArchived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: 'Conversation archivée'
  },

  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
    comment: 'Conversation active'
  },

  // 💬 DERNIER MESSAGE
  lastMessageId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'messages',
      key: 'id'
    },
    onDelete: 'SET NULL',
    comment: 'ID du dernier message de la conversation'
  },

  lastActivityAt: {
    type: DataTypes.DATE,
    allowNull: true,
    defaultValue: DataTypes.NOW,
    comment: 'Date de dernière activité dans la conversation'
  },

  // 📊 PARAMÈTRES GROUPE
  maxMembers: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
    allowNull: true,
    validate: {
      min: 2,
      max: 500
    },
    comment: 'Nombre maximum de membres (groupes seulement)'
  },

  // 🔧 MÉTADONNÉES
  settings: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: 'Paramètres spécifiques de la conversation'
  }

}, {
  // ⚙️ OPTIONS DU MODÈLE
  tableName: 'conversations',
  timestamps: true,
  
  // 📊 INDEX POUR PERFORMANCES
  indexes: [
    {
      fields: ['type'],
      name: 'idx_conversations_type'
    },
    {
      fields: ['status'],
      name: 'idx_conversations_status'
    },
    {
      fields: ['created_by'],
      name: 'idx_conversations_creator'
    },
    {
      fields: ['last_activity_at'],
      name: 'idx_conversations_last_activity'
    },
    {
      fields: ['is_active'],
      name: 'idx_conversations_active'
    }
  ],

  // 🕐 HOOKS
  hooks: {
    beforeCreate: (conversation, options) => {
      conversation.lastActivityAt = new Date();
    }
  }
});

// 📋 MÉTHODES D'INSTANCE
Conversation.prototype.toJSON = function() {
  const values = { ...this.get() };
  
  // Masquer certains champs sensibles si nécessaire
  if (values.settings && values.settings.private) {
    delete values.settings.adminKeys;
  }
  
  return values;
};

// Vérifier si un utilisateur est membre
Conversation.prototype.hasMember = async function(userId) {
  const ConversationMember = require('./ConversationMember');
  const member = await ConversationMember.findOne({
    where: {
      conversationId: this.id,
      userId: userId,
      leftAt: null
    }
  });
  return !!member;
};

// Obtenir le nombre de membres
Conversation.prototype.getMemberCount = async function() {
  const ConversationMember = require('./ConversationMember');
  return await ConversationMember.count({
    where: {
      conversationId: this.id,
      leftAt: null
    }
  });
};

// 📋 MÉTHODES STATIQUES
Conversation.findUserConversations = async function(userId, options = {}) {
  const { limit = 20, offset = 0, includeArchived = false } = options;
  
  const ConversationMember = require('./ConversationMember');
  const User = require('./User');
  const Message = require('./Message');

  return await this.findAll({
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
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'username', 'firstName', 'lastName', 'status', 'lastSeenAt']
          }
        ]
      },
      {
        model: Message,
        as: 'lastMessage',
        attributes: ['id', 'content', 'messageType', 'senderId', 'createdAt'],
        include: [
          {
            model: User,
            as: 'sender',
            attributes: ['id', 'username', 'firstName', 'lastName']
          }
        ]
      }
    ],
    where: includeArchived ? {} : { isArchived: false },
    order: [['lastActivityAt', 'DESC']],
    limit,
    offset
  });
};

Conversation.findPrivateConversation = async function(user1Id, user2Id) {
  const ConversationMember = require('./ConversationMember');
  
  // Chercher une conversation privée entre ces deux utilisateurs
  const conversations = await this.findAll({
    where: { type: 'private' },
    include: [
      {
        model: ConversationMember,
        as: 'members',
        where: {
          userId: [user1Id, user2Id],
          leftAt: null
        }
      }
    ]
  });

  // Trouver la conversation qui a exactement ces deux utilisateurs
  for (const conv of conversations) {
    const memberIds = conv.members.map(m => m.userId);
    if (memberIds.length === 2 && 
        memberIds.includes(user1Id) && 
        memberIds.includes(user2Id)) {
      return conv;
    }
  }
  
  return null;
};

console.log('✅ Modèle Conversation défini');

module.exports = Conversation;