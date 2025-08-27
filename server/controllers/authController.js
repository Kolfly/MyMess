const { validationResult } = require('express-validator');
const authService = require('../services/authService');
const { generateTokenPair } = require('../utils/jwt');

// 🎭 CONTROLLER D'AUTHENTIFICATION
// Le controller est l'interface entre les requêtes HTTP et notre logique métier
// Il orchestre les appels aux services et formate les réponses
class AuthController {

  // 📝 INSCRIPTION D'UN NOUVEL UTILISATEUR
  // Route: POST /api/auth/register
  async register(req, res) {
    try {
      // Étape 1: Vérifier les données d'entrée avec express-validator
      // Ces validations ont été définies dans nos routes (on verra ça plus tard)
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        // Si des erreurs de validation existent, on les retourne clairement
        return res.status(400).json({
          success: false,
          message: 'Erreurs de validation des données',
          errors: errors.array().map(err => ({
            field: err.path,        // Quel champ pose problème
            message: err.msg,       // Message d'erreur lisible
            value: err.value        // Valeur problématique (utile pour debug)
          }))
        });
      }

      // Étape 2: Déléguer la création à notre service
      // Le controller ne connaît pas les détails de comment créer un utilisateur,
      // il fait juste confiance au service pour faire le travail correctement
      const result = await authService.createUser(req.body);

      // Étape 3: Formater une réponse de succès standardisée
      // Une structure cohérente aide les clients (Angular, mobile, etc.) à traiter les réponses
      res.status(201).json({
        success: true,
        message: result.message,
        data: {
          user: result.user,
          token: result.token,
          // Infos utiles pour le client
          tokenType: 'Bearer',
          expiresIn: process.env.JWT_EXPIRE || '7d'
        },
        // Timestamp pour que le client sache quand cette réponse a été générée
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Erreur registration:', error);
      
      // Étape 4: Gestion centralisée des erreurs
      // On traduit les erreurs techniques en messages compréhensibles pour l'utilisateur
      
      if (error.message.includes('existe déjà')) {
        return res.status(409).json({  // 409 = Conflict
          success: false,
          message: error.message,
          code: 'USER_ALREADY_EXISTS'
        });
      }

      if (error.message.includes('validation')) {
        return res.status(400).json({  // 400 = Bad Request
          success: false,
          message: error.message,
          code: 'VALIDATION_ERROR'
        });
      }

      // Erreur générique pour tout ce qu'on n'a pas prévu
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la création du compte',
        code: 'REGISTRATION_ERROR',
        // En développement, on peut donner plus de détails
        ...(process.env.NODE_ENV === 'development' && { 
          details: error.message 
        })
      });
    }
  }

  // 🔐 CONNEXION D'UN UTILISATEUR
  // Route: POST /api/auth/login
  async login(req, res) {
    try {
      // Validation des données d'entrée
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Données de connexion invalides',
          errors: errors.array().map(err => ({
            field: err.path,
            message: err.msg
          }))
        });
      }

      const { email, password } = req.body;

      // Déléguer l'authentification au service
      const result = await authService.authenticateUser(email, password);

      // Générer une paire complète de tokens (access + refresh)
      const tokenPair = generateTokenPair(result.user.id);

      // Enregistrer des infos de connexion utiles (pour les stats, la sécurité, etc.)
      const loginInfo = {
        loginTime: new Date().toISOString(),
        userAgent: req.get('User-Agent'),  // Navigateur/app utilisé
        ip: req.ip || req.connection.remoteAddress,  // Adresse IP
        // On ne stocke pas ces infos dans la DB pour l'instant, mais on pourrait
      };

      res.status(200).json({
        success: true,
        message: 'Connexion réussie',
        data: {
          user: result.user,
          tokens: {
            accessToken: tokenPair.accessToken,
            refreshToken: tokenPair.refreshToken,
            tokenType: tokenPair.tokenType,
            expiresIn: tokenPair.expiresIn,
            refreshExpiresIn: tokenPair.refreshExpiresIn
          }
        },
        meta: {
          loginInfo,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Erreur login:', error);
      
      // Gestion spécialisée des erreurs de connexion
      if (error.message.includes('incorrect') || error.message.includes('invalide')) {
        // On ne donne pas trop de détails pour éviter l'énumération des comptes
        return res.status(401).json({  // 401 = Unauthorized
          success: false,
          message: 'Identifiants invalides',
          code: 'INVALID_CREDENTIALS'
        });
      }

      if (error.message.includes('bloqué')) {
        return res.status(423).json({  // 423 = Locked
          success: false,
          message: error.message,
          code: 'ACCOUNT_LOCKED'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la connexion',
        code: 'LOGIN_ERROR',
        ...(process.env.NODE_ENV === 'development' && { 
          details: error.message 
        })
      });
    }
  }

  // 👋 DÉCONNEXION
  // Route: POST /api/auth/logout
  async logout(req, res) {
    try {
      // req.user est disponible grâce à notre middleware d'authentification
      await authService.logoutUser(req.user.id);

      // En production, on pourrait aussi ajouter le token à une "blacklist"
      // pour s'assurer qu'il ne peut plus être utilisé même avant expiration

      res.status(200).json({
        success: true,
        message: 'Déconnexion réussie',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Erreur logout:', error);
      
      // Même si la déconnexion échoue côté serveur, 
      // on peut considérer que c'est réussi côté client
      res.status(200).json({
        success: true,
        message: 'Déconnexion effectuée',
        note: 'Une erreur mineure s\'est produite côté serveur, mais vous êtes bien déconnecté'
      });
    }
  }

  // 👤 RÉCUPÉRER LE PROFIL DE L'UTILISATEUR CONNECTÉ
  // Route: GET /api/auth/me
  async getMe(req, res) {
    try {
      // Le middleware d'authentification nous garantit que req.user existe
      const result = await authService.getUserById(req.user.id);

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Erreur getMe:', error);
      
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération du profil',
        code: 'PROFILE_FETCH_ERROR'
      });
    }
  }

  // ✏️ MISE À JOUR DU PROFIL
  // Route: PUT /api/auth/profile
  async updateProfile(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Erreurs de validation',
          errors: errors.array().map(err => ({
            field: err.path,
            message: err.msg,
            value: err.value
          }))
        });
      }

      // Déléguer la mise à jour au service
      const result = await authService.updateUserProfile(req.user.id, req.body);

      res.status(200).json({
        success: true,
        message: result.message,
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Erreur updateProfile:', error);
      
      if (error.message.includes('déjà pris')) {
        return res.status(409).json({
          success: false,
          message: error.message,
          code: 'USERNAME_TAKEN'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erreur lors de la mise à jour du profil',
        code: 'PROFILE_UPDATE_ERROR'
      });
    }
  }

  // 🔄 RENOUVELLEMENT DU TOKEN
  // Route: POST /api/auth/refresh
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Token de rafraîchissement requis',
          code: 'REFRESH_TOKEN_REQUIRED'
        });
      }

      // Utiliser notre utilitaire JWT pour renouveler le token
      const { refreshAccessToken } = require('../utils/jwt');
      const newTokenData = refreshAccessToken(refreshToken);

      res.status(200).json({
        success: true,
        message: 'Token renouvelé avec succès',
        data: {
          tokens: newTokenData
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Erreur refreshToken:', error);
      
      if (error.message.includes('Token') || error.message.includes('token')) {
        return res.status(401).json({
          success: false,
          message: 'Token de rafraîchissement invalide ou expiré',
          code: 'INVALID_REFRESH_TOKEN'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Erreur lors du renouvellement du token',
        code: 'TOKEN_REFRESH_ERROR'
      });
    }
  }

  // 🔐 CHANGEMENT DE MOT DE PASSE
  // Route: PUT /api/auth/change-password
  async changePassword(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Erreurs de validation',
          errors: errors.array().map(err => ({
            field: err.path,
            message: err.msg
          }))
        });
      }

      const { currentPassword, newPassword } = req.body;

      // Vérifier d'abord le mot de passe actuel
      try {
        await authService.authenticateUser(req.user.email, currentPassword);
      } catch (authError) {
        return res.status(401).json({
          success: false,
          message: 'Mot de passe actuel incorrect',
          code: 'INVALID_CURRENT_PASSWORD'
        });
      }

      // Mettre à jour avec le nouveau mot de passe
      const bcrypt = require('bcryptjs');
      const hashedNewPassword = await bcrypt.hash(newPassword, 12);
      
      await req.user.update({ password: hashedNewPassword });

      res.status(200).json({
        success: true,
        message: 'Mot de passe modifié avec succès',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Erreur changePassword:', error);
      
      res.status(500).json({
        success: false,
        message: 'Erreur lors du changement de mot de passe',
        code: 'PASSWORD_CHANGE_ERROR'
      });
    }
  }

  // 📊 STATISTIQUES DU COMPTE (bonus)
  // Route: GET /api/auth/stats
  async getAccountStats(req, res) {
    try {
      // Récupérer quelques statistiques utiles sur le compte
      const stats = {
        accountAge: Math.floor((Date.now() - new Date(req.user.createdAt)) / (1000 * 60 * 60 * 24)), // Âge en jours
        lastLogin: req.user.lastLogin,
        currentStatus: req.user.status,
        profileCompletion: this.calculateProfileCompletion(req.user),
        securityScore: this.calculateSecurityScore(req.user)
      };

      res.status(200).json({
        success: true,
        data: { stats },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Erreur getAccountStats:', error);
      
      res.status(500).json({
        success: false,
        message: 'Erreur lors de la récupération des statistiques',
        code: 'STATS_ERROR'
      });
    }
  }

  // 🧮 MÉTHODES UTILITAIRES PRIVÉES

  // Calculer le pourcentage de complétion du profil
  calculateProfileCompletion(user) {
    const fields = ['firstName', 'lastName', 'avatar'];
    const completedFields = fields.filter(field => user[field] && user[field].trim() !== '');
    return Math.round((completedFields.length / fields.length) * 100);
  }

  // Calculer un score de sécurité basique
  calculateSecurityScore(user) {
    let score = 50; // Score de base
    
    if (user.firstName && user.lastName) score += 10; // Profil complet
    if (user.failedLoginAttempts === 0) score += 20; // Pas de tentatives échouées récentes
    if (user.lastLogin && (Date.now() - new Date(user.lastLogin)) < 7 * 24 * 60 * 60 * 1000) {
      score += 20; // Connexion récente
    }
    
    return Math.min(100, score);
  }
}

// Exporter une instance unique du controller
module.exports = new AuthController();