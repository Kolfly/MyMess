// 📋 SCRIPT D'EXÉCUTION DES MIGRATIONS
// Script pour exécuter les migrations de base de données

const fs = require('fs');
const path = require('path');
const sequelize = require('./database/config/database');

async function runMigrations() {
  try {
    
    // Vérifier la connexion à la base
    await sequelize.authenticate();
    
    // Créer la table de suivi des migrations si elle n'existe pas
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    // Récupérer les migrations déjà exécutées
    const [executedMigrations] = await sequelize.query(
      'SELECT name FROM migrations ORDER BY executed_at'
    );
    const executedNames = executedMigrations.map(m => m.name);
    
    // Lire tous les fichiers de migration
    const migrationsDir = path.join(__dirname, 'database', 'migration');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.js'))
      .sort(); // Important: trier par nom pour l'ordre d'exécution
    
    
    // Exécuter les migrations non encore appliquées
    for (const file of migrationFiles) {
      if (!executedNames.includes(file)) {
        
        const migrationPath = path.join(migrationsDir, file);
        const migration = require(migrationPath);
        
        // Exécuter la migration
        await migration.up(sequelize.getQueryInterface(), sequelize.Sequelize);
        
        // Enregistrer la migration comme exécutée
        await sequelize.query(
          'INSERT INTO migrations (name) VALUES (?)',
          { replacements: [file] }
        );
        
      } else {
      }
    }
    
    
  } catch (error) {
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Exécuter les migrations si le script est appelé directement
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };