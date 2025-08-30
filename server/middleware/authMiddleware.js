const { verifyToken } = require('../utils/jwt');
const User = require('../models/User');

// 🛡️ MIDDLEWARE D'AUTHENTIFICATION PRINCIPAL
// Ce middleware vérifie que l'utilisateur est bien connecté et autorisé
const authMiddleware = async (req, res, next) => {
  try {
    // Étape 1: Récupérer le token depuis l'en-tête Authorization
    // Format attendu: "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    const authHeader = req.headers.authorization;
    
    // Vérifier que l'en-tête existe et commence par "Bearer "
    if (!authHeader) {
      return res.status(401).json({ 
        success: false, 
        message: 'Token d\'authentification requis',
        code: 'NO_TOKEN'
      });
    }

    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Format de token invalide. Utilisez: Bearer <token>',
        code: 'INVALID_TOKEN_FORMAT'
      });
    }

    // Extraire le token (enlever le préfixe "Bearer ")
    const token = authHeader.substring(7);

    if (!token || token === 'null' || token === 'undefined') {
      return res.status(401).json({ 
        success: false, 
        message: 'Token manquant',
        code: 'MISSING_TOKEN'
      });
    }

    // Étape 2: Vérifier et décoder le token JWT
    let decoded;
    try {
      decoded = verifyToken(token, 'access');
    } catch (tokenError) {
      // Gérer les différents types d'erreurs de token
      let message = 'Token invalide';
      let code = 'INVALID_TOKEN';

      if (tokenError.message.includes('expiré')) {
        message = 'Token expiré. Veuillez vous reconnecter.';
        code = 'TOKEN_EXPIRED';
      } else if (tokenError.message.includes('invalide')) {
        message = 'Token invalide';
        code = 'INVALID_TOKEN';
      }

      return res.status(401).json({ 
        success: false, 
        message: message,
        code: code
      });
    }

    // Étape 3: Récupérer l'utilisateur depuis la base de données
    // Important: on re-vérifie toujours en base, car l'utilisateur pourrait avoir été désactivé
    const user = await User.findOne({
      where: { 
        id: decoded.userId,
        isActive: true  // Seuls les comptes actifs peuvent s'authentifier
      }
    });
    
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Utilisateur introuvable ou compte désactivé',
        code: 'USER_NOT_FOUND'
      });
    }

    // Étape 4: Vérifier que le compte n'est pas temporairement bloqué
    if (user.isLocked()) {
      const unlockTime = new Date(user.lockedUntil).toLocaleString('fr-FR');
      return res.status(423).json({ // 423 = Locked
        success: false, 
        message: `Compte temporairement bloqué jusqu'à ${unlockTime}`,
        code: 'ACCOUNT_LOCKED'
      });
    }

    // Étape 5: Mettre à jour l'activité de l'utilisateur
    // On fait ça de manière asynchrone pour ne pas ralentir la requête
    user.update({ lastSeen: new Date() }).catch(error => {
      console.warn('Erreur mise à jour lastSeen:', error.message);
    });

    // Étape 6: Ajouter l'utilisateur et les infos du token à l'objet request
    // Cela permet aux routes suivantes d'accéder facilement aux données utilisateur
    req.user = user;           // L'objet utilisateur complet
    req.userId = user.id;      // Raccourci vers l'ID utilisateur
    req.token = decoded;       // Les données décodées du token (timestamps, etc.)

    // Étape 7: Passer au middleware/route suivant
    next();

  } catch (error) {
    // Gestion des erreurs inattendues (problèmes de base de données, etc.)
    console.error('Erreur dans authMiddleware:', error);
    
    return res.status(500).json({ 
      success: false, 
      message: 'Erreur interne d\'authentification',
      code: 'INTERNAL_AUTH_ERROR',
      // En développement, on peut inclure plus de détails
      ...(process.env.NODE_ENV === 'development' && { 
        details: error.message 
      })
    });
  }
};

// 🔒 MIDDLEWARE D'AUTHENTIFICATION OPTIONNEL
// Utilise ce middleware quand tu veux récupérer l'utilisateur connecté S'IL EXISTE,
// mais sans bloquer les utilisateurs non connectés
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    // Si pas d'en-tête d'auth, on continue sans utilisateur
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      req.userId = null;
      return next();
    }

    const token = authHeader.substring(7);
    
    if (!token || token === 'null' || token === 'undefined') {
      req.user = null;
      req.userId = null;
      return next();
    }

    // Tenter de décoder le token, mais ne pas bloquer si ça échoue
    try {
      const decoded = verifyToken(token, 'access');
      const user = await User.findOne({
        where: { 
          id: decoded.userId,
          isActive: true
        }
      });
      
      if (user && !user.isLocked()) {
        req.user = user;
        req.userId = user.id;
        req.token = decoded;
        
        // Mettre à jour l'activité
        user.update({ lastSeen: new Date() }).catch(() => {});
      } else {
        req.user = null;
        req.userId = null;
      }
    } catch (tokenError) {
      // En cas d'erreur de token, on continue simplement sans utilisateur
      req.user = null;
      req.userId = null;
    }

    next();

  } catch (error) {
    // Même en cas d'erreur, on continue sans utilisateur
    console.warn('Erreur dans optionalAuthMiddleware:', error.message);
    req.user = null;
    req.userId = null;
    next();
  }
};

// 👑 MIDDLEWARE POUR VÉRIFIER DES RÔLES SPÉCIFIQUES
// Utilise ce middleware après authMiddleware pour vérifier des permissions
const requireRole = (roles) => {
  // Retourner une fonction middleware (pattern de middleware paramétré)
  return (req, res, next) => {
    // S'assurer qu'authMiddleware a été exécuté avant
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise',
        code: 'AUTH_REQUIRED'
      });
    }

    // Vérifier si l'utilisateur a un des rôles requis
    // Pour l'instant, on n'a pas encore implémenté les rôles dans notre modèle User
    // mais ce middleware sera prêt quand on les ajoutera
    const userRoles = req.user.roles || ['user']; // Rôle par défaut
    const hasRequiredRole = roles.some(role => userRoles.includes(role));

    if (!hasRequiredRole) {
      return res.status(403).json({
        success: false,
        message: 'Permissions insuffisantes',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: roles,
        current: userRoles
      });
    }

    next();
  };
};

// 🚫 MIDDLEWARE POUR VÉRIFIER LA PROPRIÉTÉ D'UNE RESSOURCE
// Utilise ce middleware pour s'assurer qu'un utilisateur ne peut modifier que ses propres données
const requireOwnership = (resourceIdParam = 'id', userIdField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentification requise',
        code: 'AUTH_REQUIRED'
      });
    }

    // Récupérer l'ID de la ressource depuis les paramètres de route
    const resourceId = req.params[resourceIdParam];
    
    // Si on cherche à modifier une ressource avec un userId spécifique
    if (userIdField === 'userId') {
      // La ressource doit appartenir à l'utilisateur connecté
      const resourceUserId = req.body[userIdField] || req.params.userId;
      
      if (resourceUserId && resourceUserId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Vous ne pouvez modifier que vos propres données',
          code: 'OWNERSHIP_REQUIRED'
        });
      }
    }
    
    // Si c'est l'utilisateur qui modifie son propre profil
    if (resourceId === req.user.id) {
      return next();
    }

    // Pour d'autres cas, on peut ajouter une vérification en base de données
    // (par exemple, vérifier que l'utilisateur est propriétaire d'un message)
    
    return res.status(403).json({
      success: false,
      message: 'Accès non autorisé à cette ressource',
      code: 'ACCESS_DENIED'
    });
  };
};

// 📊 MIDDLEWARE DE LOGGING DES REQUÊTES AUTHENTIFIÉES
// Utile pour tracer les actions des utilisateurs (audit trail)
const logAuthenticatedRequests = (req, res, next) => {
  if (req.user) {
    console.log(`🔐 ${new Date().toISOString()} - User ${req.user.username} (${req.user.id}) - ${req.method} ${req.originalUrl}`);
  }
  next();
};

// 🕐 MIDDLEWARE POUR VÉRIFIER SI LE TOKEN VA EXPIRER BIENTÔT
// Ajoute un header pour prévenir le client qu'il devrait renouveler son token
const checkTokenExpiration = (req, res, next) => {
  if (req.token && req.token.exp) {
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = req.token.exp - now;
    
    // Si le token expire dans moins de 10 minutes
    if (expiresIn < 600) {
      res.set('X-Token-Refresh-Needed', 'true');
      res.set('X-Token-Expires-In', expiresIn.toString());
    }
  }
  next();
};

module.exports = {
  authMiddleware,
  optionalAuthMiddleware,
  requireRole,
  requireOwnership,
  logAuthenticatedRequests,
  checkTokenExpiration,
  authenticateToken: authMiddleware  
};