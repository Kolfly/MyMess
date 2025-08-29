// 📋 SCRIPT POUR EXÉCUTER LES NOUVELLES MIGRATIONS
// Script pour exécuter seulement les migrations 002 et 003

const sequelize = require('./database/config/database');
const path = require('path');

async function runNewMigrations() {
  try {
    console.log('🚀 Exécution des nouvelles migrations...');
    
    // Vérifier la connexion à la base
    await sequelize.authenticate();
    console.log('✅ Connexion à la base de données établie');
    
    // Migration 002: Ajouter colonne status à conversations
    console.log('⚙️ Migration 002: Ajout colonne status...');
    try {
      const migration002 = require('./database/migration/002-add-status-to-conversations.js');
      await migration002.up(sequelize.getQueryInterface(), sequelize.Sequelize);
      console.log('✅ Migration 002 exécutée avec succès');
    } catch (error) {
      if (error.message.includes('existe déjà') || error.message.includes('already exists')) {
        console.log('⏭️ Migration 002 déjà appliquée (colonne status existe)');
      } else {
        console.error('❌ Erreur migration 002:', error.message);
      }
    }
    
    // Migration 003: Créer table message_reads
    console.log('⚙️ Migration 003: Création table message_reads...');
    try {
      const migration003 = require('./database/migration/003-create-message-read.js');
      await migration003.up(sequelize.getQueryInterface(), sequelize.Sequelize);
      console.log('✅ Migration 003 exécutée avec succès');
    } catch (error) {
      if (error.message.includes('existe déjà') || error.message.includes('already exists')) {
        console.log('⏭️ Migration 003 déjà appliquée (table message_reads existe)');
      } else {
        console.error('❌ Erreur migration 003:', error.message);
      }
    }
    
    console.log('🎉 Nouvelles migrations terminées !');
    
  } catch (error) {
    console.error('❌ Erreur générale:', error);
  } finally {
    await sequelize.close();
  }
}

runNewMigrations();