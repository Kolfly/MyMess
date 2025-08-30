const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const User = require('../models/User');
const { generateTokenPair, extractUserIdFromToken, verifyToken } = require('../utils/jwt');
const crypto = require('crypto');

// Service d'authentification - Le cerveau de la gestion des utilisateurs
// Ce service contient toute la logique métier complexe pour créer, authentifier et gérer les utilisateurs
// Il fait l'interface entre les données brutes et les fonctionnalités de haut niveau
class AuthenticationService {

  // ================================================
  // CRÉATION ET INSCRIPTION D'UTILISATEURS
  // ================================================

  // Créer un nouveau compte utilisateur avec toutes les vérifications de sécurité
  async createUserAccount(userData) {
    const { username, email, password, firstName, lastName } = userData;

    try {
      console.log('🔄 Tentative de création de compte pour:', email);

      // Étape 1: Vérifications préalables de sécurité et d'unicité
      await this.validateUniqueCredentials(email, username);

      // Étape 2: Générer un token de vérification d'email
      const emailVerificationToken = crypto.randomBytes(32).toString('hex');

      // Étape 3: Créer l'utilisateur dans la base de données
      // Le mot de passe sera automatiquement hashé par le hook beforeSave du modèle
      const user = await User.create({
        username: username.trim(),
        email: email.toLowerCase().trim(),
        password: password,                          // Mot de passe en clair, sera hashé par le hook
        firstName: firstName ? firstName.trim() : null,
        lastName: lastName ? lastName.trim() : null,
        emailVerificationToken: emailVerificationToken,
        emailVerified: false,                        // Nécessite une vérification email
        status: 'offline',                           // Nouveau compte commence hors ligne
        lastSeen: new Date(),
        failedLoginAttempts: 0
      });

      console.log('✅ Utilisateur créé avec succès:', user.id);

      // Étape 5: Générer une paire de tokens pour connecter automatiquement l'utilisateur
      const tokens = generateTokenPair(user.id, {
        username: user.username,
        emailVerified: user.emailVerified
      });

      // Étape 6: Retourner les informations complètes
      return {
        success: true,
        user: user.toPublicJSON(),
        tokens: tokens,
        emailVerificationToken: emailVerificationToken,  // Pour envoyer l'email de vérification
        message: 'Compte créé avec succès. Veuillez vérifier votre email.'
      };

    } catch (error) {
      console.error('❌ Erreur création compte:', error.message);
      
      // Transformer les erreurs techniques en messages utilisateur compréhensibles
      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(err => ({
          field: err.path,
          message: err.message,
          value: err.value
        }));
        throw new Error(`Erreurs de validation: ${validationErrors.map(e => e.message).join(', ')}`);
      }
      
      if (error.name === 'SequelizeUniqueConstraintError') {
        const field = error.errors[0]?.path;
        throw new Error(`${field === 'email' ? 'Cette adresse email' : 'Ce nom d\'utilisateur'} est déjà utilisé(e)`);
      }
      
      throw error; // Relancer les autres erreurs
    }
  }

  // Vérifier que l'email et le nom d'utilisateur sont disponibles
  async validateUniqueCredentials(email, username, excludeUserId = null) {
    const whereClause = {
      [Op.or]: [
        { email: email.toLowerCase() },
        { username: username }
      ]
    };

    // Si on met à jour un utilisateur existant, l'exclure de la vérification
    if (excludeUserId) {
      whereClause.id = { [Op.ne]: excludeUserId };
    }

    const existingUser = await User.findOne({ where: whereClause });

    if (existingUser) {
      const conflictField = existingUser.email === email.toLowerCase() ? 'email' : 'username';
      const message = conflictField === 'email' 
        ? 'Un compte avec cette adresse email existe déjà' 
        : 'Ce nom d\'utilisateur est déjà pris';
      throw new Error(message);
    }

    return true;
  }

  // ================================================
  // CONNEXION ET AUTHENTIFICATION
  // ================================================

  // Authentifier un utilisateur avec email et mot de passe
  async authenticateUser(email, password, loginMetadata = {}) {
    try {
      console.log('🔄 Tentative de connexion pour:', email);

      // Étape 1: Récupérer l'utilisateur par email
      const user = await User.findOne({ 
        where: { 
          email: email.toLowerCase(),
          isActive: true                             // Seuls les comptes actifs peuvent se connecter
        }
      });

      if (!user) {
        console.log('❌ Tentative de connexion avec email inexistant:', email);
        // Message volontairement vague pour ne pas révéler l'existence du compte
        throw new Error('Identifiants invalides');
      }

      // Étape 2: Vérifier si le compte est temporairement bloqué
      if (user.isLocked()) {
        const unlockTime = new Date(user.lockedUntil).toLocaleString('fr-FR');
        console.log('🔒 Tentative de connexion sur compte bloqué:', email, 'jusqu\'à', unlockTime);
        throw new Error(`Compte temporairement bloqué suite à des tentatives de connexion suspectes. Réessayez après ${unlockTime}`);
      }

      // Étape 3: Vérifier le mot de passe
      const isPasswordValid = await this.verifyPassword(password, user.password);

      if (!isPasswordValid) {
        console.log('❌ Mot de passe incorrect pour:', email);
        
        // Incrémenter les tentatives échouées AVANT de lever l'erreur
        await user.incrementFailedAttempts();
        throw new Error('Identifiants invalides');
      }

      // Étape 4: Connexion réussie - Réinitialiser les sécurités et mettre à jour les infos
      await this.handleSuccessfulLogin(user, loginMetadata);

      // Étape 5: Générer une nouvelle paire de tokens
      const tokens = generateTokenPair(user.id, {
        username: user.username,
        emailVerified: user.emailVerified,
        lastLogin: user.lastLogin.toISOString()
      });

      console.log('✅ Connexion réussie pour:', email);

      return {
        success: true,
        user: user.toPublicJSON(),
        tokens: tokens,
        message: 'Connexion réussie'
      };

    } catch (error) {
      console.error('❌ Erreur connexion pour', email, ':', error.message);
      throw error;
    }
  }

  // Gérer les actions à effectuer lors d'une connexion réussie
  async handleSuccessfulLogin(user, metadata = {}) {
    const updateData = {
      status: 'online',
      lastSeen: new Date(),
      lastLogin: new Date(),
      failedLoginAttempts: 0,                      // Remettre à zéro les tentatives échouées
      lockedUntil: null,                           // Débloquer le compte si nécessaire
    };

    // Ajouter l'IP de connexion si fournie
    if (metadata.ip) {
      updateData.lastLoginIP = metadata.ip;
    }

    await user.update(updateData);
    return user;
  }

  // ================================================
  // GESTION DES MOTS DE PASSE
  // ================================================

  // Hasher un mot de passe en utilisant bcrypt
  async hashPassword(plainPassword) {
    try {
      // Le "salt rounds" détermine la complexité du hashage
      // Plus c'est élevé, plus c'est sécurisé mais plus c'est lent
      // 12 est un bon compromis entre sécurité et performance en 2024
      const saltRounds = 12;
      
      console.log('🔐 Hashage du mot de passe avec', saltRounds, 'rounds...');
      const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
      
      // Vérifier que le hashage s'est bien passé
      if (!hashedPassword || hashedPassword.length < 50) {
        throw new Error('Erreur lors du hashage du mot de passe');
      }
      
      return hashedPassword;
      
    } catch (error) {
      console.error('❌ Erreur hashage mot de passe:', error);
      throw new Error('Impossible de sécuriser le mot de passe');
    }
  }

  // Vérifier un mot de passe en clair contre un hash
  async verifyPassword(plainPassword, hashedPassword) {
    try {
      if (!plainPassword || !hashedPassword) {
        return false;
      }
      
      console.log('🔍 Vérification du mot de passe...');
      const isValid = await bcrypt.compare(plainPassword, hashedPassword);
      
      return isValid;
      
    } catch (error) {
      console.error('❌ Erreur vérification mot de passe:', error);
      return false; // En cas d'erreur, refuser l'accès par sécurité
    }
  }

  // Changer le mot de passe d'un utilisateur (nécessite l'ancien mot de passe)
  async changePassword(userId, currentPassword, newPassword) {
    try {
      console.log('🔄 Demande de changement de mot de passe pour utilisateur:', userId);

      // Récupérer l'utilisateur
      const user = await User.findByPk(userId);
      if (!user || !user.isActive) {
        throw new Error('Utilisateur introuvable ou compte désactivé');
      }

      // Vérifier l'ancien mot de passe
      const isCurrentPasswordValid = await this.verifyPassword(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        console.log('❌ Ancien mot de passe incorrect pour:', userId);
        throw new Error('Mot de passe actuel incorrect');
      }

      // Hasher le nouveau mot de passe
      const newHashedPassword = await this.hashPassword(newPassword);

      // Mettre à jour le mot de passe
      await user.update({ 
        password: newHashedPassword,
        updatedAt: new Date()
      });

      console.log('✅ Mot de passe changé avec succès pour:', userId);

      return {
        success: true,
        message: 'Mot de passe modifié avec succès'
      };

    } catch (error) {
      console.error('❌ Erreur changement mot de passe:', error.message);
      throw error;
    }
  }

  // ================================================
  // GESTION DES SESSIONS ET DÉCONNEXION
  // ================================================

  // Déconnecter un utilisateur (marquer comme offline)
  async logoutUser(userId) {
    try {
      const user = await User.findByPk(userId);
      
      if (!user) {
        throw new Error('Utilisateur introuvable');
      }

      // Mettre à jour le statut et la dernière activité
      await user.update({
        status: 'offline',
        lastSeen: new Date()
      });

      console.log('✅ Déconnexion réussie pour utilisateur:', userId);

      return {
        success: true,
        message: 'Déconnexion réussie'
      };

    } catch (error) {
      console.error('❌ Erreur déconnexion:', error.message);
      throw error;
    }
  }

  // Vérifier et récupérer un utilisateur à partir d'un token
  async getUserFromToken(token) {
    try {
      // Décoder et vérifier le token
      const decoded = verifyToken(token, 'access');
      
      // Récupérer l'utilisateur depuis la base
      const user = await User.findOne({
        where: { 
          id: decoded.userId,
          isActive: true,
          emailVerified: true                      // Seulement les comptes vérifiés
        }
      });
      
      if (!user) {
        throw new Error('Utilisateur introuvable ou compte non vérifié');
      }

      // Vérifier que le compte n'est pas bloqué
      if (user.isLocked()) {
        throw new Error('Compte temporairement bloqué');
      }

      // Mettre à jour la dernière activité
      await user.update({ lastSeen: new Date() });

      return {
        user: user.toPublicJSON(),
        tokenData: decoded
      };

    } catch (error) {
      throw error;
    }
  }

  // ================================================
  // GESTION DES PROFILS
  // ================================================

  // Mettre à jour le profil d'un utilisateur
  async updateUserProfile(userId, updateData) {
    try {
      const user = await User.findByPk(userId);
      
      if (!user || !user.isActive) {
        throw new Error('Utilisateur introuvable ou compte désactivé');
      }

      const { firstName, lastName, username, displayName, status } = updateData;

      // Si le username change, vérifier qu'il n'est pas déjà pris
      if (username && username !== user.username) {
        await this.validateUniqueCredentials(user.email, username, userId);
      }

      // Préparer les données de mise à jour
      const updateFields = {
        firstName: firstName !== undefined ? (firstName ? firstName.trim() : null) : user.firstName,
        lastName: lastName !== undefined ? (lastName ? lastName.trim() : null) : user.lastName,
        username: username ? username.trim() : user.username
      };

      // Ajouter displayName si fourni
      if (displayName !== undefined) {
        updateFields.displayName = displayName ? displayName.trim() : null;
      }

      // Ajouter status si fourni et valide
      if (status !== undefined) {
        const validStatuses = ['online', 'offline', 'away', 'busy'];
        if (validStatuses.includes(status)) {
          updateFields.status = status;
          console.log('🔄 Changement de statut vers:', status, 'pour utilisateur:', userId);
        } else {
          console.warn('⚠️ Statut invalide ignoré:', status);
        }
      }

      // Mettre à jour les champs autorisés
      const updatedUser = await user.update(updateFields);

      console.log('✅ Profil mis à jour pour utilisateur:', userId);

      // Si le statut a changé, notifier via WebSocket
      if (status !== undefined && global.socketHandler) {
        console.log('📡 Diffusion du changement de statut via WebSocket');
        global.socketHandler.broadcastUserStatusChange(userId, status, updatedUser.displayName || updatedUser.username);
      }

      return {
        success: true,
        user: updatedUser.toPublicJSON(),
        message: 'Profil mis à jour avec succès'
      };

    } catch (error) {
      console.error('❌ Erreur mise à jour profil:', error.message);
      throw error;
    }
  }

  // Mettre à jour le statut de présence d'un utilisateur
  async updateUserStatus(userId, newStatus) {
    try {
      const user = await User.findByPk(userId);
      
      if (!user || !user.isActive) {
        throw new Error('Utilisateur introuvable ou compte désactivé');
      }

      // Valider le statut
      const validStatuses = ['online', 'offline', 'away', 'busy', 'invisible'];
      if (!validStatuses.includes(newStatus)) {
        throw new Error(`Statut invalide. Statuts autorisés: ${validStatuses.join(', ')}`);
      }

      await user.update({
        status: newStatus,
        lastSeen: new Date()
      });

      return {
        success: true,
        user: user.toPublicJSON(),
        message: `Statut mis à jour: ${newStatus}`
      };

    } catch (error) {
      throw error;
    }
  }

  // ================================================
  // GESTION DE LA VÉRIFICATION D'EMAIL
  // ================================================

  // Vérifier l'adresse email d'un utilisateur avec le token de vérification
  async verifyUserEmail(emailVerificationToken) {
    try {
      console.log('🔄 Tentative de vérification d\'email avec token:', emailVerificationToken.substring(0, 8) + '...');

      // Rechercher l'utilisateur avec ce token de vérification
      const user = await User.findOne({
        where: {
          emailVerificationToken: emailVerificationToken,
          isActive: true
        }
      });

      if (!user) {
        throw new Error('Token de vérification invalide ou expiré');
      }

      if (user.emailVerified) {
        console.log('⚠️  Email déjà vérifié pour utilisateur:', user.id);
        return {
          success: true,
          user: user.toPublicJSON(),
          message: 'Email déjà vérifié'
        };
      }

      // Marquer l'email comme vérifié et supprimer le token
      await user.update({
        emailVerified: true,
        emailVerificationToken: null,
        updatedAt: new Date()
      });

      console.log('✅ Email vérifié avec succès pour utilisateur:', user.id);

      return {
        success: true,
        user: user.toPublicJSON(),
        message: 'Email vérifié avec succès. Votre compte est maintenant pleinement activé.'
      };

    } catch (error) {
      console.error('❌ Erreur vérification email:', error.message);
      throw error;
    }
  }

  // Renvoyer un email de vérification pour un utilisateur
  async resendVerificationEmail(email) {
    try {
      const user = await User.findOne({
        where: {
          email: email.toLowerCase(),
          isActive: true,
          emailVerified: false
        }
      });

      if (!user) {
        // Ne pas révéler si l'email existe ou est déjà vérifié pour des raisons de sécurité
        throw new Error('Si cette adresse existe et n\'est pas encore vérifiée, un nouveau email de vérification sera envoyé');
      }

      // Générer un nouveau token de vérification
      const newVerificationToken = crypto.randomBytes(32).toString('hex');
      await user.update({
        emailVerificationToken: newVerificationToken,
        updatedAt: new Date()
      });

      console.log('✅ Nouveau token de vérification généré pour:', email);

      return {
        success: true,
        emailVerificationToken: newVerificationToken,
        message: 'Un nouveau email de vérification a été envoyé'
      };

    } catch (error) {
      throw error;
    }
  }

  // ================================================
  // FONCTIONS UTILITAIRES ET RECHERCHE
  // ================================================

  // Rechercher des utilisateurs
  async searchUsers(query, currentUserId, limit = 10) {
    try {
      const users = await User.findAll({
        where: {
          [Op.and]: [
            { isActive: true },
            // { emailVerified: true },              // Temporairement désactivé pour les tests
            { id: { [Op.ne]: currentUserId } },      // Exclure l'utilisateur qui cherche
            {
              [Op.or]: [
                { username: { [Op.iLike]: `%${query}%` } },
                { firstName: { [Op.iLike]: `%${query}%` } },
                { lastName: { [Op.iLike]: `%${query}%` } }
              ]
            }
          ]
        },
        limit: limit,
        order: [
          ['status', 'DESC'],                       // Utilisateurs en ligne en premier
          ['lastSeen', 'DESC']                      // Puis par dernière activité
        ],
        attributes: ['id', 'username', 'firstName', 'lastName', 'avatar', 'status', 'lastSeen']
      });

      return {
        success: true,
        users: users.map(user => user.toMinimalJSON()),
        count: users.length,
        query: query
      };

    } catch (error) {
      throw error;
    }
  }

  // Obtenir des statistiques sur les utilisateurs
  async getUserStatistics() {
    try {
      const [total, active, online, verified] = await Promise.all([
        User.count(),
        User.count({ where: { isActive: true } }),
        User.count({ where: { isActive: true, status: ['online', 'away', 'busy'] } }),
        User.count({ where: { isActive: true, emailVerified: true } })
      ]);

      const recent = await User.count({
        where: {
          isActive: true,
          createdAt: {
            [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Derniers 7 jours
          }
        }
      });

      return {
        total,
        active,
        online,
        offline: active - online,
        verified,
        unverified: total - verified,
        recent
      };

    } catch (error) {
      throw error;
    }
  }
}

// Exporter une instance unique du service (pattern Singleton)
module.exports = new AuthenticationService();