// 👥 SERVICE GESTION DE GROUPE - US012
// Gère toute la logique de gestion des groupes

const { User, Conversation, ConversationMember } = require('../models/associations');
const { Op } = require('sequelize');

class GroupManagementService {

  // 👤 AJOUTER DES MEMBRES À UN GROUPE
  async addMembersToGroup(conversationId, userId, memberIds) {
    try {

      // Vérifier que l'utilisateur est admin du groupe
      const userMember = await ConversationMember.findOne({
        where: {
          conversationId,
          userId,
          leftAt: null,
          role: { [Op.in]: ['owner', 'admin'] }
        }
      });

      if (!userMember) {
        throw new Error('Vous n\'avez pas les permissions pour ajouter des membres');
      }

      // Vérifier que la conversation est un groupe
      const conversation = await Conversation.findByPk(conversationId);
      if (!conversation || conversation.type !== 'group') {
        throw new Error('Cette conversation n\'est pas un groupe');
      }

      // Filtrer les membres déjà présents
      const existingMembers = await ConversationMember.findAll({
        where: {
          conversationId,
          userId: { [Op.in]: memberIds },
          leftAt: null
        }
      });

      const existingMemberIds = existingMembers.map(m => m.userId);
      const newMemberIds = memberIds.filter(id => !existingMemberIds.includes(id));

      if (newMemberIds.length === 0) {
        throw new Error('Tous les utilisateurs sont déjà membres du groupe');
      }

      // Ajouter les nouveaux membres
      const newMembers = newMemberIds.map(memberId => ({
        conversationId,
        userId: memberId,
        role: 'member',
        joinedAt: new Date()
      }));

      await ConversationMember.bulkCreate(newMembers);

      return { success: true, addedCount: newMemberIds.length };

    } catch (error) {
      throw new Error(error.message || 'Erreur lors de l\'ajout des membres');
    }
  }

  // ❌ SUPPRIMER UN MEMBRE D'UN GROUPE
  async removeMemberFromGroup(conversationId, userId, memberIdToRemove) {
    try {

      // Vérifier que l'utilisateur est admin du groupe
      const userMember = await ConversationMember.findOne({
        where: {
          conversationId,
          userId,
          leftAt: null,
          role: { [Op.in]: ['owner', 'admin'] }
        }
      });

      if (!userMember) {
        throw new Error('Vous n\'avez pas les permissions pour supprimer des membres');
      }

      // Vérifier que le membre à supprimer existe
      const memberToRemove = await ConversationMember.findOne({
        where: {
          conversationId,
          userId: memberIdToRemove,
          leftAt: null
        }
      });

      if (!memberToRemove) {
        throw new Error('Ce membre n\'est pas dans le groupe');
      }

      // Empêcher la suppression du owner par un admin
      if (memberToRemove.role === 'owner' && userMember.role !== 'owner') {
        throw new Error('Impossible de supprimer le propriétaire du groupe');
      }

      // Marquer le membre comme ayant quitté
      await memberToRemove.update({ leftAt: new Date() });

      return { success: true };

    } catch (error) {
      throw new Error(error.message || 'Erreur lors de la suppression du membre');
    }
  }

  // ⚙️ MODIFIER LES PARAMÈTRES D'UN GROUPE
  async updateGroupSettings(conversationId, userId, updates) {
    try {

      // Vérifier que l'utilisateur est admin du groupe
      const userMember = await ConversationMember.findOne({
        where: {
          conversationId,
          userId,
          leftAt: null,
          role: { [Op.in]: ['owner', 'admin'] }
        }
      });

      if (!userMember) {
        throw new Error('Vous n\'avez pas les permissions pour modifier ce groupe');
      }

      // Vérifier que la conversation est un groupe
      const conversation = await Conversation.findByPk(conversationId);
      if (!conversation || conversation.type !== 'group') {
        throw new Error('Cette conversation n\'est pas un groupe');
      }

      // Préparer les mises à jour autorisées
      const allowedUpdates = {};
      if (updates.name && updates.name.trim().length > 0) {
        allowedUpdates.name = updates.name.trim();
      }
      if (updates.description !== undefined) {
        allowedUpdates.description = updates.description?.trim() || null;
      }

      if (Object.keys(allowedUpdates).length === 0) {
        throw new Error('Aucune modification valide fournie');
      }

      // Mettre à jour la conversation
      await conversation.update(allowedUpdates);

      return { success: true, updated: allowedUpdates };

    } catch (error) {
      throw new Error(error.message || 'Erreur lors de la modification du groupe');
    }
  }

  // 👑 MODIFIER LE RÔLE D'UN MEMBRE
  async updateMemberRole(conversationId, userId, memberIdToUpdate, newRole) {
    try {

      // Vérifier que l'utilisateur est owner du groupe
      const userMember = await ConversationMember.findOne({
        where: {
          conversationId,
          userId,
          leftAt: null,
          role: 'owner'
        }
      });

      if (!userMember) {
        throw new Error('Seul le propriétaire peut modifier les rôles');
      }

      // Vérifier que le membre existe
      const memberToUpdate = await ConversationMember.findOne({
        where: {
          conversationId,
          userId: memberIdToUpdate,
          leftAt: null
        }
      });

      if (!memberToUpdate) {
        throw new Error('Ce membre n\'est pas dans le groupe');
      }

      // Vérifier que le nouveau rôle est valide
      if (!['member', 'admin'].includes(newRole)) {
        throw new Error('Rôle non valide');
      }

      // Mettre à jour le rôle
      await memberToUpdate.update({ role: newRole });

      return { success: true, newRole };

    } catch (error) {
      throw new Error(error.message || 'Erreur lors de la modification du rôle');
    }
  }

  // 📋 OBTENIR LES DÉTAILS D'UN GROUPE AVEC PERMISSIONS
  async getGroupDetails(conversationId, userId) {
    try {

      // Récupérer la conversation avec tous les membres
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
                attributes: ['id', 'username', 'firstName', 'lastName', 'status']
              }
            ]
          }
        ]
      });

      if (!conversation || conversation.type !== 'group') {
        throw new Error('Groupe non trouvé');
      }

      // Vérifier que l'utilisateur est membre
      const userMember = conversation.allMembers.find(member => member.userId === userId);
      if (!userMember) {
        throw new Error('Vous n\'êtes pas membre de ce groupe');
      }

      // Déterminer les permissions
      const canManage = ['owner', 'admin'].includes(userMember.role);
      const isOwner = userMember.role === 'owner';

      return {
        success: true,
        data: {
          id: conversation.id,
          name: conversation.name,
          description: conversation.description,
          type: conversation.type,
          createdAt: conversation.createdAt,
          allMembers: conversation.allMembers.map(member => ({
            id: member.id,
            userId: member.userId,
            role: member.role,
            joinedAt: member.joinedAt,
            user: {
              id: member.user.id,
              username: member.user.username,
              displayName: member.user.firstName && member.user.lastName 
                ? `${member.user.firstName} ${member.user.lastName}` 
                : member.user.username,
              status: member.user.status
            }
          })),
          currentUserRole: userMember.role,
          permissions: {
            canAddMembers: canManage,
            canRemoveMembers: canManage,
            canUpdateSettings: canManage,
            canUpdateRoles: isOwner
          }
        }
      };

    } catch (error) {
      throw new Error(error.message || 'Erreur lors de la récupération des détails du groupe');
    }
  }

  // 🚪 QUITTER UN GROUPE (US025)
  async leaveGroup(conversationId, userId) {
    try {

      // Vérifier que la conversation existe et est un groupe
      const conversation = await Conversation.findByPk(conversationId, {
        include: [{
          model: ConversationMember,
          as: 'allMembers',
          where: { leftAt: null }
        }]
      });

      if (!conversation || conversation.type !== 'group') {
        throw new Error('Groupe non trouvé');
      }

      // Vérifier que l'utilisateur est membre du groupe
      const userMember = conversation.allMembers.find(member => member.userId === userId);
      if (!userMember) {
        throw new Error('Vous n\'êtes pas membre de ce groupe');
      }

      // Marquer l'utilisateur comme ayant quitté le groupe
      await userMember.update({ leftAt: new Date() });

      // Gérer le cas du propriétaire qui quitte
      if (userMember.role === 'owner') {
        const remainingMembers = conversation.allMembers.filter(m => m.userId !== userId);
        
        if (remainingMembers.length > 0) {
          // Transférer la propriété au premier admin, ou au premier membre
          const newOwner = remainingMembers.find(m => m.role === 'admin') || remainingMembers[0];
          await newOwner.update({ role: 'owner' });
        } else {
          // Si plus de membres, supprimer le groupe complètement
          await conversation.update({ isActive: false });
        }
      }

      // Notifier via WebSocket les autres membres que l'utilisateur a quitté
      if (global.socketHandler) {
        await global.socketHandler.notifyConversationMembers(conversationId, 'group:member_left', {
          conversationId,
          leftUserId: userId,
          timestamp: new Date().toISOString()
        });
      }

      return { 
        success: true, 
        action: 'left',
        groupId: conversationId
      };

    } catch (error) {
      throw new Error(error.message || 'Erreur lors de la sortie du groupe');
    }
  }
}

module.exports = new GroupManagementService();