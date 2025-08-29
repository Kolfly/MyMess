// 🔗 ASSOCIATIONS ENTRE MODÈLES SEQUELIZE
// Définit toutes les relations entre User, Conversation, Message et ConversationMember

const User = require('./User');
const Conversation = require('./Conversation');
const Message = require('./Message');
const ConversationMember = require('./ConversationMember');
const MessageRead = require('./MessageRead');

console.log('🔗 Configuration des associations entre modèles...');

// ================================================
// ASSOCIATIONS USER ↔ CONVERSATION (Many-to-Many via ConversationMember)
// ================================================

User.belongsToMany(Conversation, {
  through: ConversationMember,
  foreignKey: 'userId',
  otherKey: 'conversationId',
  as: 'conversations'
});

Conversation.belongsToMany(User, {
  through: ConversationMember,
  foreignKey: 'conversationId',
  otherKey: 'userId',
  as: 'users'
});

// ================================================
// ASSOCIATIONS USER ↔ CONVERSATION_MEMBER
// ================================================

User.hasMany(ConversationMember, {
  foreignKey: 'userId',
  as: 'memberships'
});

ConversationMember.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

// Association pour qui a invité
User.hasMany(ConversationMember, {
  foreignKey: 'invitedBy',
  as: 'invitations'
});

ConversationMember.belongsTo(User, {
  foreignKey: 'invitedBy',
  as: 'inviter'
});

// ================================================
// ASSOCIATIONS CONVERSATION ↔ CONVERSATION_MEMBER  
// ================================================

Conversation.hasMany(ConversationMember, {
  foreignKey: 'conversationId',
  as: 'members'
});

ConversationMember.belongsTo(Conversation, {
  foreignKey: 'conversationId',
  as: 'conversation'
});

// Association spéciale pour les membres actifs
Conversation.hasMany(ConversationMember, {
  foreignKey: 'conversationId',
  as: 'allMembers',
  scope: {
    leftAt: null
  }
});

// ================================================
// ASSOCIATIONS USER ↔ MESSAGE
// ================================================

User.hasMany(Message, {
  foreignKey: 'senderId',
  as: 'sentMessages'
});

Message.belongsTo(User, {
  foreignKey: 'senderId',
  as: 'sender'
});

// ================================================
// ASSOCIATIONS CONVERSATION ↔ MESSAGE
// ================================================

Conversation.hasMany(Message, {
  foreignKey: 'conversationId',
  as: 'messages'
});

Message.belongsTo(Conversation, {
  foreignKey: 'conversationId',
  as: 'conversation'
});

// Association pour le dernier message
Conversation.belongsTo(Message, {
  foreignKey: 'lastMessageId',
  as: 'lastMessage'
});

// ================================================
// ASSOCIATIONS MESSAGE ↔ MESSAGE (Réponses)
// ================================================

Message.hasMany(Message, {
  foreignKey: 'replyToId',
  as: 'replies'
});

Message.belongsTo(Message, {
  foreignKey: 'replyToId',
  as: 'replyTo'
});

// ================================================
// ASSOCIATIONS USER ↔ CONVERSATION (Créateur)
// ================================================

User.hasMany(Conversation, {
  foreignKey: 'createdBy',
  as: 'createdConversations'
});

Conversation.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator'
});

// ================================================
// ASSOCIATIONS CONVERSATION_MEMBER ↔ MESSAGE (Dernière lecture)
// ================================================

ConversationMember.belongsTo(Message, {
  foreignKey: 'lastReadMessageId',
  as: 'lastReadMessage'
});

// ================================================
// ASSOCIATIONS MESSAGE_READ
// ================================================

// User ↔ MessageRead (Un utilisateur peut lire plusieurs messages)
User.hasMany(MessageRead, {
  foreignKey: 'userId',
  as: 'readMessages'
});

MessageRead.belongsTo(User, {
  foreignKey: 'userId',
  as: 'reader'
});

// Message ↔ MessageRead (Un message peut être lu par plusieurs utilisateurs)
Message.hasMany(MessageRead, {
  foreignKey: 'messageId',
  as: 'readBy'
});

MessageRead.belongsTo(Message, {
  foreignKey: 'messageId',
  as: 'message'
});

console.log('✅ Associations configurées:');
console.log('   👤 User ↔ Conversation (many-to-many via ConversationMember)');
console.log('   💬 User ↔ Message (one-to-many)');
console.log('   💬 Conversation ↔ Message (one-to-many)');
console.log('   💬 Message ↔ Message (replies)');
console.log('   👥 ConversationMember relations');
console.log('   👁️ MessageRead relations (lecture des messages)');

module.exports = {
  User,
  Conversation,
  Message,
  ConversationMember,
  MessageRead
};