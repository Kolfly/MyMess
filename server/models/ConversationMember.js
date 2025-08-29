// 👥 MODÈLE CONVERSATION MEMBER - SEQUELIZE
// Modèle pour représenter l'appartenance d'un utilisateur à une conversation

const { DataTypes } = require('sequelize');
const sequelize = require('../database/config/database');

const ConversationMember = sequelize.define('ConversationMember', {
  // 🔑 ID unique du membre
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    comment: 'Identifiant unique du membre de conversation'
  },

  // 👤 UTILISATEUR
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'CASCADE',
    comment: 'ID de l\'utilisateur membre'
  },

  // 💬 CONVERSATION
  conversationId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'conversations',
      key: 'id'
    },
    onDelete: 'CASCADE',
    comment: 'ID de la conversation'
  },

  // 🏷️ RÔLE DANS LA CONVERSATION
  role: {
    type: DataTypes.ENUM('member', 'admin', 'owner'),
    defaultValue: 'member',
    allowNull: false,
    comment: 'Rôle de l\'utilisateur dans la conversation'
  },

  // 📅 DATES D'APPARTENANCE
  joinedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
    comment: 'Date d\'ajout à la conversation'
  },

  leftAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Date de sortie de la conversation (null = toujours membre)'
  },

  // 👤 QUI A AJOUTÉ CET UTILISATEUR
  invitedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    onDelete: 'SET NULL',
    comment: 'ID de l\'utilisateur qui a invité ce membre'
  },

  // 📖 STATUT DE LECTURE
  lastReadMessageId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'messages',
      key: 'id'
    },
    onDelete: 'SET NULL',
    comment: 'ID du dernier message lu par ce membre'
  },

  lastReadAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Date de dernière lecture'
  },

  // 🔔 PARAMÈTRES DE NOTIFICATION
  notificationsEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
    comment: 'Notifications activées pour cette conversation'
  },

  isMuted: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    comment: 'Conversation en sourdine'
  },

  mutedUntil: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Date de fin de mise en sourdine'
  },

  // 📎 PARAMÈTRES PERSONNALISÉS
  nickname: {
    type: DataTypes.STRING(50),
    allowNull: true,
    validate: {
      len: [1, 50]
    },
    comment: 'Surnom personnalisé dans cette conversation'
  },

  customSettings: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {},
    comment: 'Paramètres personnalisés du membre'
  }

}, {
  // ⚙️ OPTIONS DU MODÈLE
  tableName: 'conversation_members',
  timestamps: true,
  
  // 📊 INDEX POUR PERFORMANCES
  indexes: [
    {
      fields: ['user_id', 'conversation_id'],
      unique: true,
      name: 'idx_conversation_members_unique'
    },
    {
      fields: ['conversation_id', 'left_at'],
      name: 'idx_conversation_members_active'
    },
    {
      fields: ['user_id', 'left_at'],
      name: 'idx_user_active_conversations'
    },
    {
      fields: ['role'],
      name: 'idx_conversation_members_role'
    }
  ],

  // 🕐 HOOKS
  hooks: {
    beforeUpdate: (member, options) => {
      // Si on marque comme sorti, mettre la date
      if (member.changed('leftAt') && member.leftAt && !member._previousDataValues.leftAt) {
        member.leftAt = new Date();
      }
      
      // Si on lit un message, mettre à jour lastReadAt
      if (member.changed('lastReadMessageId')) {
        member.lastReadAt = new Date();
      }
    }
  }
});

// 📋 MÉTHODES D'INSTANCE
ConversationMember.prototype.toJSON = function() {
  const values = { ...this.get() };
  
  // Calculer si les notifications sont effectivement actives
  values.notificationsActive = values.notificationsEnabled && 
    !values.isMuted && 
    (!values.mutedUntil || new Date() > values.mutedUntil);
  
  return values;
};

// Vérifier si le membre est admin ou owner
ConversationMember.prototype.canManage = function() {
  return this.role === 'admin' || this.role === 'owner';
};

// Vérifier si le membre peut inviter d'autres utilisateurs
ConversationMember.prototype.canInvite = function() {
  return this.role === 'admin' || this.role === 'owner';
};

// Marquer un message comme lu
ConversationMember.prototype.markAsRead = async function(messageId) {
  await this.update({
    lastReadMessageId: messageId,
    lastReadAt: new Date()
  });
};

// 📋 MÉTHODES STATIQUES
ConversationMember.getActiveMembers = async function(conversationId) {
  return await this.findAll({
    where: {
      conversationId,
      leftAt: null
    },
    include: [
      {
        association: 'user',
        attributes: ['id', 'username', 'firstName', 'lastName', 'status', 'lastSeenAt']
      }
    ],
    order: [['joinedAt', 'ASC']]
  });
};

ConversationMember.getAdmins = async function(conversationId) {
  return await this.findAll({
    where: {
      conversationId,
      role: ['admin', 'owner'],
      leftAt: null
    },
    include: [
      {
        association: 'user',
        attributes: ['id', 'username', 'firstName', 'lastName']
      }
    ]
  });
};

ConversationMember.getUserRole = async function(conversationId, userId) {
  const member = await this.findOne({
    where: {
      conversationId,
      userId,
      leftAt: null
    }
  });
  
  return member ? member.role : null;
};

ConversationMember.getUnreadCount = async function(conversationId, userId) {
  const member = await this.findOne({
    where: {
      conversationId,
      userId,
      leftAt: null
    }
  });

  if (!member) return 0;

  const Message = require('./Message');
  return await Message.count({
    where: {
      conversationId,
      createdAt: {
        [require('sequelize').Op.gt]: member.lastReadAt || member.joinedAt
      },
      senderId: {
        [require('sequelize').Op.ne]: userId
      }
    }
  });
};

console.log('✅ Modèle ConversationMember défini');

module.exports = ConversationMember;