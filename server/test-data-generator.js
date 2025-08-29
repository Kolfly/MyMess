// 🧪 GÉNÉRATEUR DE DONNÉES DE TEST - DÉFILEMENT INFINI
// Crée des utilisateurs et messages de test pour valider l'historique des conversations

const { User, Conversation, Message, ConversationMember } = require('./models/associations');
require('dotenv').config();

// Configuration du générateur
const CONFIG = {
  USERS_COUNT: 10,
  MESSAGES_COUNT: 500,
  DAYS_HISTORY: 30,
  CONVERSATION_NAME: "Conversation de Test - Défilement Infini",
  CONVERSATION_DESCRIPTION: "Conversation générée automatiquement pour tester le défilement infini"
};

// 👥 DONNÉES DES UTILISATEURS DE TEST
const TEST_USERS = [
  { username: 'alice_dev', firstName: 'Alice', lastName: 'Martin', email: 'alice.martin@test.com', status: 'online' },
  { username: 'bob_designer', firstName: 'Bob', lastName: 'Wilson', email: 'bob.wilson@test.com', status: 'away' },
  { username: 'charlie_pm', firstName: 'Charlie', lastName: 'Brown', email: 'charlie.brown@test.com', status: 'busy' },
  { username: 'diana_qa', firstName: 'Diana', lastName: 'Davis', email: 'diana.davis@test.com', status: 'online' },
  { username: 'eve_devops', firstName: 'Eve', lastName: 'Garcia', email: 'eve.garcia@test.com', status: 'offline' },
  { username: 'frank_lead', firstName: 'Frank', lastName: 'Miller', email: 'frank.miller@test.com', status: 'online' },
  { username: 'grace_ux', firstName: 'Grace', lastName: 'Taylor', email: 'grace.taylor@test.com', status: 'away' },
  { username: 'henry_backend', firstName: 'Henry', lastName: 'Anderson', email: 'henry.anderson@test.com', status: 'busy' },
  { username: 'iris_frontend', firstName: 'Iris', lastName: 'Thomas', email: 'iris.thomas@test.com', status: 'online' },
  { username: 'jack_mobile', firstName: 'Jack', lastName: 'Jackson', email: 'jack.jackson@test.com', status: 'offline' }
];

// 💬 MESSAGES DE TEST VARIÉS
const TEST_MESSAGES = [
  "Salut tout le monde ! Comment ça va aujourd'hui ?",
  "Je viens de finir le sprint review, tout s'est bien passé 👍",
  "Est-ce que quelqu'un a testé la nouvelle fonctionnalité ?",
  "La démo client est prévue demain à 14h, n'oubliez pas !",
  "J'ai corrigé le bug sur la pagination, ça devrait être bon maintenant",
  "Pause café quelqu'un ? ☕",
  "Le serveur de staging semble être down, je regarde ça",
  "Excellent travail sur le redesign de l'interface !",
  "Meeting daily dans 5 minutes en salle de conf",
  "J'ai mis à jour la documentation sur le wiki",
  "Le build CI/CD est passé au vert ✅",
  "On peut faire un point sur les user stories cette semaine ?",
  "J'ai besoin d'aide sur la config Docker, quelqu'un dispo ?",
  "Les metrics montrent une amélioration des performances 📈",
  "N'oubliez pas de mettre à jour vos timesheets",
  "La release est prévue pour vendredi, on est dans les temps",
  "Quelqu'un a-t-il testé sur mobile ?",
  "Le feedback client est très positif sur les dernières améliorations",
  "Je partage le lien du repo dans le canal dev",
  "Pensez à faire un backup avant le déploiement",
  "L'environnement de test est prêt pour les validations",
  "Super job sur la résolution du bug critique ! 🎉",
  "La nouvelle librairie fonctionne parfaitement",
  "Réunion retrospective programmée pour lundi matin",
  "Les logs montrent que tout fonctionne correctement",
  "J'ai créé les tickets JIRA pour les prochaines tâches",
  "La base de données a été optimisée, les requêtes sont plus rapides",
  "Quelqu'un peut-il valider les traductions ?",
  "Le monitoring est en place, on aura plus de visibilité",
  "Bon weekend à tous ! 🎉 À lundi !"
];

class TestDataGenerator {
  constructor() {
    this.createdUsers = [];
    this.testConversation = null;
    this.stats = {
      usersCreated: 0,
      messagesCreated: 0,
      startTime: null,
      endTime: null
    };
  }

  // 🚀 POINT D'ENTRÉE PRINCIPAL
  async run() {
    try {
      console.log('🧪 ==============================================');
      console.log('🧪 GÉNÉRATEUR DE DONNÉES DE TEST');
      console.log('🧪 ==============================================\n');
      
      this.stats.startTime = new Date();
      
      await this.createTestUsers();
      await this.createTestConversation();
      await this.generateTestMessages();
      
      this.stats.endTime = new Date();
      this.displayStats();
      
      console.log('✅ Génération de données de test terminée avec succès !');
      console.log('🎯 Vous pouvez maintenant tester le défilement infini dans l\'interface.\n');
      
    } catch (error) {
      console.error('❌ Erreur lors de la génération:', error.message);
      console.error('Stack:', error.stack);
      process.exit(1);
    }
  }

  // 👥 CRÉER LES UTILISATEURS DE TEST
  async createTestUsers() {
    console.log(`👥 Création de ${CONFIG.USERS_COUNT} utilisateurs de test...`);
    
    for (let i = 0; i < TEST_USERS.length && i < CONFIG.USERS_COUNT; i++) {
      const userData = TEST_USERS[i];
      
      try {
        // Vérifier si l'utilisateur existe déjà
        const existingUser = await User.findOne({ where: { email: userData.email } });
        
        if (existingUser) {
          console.log(`   ⚠️  Utilisateur ${userData.username} existe déjà, réutilisation`);
          this.createdUsers.push(existingUser);
        } else {
          const user = await User.create({
            ...userData,
            password: 'ComplexTestPass#2024!', // Mot de passe complexe pour les tests
            emailVerified: true,
            isActive: true
          });
          
          console.log(`   ✅ Créé: ${user.username} (${user.email})`);
          this.createdUsers.push(user);
          this.stats.usersCreated++;
        }
        
      } catch (error) {
        console.warn(`   ⚠️  Erreur création ${userData.username}:`, error.message);
      }
    }
    
    console.log(`   ✨ ${this.createdUsers.length} utilisateurs disponibles pour les tests\n`);
  }

  // 💬 CRÉER LA CONVERSATION DE TEST
  async createTestConversation() {
    console.log('💬 Création de la conversation de test...');
    
    try {
      // Vérifier si la conversation existe déjà
      const existingConv = await Conversation.findOne({ 
        where: { name: CONFIG.CONVERSATION_NAME } 
      });
      
      if (existingConv) {
        console.log('   ⚠️  Conversation de test existe déjà, réutilisation');
        this.testConversation = existingConv;
      } else {
        // Créer la conversation avec le premier utilisateur comme créateur
        this.testConversation = await Conversation.create({
          name: CONFIG.CONVERSATION_NAME,
          description: CONFIG.CONVERSATION_DESCRIPTION,
          type: 'group',
          createdBy: this.createdUsers[0].id
        });
        
        console.log(`   ✅ Conversation créée: ${this.testConversation.name}`);
      }
      
      // Ajouter tous les utilisateurs de test à la conversation
      console.log('   👥 Ajout des membres à la conversation...');
      
      for (let i = 0; i < this.createdUsers.length; i++) {
        const user = this.createdUsers[i];
        
        // Vérifier si l'utilisateur est déjà membre
        const existingMember = await ConversationMember.findOne({
          where: {
            conversationId: this.testConversation.id,
            userId: user.id,
            leftAt: null
          }
        });
        
        if (!existingMember) {
          await ConversationMember.create({
            conversationId: this.testConversation.id,
            userId: user.id,
            role: i === 0 ? 'owner' : 'member', // Premier utilisateur = owner
            invitedBy: this.createdUsers[0].id
          });
          
          console.log(`      ✅ ${user.username} ajouté comme membre`);
        } else {
          console.log(`      ⚠️  ${user.username} est déjà membre`);
        }
      }
      
      console.log('   ✨ Conversation de test prête\n');
      
    } catch (error) {
      console.error('❌ Erreur création conversation:', error.message);
      throw error;
    }
  }

  // 📝 GÉNÉRER LES MESSAGES DE TEST
  async generateTestMessages() {
    console.log(`📝 Génération de ${CONFIG.MESSAGES_COUNT} messages sur ${CONFIG.DAYS_HISTORY} jours...`);
    
    const now = new Date();
    const startDate = new Date(now.getTime() - (CONFIG.DAYS_HISTORY * 24 * 60 * 60 * 1000));
    
    console.log(`   📅 Période: ${startDate.toLocaleDateString()} → ${now.toLocaleDateString()}`);
    
    // Compter les messages existants pour éviter les doublons
    const existingMessagesCount = await Message.count({
      where: { conversationId: this.testConversation.id }
    });
    
    if (existingMessagesCount > 0) {
      console.log(`   ⚠️  ${existingMessagesCount} messages existent déjà dans cette conversation`);
      console.log(`   🔄 Ajout de ${CONFIG.MESSAGES_COUNT} nouveaux messages...\n`);
    }
    
    const messages = [];
    const batchSize = 50; // Insérer par batch pour les performances
    
    for (let i = 0; i < CONFIG.MESSAGES_COUNT; i++) {
      // Distribution temporelle: plus de messages récents
      const timeProgress = Math.pow(i / CONFIG.MESSAGES_COUNT, 0.7); // Courbe exponentielle
      const messageTime = new Date(startDate.getTime() + (timeProgress * (now.getTime() - startDate.getTime())));
      
      // Choisir un utilisateur aléatoire
      const randomUser = this.createdUsers[Math.floor(Math.random() * this.createdUsers.length)];
      
      // Choisir un message aléatoire
      let content = TEST_MESSAGES[Math.floor(Math.random() * TEST_MESSAGES.length)];
      
      // Ajouter des messages de repère tous les 50 messages
      if ((i + 1) % 50 === 0) {
        content = `🏁 Point de repère ${i + 1}/${CONFIG.MESSAGES_COUNT} - ${messageTime.toLocaleDateString()}`;
      }
      
      messages.push({
        content,
        senderId: randomUser.id,
        conversationId: this.testConversation.id,
        messageType: 'text',
        status: 'sent',
        createdAt: messageTime,
        updatedAt: messageTime
      });
      
      // Insérer par batch
      if (messages.length >= batchSize || i === CONFIG.MESSAGES_COUNT - 1) {
        try {
          await Message.bulkCreate(messages, { validate: true });
          
          this.stats.messagesCreated += messages.length;
          const progress = Math.round(((i + 1) / CONFIG.MESSAGES_COUNT) * 100);
          const eta = this.calculateETA(i + 1, CONFIG.MESSAGES_COUNT);
          
          console.log(`   📊 Progression: ${progress}% (${i + 1}/${CONFIG.MESSAGES_COUNT}) - ETA: ${eta}`);
          
          messages.length = 0; // Vider le batch
          
        } catch (error) {
          console.warn(`   ⚠️  Erreur batch ${i}:`, error.message);
        }
      }
    }
    
    // Mettre à jour l'activité de la conversation
    const lastMessage = await Message.findOne({
      where: { conversationId: this.testConversation.id },
      order: [['createdAt', 'DESC']]
    });
    
    if (lastMessage) {
      await this.testConversation.update({
        lastMessageId: lastMessage.id,
        lastActivityAt: lastMessage.createdAt
      });
    }
    
    console.log('   ✨ Messages générés avec succès\n');
  }

  // 📊 CALCULER L'ETA
  calculateETA(current, total) {
    if (current === 0) return 'Calcul...';
    
    const elapsed = new Date() - this.stats.startTime;
    const rate = current / elapsed;
    const remaining = total - current;
    const etaMs = remaining / rate;
    
    const etaSeconds = Math.round(etaMs / 1000);
    
    if (etaSeconds < 60) return `${etaSeconds}s`;
    if (etaSeconds < 3600) return `${Math.round(etaSeconds / 60)}m`;
    return `${Math.round(etaSeconds / 3600)}h`;
  }

  // 📈 AFFICHER LES STATISTIQUES
  displayStats() {
    const duration = (this.stats.endTime - this.stats.startTime) / 1000;
    const totalMessages = this.stats.messagesCreated;
    
    console.log('\n📊 ==============================================');
    console.log('📊 STATISTIQUES DE GÉNÉRATION');
    console.log('📊 ==============================================');
    console.log(`👥 Utilisateurs créés: ${this.stats.usersCreated}`);
    console.log(`👥 Utilisateurs totaux disponibles: ${this.createdUsers.length}`);
    console.log(`💬 Conversation: ${this.testConversation.name}`);
    console.log(`📝 Messages générés: ${totalMessages}`);
    console.log(`⏱️  Durée: ${duration.toFixed(1)}s`);
    console.log(`🚀 Vitesse: ${Math.round(totalMessages / duration)} messages/s`);
    
    if (totalMessages > 0) {
      console.log(`📅 Période couverte: ${CONFIG.DAYS_HISTORY} jours`);
      console.log(`📈 Moyenne: ${Math.round(totalMessages / CONFIG.DAYS_HISTORY)} messages/jour`);
    }
    
    console.log('📊 ==============================================\n');
  }

  // 🧹 NETTOYER LES DONNÉES DE TEST
  async cleanup() {
    console.log('🧹 Nettoyage des données de test...\n');
    
    try {
      // Supprimer les messages de test
      const deletedMessages = await Message.destroy({
        where: { conversationId: this.testConversation?.id }
      });
      console.log(`   🗑️  ${deletedMessages} messages supprimés`);
      
      // Supprimer les membres de conversation
      const deletedMembers = await ConversationMember.destroy({
        where: { conversationId: this.testConversation?.id }
      });
      console.log(`   🗑️  ${deletedMembers} membres supprimés`);
      
      // Supprimer la conversation
      if (this.testConversation) {
        await this.testConversation.destroy();
        console.log(`   🗑️  Conversation supprimée: ${this.testConversation.name}`);
      }
      
      // Supprimer les utilisateurs de test
      let deletedUsers = 0;
      for (const user of this.createdUsers) {
        try {
          await user.destroy();
          deletedUsers++;
        } catch (error) {
          console.warn(`   ⚠️  Impossible de supprimer ${user.username}: ${error.message}`);
        }
      }
      console.log(`   🗑️  ${deletedUsers} utilisateurs supprimés`);
      
      console.log('✅ Nettoyage terminé\n');
      
    } catch (error) {
      console.error('❌ Erreur lors du nettoyage:', error.message);
    }
  }
}

// 🎬 EXÉCUTION DU SCRIPT
async function main() {
  const args = process.argv.slice(2);
  const shouldCleanup = args.includes('--cleanup');
  
  const generator = new TestDataGenerator();
  
  try {
    if (shouldCleanup) {
      // Mode nettoyage
      console.log('🧹 Mode nettoyage activé\n');
      
      // Chercher les données existantes
      const existingConv = await Conversation.findOne({ 
        where: { name: CONFIG.CONVERSATION_NAME },
        include: [{
          model: ConversationMember,
          as: 'allMembers',
          include: [{
            model: User,
            as: 'user'
          }]
        }]
      });
      
      if (existingConv) {
        generator.testConversation = existingConv;
        generator.createdUsers = existingConv.allMembers?.map(member => member.user) || [];
        await generator.cleanup();
      } else {
        console.log('⚠️  Aucune donnée de test trouvée à nettoyer\n');
      }
      
    } else {
      // Mode génération normal
      await generator.run();
    }
    
  } catch (error) {
    console.error('💥 Erreur fatale:', error.message);
    process.exit(1);
  }
  
  process.exit(0);
}

// Lancer le script
if (require.main === module) {
  main();
}

module.exports = TestDataGenerator;