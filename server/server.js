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

// Charger les associations entre les modèles
require('./models/associations');

// ================================================
// CRÉATION DE L'APPLICATION ET DU SERVEUR
// ================================================


// Création de l'application Express - c'est le cœur de notre API REST
const app = express();

// Création du serveur HTTP qui va héberger à la fois Express ET Socket.io
// Cette approche unifié nous permet d'avoir REST et WebSocket sur le même port
const server = http.createServer(app);

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


// ================================================
// GESTIONNAIRE SOCKET.IO COMPLET
// ================================================

const SocketHandler = require('./sockets/socketHandler');

// Initialiser le gestionnaire WebSocket complet
const socketHandler = new SocketHandler(io);

// Rendre accessible globalement pour les autres services
global.io = io;
global.socketHandler = socketHandler;


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


// ================================================
// ROUTES D'API PRINCIPALES
// ================================================

// Import des routes - VERSION CLEAN
const authRoutes = require('./routes/authRoutes-clean');
const userRoutes = require('./routes/userRoutes-simple');
const messageRoutes = require('./routes/messageRoutes-simple');
const groupRoutes = require('./routes/groupRoutes');

// Configuration des routes principales - RÉACTIVATION PROGRESSIVE
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);

// Route de test temporaire - RÉACTIVÉE POUR TEST
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'Serveur fonctionnel - test sans autres routes'
  });
});

// 📋 LISTE DE TOUTES LES ROUTES DISPONIBLES
app.get('/api/routes', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Liste de toutes les routes disponibles',
    routes: {
      auth: {
        base_url: '/api/auth',
        routes: [
          'POST   /register                - Inscription utilisateur',
          'POST   /login                   - Connexion utilisateur', 
          'POST   /refresh                 - Renouveler le token',
          'POST   /resend-verification     - Renvoyer email de vérification',
          'GET    /me                      - Mon profil (auth requise)',
          'PUT    /profile                 - Modifier mon profil (auth requise)',
          'PUT    /change-password         - Changer mot de passe (auth requise)',
          'PUT    /status                  - Changer mon statut (auth requise)',
          'POST   /logout                  - Déconnexion (auth requise)',
          'GET    /stats                   - Mes statistiques (auth requise)',
          'GET    /search?q=terme          - Rechercher utilisateurs (auth requise)',
          'GET    /global-stats            - Statistiques globales',
          'GET    /test                    - Test authentification (auth requise)'
        ]
      },
      users: {
        base_url: '/api/users',
        routes: [
          'GET    /test                    - Test routes utilisateur (auth requise)',
          'GET    /stats                   - Statistiques publiques',
          'GET    /search?q=terme          - Rechercher utilisateurs (auth requise)',
          'GET    /me/stats                - Mes stats détaillées (auth requise)',
          'GET    /online                  - Utilisateurs en ligne',
          'GET    /statistics              - Statistiques détaillées (auth requise)',
          'GET    /:userId                 - Profil utilisateur par ID (auth requise)',
          'PUT    /profile                 - Modifier profil (auth requise)',
          'PUT    /status                  - Modifier statut (auth requise)',
          'GET    /public/:userId          - Profil public utilisateur',
          'GET    /check/username/:username - Vérifier disponibilité username',
          'GET    /check/email/:email      - Vérifier disponibilité email',
          'PUT    /last-seen               - Mettre à jour dernière connexion (auth requise)'
        ]
      },
      messages: {
        base_url: '/api/messages',
        routes: [
          'GET    /test                           - Test routes messages (auth requise)',
          'POST   /                              - Envoyer message (auth requise)',
          'PUT    /:messageId                    - Modifier message (auth requise)',
          'DELETE /:messageId                    - Supprimer message (auth requise)',
          'GET    /conversations                 - Mes conversations (auth requise)',
          'POST   /conversations/private         - Créer conversation privée (auth requise)',
          'POST   /conversations/group           - Créer groupe (auth requise)',
          'GET    /conversations/:id             - Détails conversation (auth requise)',
          'GET    /conversations/:id/messages    - Messages conversation (auth requise)',
          'POST   /conversations/:id/read        - Marquer comme lu (auth requise)',
          'GET    /stats                         - Statistiques messages (auth requise)'
        ]
      },
      websocket: {
        base_url: 'ws://localhost:3000',
        description: 'WebSocket temps réel pour chat instantané',
        authentication: 'Token JWT dans auth.token ou headers.authorization',
        events: {
          client_to_server: [
            'message:send          - Envoyer un message',
            'message:edit          - Modifier un message', 
            'message:delete        - Supprimer un message',
            'conversation:join     - Rejoindre une conversation',
            'conversation:leave    - Quitter une conversation',
            'conversation:typing   - Indiquer que l\'utilisateur tape',
            'conversation:read     - Marquer des messages comme lus',
            'user:status           - Changer son statut (online/away/busy)'
          ],
          server_to_client: [
            'welcome               - Message de bienvenue à la connexion',
            'message:new           - Nouveau message reçu',
            'message:edited        - Message modifié',
            'message:deleted       - Message supprimé', 
            'message:sent          - Confirmation d\'envoi',
            'message:read          - Message marqué comme lu',
            'user:joined           - Utilisateur rejoint conversation',
            'user:left             - Utilisateur quitte conversation',
            'user:typing           - Utilisateur en train de taper',
            'user:status_changed   - Statut utilisateur changé',
            'error                 - Erreur WebSocket'
          ]
        }
      },
      system: {
        base_url: '/',
        routes: [
          'GET    /                        - Informations serveur',
          'GET    /health                  - État de santé du serveur',
          'GET    /info                    - Informations détaillées API',
          'GET    /api/test                - Test général API',
          'GET    /api/routes              - Cette liste de routes'
        ]
      }
    },
    notes: [
      '(auth requise) = Header: Authorization: Bearer YOUR_JWT_TOKEN',
      'Pour les requêtes POST/PUT, envoyer les données en JSON dans le body',
      'Base URL complète: http://localhost:3000'
    ],
    timestamp: new Date().toISOString()
  });
});


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
    } else if (process.env.NODE_ENV === 'development') {
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


// ================================================
// GESTION PROPRE DE LA FERMETURE DU SERVEUR
// ================================================

// Ces gestionnaires permettent au serveur de se fermer proprement
// Cela évite les problèmes de ports bloqués que nous avons rencontrés
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown(signal) {
  
  try {
    // Fermer les connexions Socket.io
    io.close(() => {
    });
    
    // Fermer les connexions à la base de données
    await sequelize.close();
    
    // Fermer le serveur HTTP
    server.close(() => {
      process.exit(0);
    });
    
  } catch (error) {
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
    
    // ================================================
    // SYNCHRONISATION DE LA BASE DE DONNÉES
    // ================================================
    
    
    try {
      // Mode sûr maintenant que les tables existent
      await sequelize.sync({ 
        alter: true,     // ✅ Mode sûr: Ajuste les tables existantes
        logging: false   // Désactiver le logging pour éviter les erreurs
      });
      
      
    } catch (error) {
      
      // Fallback sur l'initialisation manuelle si sync échoue
      const { initializeDatabase, safeInitializeDatabase } = require('./database/init-database');
      
      // Utiliser la version sécurisée par défaut
      if (process.env.FORCE_DB_RESET === 'true') {
        await initializeDatabase(true);
      } else {
        await safeInitializeDatabase();
      }
    }
    
    // Démarrer l'écoute sur le port configuré
    server.listen(PORT, () => {
    });
    
  } catch (error) {
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
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  gracefulShutdown('UNHANDLED_REJECTION');
});


// ================================================
// EXPORTS POUR LES TESTS (OPTIONNEL)
// ================================================

// Permet d'importer ce serveur dans d'autres fichiers pour les tests
module.exports = { 
  app,    // Application Express
  server, // Serveur HTTP 
  io      // Instance Socket.io
};