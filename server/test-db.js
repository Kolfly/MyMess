// Test simple de connexion à la base de données
require('dotenv').config();
const sequelize = require('./database/config/database');

async function testDatabase() {
  try {
    await sequelize.authenticate();
    console.log('🎉 Connexion à la base de données réussie !');
    process.exit(0);
  } catch (error) {
    console.error('❌ Échec de la connexion:', error.message);
    process.exit(1);
  }
}

testDatabase();