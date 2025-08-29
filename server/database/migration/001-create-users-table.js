const { DataTypes } = require('sequelize');

module.exports = {
  // Migration UP - Créer les tables et structures
  up: async (queryInterface, Sequelize) => {
    console.log('🔄 Création de la table users...');
    
    await queryInterface.createTable('users', {
      // Identifiant unique
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false
      },

      // Informations d'identification
      username: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
      },
      
      email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
      },

      password: {
        type: DataTypes.STRING(255),
        allowNull: false
      },

      // Informations personnelles
      firstName: {
        type: DataTypes.STRING(50),
        allowNull: true
      },

      lastName: {
        type: DataTypes.STRING(50),
        allowNull: true
      },

      avatar: {
        type: DataTypes.TEXT,
        allowNull: true
      },

      // Statut et présence
      status: {
        type: DataTypes.ENUM('online', 'offline', 'away', 'busy', 'invisible'),
        defaultValue: 'offline',
        allowNull: false
      },

      lastSeen: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.NOW,
        allowNull: false
      },

      // Gestion du compte
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
      },

      emailVerified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
      },

      emailVerificationToken: {
        type: DataTypes.STRING(255),
        allowNull: true
      },

      // Sécurité
      lastLogin: {
        type: DataTypes.DATE,
        allowNull: true
      },

      failedLoginAttempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false
      },

      lockedUntil: {
        type: DataTypes.DATE,
        allowNull: true
      },

      lastLoginIP: {
        type: DataTypes.INET,
        allowNull: true
      },

      // Timestamps automatiques
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },

      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Création des index pour optimiser les performances
    console.log('🔄 Création des index...');
    
    // Index pour les recherches par email
    await queryInterface.addIndex('users', ['email'], {
      name: 'users_email_unique',
      unique: true
    });

    // Index pour les recherches par username
    await queryInterface.addIndex('users', ['username'], {
      name: 'users_username_unique',
      unique: true
    });

    // Index pour filtrer par statut
    await queryInterface.addIndex('users', ['status'], {
      name: 'users_status_index'
    });

    // Index pour trier par dernière activité
    await queryInterface.addIndex('users', ['last_seen'], {
      name: 'users_last_seen_index'
    });

    // Index composé pour les requêtes de sécurité
    await queryInterface.addIndex('users', ['is_active', 'email_verified'], {
      name: 'users_security_index'
    });

    console.log('✅ Table users créée avec succès!');
  },

  // Migration DOWN - Supprimer les structures (pour rollback)
  down: async (queryInterface, Sequelize) => {
    console.log('🗑️ Suppression de la table users...');
    
    await queryInterface.dropTable('users');
    
    console.log('✅ Table users supprimée');
  }
};