import { Component, OnInit, OnDestroy, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subscription, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';

import { ConversationService, Conversation, Message } from '../../services/conversation.service';
import { AuthService } from '../../services/auth.service';
import { WebSocketService } from '../../services/websocket.service';

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
    MatTooltipModule
  ],
  templateUrl: './chat.html',
  styleUrl: './chat.scss'
})
export class Chat implements OnInit, OnDestroy {
  private conversationService = inject(ConversationService);
  private authService = inject(AuthService);
  private websocketService = inject(WebSocketService);
  private snackBar = inject(MatSnackBar);
  
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
  
  // Indicateurs de frappe (US010)
  protected typingUsers = signal<string[]>([]);
  private typingTimer: any = null;
  private isCurrentlyTyping = false;
  
  private subscriptions = new Subscription();
  private searchSubject = new Subject<string>();
  
  @ViewChild('messagesContainer', { static: false }) messagesContainer!: ElementRef;
  
  ngOnInit(): void {
    this.currentUser.set(this.authService.getCurrentUser());
    
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
    this.authService.logout();
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
  
}
