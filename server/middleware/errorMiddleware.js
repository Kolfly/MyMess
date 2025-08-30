// 🚫 MIDDLEWARE DE GESTION DES ERREURS
// Ces middlewares gèrent toutes les erreurs de l'application de manière centralisée

// Middleware pour les routes 404 (Not Found)
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Route ${req.method} ${req.originalUrl} non trouvée`);
  error.statusCode = 404;
  
  // Log de la tentative d'accès à une route inexistante
  
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} non trouvée`,
    code: 'ROUTE_NOT_FOUND',
    method: req.method,
    timestamp: new Date().toISOString(),
    // En développement, donner des suggestions
    ...(process.env.NODE_ENV === 'development' && {
      suggestions: [
        'Vérifiez l\'URL demandée',
        'Consultez /api/info pour voir les endpoints disponibles',
        'Assurez-vous d\'utiliser la bonne méthode HTTP'
      ]
    })
  });
};

// Middleware global de gestion des erreurs
const errorHandler = (err, req, res, next) => {
  // Si la réponse a déjà été envoyée, déléguer à Express
  if (res.headersSent) {
    return next(err);
  }

  let error = { ...err };
  error.message = err.message;

  // Log détaillé de l'erreur
  const errorLog = {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp: new Date().toISOString(),
    userId: req.user ? req.user.id : 'anonymous'
  };

  // Log différemment selon la gravité
  if (err.statusCode >= 500 || !err.statusCode) {
  } else {
  }

  // 🗄️ ERREURS DE BASE DE DONNÉES SEQUELIZE
  
  // Erreurs de validation Sequelize
  if (err.name === 'SequelizeValidationError') {
    const messages = err.errors.map(error => ({
      field: error.path,
      message: error.message,
      value: error.value
    }));
    
    error = {
      message: 'Erreurs de validation des données',
      statusCode: 400,
      details: messages
    };
  }

  // Erreurs de contrainte unique (email/username déjà utilisé)
  if (err.name === 'SequelizeUniqueConstraintError') {
    const field = err.errors[0]?.path || 'champ';
    error = {
      message: `Cette valeur pour le champ '${field}' est déjà utilisée`,
      statusCode: 409,
      field: field
    };
  }

  // Erreurs de connexion à la base de données
  if (err.name === 'SequelizeConnectionError') {
    error = {
      message: 'Erreur de connexion à la base de données',
      statusCode: 503 // Service Unavailable
    };
  }

  // Erreurs de contrainte de clé étrangère
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    error = {
      message: 'Référence invalide vers une ressource liée',
      statusCode: 400
    };
  }

  // 🔐 ERREURS JWT

  if (err.name === 'JsonWebTokenError') {
    error = {
      message: 'Token d\'authentification invalide',
      statusCode: 401,
      code: 'INVALID_TOKEN'
    };
  }

  if (err.name === 'TokenExpiredError') {
    error = {
      message: 'Token d\'authentification expiré',
      statusCode: 401,
      code: 'TOKEN_EXPIRED'
    };
  }

  if (err.name === 'NotBeforeError') {
    error = {
      message: 'Token pas encore valide',
      statusCode: 401,
      code: 'TOKEN_NOT_ACTIVE'
    };
  }

  // 📝 ERREURS DE VALIDATION EXPRESS-VALIDATOR
  // (Normalement gérées dans les controllers, mais au cas où)
  if (err.type === 'validation') {
    error = {
      message: 'Erreurs de validation des données d\'entrée',
      statusCode: 400,
      details: err.details
    };
  }

  // 🌐 ERREURS HTTP COMMUNES
  
  // Payload trop volumineux
  if (err.type === 'entity.too.large') {
    error = {
      message: 'Données envoyées trop volumineuses',
      statusCode: 413,
      code: 'PAYLOAD_TOO_LARGE'
    };
  }

  // JSON malformé
  if (err.type === 'entity.parse.failed' || err.message.includes('JSON')) {
    error = {
      message: 'Format JSON invalide',
      statusCode: 400,
      code: 'INVALID_JSON'
    };
  }

  // Erreur CORS
  if (err.message.includes('CORS')) {
    error = {
      message: 'Requête bloquée par la politique CORS',
      statusCode: 403,
      code: 'CORS_ERROR'
    };
  }

  // 🔧 ERREURS DE DÉVELOPPEMENT VS PRODUCTION

  const isDevelopment = process.env.NODE_ENV === 'development';
  const statusCode = error.statusCode || 500;

  // Structure de réponse standard
  const errorResponse = {
    success: false,
    message: error.message || 'Une erreur interne s\'est produite',
    code: error.code || 'INTERNAL_SERVER_ERROR',
    statusCode: statusCode,
    timestamp: new Date().toISOString()
  };

  // En développement, ajouter plus de détails
  if (isDevelopment) {
    errorResponse.stack = err.stack;
    errorResponse.details = error.details;
    
    if (error.field) {
      errorResponse.field = error.field;
    }
  }

  // En production, éviter de révéler des informations sensibles
  if (!isDevelopment && statusCode >= 500) {
    errorResponse.message = 'Une erreur interne s\'est produite';
    errorResponse.code = 'INTERNAL_SERVER_ERROR';
  }

  // 📊 COLLECTE D'ERREURS POUR MONITORING (placeholder)
  // En production, on pourrait envoyer les erreurs à un service comme Sentry
  if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
    // TODO: Intégrer avec un service de monitoring d'erreurs
    // Sentry.captureException(err);
  }

  res.status(statusCode).json(errorResponse);
};

// Middleware pour gérer les erreurs asynchrones non capturées
const asyncErrorHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Middleware de validation des données JSON entrantes
const validateJSON = (err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'JSON malformé dans le corps de la requête',
      code: 'INVALID_JSON',
      timestamp: new Date().toISOString()
    });
  }
  next(err);
};

// Middleware pour loguer les requêtes lentes
const slowQueryLogger = (threshold = 1000) => { // 1 seconde par défaut
  return (req, res, next) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (duration > threshold) {
      }
    });
    
    next();
  };
};

module.exports = {
  notFoundHandler,
  errorHandler,
  asyncErrorHandler,
  validateJSON,
  slowQueryLogger
};