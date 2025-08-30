import { Component, OnInit, OnDestroy, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { Subscription, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

import { ConversationService, Conversation, Message } from '../../services/conversation.service';
import { AuthService } from '../../services/auth.service';
import { WebSocketService } from '../../services/websocket.service';
import { ConfirmDialogComponent, ConfirmDialogData } from '../shared/confirm-dialog/confirm-dialog';
import { ProfileDialogComponent } from '../profile-dialog/profile-dialog.component';

@Component({
  selector: 'app-chat',
  imports: [
    CommonModule,
    FormsModule,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatBadgeModule,
    MatInputModule,
    MatFormFieldModule,
    MatDividerModule,
    MatMenuModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  templateUrl: './chat.html',
  styleUrls: ['./chat.scss', './group-creation.scss', './group-management.scss']
})
export class Chat implements OnInit, OnDestroy {
  private conversationService = inject(ConversationService);
  private authService = inject(AuthService);
  private websocketService = inject(WebSocketService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private breakpointObserver = inject(BreakpointObserver);
  
  protected conversations = signal<Conversation[]>([]);
  protected selectedConversation = signal<Conversation | null>(null);
  protected messages = signal<Message[]>([]);
  protected currentUser = signal<any>(null);
  newMessage = '';
  protected isConnected = signal<boolean>(false);
  protected onlineUsers = signal<string[]>([]);
  
  // Pagination des messages
  protected isLoadingMessages = signal<boolean>(false);
  protected hasMoreMessages = signal<boolean>(true);
  
  // Recherche d'utilisateurs
  protected showUserSearch = signal<boolean>(false);
  protected searchResults = signal<any[]>([]);
  protected isSearching = signal<boolean>(false);
  searchQuery = '';
  
  // Demandes de conversation (US022)
  protected pendingConversations = signal<Conversation[]>([]);
  showPendingConversations = false;
  protected processingConversation = signal<string | null>(null);
  
  // Création de groupe (US011)
  showGroupCreation = false;
  groupName = '';
  groupDescription = '';
  protected selectedMembers = signal<any[]>([]);
  protected availableUsers = signal<any[]>([]);
  protected isLoadingUsers = signal<boolean>(false);
  memberSearchQuery = '';
  
  // Gestion de groupe (US012)
  showGroupManagement = false;
  protected groupDetails = signal<any>(null);
  protected isLoadingGroupDetails = signal<boolean>(false);
  editGroupName = '';
  editGroupDescription = '';
  protected availableMembersToAdd = signal<any[]>([]);
  protected isProcessingGroupAction = signal<boolean>(false);
  
  // Indicateurs de frappe (US010)
  protected typingUsers = signal<string[]>([]);
  private typingTimer: any = null;
  private isCurrentlyTyping = false;
  
  private subscriptions = new Subscription();
  private searchSubject = new Subject<string>();
  
  @ViewChild('messagesContainer', { static: false }) messagesContainer!: ElementRef;
  @ViewChild('sidenav', { static: false }) sidenav!: any;
  
  ngOnInit(): void {
    this.currentUser.set(this.authService.getCurrentUser());
    
    // Souscrire aux changements d'utilisateur
    this.subscriptions.add(
      this.authService.currentUser$.subscribe(user => {
        this.currentUser.set(user);
        console.log('🔄 Utilisateur mis à jour dans le signal:', user);
      })
    );
    
    // Souscrire aux conversations
    this.subscriptions.add(
      this.conversationService.conversations$.subscribe(conversations => {
        this.conversations.set(conversations);
      })
    );
    
    // Souscrire aux changements de conversation sélectionnée
    this.subscriptions.add(
      this.conversationService.selectedConversation$.subscribe(conversation => {
        const previousConv = this.selectedConversation();
        
        // Quitter la conversation précédente
        if (previousConv) {
          this.websocketService.leaveConversation(previousConv.id);
        }
        
        this.selectedConversation.set(conversation);
        
        if (conversation) {
          // Rejoindre la nouvelle conversation
          this.websocketService.joinConversation(conversation.id);
          // Réinitialiser les états de pagination
          this.hasMoreMessages.set(true);
          this.isLoadingMessages.set(false);
          this.loadMessages(conversation.id);
        }
      })
    );
    
    // Souscrire au statut de connexion WebSocket
    this.subscriptions.add(
      this.websocketService.connectionStatus$.subscribe(isConnected => {
        this.isConnected.set(isConnected);
      })
    );
    
    // Souscrire aux utilisateurs en ligne
    this.subscriptions.add(
      this.websocketService.onlineUsers$.subscribe(users => {
        this.onlineUsers.set(users);
      })
    );
    
    // Souscrire aux nouveaux messages WebSocket
    this.subscriptions.add(
      this.websocketService.newMessage$.subscribe(message => {
        if (message) {
          console.log('📨 Nouveau message reçu dans le composant:', message);
          console.log('👤 Sender ID:', message.senderId);
          console.log('👤 Current User ID:', this.currentUser()?.id);
          console.log('🤔 Is current user message?', message.senderId === this.currentUser()?.id);
          
          const selectedConv = this.selectedConversation();
          // Ajouter le message seulement s'il appartient à la conversation active
          if (selectedConv && message.conversationId === selectedConv.id) {
            const currentMessages = this.messages();
            
            // Vérifier si le message existe déjà pour éviter les doublons
            const messageExists = currentMessages.some(m => m.id === message.id);
            if (!messageExists) {
              console.log('➕ Ajout du nouveau message à la liste');
              this.messages.set([...currentMessages, message]);
              // Faire défiler vers le bas pour les nouveaux messages temps réel
              setTimeout(() => this.scrollToBottom(), 100);
            } else {
              console.log('⚠️ Message déjà existant, ignoré');
            }
          }
        }
      })
    );

    // Souscrire aux mises à jour de conversations
    this.subscriptions.add(
      this.websocketService.conversationUpdate$.subscribe(update => {
        if (update) {
          console.log('🔄 Mise à jour de conversation reçue:', update);
          // Recharger la liste des conversations pour récupérer les nouvelles
          this.loadConversations();
        }
      })
    );
    
    // Souscrire aux indicateurs de frappe (US010)
    this.subscriptions.add(
      this.websocketService.typingUsers$.subscribe(typingData => {
        const selectedConv = this.selectedConversation();
        if (selectedConv) {
          const conversationTypers = typingData[selectedConv.id] || [];
          this.typingUsers.set(conversationTypers);
        }
      })
    );

    // Souscrire aux changements de statut utilisateur (US013)
    this.subscriptions.add(
      this.websocketService.userStatusChanged$.subscribe(statusChange => {
        if (statusChange) {
          console.log('🎨 Changement de statut reçu dans chat component:', statusChange);
          
          // Mettre à jour les statuts dans les conversations
          this.updateUserStatusInConversations(statusChange.userId, statusChange.status);
          
          // Si c'est notre propre statut qui change, forcer la mise à jour de currentUser
          const currentUserId = this.currentUser()?.id;
          if (statusChange.userId === currentUserId) {
            console.log('🎨 Mon propre statut a changé, mise à jour de l\'indicateur personnel');
          }
        }
      })
    );
    
    // Configuration de la recherche avec debounce
    this.subscriptions.add(
      this.searchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(query => {
          if (query.trim().length < 2) {
            this.searchResults.set([]);
            this.isSearching.set(false);
            return [];
          }
          
          this.isSearching.set(true);
          return this.authService.searchUsers(query.trim());
        })
      ).subscribe({
        next: (response) => {
          this.isSearching.set(false);
          if (response.success) {
            this.searchResults.set(response.data.users || []);
          } else {
            this.searchResults.set([]);
          }
        },
        error: (error) => {
          this.isSearching.set(false);
          this.searchResults.set([]);
          console.error('Erreur lors de la recherche:', error);
        }
      })
    );
    
    this.loadConversations();
    this.loadPendingConversations();
  }
  
  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }
  
  loadConversations(): void {
    this.conversationService.loadConversations().subscribe({
      next: (response) => {
        // Conversations chargées avec succès
      },
      error: (error) => {
        console.error('❌ Erreur lors du chargement des conversations:', error);
      }
    });
  }
  
  loadMessages(conversationId: string, reset: boolean = true): void {
    if (this.isLoadingMessages()) return; // Éviter les requêtes multiples
    
    this.isLoadingMessages.set(true);
    const currentMessages = this.messages();
    const beforeTimestamp = reset ? undefined : (currentMessages.length > 0 ? currentMessages[0].createdAt : undefined);
    
    this.conversationService.getConversationMessages(conversationId, 50, 0, beforeTimestamp).subscribe({
      next: (response) => {
        this.isLoadingMessages.set(false);
        if (response.success) {
          const newMessages = response.data.messages || [];
          this.hasMoreMessages.set(response.data.hasMore || newMessages.length === 50);
          
          if (reset) {
            this.messages.set(newMessages);
            // Faire défiler automatiquement vers le bas pour les nouveaux chargements de conversation
            setTimeout(() => this.scrollToBottom(), 100);
          } else {
            // Ajouter les anciens messages au début de la liste
            this.messages.set([...newMessages, ...currentMessages]);
          }
        }
      },
      error: (error) => {
        this.isLoadingMessages.set(false);
        console.error('❌ Erreur lors du chargement des messages:', error);
      }
    });
  }

  loadMoreMessages(): void {
    const selectedConv = this.selectedConversation();
    if (selectedConv && this.hasMoreMessages() && !this.isLoadingMessages()) {
      this.loadMessages(selectedConv.id, false);
    }
  }

  onMessagesScroll(event: Event): void {
    const element = event.target as HTMLElement;
    const threshold = 100; // Pixels depuis le haut pour déclencher le chargement
    
    // Si l'utilisateur est proche du haut et qu'il y a plus de messages à charger
    if (element.scrollTop < threshold && this.hasMoreMessages() && !this.isLoadingMessages()) {
      const scrollHeight = element.scrollHeight;
      const scrollTop = element.scrollTop;
      
      this.loadMoreMessages();
      
      // Maintenir la position de défilement après le chargement
      setTimeout(() => {
        const newScrollHeight = element.scrollHeight;
        const heightDifference = newScrollHeight - scrollHeight;
        element.scrollTop = scrollTop + heightDifference;
      }, 100);
    }
  }

  selectConversation(conversation: Conversation): void {
    const previousSelected = this.selectedConversation();
    
    // Arrêter l'indicateur de frappe de la conversation précédente
    if (this.isCurrentlyTyping && previousSelected) {
      this.isCurrentlyTyping = false;
      this.websocketService.stopTyping(previousSelected.id);
      if (this.typingTimer) {
        clearTimeout(this.typingTimer);
        this.typingTimer = null;
      }
    }
    
    // Sélectionner la nouvelle conversation
    this.conversationService.selectConversation(conversation);
    
    // Fermer le menu burger sur mobile après sélection (US026)
    if (this.isMobileView() && this.sidenav) {
      this.sidenav.close();
    }
    
    // Réinitialiser les indicateurs de frappe pour la nouvelle conversation
    this.typingUsers.set([]);
    
    // Marquer immédiatement le compteur comme mis à jour localement
    this.conversationService.clearUnreadCount(conversation.id);
    
    // Marquer les messages comme lus après un délai (pour que la conversation se charge)
    setTimeout(() => {
      this.markVisibleMessagesAsRead();
    }, 1500);
  }
  
  sendMessage(): void {
    console.log('🔄 sendMessage appelé!');
    console.log('📝 newMessage value:', this.newMessage);
    
    const content = this.newMessage.trim();
    const selectedConv = this.selectedConversation();
    
    console.log('📄 Contenu après trim:', content);
    console.log('💬 Conversation sélectionnée:', selectedConv);
    console.log('🔌 WebSocket connecté:', this.websocketService.isConnected());
    
    if (content && selectedConv) {
      console.log('✅ Conditions OK - envoi du message');
      
      // Arrêter l'indicateur de frappe lors de l'envoi
      if (this.isCurrentlyTyping) {
        this.isCurrentlyTyping = false;
        this.websocketService.stopTyping(selectedConv.id);
        if (this.typingTimer) {
          clearTimeout(this.typingTimer);
          this.typingTimer = null;
        }
      }
      
      if (this.websocketService.isConnected()) {
        console.log('📡 Envoi via WebSocket');
        this.websocketService.sendMessage(selectedConv.id, content);
        this.newMessage = '';
        
        // Mettre à jour immédiatement la conversation dans la liste locale
        const currentUser = this.currentUser();
        if (currentUser) {
          const tempMessage = {
            id: 'temp-' + Date.now(),
            content: content,
            senderId: currentUser.id,
            conversationId: selectedConv.id,
            createdAt: new Date().toISOString(),
            messageType: 'text',
            status: 'sent',
            isEdited: false,
            sender: {
              id: currentUser.id,
              username: currentUser.username,
              displayName: currentUser.displayName || currentUser.firstName + ' ' + currentUser.lastName || currentUser.username,
              status: 'online'
            }
          } as any;
          
          // Mettre à jour la conversation localement en attendant la confirmation WebSocket
          this.conversationService.updateConversationLastMessage(selectedConv.id, tempMessage);
          
          // Faire défiler vers le bas après l'envoi d'un message
          setTimeout(() => this.scrollToBottom(), 100);
        }
      } else {
        console.log('🌐 Envoi via HTTP');
        this.conversationService.sendMessage(selectedConv.id, content).subscribe({
          next: (response) => {
            console.log('📥 Réponse HTTP:', response);
            if (response.success) {
              this.newMessage = '';
              this.loadMessages(selectedConv.id);
              // Faire défiler vers le bas après le rechargement des messages
              setTimeout(() => this.scrollToBottom(), 200);
            }
          },
          error: (error) => {
            console.error('❌ Erreur lors de l\'envoi du message:', error);
          }
        });
      }
    } else {
      console.log('❌ Conditions non remplies:', {
        hasContent: !!content,
        hasConversation: !!selectedConv,
        contentValue: content,
        conversationId: selectedConv?.id
      });
    }
  }

  onEnterKey(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    } else {
      this.handleTyping();
    }
  }

  // Détecter la frappe de l'utilisateur (US010)
  onMessageInput(): void {
    this.handleTyping();
  }

  private handleTyping(): void {
    const selectedConv = this.selectedConversation();
    if (!selectedConv) return;

    // Commencer à taper si ce n'est pas déjà le cas
    if (!this.isCurrentlyTyping) {
      this.isCurrentlyTyping = true;
      this.websocketService.startTyping(selectedConv.id);
    }

    // Réinitialiser le timer - arrêter de taper après 3 secondes d'inactivité
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
    }

    this.typingTimer = setTimeout(() => {
      this.isCurrentlyTyping = false;
      this.websocketService.stopTyping(selectedConv.id);
    }, 3000);
  }
  
  getConversationDisplayName(conversation: Conversation): string {
    const currentUser = this.currentUser();
    return this.conversationService.getConversationDisplayName(conversation, currentUser?.id);
  }
  
  formatMessageTime(createdAt: string): string {
    const date = new Date(createdAt);
    return date.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  // Obtenir les initiales d'un utilisateur (2 premières lettres)
  getUserInitials(conversation: Conversation): string {
    const currentUser = this.currentUser();
    
    if (conversation.type === 'group') {
      return conversation.name ? conversation.name.substring(0, 2).toUpperCase() : 'GR';
    }
    
    // Pour les conversations privées, trouver l'autre utilisateur
    const otherMember = conversation.allMembers?.find(member => member.userId !== currentUser?.id);
    
    if (otherMember) {
      const displayName = otherMember.user.displayName || otherMember.user.username;
      // Prendre les 2 premières lettres du nom d'affichage
      return displayName.substring(0, 2).toUpperCase();
    }
    
    return '??';
  }
  
  isCurrentUserMessage(message: Message): boolean {
    const currentUser = this.currentUser();
    return message.senderId === currentUser?.id;
  }
  
  // ================================================
  // GESTION DES STATUTS DE LECTURE (US009)
  // ================================================
  
  getReadTooltip(message: Message): string {
    if (!message.readers || message.readers.length === 0) {
      return 'Non lu';
    }
    
    if (message.readers.length === 1) {
      const reader = message.readers[0];
      const readTime = this.formatMessageTime(reader.readAt);
      return `Lu par ${reader.user.displayName} à ${readTime}`;
    }
    
    const names = message.readers.map(r => r.user.displayName).join(', ');
    return `Lu par ${names}`;
  }
  
  // Marquer automatiquement les messages comme lus quand ils deviennent visibles
  markVisibleMessagesAsRead(): void {
    const selectedConv = this.selectedConversation();
    if (!selectedConv) return;
    
    const unreadMessages = this.messages().filter(msg => 
      !this.isCurrentUserMessage(msg) && !msg.isReadByCurrentUser
    );
    
    // Marquer les messages comme lus via WebSocket pour les performances
    unreadMessages.forEach(message => {
      this.websocketService.markMessageAsRead(message.id);
    });
    
    // Marquer aussi la conversation comme lue si il y a des messages non lus
    if (unreadMessages.length > 0) {
      const lastMessage = this.messages()[this.messages().length - 1];
      if (lastMessage) {
        this.websocketService.markConversationAsRead(selectedConv.id, lastMessage.id);
      }
    }
  }
  
  logout(): void {
    console.log('🔄 Début du processus de déconnexion');
    
    const user = this.currentUser();
    if (!user) {
      // Si pas d'utilisateur, déconnexion directe
      this.performLogout();
      return;
    }

    console.log('🔄 Changement du statut vers "away" avant déconnexion');
    
    // Changer le statut vers "absent" avant de se déconnecter (US015)
    this.authService.updateProfile({ status: 'away' }).subscribe({
      next: (response) => {
        console.log('✅ Statut changé vers "absent" avant déconnexion');
        this.performLogout();
      },
      error: (error) => {
        console.warn('⚠️ Erreur lors du changement de statut, déconnexion quand même:', error);
        // Même en cas d'erreur, on procède à la déconnexion
        this.performLogout();
      }
    });
  }

  private performLogout(): void {
    console.log('🔌 Nettoyage des ressources avant déconnexion');
    
    // Nettoyer la WebSocket
    if (this.websocketService.isConnected()) {
      this.websocketService.disconnect();
      console.log('🔌 WebSocket déconnectée');
    }
    
    // Nettoyer les subscriptions
    this.subscriptions.unsubscribe();
    console.log('🧹 Subscriptions nettoyées');
    
    // Appeler la déconnexion du service Auth
    this.authService.logout();
    console.log('👋 Déconnexion effectuée');
  }

  // ================================================
  // GESTION DU PROFIL UTILISATEUR (US013)
  // ================================================

  openProfileDialog(): void {
    const dialogRef = this.dialog.open(ProfileDialogComponent, {
      width: '450px',
      maxWidth: '90vw',
      disableClose: false,
      autoFocus: true,
      restoreFocus: true,
      panelClass: ['profile-dialog-container']
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        console.log('✅ Profil utilisateur mis à jour avec succès');
      }
    });
  }

  changeUserStatus(status: 'online' | 'away' | 'busy'): void {
    const user = this.currentUser();
    if (!user) return;

    console.log(`🔄 Changement de statut vers: ${status}`);
    console.log(`🔄 Statut actuel de l'utilisateur:`, user.status);

    this.authService.updateProfile({ status }).subscribe({
      next: (response) => {
        if (response.success) {
          console.log(`✅ Réponse serveur pour changement de statut:`, response);
          console.log(`✅ Nouveau statut dans la réponse:`, response.data?.user?.status);
          
          this.snackBar.open(`Statut changé vers "${this.getStatusLabel(status)}"`, 'Fermer', {
            duration: 2000,
            panelClass: ['success-snackbar']
          });
          console.log(`✅ Statut mis à jour vers: ${status}`);
          
          // Forcer la mise à jour du signal currentUser
          if (response.data?.user) {
            this.currentUser.set(response.data.user);
            console.log(`🔄 Signal currentUser forcé avec:`, response.data.user);
          }
          
          // Vérifier que le currentUser a été mis à jour
          setTimeout(() => {
            const updatedUser = this.currentUser();
            console.log(`🎨 Statut après mise à jour:`, updatedUser?.status);
            console.log(`🎨 Couleur du statut:`, this.getStatusColor(updatedUser?.status));
          }, 100);
        } else {
          this.snackBar.open('Erreur lors du changement de statut', 'Fermer', {
            duration: 3000,
            panelClass: ['error-snackbar']
          });
        }
      },
      error: (error) => {
        console.error('❌ Erreur changement de statut:', error);
        this.snackBar.open('Erreur lors du changement de statut', 'Fermer', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  private getStatusLabel(status: string): string {
    switch (status) {
      case 'online': return 'En ligne';
      case 'away': return 'Absent';
      case 'busy': return 'Occupé';
      default: return 'En ligne';
    }
  }

  getStatusClass(status: string | undefined): string {
    const currentStatus = status || 'online';
    console.log('🎨 Status class:', currentStatus, 'for status:', status);
    return currentStatus; // Retourne 'online', 'away', ou 'busy'
  }

  getCurrentUserInitials(): string {
    const user = this.currentUser();
    if (!user) return '?';

    const displayName = user.displayName || user.username || '';
    console.log('🎨 Getting initials for current user:', displayName);
    
    // Si on a un nom d'affichage avec des espaces, prendre les premières lettres des mots
    if (displayName.includes(' ')) {
      const words = displayName.split(' ').filter((word: string) => word.length > 0);
      const initials = words.slice(0, 2).map((word: string) => word[0]).join('').toUpperCase();
      console.log('🎨 Current user initials (words):', initials);
      return initials;
    }
    
    // Sinon, prendre les 2 premières lettres
    const initials = displayName.substring(0, 2).toUpperCase();
    console.log('🎨 Current user initials (substring):', initials);
    return initials;
  }

  getStatusColor(status: string | undefined): string {
    const currentStatus = status || 'online';
    console.log('🎨 Status color requested for:', currentStatus);
    const color = this.getColorByStatus(currentStatus);
    console.log('🎨 Returning color:', color, 'for status:', currentStatus);
    return color;
  }

  private getColorByStatus(status: string): string {
    switch (status) {
      case 'online': return '#4caf50'; // Vert
      case 'away': return '#ff9800'; // Orange  
      case 'busy': return '#f44336'; // Rouge
      default: return '#4caf50'; // Vert par défaut
    }
  }

  // ================================================
  // RESPONSIVE DESIGN (US026)
  // ================================================
  
  isMobileView(): boolean {
    return this.breakpointObserver.isMatched(['(max-width: 768px)']);
  }

  getConversationUserStatus(conversation: Conversation): string {
    // Seulement pour les conversations privées
    if (conversation.type !== 'private') {
      return '#4caf50'; // Vert par défaut
    }

    // Trouver l'autre utilisateur (pas nous)
    const currentUserId = this.currentUser()?.id;
    const otherUser = conversation.allMembers?.find(member => member.userId !== currentUserId);
    
    if (otherUser?.user?.status) {
      console.log('🎨 Conversation user status:', otherUser.user.status, 'for user:', otherUser.user.displayName);
      return this.getColorByStatus(otherUser.user.status);
    }
    
    // Par défaut : en ligne (vert)
    return this.getColorByStatus('online');
  }

  updateUserStatusInConversations(userId: string, newStatus: string): void {
    console.log('🎨 Mise à jour statut dans conversations:', userId, newStatus);
    
    const currentConversations = this.conversations();
    const updatedConversations = currentConversations.map(conversation => {
      // Seulement pour les conversations privées
      if (conversation.type === 'private') {
        // Vérifier si l'utilisateur modifié est dans cette conversation
        const updatedMembers = conversation.allMembers?.map(member => {
          if (member.userId === userId) {
            console.log('✅ Mise à jour statut pour membre:', member.user.displayName, 'vers:', newStatus);
            return {
              ...member,
              user: {
                ...member.user,
                status: newStatus
              }
            };
          }
          return member;
        });

        if (updatedMembers) {
          return {
            ...conversation,
            allMembers: updatedMembers
          };
        }
      }
      return conversation;
    });

    // Mettre à jour la liste des conversations si des changements ont été faits
    if (JSON.stringify(currentConversations) !== JSON.stringify(updatedConversations)) {
      console.log('🔄 Liste des conversations mise à jour avec nouveaux statuts');
      this.conversations.set(updatedConversations);
    }
  }
  
  // ================================================
  // RECHERCHE D'UTILISATEURS ET CREATION DE CONVERSATIONS
  // ================================================
  
  toggleUserSearch(): void {
    this.showUserSearch.set(!this.showUserSearch());
    if (!this.showUserSearch()) {
      this.searchQuery = '';
      this.searchResults.set([]);
      this.isSearching.set(false);
    }
  }
  
  onSearchUsers(event: any): void {
    const query = event.target.value;
    this.searchQuery = query;
    this.searchSubject.next(query);
  }
  
  startConversationWithUser(user: any): void {
    this.isSearching.set(true);
    
    this.conversationService.createPrivateConversation(user.id).subscribe({
      next: (response) => {
        this.isSearching.set(false);
        if (response.success) {
          // Sélectionner automatiquement la nouvelle conversation
          this.conversationService.selectConversation(response.data);
          
          // Fermer la recherche
          this.showUserSearch.set(false);
          this.searchQuery = '';
          this.searchResults.set([]);
          
          this.snackBar.open(
            `Conversation avec ${user.displayName || user.username} démarrée !`,
            'Fermer',
            {
              duration: 3000,
              panelClass: ['success-snackbar']
            }
          );
        } else {
          this.snackBar.open(
            response.message || 'Erreur lors de la création de la conversation',
            'Fermer',
            {
              duration: 5000,
              panelClass: ['error-snackbar']
            }
          );
        }
      },
      error: (error) => {
        this.isSearching.set(false);
        const message = error.error?.message || 'Erreur lors de la création de la conversation';
        this.snackBar.open(message, 'Fermer', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
        console.error('Erreur lors de la création de la conversation:', error);
      }
    });
  }

  // Faire défiler automatiquement vers le bas
  private scrollToBottom(): void {
    if (this.messagesContainer?.nativeElement) {
      const container = this.messagesContainer.nativeElement;
      container.scrollTop = container.scrollHeight;
    }
  }

  // ================================================
  // GESTION DES DEMANDES DE CONVERSATION (US022)
  // ================================================

  loadPendingConversations(): void {
    this.conversationService.getPendingConversations().subscribe({
      next: (response) => {
        if (response.success) {
          console.log('🔍 DEBUG - Conversations en attente:', response.data.conversations);
          console.log('🔍 DEBUG - Utilisateur actuel:', this.currentUser());
          
          response.data.conversations.forEach((conv: any) => {
            console.log(`🔍 DEBUG - Conversation ${conv.id}: createdBy=${conv.createdBy}, currentUser=${this.currentUser()?.id}`);
          });
          
          this.pendingConversations.set(response.data.conversations);
        }
      },
      error: (error) => {
        console.error('❌ Erreur lors du chargement des demandes:', error);
      }
    });
  }

  pendingConversationsCount(): number {
    return this.pendingConversations().length;
  }

  closePendingModal(): void {
    this.showPendingConversations = false;
  }

  acceptConversation(conversationId: string): void {
    this.processingConversation.set(conversationId);
    
    this.conversationService.acceptConversation(conversationId).subscribe({
      next: (response) => {
        this.processingConversation.set(null);
        if (response.success) {
          // Retirer la conversation des demandes en attente
          const updated = this.pendingConversations().filter(c => c.id !== conversationId);
          this.pendingConversations.set(updated);
          
          // Fermer le modal si plus de demandes
          if (updated.length === 0) {
            this.showPendingConversations = false;
          }
          
          this.snackBar.open('Conversation acceptée !', 'Fermer', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
        }
      },
      error: (error) => {
        this.processingConversation.set(null);
        const message = error.error?.message || 'Erreur lors de l\'acceptation';
        this.snackBar.open(message, 'Fermer', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  rejectConversation(conversationId: string): void {
    this.processingConversation.set(conversationId);
    
    this.conversationService.rejectConversation(conversationId).subscribe({
      next: (response) => {
        this.processingConversation.set(null);
        if (response.success) {
          // Retirer la conversation des demandes en attente
          const updated = this.pendingConversations().filter(c => c.id !== conversationId);
          this.pendingConversations.set(updated);
          
          // Fermer le modal si plus de demandes
          if (updated.length === 0) {
            this.showPendingConversations = false;
          }
          
          this.snackBar.open('Conversation refusée', 'Fermer', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
        }
      },
      error: (error) => {
        this.processingConversation.set(null);
        const message = error.error?.message || 'Erreur lors du refus';
        this.snackBar.open(message, 'Fermer', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }
  
  // ================================================
  // CRÉATION DE GROUPE (US011)
  // ================================================
  
  toggleGroupCreation(): void {
    this.showGroupCreation = !this.showGroupCreation;
    if (this.showGroupCreation) {
      this.resetGroupForm();
      this.loadAvailableUsers();
    }
  }
  
  resetGroupForm(): void {
    this.groupName = '';
    this.groupDescription = '';
    this.memberSearchQuery = '';
    this.selectedMembers.set([]);
    this.availableUsers.set([]);
  }
  
  loadAvailableUsers(): void {
    this.isLoadingUsers.set(true);
    this.authService.searchUsers('', 50).subscribe({
      next: (response) => {
        this.isLoadingUsers.set(false);
        if (response.success) {
          // Filtrer l'utilisateur actuel de la liste
          const currentUser = this.currentUser();
          const users = response.data.users.filter((user: any) => user.id !== currentUser?.id);
          this.availableUsers.set(users);
        }
      },
      error: (error) => {
        this.isLoadingUsers.set(false);
        console.error('Erreur lors du chargement des utilisateurs:', error);
        this.snackBar.open('Erreur lors du chargement des utilisateurs', 'Fermer', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }
  
  onMemberSearch(event: any): void {
    const query = event.target.value;
    this.memberSearchQuery = query;
    
    if (query.trim()) {
      this.isLoadingUsers.set(true);
      this.authService.searchUsers(query, 20).subscribe({
        next: (response) => {
          this.isLoadingUsers.set(false);
          if (response.success) {
            const currentUser = this.currentUser();
            const users = response.data.users.filter((user: any) => user.id !== currentUser?.id);
            this.availableUsers.set(users);
          }
        },
        error: (error) => {
          this.isLoadingUsers.set(false);
          console.error('Erreur lors de la recherche:', error);
        }
      });
    } else {
      this.loadAvailableUsers();
    }
  }
  
  toggleMemberSelection(user: any): void {
    const currentSelected = this.selectedMembers();
    const isSelected = currentSelected.some(member => member.id === user.id);
    
    if (isSelected) {
      this.selectedMembers.set(currentSelected.filter(member => member.id !== user.id));
    } else {
      this.selectedMembers.set([...currentSelected, user]);
    }
  }
  
  isMemberSelected(user: any): boolean {
    return this.selectedMembers().some(member => member.id === user.id);
  }
  
  createGroup(): void {
    if (!this.groupName.trim()) {
      this.snackBar.open('Le nom du groupe est obligatoire', 'Fermer', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
      return;
    }
    
    if (this.selectedMembers().length === 0) {
      this.snackBar.open('Veuillez sélectionner au moins un membre', 'Fermer', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
      return;
    }
    
    const memberIds = this.selectedMembers().map(member => member.id);
    
    this.conversationService.createGroupConversation(
      this.groupName.trim(),
      this.groupDescription.trim() || undefined,
      memberIds
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackBar.open('Groupe créé avec succès', 'Fermer', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
          
          // Sélectionner automatiquement le nouveau groupe
          this.conversationService.selectConversation(response.data);
          
          // Fermer le modal de création
          this.showGroupCreation = false;
          this.resetGroupForm();
        }
      },
      error: (error) => {
        const message = error.error?.message || 'Erreur lors de la création du groupe';
        this.snackBar.open(message, 'Fermer', {
          duration: 5000,
          panelClass: ['error-snackbar']
        });
      }
    });
  }

  // ================================================
  // GESTION DES GROUPES (US012)
  // ================================================

  openGroupManagement(): void {
    const selectedConv = this.selectedConversation();
    if (!selectedConv || selectedConv.type !== 'group') return;
    
    this.showGroupManagement = true;
    this.loadGroupDetails();
  }

  closeGroupManagement(): void {
    this.showGroupManagement = false;
    this.resetGroupManagementForm();
  }

  loadGroupDetails(): void {
    const selectedConv = this.selectedConversation();
    if (!selectedConv) return;
    
    this.isLoadingGroupDetails.set(true);
    
    this.conversationService.getGroupDetails(selectedConv.id).subscribe({
      next: (response) => {
        if (response.success) {
          this.groupDetails.set(response.data);
          this.editGroupName = response.data.name || '';
          this.editGroupDescription = response.data.description || '';
        }
        this.isLoadingGroupDetails.set(false);
      },
      error: (error) => {
        console.error('Erreur chargement détails groupe:', error);
        this.snackBar.open('Erreur lors du chargement des détails', 'Fermer', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
        this.isLoadingGroupDetails.set(false);
      }
    });
  }

  updateGroupSettings(): void {
    const selectedConv = this.selectedConversation();
    if (!selectedConv || !this.editGroupName.trim()) return;
    
    this.isProcessingGroupAction.set(true);
    
    this.conversationService.updateGroupSettings(
      selectedConv.id,
      this.editGroupName.trim(),
      this.editGroupDescription.trim() || undefined
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackBar.open('Paramètres mis à jour', 'Fermer', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
          
          // Recharger les détails et la liste des conversations
          this.loadGroupDetails();
          this.conversationService.loadConversations().subscribe();
        }
        this.isProcessingGroupAction.set(false);
      },
      error: (error) => {
        const message = error.error?.message || 'Erreur lors de la mise à jour';
        this.snackBar.open(message, 'Fermer', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
        this.isProcessingGroupAction.set(false);
      }
    });
  }

  addMemberToGroup(): void {
    if (this.availableMembersToAdd().length === 0) return;
    
    const selectedConv = this.selectedConversation();
    if (!selectedConv) return;
    
    // Pour l'exemple, ajouter le premier membre de la liste
    const memberToAdd = this.availableMembersToAdd()[0];
    this.isProcessingGroupAction.set(true);
    
    this.conversationService.addMembersToGroup(
      selectedConv.id, 
      [memberToAdd.id]
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackBar.open('Membre ajouté avec succès', 'Fermer', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
          
          this.loadGroupDetails();
          this.loadAvailableMembers();
        }
        this.isProcessingGroupAction.set(false);
      },
      error: (error) => {
        const message = error.error?.message || 'Erreur lors de l\'ajout';
        this.snackBar.open(message, 'Fermer', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
        this.isProcessingGroupAction.set(false);
      }
    });
  }

  removeMemberFromGroup(memberId: string): void {
    const selectedConv = this.selectedConversation();
    if (!selectedConv) return;
    
    this.isProcessingGroupAction.set(true);
    
    this.conversationService.removeMemberFromGroup(
      selectedConv.id,
      memberId
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackBar.open('Membre supprimé avec succès', 'Fermer', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
          
          this.loadGroupDetails();
          this.loadAvailableMembers();
        }
        this.isProcessingGroupAction.set(false);
      },
      error: (error) => {
        const message = error.error?.message || 'Erreur lors de la suppression';
        this.snackBar.open(message, 'Fermer', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
        this.isProcessingGroupAction.set(false);
      }
    });
  }

  updateMemberRole(memberId: string, newRole: string): void {
    const selectedConv = this.selectedConversation();
    if (!selectedConv) return;
    
    this.isProcessingGroupAction.set(true);
    
    this.conversationService.updateMemberRole(
      selectedConv.id,
      memberId,
      newRole
    ).subscribe({
      next: (response) => {
        if (response.success) {
          this.snackBar.open('Rôle mis à jour avec succès', 'Fermer', {
            duration: 3000,
            panelClass: ['success-snackbar']
          });
          
          this.loadGroupDetails();
        }
        this.isProcessingGroupAction.set(false);
      },
      error: (error) => {
        const message = error.error?.message || 'Erreur lors de la mise à jour du rôle';
        this.snackBar.open(message, 'Fermer', {
          duration: 3000,
          panelClass: ['error-snackbar']
        });
        this.isProcessingGroupAction.set(false);
      }
    });
  }

  loadAvailableMembers(): void {
    // Simuler le chargement des membres disponibles
    // En production, ceci devrait venir d'un service
    this.availableMembersToAdd.set([]);
  }

  resetGroupManagementForm(): void {
    this.editGroupName = '';
    this.editGroupDescription = '';
    this.groupDetails.set(null);
    this.availableMembersToAdd.set([]);
    this.isProcessingGroupAction.set(false);
  }

  canManageGroup(): boolean {
    const currentUser = this.currentUser();
    const selectedConv = this.selectedConversation();
    
    if (!currentUser || !selectedConv || selectedConv.type !== 'group') return false;
    
    // Seuls les propriétaires et admins peuvent gérer le groupe
    const currentMember = selectedConv.allMembers?.find((member: any) => member.userId === currentUser.id);
    return currentMember?.role === 'owner' || currentMember?.role === 'admin';
  }

  canRemoveMember(member: any): boolean {
    const currentUser = this.currentUser();
    const groupDetails = this.groupDetails();
    
    if (!currentUser || !groupDetails) return false;
    
    // Ne peut pas se supprimer soi-même
    if (member.userId === currentUser.id) return false;
    
    // Le propriétaire ne peut pas être supprimé
    if (member.role === 'owner') return false;
    
    const currentMember = groupDetails.allMembers?.find((m: any) => m.userId === currentUser.id);
    
    // Seul le propriétaire peut supprimer des admins
    if (member.role === 'admin' && currentMember?.role !== 'owner') return false;
    
    // Les admins et propriétaires peuvent supprimer des membres normaux
    return currentMember?.role === 'owner' || currentMember?.role === 'admin';
  }

  canUpdateRole(member: any): boolean {
    const currentUser = this.currentUser();
    const groupDetails = this.groupDetails();
    
    if (!currentUser || !groupDetails) return false;
    
    // Ne peut pas modifier son propre rôle
    if (member.userId === currentUser.id) return false;
    
    // Seul le propriétaire peut modifier les rôles
    const currentMember = groupDetails.allMembers?.find((m: any) => m.userId === currentUser.id);
    return currentMember?.role === 'owner';
  }

  // ================================================
  // GESTION DES CONVERSATIONS (US023 & US025)
  // ================================================

  deleteConversation(conversationId: string): void {
    const conversationName = this.getConversationDisplayName(
      this.conversations().find(c => c.id === conversationId)!
    );

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Supprimer la conversation',
        message: `Êtes-vous sûr de vouloir supprimer la conversation avec "${conversationName}" ? Cette action ne peut pas être annulée.`,
        confirmText: 'Supprimer',
        cancelText: 'Annuler',
        type: 'danger'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.conversationService.deleteConversation(conversationId).subscribe({
          next: (response) => {
            if (response.success) {
              // Retirer la conversation de la liste
              const updatedConversations = this.conversations().filter(c => c.id !== conversationId);
              this.conversations.set(updatedConversations);

              // Si c'était la conversation sélectionnée, la désélectionner
              if (this.selectedConversation()?.id === conversationId) {
                this.selectedConversation.set(null);
                this.messages.set([]);
              }

              this.snackBar.open('Conversation supprimée avec succès', 'Fermer', {
                duration: 3000,
                panelClass: ['success-snackbar']
              });
            }
          },
          error: (error) => {
            console.error('❌ Erreur suppression conversation:', error);
            this.snackBar.open('Erreur lors de la suppression de la conversation', 'Fermer', {
              duration: 3000,
              panelClass: ['error-snackbar']
            });
          }
        });
      }
    });
  }

  leaveGroup(conversationId: string): void {
    const conversation = this.conversations().find(c => c.id === conversationId);
    if (!conversation) return;

    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '400px',
      data: {
        title: 'Quitter le groupe',
        message: `Êtes-vous sûr de vouloir quitter le groupe "${conversation.name}" ? Vous ne recevrez plus les messages de ce groupe.`,
        confirmText: 'Quitter',
        cancelText: 'Annuler',
        type: 'warning'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.conversationService.leaveGroup(conversationId).subscribe({
          next: (response) => {
            if (response.success) {
              // Retirer le groupe de la liste
              const updatedConversations = this.conversations().filter(c => c.id !== conversationId);
              this.conversations.set(updatedConversations);

              // Si c'était le groupe sélectionné, le désélectionner
              if (this.selectedConversation()?.id === conversationId) {
                this.selectedConversation.set(null);
                this.messages.set([]);
              }

              this.snackBar.open('Vous avez quitté le groupe avec succès', 'Fermer', {
                duration: 3000,
                panelClass: ['success-snackbar']
              });
            }
          },
          error: (error) => {
            console.error('❌ Erreur en quittant le groupe:', error);
            this.snackBar.open('Erreur lors de la sortie du groupe', 'Fermer', {
              duration: 3000,
              panelClass: ['error-snackbar']
            });
          }
        });
      }
    });
  }
  
}
