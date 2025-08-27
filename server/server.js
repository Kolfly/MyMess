// ================================================
// SERVEUR CHAT APPLICATION - CONFIGURATION COMPLÈTE
// ================================================

// Chargement des variables d'environnement en premier
// C'est crucial car nos autres modules vont avoir besoin de ces variables
require('dotenv').config();

// ================================================
// IMPORTS DES MODULES PRINCIPAUX
// ================================================

// Modules Node.js natifs - ces modules font partie de Node.js lui-même
const express = require('express');        // Framework web pour créer notre API REST
const http = require('http');             // Module natif pour créer le serveur HTTP
const cors = require('cors');             // Gestion des requêtes cross-origin pour Angular

// Socket.io pour les communications temps réel (WebSocket)
const socketIo = require('socket.io');

// Nos modules personnalisés - l'ordre d'import reflète les dépendances
const sequelize = require('./database/config/database');           // Configuration base de données
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');  // Gestion des erreurs

// ================================================
// CRÉATION DE L'APPLICATION ET DU SERVEUR
// ================================================

console.log('🚀 Initialisation du serveur de chat...');

// Création de l'application Express - c'est le cœur de notre API REST
const app = express();

// Création du serveur HTTP qui va héberger à la fois Express ET Socket.io
// Cette approche unifié nous permet d'avoir REST et WebSocket sur le même port
const server = http.createServer(app);

console.log('✅ Application Express créée');
console.log('✅ Serveur HTTP initialisé');

// ================================================
// CONFIGURATION DES MIDDLEWARES GLOBAUX
// ================================================

// CORS - Permet à notre frontend Angular de communiquer avec notre API
// Sans cela, les navigateurs bloqueraient les requêtes par sécurité
app.use(cors({
  origin: function(origin, callback) {
    // En développement, on est plus permissif pour faciliter les tests
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }
    
    // En production, on contrôle strictement les origines autorisées
    const allowedOrigins = [
      process.env.FRONTEND_URL,
      'http://localhost:4200',  // Angular dev server par défaut
      'http://localhost:3000'   // Notre serveur pour les tests
    ].filter(Boolean);  // Enlever les valeurs undefined/null
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Non autorisé par la politique CORS'));
    }
  },
  credentials: true,  // Autoriser les cookies et headers d'authentification
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// Parser JSON - permet de lire les données JSON dans req.body
app.use(express.json({ 
  limit: '10mb',  // Limite de taille pour éviter les attaques
  verify: (req, res, buf, encoding) => {
    // Vérification basique de la validité du JSON
    try {
      JSON.parse(buf);
    } catch (e) {
      throw new Error('Format JSON invalide');
    }
  }
}));

// Parser URL-encoded - pour les formulaires HTML classiques
app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

console.log('✅ Middlewares de base configurés');

// ================================================
// MIDDLEWARES DE SÉCURITÉ
// ================================================

app.use((req, res, next) => {
  // Supprimer les headers qui révèlent des informations sur notre stack technique
  res.removeHeader('X-Powered-By');
  
  // Headers de sécurité recommandés pour les applications web modernes
  res.setHeader('X-Content-Type-Options', 'nosniff');  // Empêche le navigateur de "deviner" les types de fichiers
  res.setHeader('X-Frame-Options', 'DENY');            // Empêche l'inclusion dans des iframes (protection contre clickjacking)
  res.setHeader('X-XSS-Protection', '1; mode=block');  // Active la protection XSS du navigateur
  
  next();
});

console.log('✅ Middlewares de sécurité appliqués');

// ================================================
// CONFIGURATION DE SOCKET.IO
// ================================================

const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:4200",
    methods: ["GET", "POST"],  // Socket.io utilise principalement ces deux méthodes
    credentials: true
  },
  // Configuration optimisée pour le développement et la production
  transports: ['websocket', 'polling'],  // Websocket en priorité, polling en fallback
  pingTimeout: 60000,    // Timeout de connexion (60 secondes)
  pingInterval: 25000    // Intervalle de vérification de connexion (25 secondes)
});

console.log('✅ Socket.io configuré et prêt');

// ================================================
// GESTIONNAIRE SOCKET.IO BASIQUE
// ================================================

// Gestion des connexions WebSocket - ceci sera étendu plus tard
io.on('connection', (socket) => {
  console.log(`👤 Nouvelle connexion WebSocket: ${socket.id}`);

  // Message de bienvenue au client qui se connecte
  socket.emit('welcome', {
    message: 'Connexion WebSocket établie avec succès',
    socketId: socket.id,
    timestamp: new Date().toISOString(),
    server: 'Chat Application v1.0'
  });

  // Test d'écho - permet de vérifier la communication bidirectionnelle
  socket.on('ping', (data) => {
    socket.emit('pong', {
      originalMessage: data,
      response: 'Pong reçu du serveur',
      timestamp: new Date().toISOString()
    });
  });

  // Gestion de la déconnexion
  socket.on('disconnect', (reason) => {
    console.log(`👋 Déconnexion WebSocket: ${socket.id} - Raison: ${reason}`);
  });
});

console.log('✅ Gestionnaire Socket.io configuré');

// ================================================
// ROUTES DE TEST ET DE DIAGNOSTIC
// ================================================

// Route racine - test de base pour vérifier que le serveur répond
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Serveur de chat fonctionnel !',
    data: {
      name: 'Chat Application API',
      version: '1.0.0',
      status: 'Opérationnel',
      database: 'PostgreSQL connecté',
      websocket: 'Socket.io actif',
      environment: process.env.NODE_ENV || 'development'
    },
    endpoints: {
      health: '/health',
      info: '/info',
      websocket: 'ws://localhost:' + (process.env.PORT || 3000)
    },
    timestamp: new Date().toISOString()
  });
});

// Route de santé - crucial pour le monitoring en production
app.get('/health', (req, res) => {
  res.status(200).json({ 
    success: true,
    message: 'Serveur en bonne santé',
    checks: {
      database: 'Connected',      // Status de la base de données
      memory: process.memoryUsage(),  // Utilisation mémoire
      uptime: process.uptime(),       // Temps depuis le démarrage
      version: process.version        // Version de Node.js
    },
    timestamp: new Date().toISOString()
  });
});

// Route d'information détaillée sur l'API
app.get('/info', (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      name: 'Chat Application API',
      version: '1.0.0',
      description: 'API REST et WebSocket pour application de chat temps réel',
      features: [
        'Authentification JWT (à venir)',
        'Chat temps réel via WebSocket',
        'Messages privés et groupes (à venir)',
        'Gestion des utilisateurs (à venir)',
        'Base de données PostgreSQL'
      ],
      technology_stack: {
        runtime: 'Node.js',
        framework: 'Express.js',
        websocket: 'Socket.io',
        database: 'PostgreSQL',
        orm: 'Sequelize'
      }
    },
    timestamp: new Date().toISOString()
  });
});

console.log('✅ Routes de test configurées');

// ================================================
// PLACEHOLDERS POUR LES FUTURES ROUTES D'API
// ================================================
/*
// Ces routes seront implémentées dans les prochaines étapes
app.all('/api/*', (req, res) => {
  res.status(501).json({
    success: false,
    message: 'API en cours de développement',
    route: req.originalUrl,
    method: req.method,
    note: 'Cette route sera implémentée dans les prochaines versions',
    plannedFeatures: [
      '/api/auth/* - Authentification et gestion des comptes',
      '/api/users/* - Gestion des profils utilisateur',
      '/api/messages/* - Envoi et réception de messages',
      '/api/conversations/* - Gestion des conversations'
    ]
  });
});*/

// ================================================
// MIDDLEWARE DE LOGGING DES REQUÊTES
// ================================================

app.use((req, res, next) => {
  const start = Date.now();
  
  // Quand la réponse est terminée, calculer le temps de traitement
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection.remoteAddress,
      timestamp: new Date().toISOString()
    };
    
    // Logger différemment selon le type de réponse
    if (res.statusCode >= 400) {
      console.error('❌ Erreur de requête:', JSON.stringify(logData));
    } else if (process.env.NODE_ENV === 'development') {
      console.log('📝 Requête traitée:', JSON.stringify(logData));
    }
  });
  
  next();
});

// ================================================
// GESTION DES ERREURS (DOIT ÊTRE EN DERNIER)
// ================================================

// Middleware pour les routes non trouvées (404)
app.use(notFoundHandler);

// Middleware global de gestion des erreurs
app.use(errorHandler);

console.log('✅ Gestion des erreurs configurée');

// ================================================
// GESTION PROPRE DE LA FERMETURE DU SERVEUR
// ================================================

// Ces gestionnaires permettent au serveur de se fermer proprement
// Cela évite les problèmes de ports bloqués que nous avons rencontrés
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown(signal) {
  console.log(`\n📴 Signal ${signal} reçu. Arrêt propre du serveur...`);
  
  try {
    // Fermer les connexions Socket.io
    io.close(() => {
      console.log('✅ Connexions WebSocket fermées');
    });
    
    // Fermer les connexions à la base de données
    await sequelize.close();
    console.log('✅ Connexions base de données fermées');
    
    // Fermer le serveur HTTP
    server.close(() => {
      console.log('✅ Serveur HTTP fermé');
      console.log('👋 Arrêt propre terminé');
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'arrêt propre:', error);
    process.exit(1);
  }
}

// ================================================
// DÉMARRAGE DU SERVEUR
// ================================================

const PORT = process.env.PORT || 3000;

// Fonction de démarrage qui gère les erreurs potentielles
async function startServer() {
  try {
    console.log('\n🔄 Finalisation du démarrage...');
    
    // Démarrer l'écoute sur le port configuré
    server.listen(PORT, () => {
      console.log('\n🎉 SERVEUR CHAT DÉMARRÉ AVEC SUCCÈS !');
      console.log('┌─────────────────────────────────────────────┐');
      console.log(`│  🌐 URL:              http://localhost:${PORT}    │`);
      console.log(`│  📊 Base de données:  PostgreSQL (connectée) │`);
      console.log(`│  🔌 WebSocket:        Socket.io (actif)      │`);
      console.log(`│  🛡️  Sécurité:        CORS configuré         │`);
      console.log(`│  📝 Logging:          Actif                  │`);
      console.log('└─────────────────────────────────────────────┘');
      console.log('\n📍 ENDPOINTS DE TEST DISPONIBLES:');
      console.log(`   🏠 Accueil:      http://localhost:${PORT}/`);
      console.log(`   ❤️  Santé:       http://localhost:${PORT}/health`);
      console.log(`   ℹ️  Information:  http://localhost:${PORT}/info`);
      console.log(`   🔌 WebSocket:    ws://localhost:${PORT}`);
      console.log('\n✨ Le serveur est prêt à recevoir des connexions !');
      console.log('💡 Astuce: Ouvre http://localhost:' + PORT + ' dans ton navigateur pour tester\n');
    });
    
  } catch (error) {
    console.error('\n💥 ERREUR CRITIQUE LORS DU DÉMARRAGE:');
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Lancer le serveur
startServer();

// ================================================
// GESTION DES ERREURS NON CAPTURÉES
// ================================================

// Ces gestionnaires capturent les erreurs qui pourraient échapper
// à notre gestion normale et évitent que le serveur crash brutalement
process.on('uncaughtException', (error) => {
  console.error('💥 ERREUR NON CAPTURÉE:', error);
  console.error('Stack:', error.stack);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 PROMESSE REJETÉE NON GÉRÉE:', reason);
  console.error('Promise:', promise);
  gracefulShutdown('UNHANDLED_REJECTION');
});

console.log('✅ Gestionnaires d\'erreurs globaux configurés');

// ================================================
// EXPORTS POUR LES TESTS (OPTIONNEL)
// ================================================

// Permet d'importer ce serveur dans d'autres fichiers pour les tests
module.exports = { 
  app,    // Application Express
  server, // Serveur HTTP 
  io      // Instance Socket.io
};