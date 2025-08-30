// 📋 SCRIPT POUR EXÉCUTER LES NOUVELLES MIGRATIONS
// Script pour exécuter seulement les migrations 002 et 003

const sequelize = require('./database/config/database');
const path = require('path');

async function runNewMigrations() {
  try {
    
    // Vérifier la connexion à la base
    await sequelize.authenticate();
    
    // Migration 002: Ajouter colonne status à conversations
    try {
      const migration002 = require('./database/migration/002-add-status-to-conversations.js');
      await migration002.up(sequelize.getQueryInterface(), sequelize.Sequelize);
    } catch (error) {
      if (error.message.includes('existe déjà') || error.message.includes('already exists')) {
      } else {
      }
    }
    
    // Migration 003: Créer table message_reads
    try {
      const migration003 = require('./database/migration/003-create-message-read.js');
      await migration003.up(sequelize.getQueryInterface(), sequelize.Sequelize);
    } catch (error) {
      if (error.message.includes('existe déjà') || error.message.includes('already exists')) {
      } else {
      }
    }
    
    
  } catch (error) {
  } finally {
    await sequelize.close();
  }
}

runNewMigrations();