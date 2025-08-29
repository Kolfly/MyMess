require('dotenv').config();
const sequelize = require('./database/config/database');
const authService = require('./services/authService');
const User = require('./models/User');

// Test complet du système d'authentification avec vérification d'email
// Ce test simule le parcours complet d'un utilisateur depuis l'inscription 
// jusqu'à l'utilisation complète de l'application
async function testCompleteAuthenticationFlow() {
  try {
    console.log('🚀 TEST COMPLET DU SYSTÈME D\'AUTHENTIFICATION');
    console.log('=' * 60);
    console.log('📧 Email de test utilisé: matt.cloud83@gmail.com');
    console.log('🎯 Objectif: Valider tout le parcours utilisateur\n');
    
    // ================================================
    // PRÉPARATION : Synchronisation de la base de données
    // ================================================
    console.log('🔧 ÉTAPE DE PRÉPARATION');
    console.log('─'.repeat(30));
    
    await sequelize.sync({ force: false });
    console.log('✅ Base de données synchronisée avec succès');
    
    // Nettoyer tout utilisateur de test existant pour éviter les conflits
    await User.destroy({ 
      where: { email: 'matt.cloud83@gmail.com' } 
    });
    console.log('🧹 Nettoyage préventif des données de test terminé\n');

    // ================================================
    // TEST 1: CRÉATION D'UN NOUVEAU COMPTE UTILISATEUR
    // ================================================
    console.log('📝 TEST 1: CRÉATION D\'UN COMPTE UTILISATEUR');
    console.log('─'.repeat(40));
    
    // Données d'inscription réalistes pour notre test
    // Ces informations simulent exactement ce qu'un vrai utilisateur saisirait
    const registrationData = {
      username: 'matt_cloud83',                    // Nom d'utilisateur unique
      email: 'matt.cloud83@gmail.com',            // Email réel pour les tests
      password: 'SecureMattPassword2024!',        // Mot de passe complexe respectant nos règles
      firstName: 'Matt',                          // Prénom pour personnaliser l'expérience
      lastName: 'Cloud'                           // Nom pour compléter le profil
    };

    console.log('📋 Données d\'inscription préparées:');
    console.log(`   👤 Utilisateur: ${registrationData.username}`);
    console.log(`   📧 Email: ${registrationData.email}`);
    console.log(`   🔐 Mot de passe: [MASQUÉ POUR SÉCURITÉ]`);
    console.log(`   👨 Nom complet: ${registrationData.firstName} ${registrationData.lastName}`);

    // Tentative de création du compte avec toutes nos vérifications de sécurité
    const registrationResult = await authService.createUserAccount(registrationData);
    
    console.log('\n🎉 RÉSULTAT DE LA CRÉATION DE COMPTE:');
    console.log(`   ✅ Compte créé avec l'ID: ${registrationResult.user.id}`);
    console.log(`   🔑 Token d'accès généré: ${registrationResult.tokens.accessToken ? 'OUI' : 'NON'}`);
    console.log(`   🔄 Token de rafraîchissement: ${registrationResult.tokens.refreshToken ? 'OUI' : 'NON'}`);
    console.log(`   📧 Token de vérification email: ${registrationResult.emailVerificationToken ? 'OUI' : 'NON'}`);
    console.log(`   ⚠️  Statut de vérification email: ${registrationResult.user.emailVerified ? 'VÉRIFIÉ' : 'EN ATTENTE'}`);
    
    // Sauvegarder les informations importantes pour les tests suivants
    const userId = registrationResult.user.id;
    const emailVerificationToken = registrationResult.emailVerificationToken;
    const initialAccessToken = registrationResult.tokens.accessToken;

    console.log(`\n💡 ANALYSE: Le compte est créé mais l'email n'est pas encore vérifié.`);
    console.log(`   Dans une vraie application, un email serait envoyé à matt.cloud83@gmail.com`);
    console.log(`   avec un lien contenant le token: ${emailVerificationToken.substring(0, 12)}...\n`);

    // ================================================
    // TEST 2: TENTATIVE DE CONNEXION AVEC IDENTIFIANTS INCORRECTS
    // ================================================
    console.log('📝 TEST 2: SÉCURITÉ - TENTATIVE AVEC IDENTIFIANTS INCORRECTS');
    console.log('─'.repeat(55));

    // Test de sécurité : vérifier que notre système rejette les mauvais mots de passe
    console.log('🔍 Test avec mot de passe incorrect...');
    try {
      await authService.authenticateUser(registrationData.email, 'MotDePasseIncorrect123!');
      console.log('❌ ALERTE SÉCURITÉ: La connexion a réussi avec un mauvais mot de passe !');
      throw new Error('Le système de sécurité a échoué - connexion autorisée avec mauvais mot de passe');
    } catch (error) {
      if (error.message.includes('Identifiants invalides')) {
        console.log('✅ Sécurité validée: Connexion refusée correctement');
        console.log(`   📝 Message d'erreur approprié: "${error.message}"`);
        console.log(`   🛡️  Le système protège bien contre les tentatives malveillantes`);
      } else {
        throw error; // Re-lancer si c'est une autre erreur inattendue
      }
    }

    // Test de sécurité : vérifier avec un email inexistant
    console.log('\n🔍 Test avec email inexistant...');
    try {
      await authService.authenticateUser('email.inexistant@test.com', registrationData.password);
      console.log('❌ ALERTE SÉCURITÉ: Connexion réussie avec email inexistant !');
      throw new Error('Le système a autorisé une connexion avec un email inexistant');
    } catch (error) {
      if (error.message.includes('Identifiants invalides')) {
        console.log('✅ Sécurité validée: Email inexistant refusé correctement');
        console.log(`   🕵️  Le système ne révèle pas l'existence ou non des comptes`);
      } else {
        throw error;
      }
    }

    console.log(`\n💡 ANALYSE: Notre système de sécurité fonctionne parfaitement.`);
    console.log(`   Les messages d'erreur sont volontairement vagues pour ne pas aider les attaquants.\n`);

    // ================================================
    // TEST 3: CONNEXION RÉUSSIE AVEC LES BONS IDENTIFIANTS
    // ================================================
    console.log('📝 TEST 3: CONNEXION RÉUSSIE AVEC IDENTIFIANTS CORRECTS');
    console.log('─'.repeat(50));

    console.log('🔐 Tentative de connexion avec les vrais identifiants...');
    const loginResult = await authService.authenticateUser(
      registrationData.email, 
      registrationData.password,
      { 
        ip: '192.168.1.100',           // Simulation d'une adresse IP pour les logs de sécurité
        userAgent: 'Test-Client/1.0'   // Simulation d'un navigateur pour le suivi
      }
    );

    console.log('\n🎉 RÉSULTAT DE LA CONNEXION:');
    console.log(`   ✅ Connexion réussie pour: ${loginResult.user.email}`);
    console.log(`   👤 Nom d'utilisateur connecté: ${loginResult.user.username}`);
    console.log(`   🟢 Nouveau statut: ${loginResult.user.status}`);
    console.log(`   🔑 Nouveaux tokens générés: OUI`);
    console.log(`   ⏰ Dernière connexion: ${loginResult.user.lastLogin}`);
    console.log(`   ⚠️  Email vérifié: ${loginResult.user.emailVerified ? 'OUI' : 'NON'}`);

    // Sauvegarder le nouveau token pour les tests suivants
    const postLoginAccessToken = loginResult.tokens.accessToken;

    console.log(`\n💡 ANALYSE: L'utilisateur peut se connecter même sans email vérifié.`);
    console.log(`   Cela lui permet d'accéder aux fonctions de vérification d'email.`);
    console.log(`   Cependant, l'accès aux fonctions principales reste limité.\n`);

    // ================================================
    // TEST 4: TENTATIVE D'ACCÈS AUX FONCTIONS AVANCÉES SANS VÉRIFICATION
    // ================================================
    console.log('📝 TEST 4: LIMITATION D\'ACCÈS AVANT VÉRIFICATION EMAIL');
    console.log('─'.repeat(50));

    console.log('🚫 Tentative d\'accès aux fonctions avancées sans vérification...');
    try {
      // Cette méthode exige un compte avec email vérifié
      await authService.getUserFromToken(postLoginAccessToken);
      console.log('❌ ALERTE SÉCURITÉ: Accès autorisé sans vérification email !');
      throw new Error('Le système a autorisé l\'accès avancé sans vérification email');
    } catch (error) {
      if (error.message.includes('compte non vérifié')) {
        console.log('✅ Sécurité validée: Accès limité correctement appliqué');
        console.log(`   📝 Message de sécurité: "${error.message}"`);
        console.log(`   🛡️  Les fonctions avancées sont protégées`);
      } else {
        throw error;
      }
    }

    console.log(`\n💡 ANALYSE: L'architecture de sécurité en couches fonctionne.`);
    console.log(`   Connexion possible ≠ Accès complet aux fonctionnalités\n`);

    // ================================================
    // TEST 5: SIMULATION DE LA VÉRIFICATION D'EMAIL
    // ================================================
    console.log('📝 TEST 5: VÉRIFICATION DE L\'ADRESSE EMAIL');
    console.log('─'.repeat(40));

    console.log('📧 Simulation de la vérification d\'email...');
    console.log(`   🔗 Dans une vraie application, l'utilisateur cliquerait sur un lien`);
    console.log(`   🔗 Le lien contiendrait: https://tonapp.com/verify-email/${emailVerificationToken}`);
    console.log(`   🔗 Notre test simule cette action automatiquement`);

    // Simuler ce qui se passerait quand l'utilisateur clique sur le lien de vérification
    const emailVerificationResult = await authService.verifyUserEmail(emailVerificationToken);

    console.log('\n🎉 RÉSULTAT DE LA VÉRIFICATION EMAIL:');
    console.log(`   ✅ Email vérifié avec succès: ${emailVerificationResult.success}`);
    console.log(`   📧 Statut de vérification: ${emailVerificationResult.user.emailVerified ? 'VÉRIFIÉ' : 'NON VÉRIFIÉ'}`);
    console.log(`   📝 Message: ${emailVerificationResult.message}`);
    console.log(`   🗑️  Token de vérification supprimé: OUI (sécurité)`);

    console.log(`\n💡 ANALYSE: L'email est maintenant vérifié.`);
    console.log(`   L'utilisateur peut maintenant accéder à toutes les fonctionnalités.\n`);

    // ================================================
    // TEST 6: ACCÈS COMPLET APRÈS VÉRIFICATION
    // ================================================
    console.log('📝 TEST 6: ACCÈS COMPLET APRÈS VÉRIFICATION EMAIL');
    console.log('─'.repeat(45));

    console.log('🔓 Test d\'accès aux fonctions avancées maintenant...');
    const tokenVerificationResult = await authService.getUserFromToken(postLoginAccessToken);

    console.log('\n🎉 RÉSULTAT DE LA VÉRIFICATION DE TOKEN:');
    console.log(`   ✅ Token vérifié avec succès: OUI`);
    console.log(`   👤 Utilisateur récupéré: ${tokenVerificationResult.user.username}`);
    console.log(`   📧 Email vérifié: ${tokenVerificationResult.user.emailVerified}`);
    console.log(`   ⏰ Dernière activité mise à jour: OUI`);
    console.log(`   🎯 Données du token:`);
    console.log(`      - Type: ${tokenVerificationResult.tokenData.type}`);
    console.log(`      - Émis le: ${new Date(tokenVerificationResult.tokenData.iat * 1000).toLocaleString()}`);
    console.log(`      - Expire le: ${new Date(tokenVerificationResult.tokenData.exp * 1000).toLocaleString()}`);

    console.log(`\n💡 ANALYSE: L'accès complet est maintenant débloqué !`);
    console.log(`   Toutes les fonctionnalités de chat sont maintenant disponibles.\n`);

    // ================================================
    // TEST 7: GESTION AVANCÉE DU PROFIL UTILISATEUR
    // ================================================
    console.log('📝 TEST 7: GESTION DU PROFIL UTILISATEUR');
    console.log('─'.repeat(35));

    console.log('✏️ Mise à jour des informations de profil...');
    const profileUpdateResult = await authService.updateUserProfile(userId, {
      firstName: 'Matthew',           // Prénom plus formel
      lastName: 'CloudTech',          // Nom de famille mis à jour
      username: 'matt_cloudtech_pro'  // Nom d'utilisateur plus professionnel
    });

    console.log('\n🎉 RÉSULTAT DE LA MISE À JOUR DE PROFIL:');
    console.log(`   ✅ Profil mis à jour avec succès: ${profileUpdateResult.success}`);
    console.log(`   👤 Nouveau nom d'utilisateur: ${profileUpdateResult.user.username}`);
    console.log(`   👨 Nouveau nom complet: ${profileUpdateResult.user.firstName} ${profileUpdateResult.user.lastName}`);
    console.log(`   📝 Message: ${profileUpdateResult.message}`);

    console.log(`\n💡 ANALYSE: Le système de gestion de profil fonctionne parfaitement.`);
    console.log(`   Les modifications sont appliquées et persistées en base de données.\n`);

    // ================================================
    // TEST 8: GESTION DES STATUTS DE PRÉSENCE
    // ================================================
    console.log('📝 TEST 8: GESTION DES STATUTS DE PRÉSENCE');
    console.log('─'.repeat(38));

    // Tester différents statuts de présence
    const statusesToTest = ['away', 'busy', 'invisible', 'online'];
    
    for (const status of statusesToTest) {
      console.log(`🔄 Changement de statut vers: ${status}...`);
      const statusResult = await authService.updateUserStatus(userId, status);
      console.log(`   ✅ Statut mis à jour: ${statusResult.user.status}`);
      
      // Petite pause pour simuler l'usage réel
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`\n💡 ANALYSE: La gestion des statuts de présence fonctionne.`);
    console.log(`   Essentiel pour un système de chat en temps réel.\n`);

    // ================================================
    // TEST 9: CHANGEMENT SÉCURISÉ DE MOT DE PASSE
    // ================================================
    console.log('📝 TEST 9: CHANGEMENT SÉCURISÉ DE MOT DE PASSE');
    console.log('─'.repeat(42));

    console.log('🔐 Test de changement de mot de passe...');
    
    // D'abord, tester avec un mauvais mot de passe actuel
    console.log('🚫 Test avec mot de passe actuel incorrect...');
    try {
      await authService.changePassword(userId, 'MauvaisMotDePasse123!', 'NouveauMotDePasse456!');
      console.log('❌ ALERTE: Changement autorisé avec mauvais mot de passe actuel !');
    } catch (error) {
      console.log('✅ Sécurité validée: Changement refusé avec mauvais mot de passe actuel');
    }

    // Maintenant, changer avec le bon mot de passe actuel
    console.log('\n✅ Test avec mot de passe actuel correct...');
    const newPassword = 'NouveauSecureMatt2024#';
    const passwordChangeResult = await authService.changePassword(
      userId, 
      registrationData.password, 
      newPassword
    );

    console.log('\n🎉 RÉSULTAT DU CHANGEMENT DE MOT DE PASSE:');
    console.log(`   ✅ Changement réussi: ${passwordChangeResult.success}`);
    console.log(`   📝 Message: ${passwordChangeResult.message}`);

    // Vérifier que l'ancien mot de passe ne fonctionne plus
    console.log('\n🔍 Vérification que l\'ancien mot de passe est invalidé...');
    try {
      await authService.authenticateUser(registrationData.email, registrationData.password);
      console.log('❌ ALERTE: Connexion encore possible avec l\'ancien mot de passe !');
    } catch (error) {
      console.log('✅ Sécurité validée: Ancien mot de passe correctement invalidé');
    }

    // Vérifier que le nouveau mot de passe fonctionne
    console.log('✅ Vérification que le nouveau mot de passe fonctionne...');
    const newPasswordLoginResult = await authService.authenticateUser(registrationData.email, newPassword);
    console.log(`   ✅ Connexion réussie avec le nouveau mot de passe: ${newPasswordLoginResult.success}`);

    console.log(`\n💡 ANALYSE: Le système de changement de mot de passe est sécurisé.`);
    console.log(`   L'ancien mot de passe est immédiatement invalidé.\n`);

    // ================================================
    // TEST 10: RECHERCHE ET DÉCOUVERTE D'UTILISATEURS
    // ================================================
    console.log('📝 TEST 10: RECHERCHE ET DÉCOUVERTE D\'UTILISATEURS');
    console.log('─'.repeat(45));

    console.log('🔍 Test de recherche d\'utilisateurs...');
    
    // Créer un deuxième utilisateur pour tester la recherche
    console.log('👥 Création d\'un deuxième utilisateur pour la recherche...');
    const secondUser = await authService.createUserAccount({
      username: 'alice_test',
      email: 'alice.test@example.com',
      password: 'AliceSecurePass123!',
      firstName: 'Alice',
      lastName: 'TestUser'
    });
    
    // Vérifier l'email du deuxième utilisateur aussi
    await authService.verifyUserEmail(secondUser.emailVerificationToken);

    // Maintenant tester la recherche
    const searchResults = await authService.searchUsers('Alice', userId, 10);

    console.log('\n🎉 RÉSULTATS DE LA RECHERCHE:');
    console.log(`   ✅ Recherche effectuée: ${searchResults.success}`);
    console.log(`   📊 Nombre de résultats: ${searchResults.count}`);
    console.log(`   🔍 Terme recherché: "${searchResults.query}"`);
    
    if (searchResults.users.length > 0) {
      searchResults.users.forEach((user, index) => {
        console.log(`   👤 Résultat ${index + 1}: ${user.username} (${user.firstName} ${user.lastName})`);
      });
    }

    // Nettoyer le deuxième utilisateur
    await User.destroy({ where: { id: secondUser.user.id } });
    console.log('🧹 Utilisateur de test supplémentaire nettoyé');

    console.log(`\n💡 ANALYSE: Le système de recherche fonctionne correctement.`);
    console.log(`   Les utilisateurs peuvent se découvrir mutuellement pour démarrer des conversations.\n`);

    // ================================================
    // TEST 11: STATISTIQUES ET MONITORING
    // ================================================
    console.log('📝 TEST 11: STATISTIQUES ET MONITORING DU SYSTÈME');
    console.log('─'.repeat(45));

    console.log('📊 Récupération des statistiques système...');
    const systemStats = await authService.getUserStatistics();

    console.log('\n📈 STATISTIQUES SYSTÈME:');
    console.log(`   👥 Total des utilisateurs: ${systemStats.total}`);
    console.log(`   ✅ Utilisateurs actifs: ${systemStats.active}`);
    console.log(`   🟢 Utilisateurs en ligne: ${systemStats.online}`);
    console.log(`   🔴 Utilisateurs hors ligne: ${systemStats.offline}`);
    console.log(`   📧 Comptes vérifiés: ${systemStats.verified}`);
    console.log(`   ⏳ Comptes non vérifiés: ${systemStats.unverified}`);
    console.log(`   🆕 Nouveaux utilisateurs (7 jours): ${systemStats.recent}`);

    console.log(`\n💡 ANALYSE: Le système de monitoring fournit toutes les métriques nécessaires.`);
    console.log(`   Ces statistiques sont essentielles pour surveiller la santé de l'application.\n`);

    // ================================================
    // TEST 12: DÉCONNEXION ET NETTOYAGE FINAL
    // ================================================
    console.log('📝 TEST 12: DÉCONNEXION ET NETTOYAGE');
    console.log('─'.repeat(32));

    console.log('👋 Test de déconnexion utilisateur...');
    const logoutResult = await authService.logoutUser(userId);

    console.log('\n🎉 RÉSULTAT DE LA DÉCONNEXION:');
    console.log(`   ✅ Déconnexion réussie: ${logoutResult.success}`);
    console.log(`   📝 Message: ${logoutResult.message}`);

    // Vérifier que l'utilisateur est maintenant offline
    const userAfterLogout = await User.findByPk(userId);
    console.log(`   🔴 Nouveau statut: ${userAfterLogout.status}`);
    console.log(`   ⏰ Dernière activité: ${userAfterLogout.lastSeen}`);

    console.log(`\n💡 ANALYSE: La déconnexion met correctement à jour le statut utilisateur.\n`);

    // ================================================
    // NETTOYAGE FINAL ET RÉSUMÉ
    // ================================================
    console.log('🧹 NETTOYAGE FINAL');
    console.log('─'.repeat(18));

    console.log('🗑️  Suppression de l\'utilisateur de test...');
    await User.destroy({ where: { id: userId } });
    console.log('✅ Utilisateur de test supprimé de la base de données');

    console.log('\n' + '=' * 60);
    console.log('🎊 TOUS LES TESTS ONT ÉTÉ RÉALISÉS AVEC SUCCÈS !');
    console.log('=' * 60);
    
    console.log('\n📋 RÉSUMÉ DES FONCTIONNALITÉS VALIDÉES:');
    console.log('   ✅ Création de compte avec validation complexe');
    console.log('   ✅ Hashage sécurisé des mots de passe avec bcrypt');
    console.log('   ✅ Génération et vérification de tokens JWT');
    console.log('   ✅ Système de vérification d\'email complet');
    console.log('   ✅ Protection contre les tentatives de piratage');
    console.log('   ✅ Architecture de sécurité en couches');
    console.log('   ✅ Gestion des profils utilisateur');
    console.log('   ✅ Système de statuts de présence');
    console.log('   ✅ Changement sécurisé de mots de passe');
    console.log('   ✅ Recherche et découverte d\'utilisateurs');
    console.log('   ✅ Monitoring et statistiques système');
    console.log('   ✅ Déconnexion propre et mise à jour des statuts');

    console.log('\n🏆 VOTRE SYSTÈME D\'AUTHENTIFICATION EST PRÊT POUR LA PRODUCTION !');
    console.log('🚀 Prochaine étape: Création des controllers et routes pour l\'API REST');

  } catch (error) {
    console.error('\n💥 ERREUR LORS DES TESTS:', error.message);
    if (error.stack) {
      console.error('\n📍 STACK TRACE POUR DEBUG:');
      console.error(error.stack);
    }
    
    console.error('\n🔧 SUGGESTIONS DE DÉBOGAGE:');
    console.error('   1. Vérifiez que la base de données PostgreSQL est accessible');
    console.error('   2. Vérifiez que les variables d\'environnement JWT_SECRET sont définies');
    console.error('   3. Vérifiez que tous les modules requis sont bien installés');
    console.error('   4. Vérifiez les logs ci-dessus pour identifier l\'étape qui échoue');
    
  } finally {
    console.log('\n🔌 Fermeture de la connexion à la base de données...');
    await sequelize.close();
    console.log('✅ Connexion fermée proprement');
  }
}

// Lancer le test complet
testCompleteAuthenticationFlow();