// ================================================
// SCRIPT D'INITIALISATION MANUELLE DE LA BASE DE DONNÉES
// ================================================

const sequelize = require('./config/database');

async function initializeDatabase(forceReset = false) {
  try {
    console.log('🔄 Initialisation manuelle de la base de données...');
    
    // Test de connexion
    await sequelize.authenticate();
    console.log('✅ Connexion PostgreSQL établie');
    
    // Vérifier si l'utilisateur veut forcer la suppression des données
    const shouldForceReset = forceReset || process.env.FORCE_DB_RESET === 'true';
    
    if (shouldForceReset) {
      console.log('⚠️  FORCE_DB_RESET activé - Suppression de toutes les données...');
      // Supprimer toutes les tables existantes et leurs contraintes
      await sequelize.query('DROP SCHEMA public CASCADE;');
      await sequelize.query('CREATE SCHEMA public;');
      await sequelize.query('GRANT ALL ON SCHEMA public TO postgres;');
      await sequelize.query('GRANT ALL ON SCHEMA public TO public;');
      
      console.log('✅ Schéma nettoyé');
    } else {
      console.log('🔒 Mode sécurisé - Préservation des données existantes');
    }
    
    // Créer les enums d'abord
    await sequelize.query(`
      CREATE TYPE enum_users_status AS ENUM ('online', 'offline', 'away', 'busy', 'invisible');
    `);
    
    await sequelize.query(`
      CREATE TYPE enum_conversations_type AS ENUM ('private', 'group');
    `);
    
    await sequelize.query(`
      CREATE TYPE enum_messages_message_type AS ENUM ('text', 'image', 'file', 'system');
    `);
    
    await sequelize.query(`
      CREATE TYPE enum_messages_status AS ENUM ('sent', 'delivered', 'read');
    `);
    
    await sequelize.query(`
      CREATE TYPE enum_conversation_members_role AS ENUM ('member', 'admin', 'owner');
    `);
    
    console.log('✅ Types ENUM créés');
    
    // Créer la table users
    await sequelize.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(100) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(50),
        last_name VARCHAR(50),
        avatar TEXT,
        status enum_users_status NOT NULL DEFAULT 'offline',
        last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        is_active BOOLEAN NOT NULL DEFAULT true,
        email_verified BOOLEAN NOT NULL DEFAULT false,
        email_verification_token VARCHAR(255),
        last_login TIMESTAMP WITH TIME ZONE,
        failed_login_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TIMESTAMP WITH TIME ZONE,
        last_login_i_p INET,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log('✅ Table users créée');
    
    // Créer la table conversations
    await sequelize.query(`
      CREATE TABLE conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100),
        description TEXT,
        type enum_conversations_type NOT NULL DEFAULT 'private',
        created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        avatar VARCHAR(255),
        is_archived BOOLEAN NOT NULL DEFAULT false,
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_message_id UUID, -- On ajoutera la référence plus tard
        last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        max_members INTEGER DEFAULT 100,
        settings JSON DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log('✅ Table conversations créée');
    
    // Créer la table messages
    await sequelize.query(`
      CREATE TABLE messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        content TEXT NOT NULL,
        message_type enum_messages_message_type NOT NULL DEFAULT 'text',
        sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        status enum_messages_status NOT NULL DEFAULT 'sent',
        is_edited BOOLEAN NOT NULL DEFAULT false,
        edited_at TIMESTAMP WITH TIME ZONE,
        metadata JSON,
        reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log('✅ Table messages créée');
    
    // Créer la table conversation_members
    await sequelize.query(`
      CREATE TABLE conversation_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role enum_conversation_members_role NOT NULL DEFAULT 'member',
        joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        left_at TIMESTAMP WITH TIME ZONE,
        invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
        last_read_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
        last_read_at TIMESTAMP WITH TIME ZONE,
        notifications_enabled BOOLEAN NOT NULL DEFAULT true,
        is_muted BOOLEAN NOT NULL DEFAULT false,
        muted_until TIMESTAMP WITH TIME ZONE,
        nickname VARCHAR(50),
        custom_settings JSON DEFAULT '{}',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, conversation_id)
      );
    `);
    
    console.log('✅ Table conversation_members créée');
    
    // Ajouter la référence last_message_id maintenant que messages existe
    await sequelize.query(`
      ALTER TABLE conversations 
      ADD CONSTRAINT fk_conversations_last_message 
      FOREIGN KEY (last_message_id) REFERENCES messages(id) ON DELETE SET NULL;
    `);
    
    console.log('✅ Contrainte last_message_id ajoutée');
    
    // Créer les index pour les performances
    await sequelize.query(`
      CREATE INDEX idx_users_status ON users(status);
      CREATE INDEX idx_users_last_seen ON users(last_seen);
      CREATE INDEX idx_users_security ON users(is_active, email_verified);
      
      CREATE INDEX idx_conversations_type ON conversations(type);
      CREATE INDEX idx_conversations_creator ON conversations(created_by);
      CREATE INDEX idx_conversations_last_activity ON conversations(last_activity_at);
      CREATE INDEX idx_conversations_active ON conversations(is_active);
      
      CREATE INDEX idx_messages_conversation_date ON messages(conversation_id, created_at);
      CREATE INDEX idx_messages_sender ON messages(sender_id);
      CREATE INDEX idx_messages_status ON messages(status);
      
      CREATE INDEX idx_conversation_members_active ON conversation_members(conversation_id, left_at);
      CREATE INDEX idx_user_active_conversations ON conversation_members(user_id, left_at);
      CREATE INDEX idx_conversation_members_role ON conversation_members(role);
    `);
    
    console.log('✅ Index créés');
    
    console.log('🎉 Base de données initialisée avec succès !');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation:', error.message);
    throw error;
  }
}

// Fonction sécurisée qui ne crée que les éléments manquants
async function safeInitializeDatabase() {
  try {
    console.log('🔄 Initialisation sécurisée de la base de données...');
    
    // Test de connexion
    await sequelize.authenticate();
    console.log('✅ Connexion PostgreSQL établie');
    
    // Créer les ENUMs s'ils n'existent pas
    console.log('🔍 Vérification des ENUMs...');
    
    const enumQueries = [
      `CREATE TYPE IF NOT EXISTS enum_users_status AS ENUM ('online', 'offline', 'away', 'busy', 'invisible');`,
      `CREATE TYPE IF NOT EXISTS enum_conversations_type AS ENUM ('private', 'group');`,
      `CREATE TYPE IF NOT EXISTS enum_messages_status AS ENUM ('sent', 'delivered', 'read', 'failed');`,
      `CREATE TYPE IF NOT EXISTS enum_conversation_members_role AS ENUM ('owner', 'admin', 'member');`
    ];
    
    for (const query of enumQueries) {
      try {
        await sequelize.query(query);
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.log(`⚠️  Erreur création ENUM: ${error.message}`);
        }
      }
    }
    
    console.log('✅ ENUMs vérifiés/créés');
    
    // Créer les tables une par une avec CREATE IF NOT EXISTS
    console.log('🔍 Vérification des tables...');
    
    // Table users
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        first_name VARCHAR(50),
        last_name VARCHAR(50),
        avatar VARCHAR(255),
        status enum_users_status NOT NULL DEFAULT 'offline',
        last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        email_verified BOOLEAN NOT NULL DEFAULT false,
        email_verification_token VARCHAR(255),
        email_verification_expires_at TIMESTAMP WITH TIME ZONE,
        password_reset_token VARCHAR(255),
        password_reset_expires_at TIMESTAMP WITH TIME ZONE,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    
    // Table conversations
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS conversations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type enum_conversations_type NOT NULL,
        name VARCHAR(100),
        description TEXT,
        created_by UUID NOT NULL,
        avatar VARCHAR(255),
        is_archived BOOLEAN NOT NULL DEFAULT false,
        is_active BOOLEAN NOT NULL DEFAULT true,
        last_message_id UUID,
        last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    
    // Table messages
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_id UUID NOT NULL,
        conversation_id UUID NOT NULL,
        content TEXT NOT NULL,
        status enum_messages_status NOT NULL DEFAULT 'sent',
        message_type VARCHAR(50) NOT NULL DEFAULT 'text',
        is_edited BOOLEAN NOT NULL DEFAULT false,
        edited_at TIMESTAMP WITH TIME ZONE,
        reply_to_id UUID,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    
    // Table conversation_members
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS conversation_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL,
        conversation_id UUID NOT NULL,
        role enum_conversation_members_role NOT NULL DEFAULT 'member',
        joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        left_at TIMESTAMP WITH TIME ZONE,
        invited_by UUID,
        last_read_message_id UUID,
        last_read_at TIMESTAMP WITH TIME ZONE,
        notifications_enabled BOOLEAN NOT NULL DEFAULT true,
        is_muted BOOLEAN NOT NULL DEFAULT false,
        unread_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      );
    `);
    
    console.log('✅ Tables vérifiées/créées');
    
    // Ajouter les contraintes de clés étrangères si elles n'existent pas
    console.log('🔍 Vérification des contraintes...');
    
    const constraints = [
      `ALTER TABLE conversations ADD CONSTRAINT IF NOT EXISTS fk_conversations_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE;`,
      `ALTER TABLE messages ADD CONSTRAINT IF NOT EXISTS fk_messages_sender_id FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;`,
      `ALTER TABLE messages ADD CONSTRAINT IF NOT EXISTS fk_messages_conversation_id FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;`,
      `ALTER TABLE messages ADD CONSTRAINT IF NOT EXISTS fk_messages_reply_to_id FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL;`,
      `ALTER TABLE conversation_members ADD CONSTRAINT IF NOT EXISTS fk_conversation_members_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;`,
      `ALTER TABLE conversation_members ADD CONSTRAINT IF NOT EXISTS fk_conversation_members_conversation_id FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE;`,
      `ALTER TABLE conversation_members ADD CONSTRAINT IF NOT EXISTS fk_conversation_members_invited_by FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL;`,
      `ALTER TABLE conversation_members ADD CONSTRAINT IF NOT EXISTS fk_conversation_members_last_read_message_id FOREIGN KEY (last_read_message_id) REFERENCES messages(id) ON DELETE SET NULL;`,
      `ALTER TABLE conversations ADD CONSTRAINT IF NOT EXISTS fk_conversations_last_message_id FOREIGN KEY (last_message_id) REFERENCES messages(id) ON DELETE SET NULL;`
    ];
    
    for (const constraint of constraints) {
      try {
        await sequelize.query(constraint);
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.log(`⚠️  Erreur contrainte: ${error.message}`);
        }
      }
    }
    
    console.log('✅ Contraintes vérifiées/créées');
    
    // Créer les index pour les performances
    console.log('🔍 Vérification des index...');
    
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`,
      `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
      `CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);`,
      `CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);`,
      `CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);`,
      `CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);`,
      `CREATE INDEX IF NOT EXISTS idx_conversation_members_user_id ON conversation_members(user_id);`,
      `CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation_id ON conversation_members(conversation_id);`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_members_unique ON conversation_members(user_id, conversation_id) WHERE left_at IS NULL;`
    ];
    
    for (const index of indexes) {
      try {
        await sequelize.query(index);
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.log(`⚠️  Erreur index: ${error.message}`);
        }
      }
    }
    
    console.log('✅ Index vérifiés/créés');
    console.log('🎉 Base de données initialisée de manière sécurisée !');
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'initialisation sécurisée:', error);
    throw error;
  }
}

module.exports = { initializeDatabase, safeInitializeDatabase };