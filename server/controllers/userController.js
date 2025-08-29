const authService = require('../services/authService');
const { validationResult } = require('express-validator');

class UserController {

  // ================================================
  // GESTION DES PROFILS UTILISATEUR
  // ================================================

  // 👤 RÉCUPÉRER LE PROFIL D'UN UTILISATEUR SPÉCIFIQUE
  async getUserById(req, res) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'ID utilisateur requis'
        });
      }

      console.log('🔄 Récupération du profil utilisateur:', userId);

      const user = await authService.getUserFromToken(req.headers.authorization?.split(' ')[1]);
      
      if (!user || user.user.id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Accès non autorisé à ce profil'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Profil récupéré avec succès',
        data: {
          user: user.user
        }
      });

    } catch (error) {
      console.error('❌ Erreur récupération profil:', error.message);
      
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du profil'
      });
    }
  }

  // ✏️ MISE À JOUR DU PROFIL UTILISATEUR
  async updateUserProfile(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Données invalides',
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      const { firstName, lastName, username, avatar } = req.body;

      console.log('🔄 Mise à jour du profil utilisateur:', userId);

      // Mettre à jour via le service
      const result = await authService.updateUserProfile(userId, {
        firstName,
        lastName,
        username,
        avatar
      });

      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          user: result.user
        }
      });

    } catch (error) {
      console.error('❌ Erreur mise à jour profil:', error.message);
      
      if (error.message.includes('déjà pris') || error.message.includes('déjà utilisé')) {
        return res.status(409).json({
          success: false,
          message: error.message
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour du profil'
      });
    }
  }

  // 🔄 MISE À JOUR DU STATUT UTILISATEUR
  async updateUserStatus(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Statut invalide',
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      const { status } = req.body;

      console.log('🔄 Mise à jour du statut utilisateur:', userId, '→', status);

      // Mettre à jour via le service
      const result = await authService.updateUserStatus(userId, status);

      return res.status(200).json({
        success: true,
        message: result.message,
        data: {
          user: result.user
        }
      });

    } catch (error) {
      console.error('❌ Erreur mise à jour statut:', error.message);
      
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // ================================================
  // RECHERCHE ET DÉCOUVERTE D'UTILISATEURS
  // ================================================

  // 🔍 RECHERCHER DES UTILISATEURS
  async searchUsers(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Paramètres de recherche invalides',
          errors: errors.array()
        });
      }

      const { q: query, limit = 10 } = req.query;
      const currentUserId = req.user.id;

      if (!query || query.trim().length < 2) {
        return res.status(400).json({
          success: false,
          message: 'La recherche doit contenir au moins 2 caractères'
        });
      }

      console.log('🔄 Recherche d\'utilisateurs:', query, 'par utilisateur:', currentUserId);

      // Rechercher via le service
      const result = await authService.searchUsers(query.trim(), currentUserId, parseInt(limit));

      return res.status(200).json({
        success: true,
        message: `${result.count} utilisateur(s) trouvé(s)`,
        data: {
          users: result.users,
          query: query.trim(),
          count: result.count
        }
      });

    } catch (error) {
      console.error('❌ Erreur recherche utilisateurs:', error.message);
      
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la recherche d\'utilisateurs'
      });
    }
  }

  // 🌐 RÉCUPÉRER LES UTILISATEURS EN LIGNE
  async getOnlineUsers(req, res) {
    try {
      const { limit = 50 } = req.query;
      
      console.log('🔄 Récupération des utilisateurs en ligne');

      // Utiliser les méthodes statiques du modèle User
      const User = require('../models/User');
      const onlineUsers = await User.findOnlineUsers();

      // Limiter les résultats
      const limitedUsers = onlineUsers.slice(0, parseInt(limit));

      return res.status(200).json({
        success: true,
        message: `${limitedUsers.length} utilisateur(s) en ligne`,
        data: {
          users: limitedUsers.map(user => user.toMinimalJSON()),
          total: onlineUsers.length,
          limit: parseInt(limit)
        }
      });

    } catch (error) {
      console.error('❌ Erreur récupération utilisateurs en ligne:', error.message);
      
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des utilisateurs en ligne'
      });
    }
  }

  // 📊 STATISTIQUES UTILISATEURS
  async getUserStatistics(req, res) {
    try {
      console.log('🔄 Récupération des statistiques utilisateurs');

      // Récupérer les statistiques via le service
      const stats = await authService.getUserStatistics();

      return res.status(200).json({
        success: true,
        message: 'Statistiques récupérées avec succès',
        data: {
          statistics: stats
        }
      });

    } catch (error) {
      console.error('❌ Erreur récupération statistiques:', error.message);
      
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques'
      });
    }
  }

  // ================================================
  // GESTION DE L'ACTIVITÉ UTILISATEUR
  // ================================================

  // 👁️ METTRE À JOUR LA DERNIÈRE ACTIVITÉ
  async updateLastSeen(req, res) {
    try {
      const userId = req.user.id;

      console.log('🔄 Mise à jour de la dernière activité pour:', userId);

      // Mettre à jour la dernière activité
      const User = require('../models/User');
      const user = await User.findByPk(userId);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur introuvable'
        });
      }

      await user.update({ lastSeen: new Date() });

      return res.status(200).json({
        success: true,
        message: 'Dernière activité mise à jour',
        data: {
          lastSeen: user.lastSeen
        }
      });

    } catch (error) {
      console.error('❌ Erreur mise à jour dernière activité:', error.message);
      
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour de l\'activité'
      });
    }
  }

  // ================================================
  // VALIDATION ET VÉRIFICATION
  // ================================================

  // ✅ VÉRIFIER LA DISPONIBILITÉ D'UN NOM D'UTILISATEUR
  async checkUsernameAvailability(req, res) {
    try {
      const { username } = req.params;

      if (!username || username.length < 3) {
        return res.status(400).json({
          success: false,
          message: 'Nom d\'utilisateur invalide'
        });
      }

      console.log('🔄 Vérification de la disponibilité du username:', username);

      const User = require('../models/User');
      const existingUser = await User.findOne({ 
        where: { 
          username: username,
          id: { [require('sequelize').Op.ne]: req.user?.id || null }
        } 
      });

      const isAvailable = !existingUser;

      return res.status(200).json({
        success: true,
        message: isAvailable ? 'Nom d\'utilisateur disponible' : 'Nom d\'utilisateur déjà pris',
        data: {
          username: username,
          available: isAvailable
        }
      });

    } catch (error) {
      console.error('❌ Erreur vérification username:', error.message);
      
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification du nom d\'utilisateur'
      });
    }
  }

  // ✅ VÉRIFIER LA DISPONIBILITÉ D'UN EMAIL
  async checkEmailAvailability(req, res) {
    try {
      const { email } = req.params;

      if (!email || !email.includes('@')) {
        return res.status(400).json({
          success: false,
          message: 'Adresse email invalide'
        });
      }

      console.log('🔄 Vérification de la disponibilité de l\'email:', email);

      const User = require('../models/User');
      const existingUser = await User.findOne({ 
        where: { 
          email: email.toLowerCase(),
          id: { [require('sequelize').Op.ne]: req.user?.id || null }
        } 
      });

      const isAvailable = !existingUser;

      return res.status(200).json({
        success: true,
        message: isAvailable ? 'Adresse email disponible' : 'Adresse email déjà utilisée',
        data: {
          email: email.toLowerCase(),
          available: isAvailable
        }
      });

    } catch (error) {
      console.error('❌ Erreur vérification email:', error.message);
      
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la vérification de l\'adresse email'
      });
    }
  }

  // ================================================
  // PROFIL PUBLIC
  // ================================================

  // 👁️ RÉCUPÉRER LE PROFIL PUBLIC D'UN UTILISATEUR
  async getPublicProfile(req, res) {
    try {
      const { username } = req.params;

      if (!username) {
        return res.status(400).json({
          success: false,
          message: 'Nom d\'utilisateur requis'
        });
      }

      console.log('🔄 Récupération du profil public pour:', username);

      const User = require('../models/User');
      const user = await User.findOne({ 
        where: { 
          username: username,
          isActive: true,
          emailVerified: true
        }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Utilisateur introuvable'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Profil public récupéré avec succès',
        data: {
          user: user.toMinimalJSON()
        }
      });

    } catch (error) {
      console.error('❌ Erreur récupération profil public:', error.message);
      
      return res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du profil public'
      });
    }
  }
}

module.exports = new UserController();