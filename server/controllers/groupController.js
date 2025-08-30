// 👥 CONTROLLER GROUPES - GESTION DES GROUPES (US012)
// Contrôleur pour toutes les actions de gestion des groupes

const groupManagementService = require('../services/groupManagementService');

class GroupController {

  // 👤 AJOUTER DES MEMBRES À UN GROUPE
  async addMembers(req, res) {
    try {
      console.log(`👤 [${req.method}] ${req.originalUrl} - Utilisateur: ${req.user.id}`);

      const { conversationId } = req.params;
      const { memberIds } = req.body;

      if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Veuillez fournir une liste de membres à ajouter',
          code: 'INVALID_MEMBER_IDS',
          timestamp: new Date().toISOString()
        });
      }

      const result = await groupManagementService.addMembersToGroup(
        conversationId, 
        req.user.id, 
        memberIds
      );

      res.status(200).json({
        success: true,
        message: `${result.addedCount} membre(s) ajouté(s) avec succès`,
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur addMembers:', error.message);
      
      const statusCode = error.message.includes('permissions') ? 403 : 400;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: 'ADD_MEMBERS_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // ❌ SUPPRIMER UN MEMBRE D'UN GROUPE
  async removeMember(req, res) {
    try {
      console.log(`❌ [${req.method}] ${req.originalUrl} - Utilisateur: ${req.user.id}`);

      const { conversationId, memberId } = req.params;

      const result = await groupManagementService.removeMemberFromGroup(
        conversationId, 
        req.user.id, 
        memberId
      );

      res.status(200).json({
        success: true,
        message: 'Membre supprimé avec succès',
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur removeMember:', error.message);
      
      const statusCode = error.message.includes('permissions') ? 403 : 400;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: 'REMOVE_MEMBER_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // ⚙️ MODIFIER LES PARAMÈTRES D'UN GROUPE
  async updateSettings(req, res) {
    try {
      console.log(`⚙️ [${req.method}] ${req.originalUrl} - Utilisateur: ${req.user.id}`);

      const { conversationId } = req.params;
      const { name, description } = req.body;

      const result = await groupManagementService.updateGroupSettings(
        conversationId, 
        req.user.id, 
        { name, description }
      );

      res.status(200).json({
        success: true,
        message: 'Paramètres du groupe mis à jour avec succès',
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur updateSettings:', error.message);
      
      const statusCode = error.message.includes('permissions') ? 403 : 400;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: 'UPDATE_GROUP_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // 👑 MODIFIER LE RÔLE D'UN MEMBRE
  async updateMemberRole(req, res) {
    try {
      console.log(`👑 [${req.method}] ${req.originalUrl} - Utilisateur: ${req.user.id}`);

      const { conversationId, memberId } = req.params;
      const { role } = req.body;

      const result = await groupManagementService.updateMemberRole(
        conversationId, 
        req.user.id, 
        memberId,
        role
      );

      res.status(200).json({
        success: true,
        message: 'Rôle du membre mis à jour avec succès',
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur updateMemberRole:', error.message);
      
      const statusCode = error.message.includes('propriétaire') ? 403 : 400;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: 'UPDATE_ROLE_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // 📋 OBTENIR LES DÉTAILS D'UN GROUPE
  async getDetails(req, res) {
    try {
      console.log(`📋 [${req.method}] ${req.originalUrl} - Utilisateur: ${req.user.id}`);

      const { conversationId } = req.params;

      const result = await groupManagementService.getGroupDetails(
        conversationId, 
        req.user.id
      );

      res.status(200).json({
        success: true,
        message: 'Détails du groupe récupérés avec succès',
        data: result.data,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur getDetails:', error.message);
      
      const statusCode = error.message.includes('membre') ? 403 : 400;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: 'GET_GROUP_DETAILS_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }

  // 🚪 QUITTER UN GROUPE (US025)
  async leaveGroup(req, res) {
    try {
      console.log(`🚪 [${req.method}] ${req.originalUrl} - Utilisateur: ${req.user.id}`);

      const { conversationId } = req.params;

      const result = await groupManagementService.leaveGroup(conversationId, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Vous avez quitté le groupe avec succès',
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Erreur leaveGroup:', error.message);
      
      const statusCode = error.message.includes('non trouvé') ? 404 :
                        error.message.includes('membre') ? 403 : 500;

      res.status(statusCode).json({
        success: false,
        message: error.message,
        code: 'LEAVE_GROUP_ERROR',
        timestamp: new Date().toISOString()
      });
    }
  }
}

console.log('✅ GroupController créé');

module.exports = new GroupController();