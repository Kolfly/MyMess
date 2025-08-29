// 📝 VALIDATORS POUR LES MESSAGES
// Validation des données d'entrée pour les messages et conversations

const { body, param, query, validationResult } = require('express-validator');

class MessageValidator {

  // ================================================
  // VALIDATION ENVOI DE MESSAGE
  // ================================================
  
  getSendMessageValidation() {
    return [
      // Contenu du message
      body('content')
        .notEmpty()
        .withMessage('Le contenu du message est requis')
        .isLength({ min: 1, max: 2000 })
        .withMessage('Le message doit faire entre 1 et 2000 caractères')
        .trim(),

      // Type de message (optionnel)
      body('messageType')
        .optional()
        .isIn(['text', 'image', 'file', 'system'])
        .withMessage('Type de message invalide'),

      // ID de la conversation
      body('conversationId')
        .notEmpty()
        .withMessage('ID de conversation requis')
        .isUUID()
        .withMessage('ID de conversation invalide'),

      // Message auquel on répond (optionnel)
      body('replyToId')
        .optional()
        .isUUID()
        .withMessage('ID du message de réponse invalide'),

      // Métadonnées (optionnel)
      body('metadata')
        .optional()
        .isObject()
        .withMessage('Les métadonnées doivent être un objet'),

      // Middleware de validation
      this.handleValidationErrors
    ];
  }

  // ================================================
  // VALIDATION MODIFICATION DE MESSAGE
  // ================================================

  getEditMessageValidation() {
    return [
      // ID du message dans l'URL
      param('messageId')
        .notEmpty()
        .withMessage('ID du message requis')
        .isUUID()
        .withMessage('ID du message invalide'),

      // Nouveau contenu
      body('content')
        .notEmpty()
        .withMessage('Le nouveau contenu est requis')
        .isLength({ min: 1, max: 2000 })
        .withMessage('Le message doit faire entre 1 et 2000 caractères')
        .trim(),

      this.handleValidationErrors
    ];
  }

  // ================================================
  // VALIDATION SUPPRESSION DE MESSAGE
  // ================================================

  getDeleteMessageValidation() {
    return [
      param('messageId')
        .notEmpty()
        .withMessage('ID du message requis')
        .isUUID()
        .withMessage('ID du message invalide'),

      this.handleValidationErrors
    ];
  }

  // ================================================
  // VALIDATION CRÉATION DE CONVERSATION PRIVÉE
  // ================================================

  getCreatePrivateConversationValidation() {
    return [
      body('otherUserId')
        .notEmpty()
        .withMessage('ID de l\'autre utilisateur requis')
        .isUUID()
        .withMessage('ID utilisateur invalide'),

      this.handleValidationErrors
    ];
  }

  // ================================================
  // VALIDATION CRÉATION DE CONVERSATION GROUPE
  // ================================================

  getCreateGroupConversationValidation() {
    return [
      // Nom du groupe
      body('name')
        .notEmpty()
        .withMessage('Le nom du groupe est requis')
        .isLength({ min: 1, max: 100 })
        .withMessage('Le nom doit faire entre 1 et 100 caractères')
        .trim(),

      // Description (optionnelle)
      body('description')
        .optional()
        .isLength({ max: 500 })
        .withMessage('La description ne peut pas dépasser 500 caractères')
        .trim(),

      // Membres du groupe
      body('memberIds')
        .optional()
        .isArray()
        .withMessage('La liste des membres doit être un tableau')
        .custom((memberIds) => {
          if (memberIds && memberIds.length > 0) {
            const allValid = memberIds.every(id => 
              typeof id === 'string' && 
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
            );
            if (!allValid) {
              throw new Error('Tous les IDs de membres doivent être des UUIDs valides');
            }
          }
          return true;
        }),

      this.handleValidationErrors
    ];
  }

  // ================================================
  // VALIDATION RÉCUPÉRATION DE MESSAGES
  // ================================================

  getConversationMessagesValidation() {
    return [
      // ID de la conversation dans l'URL
      param('conversationId')
        .notEmpty()
        .withMessage('ID de conversation requis')
        .isUUID()
        .withMessage('ID de conversation invalide'),

      // Paramètres de pagination
      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('La limite doit être entre 1 et 100')
        .toInt(),

      query('offset')
        .optional()
        .isInt({ min: 0 })
        .withMessage('L\'offset doit être un nombre positif')
        .toInt(),

      // Filtres de date
      query('before')
        .optional()
        .isISO8601()
        .withMessage('La date \'before\' doit être au format ISO8601'),

      query('after')
        .optional()
        .isISO8601()
        .withMessage('La date \'after\' doit être au format ISO8601'),

      this.handleValidationErrors
    ];
  }

  // ================================================
  // VALIDATION RÉCUPÉRATION DE CONVERSATIONS
  // ================================================

  getUserConversationsValidation() {
    return [
      query('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('La limite doit être entre 1 et 50')
        .toInt(),

      query('offset')
        .optional()
        .isInt({ min: 0 })
        .withMessage('L\'offset doit être un nombre positif')
        .toInt(),

      query('includeArchived')
        .optional()
        .isBoolean()
        .withMessage('includeArchived doit être un booléen')
        .toBoolean(),

      this.handleValidationErrors
    ];
  }

  // ================================================
  // VALIDATION DÉTAILS D'UNE CONVERSATION
  // ================================================

  getConversationDetailsValidation() {
    return [
      param('conversationId')
        .notEmpty()
        .withMessage('ID de conversation requis')
        .isUUID()
        .withMessage('ID de conversation invalide'),

      this.handleValidationErrors
    ];
  }

  // ================================================
  // VALIDATION MARQUAGE COMME LU
  // ================================================

  getMarkAsReadValidation() {
    return [
      param('conversationId')
        .notEmpty()
        .withMessage('ID de conversation requis')
        .isUUID()
        .withMessage('ID de conversation invalide'),

      body('messageId')
        .optional()
        .isUUID()
        .withMessage('ID du message invalide'),

      this.handleValidationErrors
    ];
  }

  // ================================================
  // VALIDATION RECHERCHE DE MESSAGES
  // ================================================

  getSearchMessagesValidation() {
    return [
      query('q')
        .notEmpty()
        .withMessage('Terme de recherche requis')
        .isLength({ min: 2, max: 100 })
        .withMessage('Le terme de recherche doit faire entre 2 et 100 caractères')
        .trim(),

      query('conversationId')
        .optional()
        .isUUID()
        .withMessage('ID de conversation invalide'),

      query('limit')
        .optional()
        .isInt({ min: 1, max: 50 })
        .withMessage('La limite doit être entre 1 et 50')
        .toInt(),

      query('offset')
        .optional()
        .isInt({ min: 0 })
        .withMessage('L\'offset doit être un nombre positif')
        .toInt(),

      this.handleValidationErrors
    ];
  }

  // ================================================
  // GESTION DES ERREURS DE VALIDATION
  // ================================================

  handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
      const formattedErrors = errors.array().map(error => ({
        field: error.path || error.param,
        message: error.msg,
        value: error.value
      }));

      console.warn('⚠️ Erreurs de validation messages:', {
        url: req.originalUrl,
        method: req.method,
        errors: formattedErrors,
        ip: req.ip
      });

      return res.status(400).json({
        success: false,
        message: 'Erreurs de validation des données',
        code: 'VALIDATION_ERROR',
        errors: formattedErrors,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };

  // ================================================
  // VALIDATION PERSONNALISÉE POUR UUID
  // ================================================

  isValidUUID(value) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }

  // ================================================
  // VALIDATION DEMANDES DE CONVERSATION (US022)
  // ================================================

  // Validation pour accepter une conversation
  getAcceptConversationValidation() {
    return [
      param('conversationId')
        .notEmpty()
        .withMessage('ID de conversation requis')
        .isUUID()
        .withMessage('ID de conversation invalide'),

      this.handleValidationErrors
    ];
  }

  // Validation pour refuser une conversation
  getRejectConversationValidation() {
    return [
      param('conversationId')
        .notEmpty()
        .withMessage('ID de conversation requis')
        .isUUID()
        .withMessage('ID de conversation invalide'),

      this.handleValidationErrors
    ];
  }

  // ================================================
  // VALIDATION STATUTS DE LECTURE (US009)
  // ================================================

  // Validation pour marquer un message comme lu
  getMarkMessageReadValidation() {
    return [
      param('messageId')
        .notEmpty()
        .withMessage('ID du message requis')
        .isUUID()
        .withMessage('ID du message invalide'),

      this.handleValidationErrors
    ];
  }

  // Validation pour marquer une conversation comme lue
  getMarkConversationReadValidation() {
    return [
      param('conversationId')
        .notEmpty()
        .withMessage('ID de conversation requis')
        .isUUID()
        .withMessage('ID de conversation invalide'),

      body('lastMessageId')
        .optional()
        .isUUID()
        .withMessage('ID du dernier message invalide'),

      this.handleValidationErrors
    ];
  }

  // Validation pour obtenir les statuts de lecture
  getReadStatusesValidation() {
    return [
      body('messageIds')
        .isArray({ min: 1 })
        .withMessage('La liste des IDs de messages est requise')
        .custom((messageIds) => {
          if (!messageIds.every(id => this.isValidUUID(id))) {
            throw new Error('Tous les IDs de messages doivent être des UUIDs valides');
          }
          if (messageIds.length > 100) {
            throw new Error('Maximum 100 messages par requête');
          }
          return true;
        }),

      this.handleValidationErrors
    ];
  }

  // Validation pour obtenir les lecteurs d'un message
  getMessageReadersValidation() {
    return [
      param('messageId')
        .notEmpty()
        .withMessage('ID du message requis')
        .isUUID()
        .withMessage('ID du message invalide'),

      this.handleValidationErrors
    ];
  }

  // Validation pour obtenir les messages non lus
  getUnreadMessagesValidation() {
    return [
      param('conversationId')
        .notEmpty()
        .withMessage('ID de conversation requis')
        .isUUID()
        .withMessage('ID de conversation invalide'),

      this.handleValidationErrors
    ];
  }

  // ================================================
  // VALIDATION DE FICHIER (POUR FUTURES FONCTIONNALITÉS)
  // ================================================

  getFileUploadValidation() {
    return [
      body('conversationId')
        .notEmpty()
        .withMessage('ID de conversation requis')
        .isUUID()
        .withMessage('ID de conversation invalide'),

      body('fileType')
        .notEmpty()
        .withMessage('Type de fichier requis')
        .isIn(['image', 'file'])
        .withMessage('Type de fichier non supporté'),

      // Validation custom pour la taille de fichier sera ajoutée au niveau multer

      this.handleValidationErrors
    ];
  }
}

console.log('✅ MessageValidator créé');

module.exports = new MessageValidator();