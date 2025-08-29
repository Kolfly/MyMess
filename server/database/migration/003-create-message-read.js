// 📋 MIGRATION - CRÉATION TABLE MESSAGE_READS
// Migration pour créer la table de tracking des statuts de lecture

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('📋 Création de la table message_reads...');
    
    await queryInterface.createTable('message_reads', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      message_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'messages',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      read_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Créer les index pour optimiser les performances
    console.log('📊 Création des index pour message_reads...');
    
    await queryInterface.addIndex('message_reads', ['message_id'], {
      name: 'idx_message_reads_message'
    });
    
    await queryInterface.addIndex('message_reads', ['user_id'], {
      name: 'idx_message_reads_user'
    });
    
    // Index unique pour éviter les doublons
    await queryInterface.addIndex('message_reads', ['message_id', 'user_id'], {
      unique: true,
      name: 'idx_message_reads_unique'
    });
    
    await queryInterface.addIndex('message_reads', ['read_at'], {
      name: 'idx_message_reads_date'
    });

    console.log('✅ Table message_reads créée avec succès');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🗑️ Suppression de la table message_reads...');
    await queryInterface.dropTable('message_reads');
    console.log('✅ Table message_reads supprimée');
  }
};