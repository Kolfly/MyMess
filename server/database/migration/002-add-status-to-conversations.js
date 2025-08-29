// 📋 MIGRATION - AJOUT CHAMP STATUS À CONVERSATIONS
// Migration pour ajouter le champ status pour l'US022 (demandes de conversation)

'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    console.log('📋 Ajout de la colonne status à la table conversations...');
    
    await queryInterface.addColumn('conversations', 'status', {
      type: Sequelize.ENUM('pending', 'accepted', 'rejected'),
      allowNull: false,
      defaultValue: 'accepted',
      comment: 'Statut de la conversation: pending (en attente), accepted (acceptée), rejected (refusée)'
    });

    // Créer un index sur la colonne status pour optimiser les performances
    await queryInterface.addIndex('conversations', ['status'], {
      name: 'idx_conversations_status'
    });

    console.log('✅ Colonne status ajoutée à la table conversations');
  },

  down: async (queryInterface, Sequelize) => {
    console.log('🗑️ Suppression de la colonne status de la table conversations...');
    
    // Supprimer l'index
    await queryInterface.removeIndex('conversations', 'idx_conversations_status');
    
    // Supprimer la colonne
    await queryInterface.removeColumn('conversations', 'status');
    
    // Supprimer l'ENUM
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_conversations_status";');
    
    console.log('✅ Colonne status supprimée de la table conversations');
  }
};