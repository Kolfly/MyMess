const { body, param, query } = require('express-validator');

// 🛡️ VALIDATORS POUR L'AUTHENTIFICATION
// Ces validators utilisent express-validator pour vérifier et nettoyer les données
// Ils s'exécutent AVANT que les données arrivent au controller

class AuthValidator {
  
  // ✅ VALIDATION POUR L'INSCRIPTION
  // Cette fonction retourne un tableau de middlewares de validation
  static getRegisterValidation() {
    return [
      // Validation du nom d'utilisateur
      body('username')
        .trim()                                    // Supprime les espaces en début/fin
        .notEmpty()
        .withMessage('Le nom d\'utilisateur est requis')
        .isLength({ min: 3, max: 50 })
        .withMessage('Le nom d\'utilisateur doit faire entre 3 et 50 caractères')
        .matches(/^[a-zA-Z0-9_-]+$/)              // Lettres, chiffres, tirets et underscores uniquement
        .withMessage('Le nom d\'utilisateur ne peut contenir que des lettres, chiffres, tirets et underscores')
        .custom(async (username) => {
          // Vérification personnalisée : éviter les noms d'utilisateur réservés
          const reservedNames = ['admin', 'root', 'system', 'api', 'www', 'mail', 'support', 'help'];
          if (reservedNames.includes(username.toLowerCase())) {
            throw new Error('Ce nom d\'utilisateur est réservé');
          }
          return true;
        }),

      // Validation de l'email
      body('email')
        .trim()
        .normalizeEmail({                          // Normalise l'email (minuscules, supprime les points dans Gmail, etc.)
          gmail_remove_dots: true,
          gmail_remove_subaddress: true,
          outlookdotcom_remove_subaddress: true
        })
        .isEmail()
        .withMessage('Veuillez fournir un adresse email valide')
        .isLength({ min: 5, max: 100 })
        .withMessage('L\'email doit faire entre 5 et 100 caractères')
        .custom((email) => {
          // Vérifications supplémentaires pour éviter les emails temporaires
          const tempEmailDomains = ['10minutemail.com', 'tempmail.org', 'guerrillamail.com'];
          const domain = email.split('@')[1]?.toLowerCase();
          
          if (tempEmailDomains.includes(domain)) {
            throw new Error('Les adresses email temporaires ne sont pas autorisées');
          }
          
          return true;
        }),

      // Validation du mot de passe
      body('password')
        .isLength({ min: 8, max: 128 })
        .withMessage('Le mot de passe doit faire entre 8 et 128 caractères')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).*$/)
        .withMessage('Le mot de passe doit contenir au moins : 1 minuscule, 1 majuscule, 1 chiffre et 1 caractère spécial')
        .custom((password) => {
          // Vérifications supplémentaires de sécurité
          const commonPasswords = ['password', '123456', 'azerty', 'qwerty', 'admin'];
          const lowerPassword = password.toLowerCase();
          
          for (let commonPwd of commonPasswords) {
            if (lowerPassword.includes(commonPwd)) {
              throw new Error('Le mot de passe ne peut pas contenir des mots courants');
            }
          }
          
          return true;
        }),

      // Validation optionnelle du prénom
      body('firstName')
        .optional({ checkFalsy: true })            // Le champ est optionnel
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Le prénom doit faire entre 2 et 50 caractères')
        .matches(/^[a-zA-ZÀ-ÿ\s\-']+$/)           // Lettres, espaces, tirets et apostrophes (pour les noms composés)
        .withMessage('Le prénom ne peut contenir que des lettres, espaces, tirets et apostrophes')
        .custom((firstName) => {
          // Vérifier qu'il n'y a pas que des espaces ou tirets
          if (firstName && firstName.replace(/[\s\-']/g, '').length < 2) {
            throw new Error('Le prénom doit contenir au moins 2 lettres');
          }
          return true;
        }),

      // Validation optionnelle du nom de famille
      body('lastName')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Le nom de famille doit faire entre 2 et 50 caractères')
        .matches(/^[a-zA-ZÀ-ÿ\s\-']+$/)
        .withMessage('Le nom de famille ne peut contenir que des lettres, espaces, tirets et apostrophes')
        .custom((lastName) => {
          if (lastName && lastName.replace(/[\s\-']/g, '').length < 2) {
            throw new Error('Le nom de famille doit contenir au moins 2 lettres');
          }
          return true;
        })
    ];
  }

  // 🔐 VALIDATION POUR LA CONNEXION
  static getLoginValidation() {
    return [
      body('email')
        .trim()
        .normalizeEmail()
        .isEmail()
        .withMessage('Veuillez fournir une adresse email valide')
        .isLength({ max: 100 })
        .withMessage('L\'email est trop long'),

      body('password')
        .notEmpty()
        .withMessage('Le mot de passe est requis')
        .isLength({ max: 128 })
        .withMessage('Le mot de passe est trop long')
    ];
  }

  // ✏️ VALIDATION POUR LA MISE À JOUR DU PROFIL
  static getProfileUpdateValidation() {
    return [
      body('username')
        .optional()
        .trim()
        .isLength({ min: 3, max: 50 })
        .withMessage('Le nom d\'utilisateur doit faire entre 3 et 50 caractères')
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('Le nom d\'utilisateur ne peut contenir que des lettres, chiffres, tirets et underscores')
        .custom(async (username) => {
          const reservedNames = ['admin', 'root', 'system', 'api', 'www', 'mail', 'support', 'help'];
          if (username && reservedNames.includes(username.toLowerCase())) {
            throw new Error('Ce nom d\'utilisateur est réservé');
          }
          return true;
        }),

      body('firstName')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Le prénom doit faire entre 2 et 50 caractères')
        .matches(/^[a-zA-ZÀ-ÿ\s\-']+$/)
        .withMessage('Le prénom ne peut contenir que des lettres, espaces, tirets et apostrophes'),

      body('lastName')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Le nom de famille doit faire entre 2 et 50 caractères')
        .matches(/^[a-zA-ZÀ-ÿ\s\-']+$/)
        .withMessage('Le nom de famille ne peut contenir que des lettres, espaces, tirets et apostrophes'),

      body('avatar')
        .optional({ checkFalsy: true })
        .isURL({
          protocols: ['http', 'https'],
          require_protocol: true
        })
        .withMessage('L\'avatar doit être une URL valide (http ou https)')
        .isLength({ max: 500 })
        .withMessage('L\'URL de l\'avatar est trop longue')
        .custom((avatarUrl) => {
          // Vérifier que c'est bien une image
          if (avatarUrl) {
            const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
            const hasValidExtension = imageExtensions.some(ext => 
              avatarUrl.toLowerCase().includes(ext)
            );
            
            // Autoriser les URLs sans extension (services comme Gravatar, Cloudinary)
            const isServiceUrl = /\.(gravatar|cloudinary|imgur|unsplash)\./.test(avatarUrl.toLowerCase());
            
            if (!hasValidExtension && !isServiceUrl) {
              throw new Error('L\'avatar doit pointer vers une image (jpg, png, gif, webp) ou un service d\'images reconnu');
            }
          }
          return true;
        })
    ];
  }

  // 🔒 VALIDATION POUR LE CHANGEMENT DE MOT DE PASSE
  static getChangePasswordValidation() {
    return [
      body('currentPassword')
        .notEmpty()
        .withMessage('Le mot de passe actuel est requis')
        .isLength({ max: 128 })
        .withMessage('Le mot de passe actuel est trop long'),

      body('newPassword')
        .isLength({ min: 8, max: 128 })
        .withMessage('Le nouveau mot de passe doit faire entre 8 et 128 caractères')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).*$/)
        .withMessage('Le nouveau mot de passe doit contenir au moins : 1 minuscule, 1 majuscule, 1 chiffre et 1 caractère spécial')
        .custom((newPassword, { req }) => {
          // Vérifier que le nouveau mot de passe est différent de l'ancien
          if (newPassword === req.body.currentPassword) {
            throw new Error('Le nouveau mot de passe doit être différent de l\'ancien');
          }
          
          // Vérifications de sécurité supplémentaires
          const commonPasswords = ['password', '123456', 'azerty', 'qwerty', 'admin'];
          const lowerPassword = newPassword.toLowerCase();
          
          for (let commonPwd of commonPasswords) {
            if (lowerPassword.includes(commonPwd)) {
              throw new Error('Le nouveau mot de passe ne peut pas contenir des mots courants');
            }
          }
          
          return true;
        }),

      body('confirmPassword')
        .custom((confirmPassword, { req }) => {
          if (confirmPassword !== req.body.newPassword) {
            throw new Error('La confirmation du mot de passe ne correspond pas');
          }
          return true;
        })
    ];
  }

  // 🔄 VALIDATION POUR LE REFRESH TOKEN
  static getRefreshTokenValidation() {
    return [
      body('refreshToken')
        .notEmpty()
        .withMessage('Le token de rafraîchissement est requis')
        .isJWT()
        .withMessage('Le token de rafraîchissement doit être un JWT valide')
    ];
  }

  // 🔍 VALIDATION POUR LA RECHERCHE D'UTILISATEURS
  static getSearchUsersValidation() {
    return [
      query('q')                                   // Le paramètre de recherche vient de l'URL (?q=terme)
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Le terme de recherche doit faire entre 2 et 50 caractères')
        .escape(),                                 // Échapper les caractères HTML dangereux

      query('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('La limite doit être un nombre entre 1 et 50')
        .toInt(),                                  // Convertir en entier

      query('offset')
        .optional()
        .isInt({ min: 0 })
        .withMessage('L\'offset doit être un nombre positif ou zéro')
        .toInt()
    ];
  }

  // 🎯 VALIDATION POUR LA MISE À JOUR DU STATUT
  static getUpdateStatusValidation() {
    return [
      body('status')
        .isIn(['online', 'offline', 'away', 'busy', 'invisible'])
        .withMessage('Le statut doit être : online, offline, away, busy ou invisible')
    ];
  }

  // 📧 VALIDATION POUR LE RENVOI DE VÉRIFICATION D'EMAIL
  static getResendVerificationValidation() {
    return [
      body('email')
        .trim()
        .normalizeEmail()
        .isEmail()
        .withMessage('Veuillez fournir une adresse email valide')
        .isLength({ min: 5, max: 100 })
        .withMessage('L\'email doit faire entre 5 et 100 caractères')
    ];
  }

  // 📧 VALIDATION POUR LA RÉINITIALISATION DE MOT DE PASSE (pour plus tard)
  static getPasswordResetRequestValidation() {
    return [
      body('email')
        .trim()
        .normalizeEmail()
        .isEmail()
        .withMessage('Veuillez fournir une adresse email valide')
    ];
  }

  static getPasswordResetValidation() {
    return [
      body('token')
        .notEmpty()
        .withMessage('Le token de réinitialisation est requis')
        .isLength({ min: 20 })
        .withMessage('Token de réinitialisation invalide'),

      body('newPassword')
        .isLength({ min: 8, max: 128 })
        .withMessage('Le mot de passe doit faire entre 8 et 128 caractères')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).*$/)
        .withMessage('Le mot de passe doit contenir au moins : 1 minuscule, 1 majuscule, 1 chiffre et 1 caractère spécial')
    ];
  }

  // 🏷️ VALIDATION POUR LES PARAMÈTRES D'URL
  static getParamValidation() {
    return {
      // Validation pour les IDs UUID dans les paramètres de route
      userId: param('userId')
        .isUUID(4)
        .withMessage('ID utilisateur invalide'),
      
      // Validation pour les tokens dans les paramètres
      token: param('token')
        .isLength({ min: 20 })
        .withMessage('Token invalide')
    };
  }
}

module.exports = AuthValidator;