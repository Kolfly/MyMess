const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Utilitaires pour la gestion des tokens JWT dans notre système d'authentification
// JWT = JSON Web Token : un standard sécurisé pour transmettre des informations d'identité

class JWTUtilities {
  
  // ================================================
  // GÉNÉRATION DE TOKENS D'ACCÈS
  // ================================================
  
  // Générer un token d'accès principal pour un utilisateur authentifié
  // Ce token sert de "badge d'accès" que l'utilisateur présente à chaque requête
  generateAccessToken(userId, additionalData = {}) {
    try {
      // Le payload contient les informations que nous voulons encoder dans le token
      // ATTENTION : ces données ne sont pas chiffrées, seulement signées !
      // Ne jamais inclure d'informations sensibles comme des mots de passe
      const payload = {
        // Informations standard JWT (claims standards)
        userId: userId,                           // L'identifiant de l'utilisateur
        type: 'access',                          // Type de token pour différencier access/refresh
        iat: Math.floor(Date.now() / 1000),     // Issued At : moment de création
        jti: crypto.randomUUID(),               // JWT ID : identifiant unique du token
        
        // Informations supplémentaires si fournies
        ...additionalData
      };

      // Signer le token avec notre clé secrète
      // La signature garantit que le token n'a pas été modifié
      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET,                 // Clé secrète stockée dans les variables d'environnement
        {
          expiresIn: process.env.JWT_EXPIRE || '24h',  // Durée de vie du token
          algorithm: 'HS256',                   // Algorithme de signature (sécurisé et performant)
          issuer: 'chatapp-api',               // Qui a émis ce token (notre application)
          audience: 'chatapp-users'            // Pour qui ce token est destiné (nos utilisateurs)
        }
      );

      return token;

    } catch (error) {
      console.error('Erreur lors de la génération du token d\'accès:', error);
      throw new Error('Impossible de générer le token d\'authentification');
    }
  }

  // ================================================
  // GÉNÉRATION DE REFRESH TOKENS
  // ================================================
  
  // Les refresh tokens permettent de renouveler les access tokens expirés
  // sans demander à l'utilisateur de se reconnecter
  // Ils ont une durée de vie plus longue mais des privilèges plus limités
  generateRefreshToken(userId) {
    try {
      const payload = {
        userId: userId,
        type: 'refresh',                        // Type spécifique pour les refresh tokens
        iat: Math.floor(Date.now() / 1000),
        jti: crypto.randomUUID()               // Chaque refresh token a un ID unique
      };

      const refreshToken = jwt.sign(
        payload,
        process.env.JWT_SECRET,                 // Même clé secrète mais payload différent
        {
          expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',  // Plus long que l'access token
          algorithm: 'HS256',
          issuer: 'chatapp-api',
          audience: 'chatapp-users'
        }
      );

      return refreshToken;

    } catch (error) {
      console.error('Erreur lors de la génération du refresh token:', error);
      throw new Error('Impossible de générer le refresh token');
    }
  }

  // ================================================
  // VÉRIFICATION ET DÉCODAGE DE TOKENS
  // ================================================
  
  // Vérifier qu'un token est valide et récupérer les informations qu'il contient
  // Cette fonction effectue plusieurs vérifications de sécurité
  verifyToken(token, expectedType = 'access') {
    try {
      if (!token || typeof token !== 'string') {
        throw new Error('Token manquant ou format invalide');
      }

      // Nettoyer le token au cas où il contiendrait le préfixe "Bearer "
      const cleanToken = token.replace(/^Bearer\s+/, '');

      // Vérifier et décoder le token avec notre clé secrète
      const decoded = jwt.verify(cleanToken, process.env.JWT_SECRET, {
        issuer: 'chatapp-api',                  // Vérifier que c'est notre application qui l'a émis
        audience: 'chatapp-users',              // Vérifier qu'il est destiné à nos utilisateurs
        algorithms: ['HS256']                   // Accepter seulement notre algorithme de signature
      });

      // Vérifier que c'est le bon type de token
      if (decoded.type !== expectedType) {
        throw new Error(`Type de token incorrect. Attendu: ${expectedType}, reçu: ${decoded.type || 'non défini'}`);
      }

      // Vérifications supplémentaires de sécurité
      if (!decoded.userId) {
        throw new Error('Token invalide : identifiant utilisateur manquant');
      }

      // Vérifier que le token n'est pas expiré (jwt.verify le fait déjà, mais on double-check)
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < now) {
        throw new Error('Token expiré');
      }

      return decoded;

    } catch (error) {
      // Transformer les erreurs JWT en messages plus compréhensibles
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Token invalide ou corrompu');
      } else if (error.name === 'TokenExpiredError') {
        throw new Error('Token expiré, veuillez vous reconnecter');
      } else if (error.name === 'NotBeforeError') {
        throw new Error('Token pas encore valide');
      } else {
        // Si c'est notre propre erreur personnalisée, la relancer telle quelle
        throw error;
      }
    }
  }

  // ================================================
  // DÉCODAGE SANS VÉRIFICATION
  // ================================================
  
  // Décoder un token sans vérifier sa signature (utile pour le debugging)
  // ⚠️ ATTENTION : ne jamais utiliser cette fonction pour l'authentification !
  decodeTokenUnsafe(token) {
    try {
      const cleanToken = token.replace(/^Bearer\s+/, '');
      const decoded = jwt.decode(cleanToken, { complete: true });
      
      if (!decoded) {
        throw new Error('Token impossible à décoder');
      }

      return {
        header: decoded.header,         // Informations sur l'algorithme de signature
        payload: decoded.payload,       // Les données que nous avons mises dans le token
        signature: '[HIDDEN]'           // On cache la signature pour la sécurité
      };

    } catch (error) {
      throw new Error('Token malformé ou corrompu');
    }
  }

  // ================================================
  // VÉRIFICATIONS D'EXPIRATION
  // ================================================
  
  // Vérifier si un token va expirer bientôt
  // Utile pour proposer un renouvellement proactif à l'utilisateur
  isTokenExpiringSoon(token, thresholdInMinutes = 10) {
    try {
      const decoded = this.decodeTokenUnsafe(token);
      
      if (!decoded.payload.exp) {
        return false; // Si pas d'expiration définie, il n'expire jamais
      }

      const expirationTime = decoded.payload.exp * 1000; // Convertir en millisecondes
      const now = Date.now();
      const thresholdTime = thresholdInMinutes * 60 * 1000;

      // Retourne true si le token expire dans moins de X minutes
      return (expirationTime - now) <= thresholdTime;

    } catch (error) {
      // En cas d'erreur de décodage, considérer qu'il expire bientôt par sécurité
      return true;
    }
  }

  // Calculer le temps restant avant expiration d'un token
  getTimeUntilExpiration(token) {
    try {
      const decoded = this.decodeTokenUnsafe(token);
      
      if (!decoded.payload.exp) {
        return null; // Pas d'expiration définie
      }

      const expirationTime = decoded.payload.exp * 1000;
      const now = Date.now();
      const timeRemaining = expirationTime - now;

      if (timeRemaining <= 0) {
        return 0; // Déjà expiré
      }

      // Retourner le temps restant en secondes
      return Math.floor(timeRemaining / 1000);

    } catch (error) {
      return 0; // En cas d'erreur, considérer comme expiré
    }
  }

  // ================================================
  // UTILITAIRES PRATIQUES
  // ================================================
  
  // Extraire rapidement l'ID utilisateur d'un token
  extractUserIdFromToken(token) {
    try {
      const decoded = this.verifyToken(token);
      return decoded.userId;
    } catch (error) {
      throw new Error('Impossible d\'extraire l\'ID utilisateur : ' + error.message);
    }
  }

  // Créer une paire complète de tokens (access + refresh)
  generateTokenPair(userId, additionalData = {}) {
    try {
      const accessToken = this.generateAccessToken(userId, additionalData);
      const refreshToken = this.generateRefreshToken(userId);

      // Calculer les timestamps d'expiration pour informer le client
      const accessDecoded = this.decodeTokenUnsafe(accessToken);
      const refreshDecoded = this.decodeTokenUnsafe(refreshToken);

      return {
        accessToken: accessToken,
        refreshToken: refreshToken,
        tokenType: 'Bearer',                     // Standard OAuth2
        expiresIn: accessDecoded.payload.exp,    // Timestamp d'expiration access token
        refreshExpiresIn: refreshDecoded.payload.exp,  // Timestamp d'expiration refresh token
        issuedAt: Math.floor(Date.now() / 1000)  // Moment de génération
      };

    } catch (error) {
      throw new Error('Impossible de générer la paire de tokens : ' + error.message);
    }
  }

  // Renouveler un access token en utilisant un refresh token valide
  refreshAccessToken(refreshToken) {
    try {
      // Vérifier que le refresh token est valide
      const decoded = this.verifyToken(refreshToken, 'refresh');
      
      // Générer un nouvel access token pour le même utilisateur
      const newAccessToken = this.generateAccessToken(decoded.userId);
      const newAccessDecoded = this.decodeTokenUnsafe(newAccessToken);

      return {
        accessToken: newAccessToken,
        tokenType: 'Bearer',
        expiresIn: newAccessDecoded.payload.exp,
        issuedAt: Math.floor(Date.now() / 1000)
      };

    } catch (error) {
      throw new Error('Impossible de renouveler le token : ' + error.message);
    }
  }

  // ================================================
  // VALIDATION DE LA CONFIGURATION
  // ================================================
  
  // Vérifier que la clé secrète JWT est suffisamment robuste
  validateJWTConfiguration() {
    const secret = process.env.JWT_SECRET;
    
    if (!secret) {
      throw new Error('❌ JWT_SECRET n\'est pas défini dans les variables d\'environnement');
    }

    if (secret.length < 32) {
      console.warn('⚠️  JWT_SECRET est courte (moins de 32 caractères). Utilise une clé plus longue pour une sécurité optimale.');
    }

    // Vérifier que ce n'est pas une valeur par défaut dangereuse
    const dangerousDefaults = [
      'secret', 'jwt-secret', 'your-secret-key', 'change-me',
      'your-super-secret-jwt-key-change-this-in-production'
    ];
    
    if (dangerousDefaults.includes(secret.toLowerCase())) {
      throw new Error('🚨 JWT_SECRET utilise une valeur par défaut dangereuse ! Change-la immédiatement !');
    }

    console.log('✅ Configuration JWT validée avec succès');
    return true;
  }

  // Générer une suggestion de clé secrète sécurisée
  generateSecureSecret(length = 64) {
    return crypto.randomBytes(length).toString('hex');
  }
}

// Créer une instance unique de nos utilitaires JWT
const jwtUtils = new JWTUtilities();

// Valider la configuration au moment de l'importation
try {
  jwtUtils.validateJWTConfiguration();
} catch (error) {
  console.error('❌ Erreur de configuration JWT:', error.message);
  
  if (error.message.includes('JWT_SECRET n\'est pas défini')) {
    console.log('💡 Suggestion de clé secrète sécurisée:');
    console.log('   JWT_SECRET=' + jwtUtils.generateSecureSecret());
  }
  
  // En production, arrêter l'application si la configuration JWT est incorrecte
  if (process.env.NODE_ENV === 'production') {
    console.error('🛑 Arrêt de l\'application : configuration JWT invalide');
    process.exit(1);
  }
}

// Exporter les fonctions les plus couramment utilisées pour simplifier l'utilisation
module.exports = {
  // Fonctions principales d'authentification
  generateToken: (userId, additionalData) => jwtUtils.generateAccessToken(userId, additionalData),
  generateRefreshToken: (userId) => jwtUtils.generateRefreshToken(userId),
  verifyToken: (token, type) => jwtUtils.verifyToken(token, type),
  
  // Utilitaires pratiques
  extractUserIdFromToken: (token) => jwtUtils.extractUserIdFromToken(token),
  generateTokenPair: (userId, additionalData) => jwtUtils.generateTokenPair(userId, additionalData),
  refreshAccessToken: (refreshToken) => jwtUtils.refreshAccessToken(refreshToken),
  
  // Fonctions de vérification
  isTokenExpiringSoon: (token, threshold) => jwtUtils.isTokenExpiringSoon(token, threshold),
  getTimeUntilExpiration: (token) => jwtUtils.getTimeUntilExpiration(token),
  
  // Décodage (pour debug uniquement)
  decodeTokenUnsafe: (token) => jwtUtils.decodeTokenUnsafe(token),
  
  // Accès à la classe complète pour usage avancé
  JWTUtilities: jwtUtils
};