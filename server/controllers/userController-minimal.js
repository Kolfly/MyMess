const { validationResult } = require('express-validator');

class UserController {

  // 📊 STATISTIQUES UTILISATEURS - Version simplifiée
  async getUserStatistics(req, res) {
    try {
      console.log('🔄 Récupération des statistiques utilisateurs');

      // Version basique sans authService pour éviter les erreurs
      const User = require('../models/User');
      const { Op } = require('sequelize');
      
      const [total, active, verified] = await Promise.all([
        User.count(),
        User.count({ where: { isActive: true } }),
        User.count({ where: { isActive: true, emailVerified: true } })
      ]);

      const online = await User.count({ 
        where: { 
          isActive: true, 
          status: { [Op.in]: ['online', 'away', 'busy'] }
        } 
      });

      return res.status(200).json({
        success: true,
        message: 'Statistiques récupérées avec succès',
        data: {
          statistics: {
            total,
            active,
            online,
            offline: active - online,
            verified,
            unverified: total - verified
          }
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

  // 🌐 RÉCUPÉRER LES UTILISATEURS EN LIGNE - Version simplifiée
  async getOnlineUsers(req, res) {
    try {
      const { limit = 50 } = req.query;
      
      console.log('🔄 Récupération des utilisateurs en ligne');

      const User = require('../models/User');
      const { Op } = require('sequelize');
      
      const onlineUsers = await User.findAll({
        where: {
          isActive: true,
          emailVerified: true,
          status: { [Op.in]: ['online', 'away', 'busy'] }
        },
        limit: parseInt(limit),
        order: [['lastSeen', 'DESC']],
        attributes: ['id', 'username', 'firstName', 'lastName', 'avatar', 'status', 'lastSeen']
      });

      return res.status(200).json({
        success: true,
        message: `${onlineUsers.length} utilisateur(s) en ligne`,
        data: {
          users: onlineUsers.map(user => user.toMinimalJSON()),
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

  // Route de fallback simple
  async fallback(req, res) {
    return res.status(501).json({
      success: false,
      message: 'Cette fonctionnalité utilisateur est en cours de développement',
      availableRoutes: [
        'GET /api/users/statistics - Statistiques',
        'GET /api/users/online - Utilisateurs en ligne'
      ]
    });
  }
}

module.exports = new UserController();