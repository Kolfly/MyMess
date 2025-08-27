const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const User = require('../models/User');
const { generateToken, verifyToken } = require('../utils/jwt');

// Notre service d'authentification - Le cerveau de la gestion des utilisateurs
// Chaque méthode a une responsabilité claire et peut être réutilisée partout dans l'app
class AuthService {
  
  // 📝 CRÉATION D'UN NOUVEL UTILISATEUR
  // Cette méthode orchestre tout le processus de création d'un compte
  async createUser(userData) {
    const { username, email, password, firstName, lastName } = userData;

    try {
      // Étape 1: Vérifier si l'utilisateur existe déjà
      // On utilise Op.or pour chercher par email OU par username
      // Pourquoi ? Car les deux doivent être uniques dans notre système
      const existingUser = await User.findOne({
        where: {
          [Op.or]: [
            { email: email.toLowerCase() },  // Email en minuscules pour éviter les doublons
            { username: username }
          ]
        }
      });

      if (existingUser) {
        // On lève une erreur explicite que le controller pourra interpréter
        const field = existingUser.email === email.toLowerCase() ? 'email' : 'username';
        throw new Error(`Un utilisateur avec cet ${field} existe déjà`);
      }

      // Étape 2: Hasher le mot de passe
      // JAMAIS stocker un mot de passe en clair ! C'est LA règle d'or de la sécurité
      // bcrypt est un algorithme spécialement conçu pour être lent (résistant aux attaques par force brute)
      const saltRounds = 12; // Plus c'est élevé, plus c'est sécurisé (mais lent)
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Étape 3: Créer l'utilisateur dans la base
      // Le modèle va automatiquement valider les données selon nos règles
      const user = await User.create({
        username: username.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,           // On stocke le hash, pas le mot de passe original
        firstName: firstName ? firstName.trim() : null,
        lastName: lastName ? lastName.trim() : null,
        status: 'offline',                  // Un nouvel utilisateur commence hors ligne
        lastSeen: new Date(),
        failedLoginAttempts: 0
      });

      // Étape 4: Générer un token JWT pour connecter automatiquement l'utilisateur
      const token = generateToken(user.id);

      // Étape 5: Retourner les données (sans le mot de passe!)
      return {
        user: user.toPublicJSON(),
        token: token,
        message: 'Compte créé avec succès'
      };

    } catch (error) {
      // Si c'est une erreur de validation Sequelize, on la reformatte pour être plus claire
      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(err => err.message);
        throw new Error(`Erreurs de validation: ${validationErrors.join(', ')}`);
      }
      
      // Sinon, on relance l'erreur pour que le controller puisse la gérer
      throw error;
    }
  }

  // 🔐 AUTHENTIFICATION D'UN UTILISATEUR
  // Cette méthode vérifie les credentials et connecte l'utilisateur
  async authenticateUser(email, password) {
    try {
      // Étape 1: Chercher l'utilisateur par email
      // On inclut les champs nécessaires pour la vérification
      const user = await User.findOne({ 
        where: { 
          email: email.toLowerCase(),
          isActive: true                    // On ne peut pas se connecter avec un compte désactivé
        }
      });

      if (!user) {
        // Message volontairement vague pour ne pas révéler si l'email existe ou non
        // C'est une mesure de sécurité contre l'énumération des comptes
        throw new Error('Email ou mot de passe incorrect');
      }

      // Étape 2: Vérifier si le compte est temporairement bloqué
      if (user.isLocked()) {
        const unlockTime = new Date(user.lockedUntil).toLocaleString('fr-FR');
        throw new Error(`Compte temporairement bloqué jusqu'à ${unlockTime}`);
      }

      // Étape 3: Vérifier le mot de passe
      // bcrypt.compare compare le mot de passe en clair avec le hash stocké
      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        // Incrémenter les tentatives échouées AVANT de lever l'erreur
        await user.incrementFailedAttempts();
        throw new Error('Email ou mot de passe incorrect');
      }

      // Étape 4: Connexion réussie ! Reset des tentatives échouées et mise à jour du statut
      await user.resetFailedAttempts();
      await user.update({
        status: 'online',
        lastSeen: new Date(),
        lastLogin: new Date()
      });

      // Étape 5: Générer un nouveau token
      const token = generateToken(user.id);

      return {
        user: user.toPublicJSON(),
        token: token,
        message: 'Connexion réussie'
      };

    } catch (error) {
      throw error;
    }
  }

  // 👋 DÉCONNEXION D'UN UTILISATEUR
  // Marque l'utilisateur comme hors ligne et invalide potentiellement le token
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

      return { 
        message: 'Déconnexion réussie' 
      };

    } catch (error) {
      throw error;
    }
  }

  // 👤 RÉCUPÉRER UN UTILISATEUR PAR ID
  // Utile pour vérifier un token ou récupérer les infos du profil
  async getUserById(userId) {
    try {
      const user = await User.findOne({
        where: { 
          id: userId, 
          isActive: true 
        }
      });
      
      if (!user) {
        throw new Error('Utilisateur introuvable ou compte désactivé');
      }

      return {
        user: user.toPublicJSON()
      };

    } catch (error) {
      throw error;
    }
  }

  // ✏️ MISE À JOUR DU PROFIL UTILISATEUR
  // Permet de modifier les informations non critiques du profil
  async updateUserProfile(userId, updateData) {
    try {
      const { firstName, lastName, username } = updateData;

      const user = await User.findByPk(userId);
      
      if (!user || !user.isActive) {
        throw new Error('Utilisateur introuvable ou compte désactivé');
      }

      // Si l'username est modifié, vérifier qu'il n'est pas déjà pris
      if (username && username !== user.username) {
        const existingUser = await User.findOne({ 
          where: { 
            username: username,
            id: { [Op.ne]: userId }         // Exclure l'utilisateur actuel de la recherche
          } 
        });
        
        if (existingUser) {
          throw new Error('Ce nom d\'utilisateur est déjà pris');
        }
      }

      // Mettre à jour les champs modifiables
      // On ne permet pas de modifier l'email ou le mot de passe ici (ça nécessite d'autres procédures)
      await user.update({
        firstName: firstName ? firstName.trim() : user.firstName,
        lastName: lastName ? lastName.trim() : user.lastName,
        username: username ? username.trim() : user.username
      });

      return {
        user: user.toPublicJSON(),
        message: 'Profil mis à jour avec succès'
      };

    } catch (error) {
      throw error;
    }
  }

  // 🔄 MISE À JOUR DU STATUT EN LIGNE
  // Permet de changer le statut (online, away, busy, etc.)
  async updateUserStatus(userId, newStatus) {
    try {
      const user = await User.findByPk(userId);
      
      if (!user || !user.isActive) {
        throw new Error('Utilisateur introuvable ou compte désactivé');
      }

      // Valider que le statut est autorisé
      const validStatuses = ['online', 'offline', 'away', 'busy', 'invisible'];
      if (!validStatuses.includes(newStatus)) {
        throw new Error('Statut invalide');
      }

      await user.update({
        status: newStatus,
        lastSeen: new Date()
      });

      return {
        user: user.toPublicJSON(),
        message: 'Statut mis à jour'
      };

    } catch (error) {
      throw error;
    }
  }

  // 🔍 RECHERCHER DES UTILISATEURS
  // Permet de chercher des utilisateurs pour les ajouter à des conversations
  async searchUsers(query, currentUserId, limit = 10) {
    try {
      const users = await User.findAll({
        where: {
          [Op.and]: [
            { isActive: true },
            { id: { [Op.ne]: currentUserId } },    // Exclure l'utilisateur qui fait la recherche
            {
              [Op.or]: [
                { username: { [Op.iLike]: `%${query}%` } },      // Recherche insensible à la casse
                { firstName: { [Op.iLike]: `%${query}%` } },
                { lastName: { [Op.iLike]: `%${query}%` } },
                { email: { [Op.iLike]: `%${query}%` } }
              ]
            }
          ]
        },
        limit: limit,
        order: [
          ['status', 'DESC'],               // Les utilisateurs en ligne en premier
          ['lastSeen', 'DESC']              // Puis par dernière activité
        ]
      });

      return {
        users: users.map(user => user.toPublicJSON()),
        count: users.length
      };

    } catch (error) {
      throw error;
    }
  }

  // 📊 STATISTIQUES DES UTILISATEURS (bonus pour l'admin)
  async getUserStats() {
    try {
      const totalUsers = await User.count({ where: { isActive: true } });
      const onlineUsers = await User.count({ 
        where: { 
          isActive: true, 
          status: ['online', 'away', 'busy'] 
        } 
      });

      const recentUsers = await User.count({
        where: {
          isActive: true,
          createdAt: {
            [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Derniers 7 jours
          }
        }
      });

      return {
        totalUsers,
        onlineUsers,
        recentUsers,
        offlineUsers: totalUsers - onlineUsers
      };

    } catch (error) {
      throw error;
    }
  }
}

// Exporter une instance unique du service (pattern Singleton)
// Cela évite de créer plusieurs instances et garantit la cohérence
module.exports = new AuthService();