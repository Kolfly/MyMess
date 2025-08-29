const { Sequelize } = require('sequelize');
require('dotenv').config();

// Cette fonction crée notre instance Sequelize de façon intelligente
const createSequelizeInstance = () => {
  
  let sequelize;

  // Stratégie 1: Si on a une DATABASE_URL complète (plus simple et sécurisé)
  if (process.env.DATABASE_URL) {
    console.log('🔗 Connexion via DATABASE_URL...');
    
    sequelize = new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      
      // Le logging nous aide à voir ce qui se passe pendant le développement
      // En production, on le désactive pour éviter de logger des informations sensibles
      logging: process.env.NODE_ENV === 'development' && process.env.DEBUG_SQL === 'true' ? console.log : false,
      
      // Configuration SSL - CRUCIAL pour les bases distantes
      dialectOptions: {
        ssl: process.env.DB_SSL === 'true' ? {
          require: true,  // Force l'utilisation de SSL
          // rejectUnauthorized à false permet les certificats auto-signés
          // En production, mets-le à true si ton serveur a un certificat valide
          rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
        } : false
      },
      
      // Le pool gère plusieurs connexions simultanées - ESSENTIEL pour les performances
      pool: {
        max: 15,        // Maximum 15 connexions (ajuste selon ton plan hosting)
        min: 3,         // Garde toujours 3 connexions ouvertes
        acquire: 60000, // Attendre 60s max pour obtenir une connexion
        idle: 10000,    // Ferme une connexion après 10s d'inactivité
        evict: 5000,    // Vérifie les connexions mortes toutes les 5s
      },
      
      // Gestion des reconnexions automatiques (crucial pour les bases distantes)
      retry: {
        max: 5,  // Essaie 5 fois de se reconnecter
        match: [
          /ECONNRESET/,    // Connexion fermée par le serveur
          /ENOTFOUND/,     // Serveur non trouvé (DNS)
          /ECONNREFUSED/,  // Connexion refusée
          /ETIMEDOUT/,     // Timeout
          /EHOSTUNREACH/   // Host inaccessible
        ]
      },
      
      // Configuration par défaut pour tous nos modèles
      define: {
        timestamps: true,       // Ajoute automatiquement createdAt et updatedAt
        underscored: true,      // Utilise snake_case (created_at au lieu de createdAt)
        freezeTableName: true,  // Garde nos noms de table exacts (pas de pluralisation auto)
        paranoid: false         // Suppression physique (pas de soft delete par défaut)
      }
    });
  } 
  // Stratégie 2: Configuration avec paramètres séparés
  else {
    console.log('🔗 Connexion via paramètres séparés...');
    
    sequelize = new Sequelize(
      process.env.DB_NAME,
      process.env.DB_USER, 
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT) || 5432,
        dialect: 'postgres',
        logging: process.env.NODE_ENV === 'development' && process.env.DEBUG_SQL === 'true' ? console.log : false,
        
        dialectOptions: {
          ssl: process.env.DB_SSL === 'true' ? {
            require: true,
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false'
          } : false,
          // Configuration supplémentaire pour certains hébergeurs
          connectTimeout: 60000,
          acquireTimeout: 60000,
          timeout: 60000,
        },
        
        pool: {
          max: 15,
          min: 3,
          acquire: 60000,
          idle: 10000,
          evict: 5000,
        },
        
        retry: {
          max: 5,
          match: [/ECONNRESET/, /ENOTFOUND/, /ECONNREFUSED/, /ETIMEDOUT/, /EHOSTUNREACH/]
        },
        
        define: {
          timestamps: true,
          underscored: true,
          freezeTableName: true,
          paranoid: false
        }
      }
    );
  }

  return sequelize;
};

// Créer notre instance unique de Sequelize
const sequelize = createSequelizeInstance();

// Fonction pour tester la connexion avec gestion d'erreurs détaillées
const testConnection = async () => {
  try {
    console.log('🔄 Test de connexion à PostgreSQL...');
    await sequelize.authenticate();
    console.log('✅ Connexion PostgreSQL établie avec succès !');
    
    // Afficher quelques infos sur la connexion (sans les credentials)
    const dbName = sequelize.config.database;
    const dbHost = sequelize.config.host;
    console.log(`📊 Connecté à la base: ${dbName} sur ${dbHost}`);
    
  } catch (error) {
    console.error('❌ Erreur de connexion PostgreSQL:');
    
    // Messages d'erreur détaillés pour t'aider à diagnostiquer
    if (error.name === 'SequelizeConnectionRefusedError') {
      console.error('   → Connexion refusée. Vérifie que ton serveur PostgreSQL est accessible.');
    } else if (error.name === 'SequelizeAccessDeniedError') {
      console.error('   → Accès refusé. Vérifie tes identifiants (username/password).');
    } else if (error.name === 'SequelizeHostNotFoundError') {
      console.error('   → Host non trouvé. Vérifie l\'URL de ton serveur PostgreSQL.');
    } else if (error.original && error.original.code === 'ENOTFOUND') {
      console.error('   → Serveur introuvable. Vérifie ton nom d\'hôte/URL.');
    } else if (error.original && error.original.code === 'ECONNREFUSED') {
      console.error('   → Connexion refusée. Le serveur PostgreSQL est-il démarré?');
    } else {
      console.error('   → Erreur:', error.message);
    }
    
    throw error;
  }
};

// Tester la connexion au moment de l'importation
testConnection().catch(err => {
  console.error('💥 Impossible de se connecter à la base de données');
  // En développement, on peut continuer, en production on arrête tout
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

module.exports = sequelize;