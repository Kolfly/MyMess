const { DataTypes } = require('sequelize');
const sequelize = require('../database/config/database');

// Le modèle User représente la structure de notre table utilisateurs
// Chaque propriété correspond à une colonne dans PostgreSQL
const User = sequelize.define('User', {
  
  // ID unique - Utilise UUID au lieu d'un entier pour plus de sécurité
  // Un UUID comme "550e8400-e29b-41d4-a716-446655440000" est quasi impossible à deviner
  id: {
    type: DataTypes.UUID,                // Type UUID (plus sécurisé qu'un simple INTEGER)
    defaultValue: DataTypes.UUIDV4,      // Génère automatiquement un UUID v4
    primaryKey: true,                    // Clé primaire de notre table
    allowNull: false                     // Ne peut jamais être null
  },

  // Nom d'utilisateur unique - Ce que l'utilisateur utilise pour se connecter
  username: {
    type: DataTypes.STRING(50),          // Maximum 50 caractères (économise l'espace DB)
    allowNull: false,                    // Obligatoire
    unique: {                            // Index unique - deux users ne peuvent avoir le même username
      name: 'unique_username',           // Nom de la contrainte (utile pour les erreurs)
      msg: 'Ce nom d\'utilisateur est déjà pris'
    },
    validate: {
      len: {                            // Valide la longueur
        args: [3, 50],
        msg: 'Le nom d\'utilisateur doit faire entre 3 et 50 caractères'
      },
      notEmpty: {                       // Ne peut pas être une chaîne vide
        msg: 'Le nom d\'utilisateur est requis'
      },
      is: {                             // Expression régulière pour autoriser seulement certains caractères
        args: /^[a-zA-Z0-9_]+$/,        // Lettres, chiffres et underscore seulement
        msg: 'Le nom d\'utilisateur ne peut contenir que des lettres, chiffres et underscores'
      }
    }
  },

  // Email - Utilisé pour la connexion et les notifications
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: {
      name: 'unique_email',
      msg: 'Un compte avec cet email existe déjà'
    },
    validate: {
      isEmail: {                        // Validation d'email intégrée à Sequelize
        msg: 'Veuillez fournir un email valide'
      },
      notEmpty: {
        msg: 'L\'email est requis'
      },
      len: {
        args: [5, 100],                 // Un email fait au minimum 5 caractères (a@b.c)
        msg: 'L\'email doit faire entre 5 et 100 caractères'
      }
    }
  },

  // Mot de passe - Sera hashé avant d'être stocké (jamais en clair!)
  password: {
    type: DataTypes.STRING(255),        // 255 car les hash bcrypt sont longs
    allowNull: false,
    validate: {
      len: {
        args: [8, 255],                 // Minimum 8 caractères avant hashage
        msg: 'Le mot de passe doit faire au moins 8 caractères'
      },
      // Validation de complexité - tu peux l'ajuster selon tes besoins
      is: {
        args: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,  // Au moins 1 minuscule, 1 majuscule, 1 chiffre
        msg: 'Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre'
      }
    }
  },

  // Informations personnelles - Optionnelles mais utiles pour personnaliser l'expérience
  firstName: {
    type: DataTypes.STRING(50),
    allowNull: true,                    // Optionnel
    validate: {
      len: {
        args: [0, 50],
        msg: 'Le prénom ne peut pas dépasser 50 caractères'
      }
    }
  },

  lastName: {
    type: DataTypes.STRING(50), 
    allowNull: true,                    // Optionnel
    validate: {
      len: {
        args: [0, 50],
        msg: 'Le nom ne peut pas dépasser 50 caractères'
      }
    }
  },

  // Avatar - URL vers l'image de profil (on stockera les images sur un service comme Cloudinary)
  avatar: {
    type: DataTypes.TEXT,               // TEXT pour les URLs longues
    allowNull: true,
    defaultValue: null,
    validate: {
      isUrl: {                          // Valide que c'est bien une URL
        msg: 'L\'avatar doit être une URL valide'
      }
    }
  },

  // Statut en ligne - Crucial pour un système de chat en temps réel
  status: {
    type: DataTypes.ENUM('online', 'offline', 'away', 'busy', 'invisible'),
    defaultValue: 'offline',            // Par défaut, l'utilisateur est hors ligne
    allowNull: false,
    validate: {
      isIn: {
        args: [['online', 'offline', 'away', 'busy', 'invisible']],
        msg: 'Le statut doit être: online, offline, away, busy ou invisible'
      }
    }
  },

  // Dernière fois vu en ligne - Pratique pour afficher "vu il y a X minutes"
  lastSeen: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,        // Par défaut, maintenant
    allowNull: false
  },

  // Compte actif ou désactivé - Permet de "soft ban" un utilisateur sans supprimer ses données
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,                 // Par défaut, le compte est actif
    allowNull: false
  },

  // Date de dernière connexion - Utile pour les statistiques
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true                     // Null tant qu'il ne s'est jamais connecté
  },

  // Tentatives de connexion échouées - Pour implémenter un système de sécurité
  failedLoginAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  },

  // Date de blocage temporaire (après trop de tentatives échouées)
  lockedUntil: {
    type: DataTypes.DATE,
    allowNull: true
  }

}, {
  // Options de configuration pour la table
  tableName: 'users',                   // Nom explicite de la table (pas de pluralisation auto)
  
  // Index pour améliorer les performances des requêtes
  indexes: [
    {
      fields: ['email'],                // Index sur email (recherches fréquentes)
      unique: true
    },
    {
      fields: ['username'],             // Index sur username (recherches fréquentes)
      unique: true
    },
    {
      fields: ['status']                // Index sur status (pour filtrer les utilisateurs en ligne)
    },
    {
      fields: ['lastSeen']              // Index sur lastSeen (pour trier par dernière connexion)
    },
    {
      fields: ['isActive']              // Index sur isActive (pour filtrer les comptes actifs)
    }
  ],

  // Hooks - Fonctions qui s'exécutent automatiquement à certains moments
  hooks: {
    // Avant la validation, on nettoie et normalise les données
    beforeValidate: (user) => {
      // Nettoyer les espaces superflus
      if (user.email) user.email = user.email.trim().toLowerCase();
      if (user.username) user.username = user.username.trim();
      if (user.firstName) user.firstName = user.firstName.trim();
      if (user.lastName) user.lastName = user.lastName.trim();
    }
  }
});

// Méthodes d'instance - Fonctions qu'on peut appeler sur un utilisateur spécifique
// Par exemple: const user = await User.findOne(...); user.getFullName();

User.prototype.getFullName = function() {
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  } else if (this.firstName) {
    return this.firstName;
  } else if (this.lastName) {
    return this.lastName;
  } else {
    return this.username;
  }
};

// Retourne les données publiques (sans le mot de passe!)
User.prototype.toPublicJSON = function() {
  return {
    id: this.id,
    username: this.username,
    email: this.email,
    firstName: this.firstName,
    lastName: this.lastName,
    fullName: this.getFullName(),
    avatar: this.avatar,
    status: this.status,
    lastSeen: this.lastSeen,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
    // On ne retourne JAMAIS le mot de passe, même hashé!
  };
};

// Vérifie si le compte est temporairement bloqué
User.prototype.isLocked = function() {
  return !!(this.lockedUntil && this.lockedUntil > Date.now());
};

// Incrémente les tentatives de connexion échouées
User.prototype.incrementFailedAttempts = async function() {
  this.failedLoginAttempts += 1;
  
  // Après 5 tentatives échouées, bloquer pendant 30 minutes
  if (this.failedLoginAttempts >= 5) {
    this.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  }
  
  return await this.save();
};

// Remet à zéro les tentatives échouées après une connexion réussie
User.prototype.resetFailedAttempts = async function() {
  this.failedLoginAttempts = 0;
  this.lockedUntil = null;
  this.lastLogin = new Date();
  return await this.save();
};

// Méthodes statiques - Fonctions qu'on peut appeler directement sur le modèle User
// Par exemple: await User.findActiveUsers();

User.findActiveUsers = function() {
  return this.findAll({
    where: { isActive: true },
    order: [['lastSeen', 'DESC']]
  });
};

User.findOnlineUsers = function() {
  return this.findAll({
    where: { 
      isActive: true,
      status: ['online', 'away', 'busy']
    },
    order: [['lastSeen', 'DESC']]
  });
};

module.exports = User;