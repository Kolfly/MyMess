// 📋 SCRIPT D'EXÉCUTION DES MIGRATIONS
// Script pour exécuter les migrations de base de données

const fs = require('fs');
const path = require('path');
const sequelize = require('./database/config/database');

async function runMigrations() {
  try {
    console.log('🚀 Démarrage des migrations...');
    
    // Vérifier la connexion à la base
    await sequelize.authenticate();
    console.log('✅ Connexion à la base de données établie');
    
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
    
    console.log(`📁 ${migrationFiles.length} fichiers de migration trouvés`);
    
    // Exécuter les migrations non encore appliquées
    for (const file of migrationFiles) {
      if (!executedNames.includes(file)) {
        console.log(`⚙️ Exécution de la migration: ${file}`);
        
        const migrationPath = path.join(migrationsDir, file);
        const migration = require(migrationPath);
        
        // Exécuter la migration
        await migration.up(sequelize.getQueryInterface(), sequelize.Sequelize);
        
        // Enregistrer la migration comme exécutée
        await sequelize.query(
          'INSERT INTO migrations (name) VALUES (?)',
          { replacements: [file] }
        );
        
        console.log(`✅ Migration ${file} exécutée avec succès`);
      } else {
        console.log(`⏭️ Migration ${file} déjà exécutée`);
      }
    }
    
    console.log('🎉 Toutes les migrations ont été exécutées avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution des migrations:', error);
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