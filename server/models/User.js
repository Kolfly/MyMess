const { DataTypes } = require('sequelize');
const sequelize = require('../database/config/database');

// Le modèle User représente chaque personne qui peut utiliser notre système de chat
// Pense à ce modèle comme au formulaire d'inscription d'un club : 
// quelles informations avons-nous besoin de collecter et stocker pour chaque membre ?
const User = sequelize.define('User', {
  
  // ============================================
  // IDENTIFIANT UNIQUE ET SÉCURISÉ
  // ============================================
  
  // Nous utilisons UUID au lieu d'un simple numéro séquentiel pour plus de sécurité
  // Un UUID ressemble à "550e8400-e29b-41d4-a716-446655440000"
  // L'avantage : impossible à deviner, unique globalement, ne révèle pas le nombre d'utilisateurs
  id: {
    type: DataTypes.UUID,                // PostgreSQL supporte nativement les UUID
    defaultValue: DataTypes.UUIDV4,      // Génération automatique d'un UUID version 4
    primaryKey: true,                    // Ceci est notre clé primaire
    allowNull: false                     // Ne peut jamais être vide
  },

  // ============================================
  // INFORMATIONS D'IDENTIFICATION
  // ============================================
  
  // Le nom d'utilisateur sert à identifier publiquement l'utilisateur dans les chats
  // C'est comme un pseudonyme choisi qui apparaîtra dans les conversations
  username: {
    type: DataTypes.STRING(50),          // Maximum 50 caractères pour éviter les abus
    allowNull: false,                    // Obligatoire car c'est l'identité publique
    unique: {                            // Un seul utilisateur peut avoir ce nom
      name: 'unique_username',
      msg: 'Ce nom d\'utilisateur est déjà pris par quelqu\'un d\'autre'
    },
    validate: {
      // Validation de la longueur : pas trop court (spam) ni trop long (lisibilité)
      len: {
        args: [3, 50],
        msg: 'Le nom d\'utilisateur doit faire entre 3 et 50 caractères'
      },
      // Vérifier que ce n'est pas juste des espaces vides
      notEmpty: {
        msg: 'Le nom d\'utilisateur ne peut pas être vide'
      },
      // Expression régulière pour autoriser seulement certains caractères
      // Cela évite les caractères spéciaux qui pourraient poser des problèmes d'affichage
      is: {
        args: /^[a-zA-Z0-9_-]+$/,
        msg: 'Le nom d\'utilisateur ne peut contenir que des lettres, chiffres, tirets et underscores'
      },
      // Validation personnalisée pour éviter les noms réservés ou inappropriés
      isNotReserved(value) {
        const reservedNames = [
          'admin', 'root', 'system', 'api', 'support', 'help', 
          'info', 'contact', 'service', 'bot', 'moderator'
        ];
        if (reservedNames.includes(value.toLowerCase())) {
          throw new Error('Ce nom d\'utilisateur est réservé par le système');
        }
      }
    }
  },

  // L'email sert à la fois pour la connexion et pour les communications importantes
  // C'est l'identifiant de connexion principal de l'utilisateur
  email: {
    type: DataTypes.STRING(100),         // 100 caractères suffisent pour la plupart des emails
    allowNull: false,                    // Obligatoire pour pouvoir se connecter
    unique: {                            // Un email = un seul compte
      name: 'unique_email',
      msg: 'Un compte existe déjà avec cette adresse email'
    },
    validate: {
      // Validation automatique du format email par Sequelize
      isEmail: {
        msg: 'Veuillez saisir une adresse email valide'
      },
      notEmpty: {
        msg: 'L\'adresse email est obligatoire'
      },
      // Validation de longueur raisonnable
      len: {
        args: [5, 100],                  // Minimum "a@b.c" = 5 caractères
        msg: 'L\'email doit faire entre 5 et 100 caractères'
      },
      // Validation personnalisée pour bloquer les domaines email temporaires
      // Cela évite les inscriptions avec des emails jetables
      isNotTemporaryEmail(value) {
        const tempDomains = [
          '10minutemail.com', 'tempmail.org', 'guerrillamail.com', 
          'mailinator.com', 'trash-mail.com'
        ];
        const domain = value.split('@')[1]?.toLowerCase();
        if (tempDomains.includes(domain)) {
          throw new Error('Les adresses email temporaires ne sont pas autorisées');
        }
      }
    }
  },

  // ============================================
  // SÉCURITÉ ET MOT DE PASSE
  // ============================================
  
  // Le mot de passe est stocké sous forme hashée, jamais en clair !
  // C'est comme garder seulement l'empreinte digitale au lieu de la vraie empreinte
  password: {
    type: DataTypes.STRING(255),         // Les hash bcrypt font environ 60 caractères
    allowNull: false,                    // Un mot de passe est obligatoire
    validate: {
      // Note : cette validation s'applique AVANT le hashage
      // Elle vérifie le mot de passe en clair saisi par l'utilisateur
      len: {
        args: [8, 128],                  // Entre 8 et 128 caractères avant hashage
        msg: 'Le mot de passe doit contenir au moins 8 caractères'
      },
      // Validation de la complexité pour renforcer la sécurité
      isStrongPassword(value) {
        // Au moins une minuscule, une majuscule, un chiffre et un caractère spécial
        const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])/;
        if (!strongRegex.test(value)) {
          throw new Error('Le mot de passe doit contenir au moins : 1 minuscule, 1 majuscule, 1 chiffre et 1 caractère spécial');
        }
        
        // Vérifier qu'il n'utilise pas des mots de passe trop communs
        const commonPasswords = ['password', '123456789', 'azerty123', 'qwerty123'];
        if (commonPasswords.some(common => value.toLowerCase().includes(common))) {
          throw new Error('Ce mot de passe est trop commun, veuillez en choisir un plus original');
        }
      }
    }
  },

  // ============================================
  // INFORMATIONS PERSONNELLES
  // ============================================
  
  // Le prénom permet de personnaliser l'expérience utilisateur
  // Optionnel car certains utilisateurs préfèrent rester anonymes
  firstName: {
    type: DataTypes.STRING(50),
    allowNull: true,                     // Optionnel lors de l'inscription
    validate: {
      len: {
        args: [0, 50],
        msg: 'Le prénom ne peut pas dépasser 50 caractères'
      },
      // Autoriser seulement les lettres et quelques caractères spéciaux pour les noms composés
      is: {
        args: /^[a-zA-ZÀ-ÿ\s\-']*$/,     // Lettres, espaces, tirets, apostrophes, accents
        msg: 'Le prénom ne peut contenir que des lettres, espaces, tirets et apostrophes'
      }
    }
  },

  // Le nom de famille, également optionnel pour préserver l'anonymat si souhaité
  lastName: {
    type: DataTypes.STRING(50),
    allowNull: true,                     // Optionnel lors de l'inscription
    validate: {
      len: {
        args: [0, 50],
        msg: 'Le nom de famille ne peut pas dépasser 50 caractères'
      },
      is: {
        args: /^[a-zA-ZÀ-ÿ\s\-']*$/,
        msg: 'Le nom de famille ne peut contenir que des lettres, espaces, tirets et apostrophes'
      }
    }
  },

  // ============================================
  // PERSONNALISATION ET PRÉSENCE
  // ============================================
  
  // URL vers l'image de profil de l'utilisateur
  // Nous stockons l'URL plutôt que l'image pour des raisons de performance
  avatar: {
    type: DataTypes.TEXT,                // TEXT pour accommoder les URLs longues
    allowNull: true,                     // L'avatar est optionnel
    defaultValue: null,
    validate: {
      // Vérifier que c'est bien une URL valide si elle est fournie
      isUrl: {
        protocols: ['http', 'https'],    // Seulement HTTP/HTTPS pour la sécurité
        msg: 'L\'avatar doit être une URL valide (http ou https)'
      },
      // Validation de la longueur pour éviter les URLs malicieusement longues
      len: {
        args: [0, 1000],
        msg: 'L\'URL de l\'avatar ne peut pas dépasser 1000 caractères'
      }
    }
  },

  // Statut de présence en temps réel - crucial pour un système de chat
  // Permet aux autres utilisateurs de voir qui est disponible pour discuter
  status: {
    type: DataTypes.ENUM('online', 'offline', 'away', 'busy', 'invisible'),
    defaultValue: 'offline',             // Par défaut hors ligne à la création
    allowNull: false,
    validate: {
      isIn: {
        args: [['online', 'offline', 'away', 'busy', 'invisible']],
        msg: 'Le statut doit être : online, offline, away, busy ou invisible'
      }
    }
  },

  // Timestamp de la dernière activité - pour afficher "vu il y a X minutes"
  lastSeen: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,         // Défaut à maintenant
    allowNull: false
  },

  // ============================================
  // GESTION DU COMPTE
  // ============================================
  
  // Indicateur pour activer/désactiver un compte sans supprimer les données
  // Permet de "suspendre" un compte temporairement
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,                  // Comptes actifs par défaut
    allowNull: false
  },

  // Vérification de l'email - pour s'assurer que l'adresse email est valide
  emailVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,                 // Nécessite une vérification après inscription
    allowNull: false
  },

  // Token de vérification d'email - sera généré lors de l'inscription
  emailVerificationToken: {
    type: DataTypes.STRING(255),
    allowNull: true                      // Null après vérification réussie
  },

  // ============================================
  // SÉCURITÉ AVANCÉE
  // ============================================
  
  // Horodatage de la dernière connexion réussie
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true                      // Null jusqu'à la première connexion
  },

  // Compteur des tentatives de connexion échouées consécutives
  failedLoginAttempts: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false
  },

  // Timestamp jusqu'auquel le compte est temporairement bloqué
  lockedUntil: {
    type: DataTypes.DATE,
    allowNull: true                      // Null si le compte n'est pas bloqué
  },

  // Adresse IP de la dernière connexion - utile pour la sécurité
  lastLoginIP: {
    type: DataTypes.INET,                // Type PostgreSQL pour les adresses IP
    allowNull: true
  }

}, {
  // ============================================
  // CONFIGURATION DE LA TABLE
  // ============================================
  
  tableName: 'users',                    // Nom explicite de la table
  
  // Les timestamps (createdAt, updatedAt) sont gérés automatiquement par Sequelize
  timestamps: true,
  
  // Index pour optimiser les requêtes les plus fréquentes
  indexes: [
    // Index unique sur l'email pour les connexions rapides
    {
      name: 'users_email_unique',
      unique: true,
      fields: ['email']
    },
    // Index unique sur le username pour les recherches d'utilisateurs
    {
      name: 'users_username_unique', 
      unique: true,
      fields: ['username']
    },
    // Index sur le statut pour filtrer les utilisateurs en ligne
    {
      name: 'users_status_index',
      fields: ['status']
    },
    // Index sur lastSeen pour trier par activité récente
    {
      name: 'users_last_seen_index',
      fields: ['last_seen']
    },
    // Index composé pour les requêtes de sécurité
    {
      name: 'users_security_index',
      fields: ['is_active', 'email_verified']
    }
  ],

  // Hooks - fonctions qui s'exécutent automatiquement à certains moments
  hooks: {
    // Avant la validation, nettoyer et normaliser les données
    beforeValidate: (user) => {
      // Normaliser l'email : minuscules et suppression des espaces
      if (user.email) {
        user.email = user.email.trim().toLowerCase();
      }
      
      // Nettoyer le username : suppression des espaces
      if (user.username) {
        user.username = user.username.trim();
      }
      
      // Nettoyer les noms : supprimer les espaces superflus et mettre en forme
      if (user.firstName) {
        user.firstName = user.firstName.trim().replace(/\s+/g, ' ');
        // Première lettre en majuscule
        user.firstName = user.firstName.charAt(0).toUpperCase() + user.firstName.slice(1).toLowerCase();
      }
      
      if (user.lastName) {
        user.lastName = user.lastName.trim().replace(/\s+/g, ' ');
        user.lastName = user.lastName.charAt(0).toUpperCase() + user.lastName.slice(1).toLowerCase();
      }
    },

    // Avant la sauvegarde, hasher le mot de passe si modifié
    beforeSave: async (user) => {
      // Si le mot de passe a été modifié, le hasher
      if (user.changed('password')) {
        const bcrypt = require('bcryptjs');
        const saltRounds = 12; // Niveau de sécurité élevé
        user.password = await bcrypt.hash(user.password, saltRounds);
      }
    }
  }
});

// ============================================
// MÉTHODES D'INSTANCE
// ============================================
// Ces méthodes peuvent être appelées sur une instance spécifique d'utilisateur
// Par exemple : const user = await User.findById(123); user.getFullName();

// Retourner le nom complet de l'utilisateur pour l'affichage
User.prototype.getFullName = function() {
  // Construire le nom complet selon les informations disponibles
  if (this.firstName && this.lastName) {
    return `${this.firstName} ${this.lastName}`;
  } else if (this.firstName) {
    return this.firstName;
  } else if (this.lastName) {
    return this.lastName;
  } else {
    // Si pas de nom réel, utiliser le username
    return this.username;
  }
};

// Retourner les données publiques de l'utilisateur (sans informations sensibles)
// Cette méthode est cruciale pour la sécurité : elle empêche d'exposer accidentellement
// des informations comme le mot de passe hashé ou les tokens de sécurité
User.prototype.toPublicJSON = function() {
  return {
    id: this.id,
    username: this.username,
    email: this.email,                   // On peut débattre si l'email doit être public
    firstName: this.firstName,
    lastName: this.lastName,
    fullName: this.getFullName(),
    avatar: this.avatar,
    status: this.status,
    lastSeen: this.lastSeen,
    lastLogin: this.lastLogin,
    emailVerified: this.emailVerified,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
    // IMPORTANT : on ne retourne JAMAIS le mot de passe, même hashé !
    // Ni les tokens de sécurité, ni les informations de géolocalisation sensibles
  };
};

// Retourner une version encore plus minimaliste pour les listes d'utilisateurs
User.prototype.toMinimalJSON = function() {
  return {
    id: this.id,
    username: this.username,
    fullName: this.getFullName(),
    avatar: this.avatar,
    status: this.status,
    lastSeen: this.lastSeen
  };
};

// ============================================
// MÉTHODES DE SÉCURITÉ
// ============================================

// Vérifier si le compte est temporairement bloqué à cause de trop de tentatives échouées
User.prototype.isLocked = function() {
  return !!(this.lockedUntil && this.lockedUntil > Date.now());
};

// Incrémenter le nombre de tentatives de connexion échouées
User.prototype.incrementFailedAttempts = async function() {
  this.failedLoginAttempts += 1;
  
  // Après 5 tentatives échouées, bloquer le compte pendant 30 minutes
  // Ces valeurs peuvent être ajustées selon tes besoins de sécurité
  if (this.failedLoginAttempts >= 5) {
    this.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    console.log(`⚠️  Compte ${this.email} temporairement bloqué après ${this.failedLoginAttempts} tentatives échouées`);
  }
  
  return await this.save();
};

// Remettre à zéro les tentatives échouées après une connexion réussie
User.prototype.resetFailedAttempts = async function() {
  // Sauvegarder l'ancienne valeur pour les logs
  const previousAttempts = this.failedLoginAttempts;
  
  this.failedLoginAttempts = 0;
  this.lockedUntil = null;
  this.lastLogin = new Date();
  
  if (previousAttempts > 0) {
    console.log(`✅ Connexion réussie pour ${this.email}, remise à zéro de ${previousAttempts} tentatives échouées`);
  }
  
  return await this.save();
};

// Vérifier si le mot de passe fourni correspond au mot de passe hashé
User.prototype.validatePassword = async function(plainPassword) {
  const bcrypt = require('bcryptjs');
  return await bcrypt.compare(plainPassword, this.password);
};

// Générer un token de vérification d'email
User.prototype.generateEmailVerificationToken = function() {
  // Créer un token aléatoire sécurisé
  const crypto = require('crypto');
  this.emailVerificationToken = crypto.randomBytes(32).toString('hex');
  return this.emailVerificationToken;
};

// ============================================
// MÉTHODES STATIQUES
// ============================================
// Ces méthodes peuvent être appelées directement sur le modèle User
// Par exemple : await User.findActiveUsers();

// Trouver tous les utilisateurs actifs
User.findActiveUsers = function() {
  return this.findAll({
    where: { 
      isActive: true,
      emailVerified: true 
    },
    order: [['lastSeen', 'DESC']],
    // Ne retourner que les champs nécessaires pour optimiser la performance
    attributes: ['id', 'username', 'firstName', 'lastName', 'avatar', 'status', 'lastSeen']
  });
};

// Trouver tous les utilisateurs actuellement en ligne
User.findOnlineUsers = function() {
  return this.findAll({
    where: { 
      isActive: true,
      emailVerified: true,
      status: ['online', 'away', 'busy']  // Exclure 'invisible' et 'offline'
    },
    order: [['lastSeen', 'DESC']],
    attributes: ['id', 'username', 'firstName', 'lastName', 'avatar', 'status', 'lastSeen']
  });
};

// Rechercher des utilisateurs par nom d'utilisateur ou nom réel
User.searchUsers = function(query, limit = 10) {
  const { Op } = require('sequelize');
  
  return this.findAll({
    where: {
      [Op.and]: [
        { isActive: true },
        { emailVerified: true },
        {
          [Op.or]: [
            { username: { [Op.iLike]: `%${query}%` } },        // Recherche insensible à la casse
            { firstName: { [Op.iLike]: `%${query}%` } },
            { lastName: { [Op.iLike]: `%${query}%` } }
          ]
        }
      ]
    },
    limit: limit,
    order: [
      ['status', 'DESC'],        // Utilisateurs en ligne en premier
      ['lastSeen', 'DESC']       // Puis par activité récente
    ],
    attributes: ['id', 'username', 'firstName', 'lastName', 'avatar', 'status', 'lastSeen']
  });
};

module.exports = User;