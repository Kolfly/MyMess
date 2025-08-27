const jwt = require('jsonwebtoken');

// Utilitaires pour la gestion des tokens JWT
// JWT = JSON Web Token : un standard pour transmettre des informations de manière sécurisée

class JWTUtils {
  
  // 🎫 GÉNÉRATION D'UN TOKEN D'ACCÈS
  // Crée un token que l'utilisateur utilisera pour prouver son identité
  generateAccessToken(userId, additionalPayload = {}) {
    try {
      // Le payload contient les informations qu'on veut inclure dans le token
      // ATTENTION: Ces infos ne sont pas chiffrées, juste signées ! Ne pas y mettre d'infos sensibles
      const payload = {
        userId: userId,                    // L'ID de l'utilisateur (essentiel)
        type: 'access',                    // Type de token (pour différencier access et refresh)
        iat: Math.floor(Date.now() / 1000), // Timestamp de création
        ...additionalPayload               // Infos supplémentaires si nécessaire
      };

      // On signe le token avec notre clé secrète
      // Seul notre serveur peut vérifier l'authenticité de ce token
      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET,            // Clé secrète (JAMAIS la révéler!)
        {
          expiresIn: process.env.JWT_EXPIRE || '7d',  // Durée de vie du token
          algorithm: 'HS256',              // Algorithme de signature (sécurisé)
          issuer: 'chatapp-api',           // Qui a émis ce token
          audience: 'chatapp-users'        // Pour qui ce token est destiné
        }
      );

      return token;

    } catch (error) {
      console.error('Erreur génération token:', error);
      throw new Error('Impossible de générer le token d\'authentification');
    }
  }

  // 🔄 GÉNÉRATION D'UN REFRESH TOKEN
  // Token à durée de vie plus longue pour renouveler les access tokens
  generateRefreshToken(userId) {
    try {
      const payload = {
        userId: userId,
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000)
      };

      const refreshToken = jwt.sign(
        payload,
        process.env.JWT_SECRET,
        {
          expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d', // Plus long que l'access token
          algorithm: 'HS256',
          issuer: 'chatapp-api',
          audience: 'chatapp-users'
        }
      );

      return refreshToken;

    } catch (error) {
      console.error('Erreur génération refresh token:', error);
      throw new Error('Impossible de générer le refresh token');
    }
  }

  // ✅ VÉRIFICATION D'UN TOKEN
  // Vérifie qu'un token est valide et retourne les informations qu'il contient
  verifyToken(token, tokenType = 'access') {
    try {
      if (!token) {
        throw new Error('Token manquant');
      }

      // Vérifier et décoder le token
      const decoded = jwt.verify(token, process.env.JWT_SECRET, {
        issuer: 'chatapp-api',
        audience: 'chatapp-users',
        algorithms: ['HS256']              // On accepte seulement l'algorithme qu'on utilise
      });

      // Vérifier que c'est le bon type de token
      if (decoded.type !== tokenType) {
        throw new Error(`Type de token incorrect. Attendu: ${tokenType}, reçu: ${decoded.type}`);
      }

      // Vérifier que le token n'est pas expiré (jwt.verify le fait déjà, mais on double-check)
      const now = Math.floor(Date.now() / 1000);
      if (decoded.exp && decoded.exp < now) {
        throw new Error('Token expiré');
      }

      return decoded;

    } catch (error) {
      // Gestion des différents types d'erreurs JWT
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Token invalide');
      } else if (error.name === 'TokenExpiredError') {
        throw new Error('Token expiré');
      } else if (error.name === 'NotBeforeError') {
        throw new Error('Token pas encore valide');
      } else {
        // Si c'est notre propre erreur, on la relance
        throw error;
      }
    }
  }

  // 🔍 DÉCODER UN TOKEN SANS LE VÉRIFIER
  // Utile pour débugger ou récupérer des infos d'un token expiré
  decodeToken(token) {
    try {
      // decode() ne vérifie pas la signature, juste décode le contenu
      const decoded = jwt.decode(token, { complete: true });
      
      if (!decoded) {
        throw new Error('Token impossible à décoder');
      }

      return {
        header: decoded.header,     // Infos sur l'algorithme utilisé
        payload: decoded.payload,   // Les données qu'on a mises dedans
        signature: 'hidden'         // On cache la signature pour la sécurité
      };

    } catch (error) {
      throw new Error('Token malformé');
    }
  }

  // 📅 VÉRIFIER SI UN TOKEN VA BIENTÔT EXPIRER
  // Utile pour proposer un refresh automatique avant expiration
  isTokenExpiringSoon(token, thresholdInMinutes = 15) {
    try {
      const decoded = this.decodeToken(token);
      
      if (!decoded.payload.exp) {
        return false; // Si pas d'expiration, il n'expire jamais
      }

      const expirationTime = decoded.payload.exp * 1000; // Convertir en millisecondes
      const now = Date.now();
      const thresholdTime = thresholdInMinutes * 60 * 1000; // Convertir en millisecondes

      return (expirationTime - now) <= thresholdTime;

    } catch (error) {
      // En cas d'erreur, on considère qu'il expire bientôt (par sécurité)
      return true;
    }
  }

  // 🔧 EXTRAIRE L'USER ID D'UN TOKEN
  // Fonction pratique pour récupérer rapidement l'ID utilisateur
  extractUserIdFromToken(token) {
    try {
      const decoded = this.verifyToken(token);
      return decoded.userId;
    } catch (error) {
      throw new Error('Impossible d\'extraire l\'ID utilisateur du token');
    }
  }

  // 📋 CRÉER UNE PAIRE DE TOKENS (ACCESS + REFRESH)
  // Fonction pratique qui crée les deux tokens d'un coup
  generateTokenPair(userId, additionalPayload = {}) {
    try {
      const accessToken = this.generateAccessToken(userId, additionalPayload);
      const refreshToken = this.generateRefreshToken(userId);

      // Calculer les dates d'expiration pour informer le client
      const accessDecoded = this.decodeToken(accessToken);
      const refreshDecoded = this.decodeToken(refreshToken);

      return {
        accessToken: accessToken,
        refreshToken: refreshToken,
        tokenType: 'Bearer',                    // Type de token (standard OAuth2)
        expiresIn: accessDecoded.payload.exp,   // Timestamp d'expiration access token
        refreshExpiresIn: refreshDecoded.payload.exp  // Timestamp d'expiration refresh token
      };

    } catch (error) {
      throw new Error('Impossible de générer la paire de tokens');
    }
  }

  // 🔄 RENOUVELER UN ACCESS TOKEN AVEC UN REFRESH TOKEN
  // Permet de générer un nouvel access token sans redemander le mot de passe
  refreshAccessToken(refreshToken) {
    try {
      // Vérifier que le refresh token est valide
      const decoded = this.verifyToken(refreshToken, 'refresh');
      
      // Générer un nouvel access token avec les mêmes informations
      const newAccessToken = this.generateAccessToken(decoded.userId);

      return {
        accessToken: newAccessToken,
        tokenType: 'Bearer',
        expiresIn: this.decodeToken(newAccessToken).payload.exp
      };

    } catch (error) {
      throw new Error('Impossible de renouveler le token d\'accès');
    }
  }

  // 🛡️ VALIDER LA FORCE DE LA CLÉ SECRÈTE
  // Fonction utile pour s'assurer qu'on utilise une clé secrète suffisamment forte
  validateJWTSecret() {
    const secret = process.env.JWT_SECRET;
    
    if (!secret) {
      throw new Error('JWT_SECRET n\'est pas défini dans les variables d\'environnement');
    }

    if (secret.length < 32) {
      console.warn('⚠️  JWT_SECRET est trop courte (moins de 32 caractères). Considère utiliser une clé plus longue pour la sécurité.');
    }

    if (secret === 'your-super-secret-jwt-key-change-this-in-production') {
      throw new Error('🚨 JWT_SECRET utilise encore la valeur par défaut ! Change-la immédiatement !');
    }

    console.log('✅ JWT_SECRET est correctement configurée');
    return true;
  }
}

// Créer une instance unique et valider la configuration au démarrage
const jwtUtils = new JWTUtils();

// Valider la clé secrète au moment de l'importation du module
try {
  jwtUtils.validateJWTSecret();
} catch (error) {
  console.error('❌ Erreur configuration JWT:', error.message);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1); // En production, on arrête tout si la config JWT est incorrecte
  }
}

// Exporter les fonctions individuelles pour une utilisation simple
module.exports = {
  generateToken: (userId, additionalPayload) => jwtUtils.generateAccessToken(userId, additionalPayload),
  generateRefreshToken: (userId) => jwtUtils.generateRefreshToken(userId),
  verifyToken: (token, type) => jwtUtils.verifyToken(token, type),
  decodeToken: (token) => jwtUtils.decodeToken(token),
  isTokenExpiringSoon: (token, threshold) => jwtUtils.isTokenExpiringSoon(token, threshold),
  extractUserIdFromToken: (token) => jwtUtils.extractUserIdFromToken(token),
  generateTokenPair: (userId, additionalPayload) => jwtUtils.generateTokenPair(userId, additionalPayload),
  refreshAccessToken: (refreshToken) => jwtUtils.refreshAccessToken(refreshToken),
  
  // Exporter aussi la classe complète pour usage avancé
  JWTUtils: jwtUtils
};