import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { AuthService } from './auth.service';
import { ConversationService, Message } from './conversation.service';

export interface SocketEvent {
  type: string;
  data: any;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private authService = inject(AuthService);
  private conversationService = inject(ConversationService);
  
  private socket: Socket | null = null;
  private readonly SERVER_URL = 'http://localhost:3000';
  
  private connectionStatusSubject = new BehaviorSubject<boolean>(false);
  private onlineUsersSubject = new BehaviorSubject<string[]>([]);
  private newMessageSubject = new BehaviorSubject<Message | null>(null);
  private conversationUpdateSubject = new BehaviorSubject<{conversationId: string, action: string} | null>(null);
  
  // Indicateurs de frappe
  private typingUsersSubject = new BehaviorSubject<{[conversationId: string]: string[]}>({});
  
  public connectionStatus$ = this.connectionStatusSubject.asObservable();
  public onlineUsers$ = this.onlineUsersSubject.asObservable();
  public newMessage$ = this.newMessageSubject.asObservable();
  public conversationUpdate$ = this.conversationUpdateSubject.asObservable();
  public typingUsers$ = this.typingUsersSubject.asObservable();

  constructor() {
    // Auto-connect si l'utilisateur est authentifié
    this.authService.isAuthenticated$.subscribe(isAuth => {
      if (isAuth && !this.socket) {
        this.connect();
      } else if (!isAuth && this.socket) {
        this.disconnect();
      }
    });
  }

  connect(): void {
    const currentUser = this.authService.getCurrentUser();
    const token = this.authService.getToken();

    console.log('🔍 Tentative de connexion WebSocket:');
    console.log('👤 Utilisateur courant:', currentUser);
    console.log('🔑 Token présent:', !!token);
    console.log('🔑 Token (premiers chars):', token ? token.substring(0, 20) + '...' : 'AUCUN');
    
    // Décoder le token pour voir son contenu (temporaire pour debug)
    if (token) {
      try {
        const tokenParts = token.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(atob(tokenParts[1]));
          console.log('🔍 Contenu du token JWT:', payload);
        }
      } catch (e) {
        console.error('❌ Erreur décodage token:', e);
      }
    }

    if (!currentUser || !token) {
      console.error('❌ Impossible de se connecter: utilisateur non authentifié');
      return;
    }

    if (this.socket?.connected) {
      console.log('⚡ Socket déjà connecté');
      return;
    }

    console.log('🔌 Connexion WebSocket...');

    this.socket = io(this.SERVER_URL, {
      auth: {
        token: token
      },
      transports: ['websocket', 'polling']
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    // Événements de connexion
    this.socket.on('connect', () => {
      console.log('✅ WebSocket connecté:', this.socket?.id);
      this.connectionStatusSubject.next(true);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket déconnecté:', reason);
      this.connectionStatusSubject.next(false);
    });

    this.socket.on('connect_error', (error) => {
      console.error('❌ Erreur de connexion WebSocket:', error);
      this.connectionStatusSubject.next(false);
    });

    // Événements d'authentification
    this.socket.on('auth:success', (data) => {
      console.log('🔐 Authentification WebSocket réussie:', data);
    });

    this.socket.on('auth:error', (error) => {
      console.error('🔐 Erreur d\'authentification WebSocket:', error);
      this.disconnect();
    });

    // Événements de messages
    this.socket.on('message:new', (data) => {
      console.log('📨 Nouveau message reçu:', data);
      this.handleNewMessage(data);
    });

    this.socket.on('message:sent', (data) => {
      console.log('✅ Confirmation d\'envoi message:', data);
      // Ne pas traiter comme nouveau message ici pour éviter les doublons
      // Le message sera géré par message:new
    });

    // Événements de conversations
    this.socket.on('conversation:updated', (data) => {
      console.log('🔄 Conversation mise à jour:', data);
      this.handleConversationUpdate(data);
    });

    this.socket.on('message:edited', (data) => {
      console.log('📝 Message modifié:', data);
      this.handleMessageUpdate(data);
    });

    this.socket.on('message:deleted', (data) => {
      console.log('🗑️ Message supprimé:', data);
      this.handleMessageDeletion(data);
    });

    // Événements de statut de message
    this.socket.on('message:delivered', (data) => {
      console.log('✅ Message livré:', data);
      this.handleMessageStatus(data, 'delivered');
    });

    this.socket.on('message:read', (data) => {
      console.log('👁️ Message lu:', data);
      this.handleMessageStatus(data, 'read');
    });

    // Événements de présence utilisateur
    this.socket.on('user:online', (data) => {
      console.log('🟢 Utilisateur en ligne:', data);
      this.handleUserOnline(data);
    });

    this.socket.on('user:offline', (data) => {
      console.log('🔴 Utilisateur hors ligne:', data);
      this.handleUserOffline(data);
    });

    this.socket.on('users:online', (users) => {
      console.log('👥 Utilisateurs en ligne:', users);
      this.onlineUsersSubject.next(users);
    });

    // Événements de conversation
    this.socket.on('conversation:updated', (data) => {
      console.log('💬 Conversation mise à jour:', data);
      this.handleConversationUpdate(data);
    });

    // Événements demandes de conversation (US022)
    this.socket.on('conversation:accepted', (data) => {
      console.log('✅ Conversation acceptée:', data);
      this.handleConversationAccepted(data);
    });

    this.socket.on('conversation:rejected', (data) => {
      console.log('❌ Conversation rejetée:', data);
      this.handleConversationRejected(data);
    });

    this.socket.on('conversation:accepted_success', (data) => {
      console.log('✅ Acceptation réussie:', data);
    });

    this.socket.on('conversation:rejected_success', (data) => {
      console.log('❌ Rejet réussi:', data);
    });

    // Événements statuts de lecture (US009)
    this.socket.on('message:readStatus', (data) => {
      console.log('👁️ Statut de lecture message:', data);
      this.handleMessageReadStatus(data);
    });

    this.socket.on('conversation:readStatus', (data) => {
      console.log('👁️ Statut de lecture conversation:', data);
      this.handleConversationReadStatus(data);
    });

    // Événements indicateurs de frappe (US010)
    this.socket.on('typing:start', (data) => {
      console.log('⌨️ Utilisateur commence à taper:', data);
      this.handleUserStartTyping(data);
    });

    this.socket.on('typing:stop', (data) => {
      console.log('⌨️ Utilisateur arrête de taper:', data);
      this.handleUserStopTyping(data);
    });

    this.socket.on('message:readConfirmed', (data) => {
      console.log('✅ Message marqué comme lu:', data);
    });

    this.socket.on('conversation:readConfirmed', (data) => {
      console.log('✅ Conversation marquée comme lue:', data);
    });

    // Événements système
    this.socket.on('welcome', (data) => {
      console.log('🎉 Message de bienvenue:', data);
    });

    this.socket.on('error', (error) => {
      console.error('❌ Erreur WebSocket reçue:', error);
    });
  }

  // Gestion des événements de messages
  private handleNewMessage(data: { message: Message, conversationId: string }): void {
    const { message, conversationId } = data;
    const currentUser = this.authService.getCurrentUser();
    
    console.log('📨 New message received:', {
      messageId: message.id,
      conversationId,
      senderName: message.sender?.displayName || message.sender?.username,
      isOwnMessage: message.senderId === currentUser?.id
    });
    
    // Émettre le nouveau message pour que les composants puissent l'écouter
    this.newMessageSubject.next(message);
    
    // Toujours mettre à jour le service de conversation (pour l'expéditeur ET le destinataire)
    console.log('🔄 Updating conversation list with new message');
    this.conversationService.updateConversationLastMessage(conversationId, message);
    
    // Incrémenter le compteur de messages non lus seulement si ce n'est pas l'utilisateur actuel
    if (currentUser && message.senderId !== currentUser.id) {
      console.log('📊 Incrementing unread count');
      this.conversationService.updateUnreadCount(conversationId, true);
    }
  }

  private handleMessageUpdate(data: { message: Message, conversationId: string }): void {
    // Recharger les messages de la conversation si elle est sélectionnée
    const selectedConv = this.conversationService.getSelectedConversation();
    if (selectedConv && selectedConv.id === data.conversationId) {
      // Émettre un événement pour recharger les messages
      console.log('📝 Message mis à jour dans la conversation active');
    }
  }

  private handleMessageDeletion(data: { messageId: string, conversationId: string }): void {
    // Recharger les messages de la conversation si elle est sélectionnée
    const selectedConv = this.conversationService.getSelectedConversation();
    if (selectedConv && selectedConv.id === data.conversationId) {
      console.log('🗑️ Message supprimé dans la conversation active');
    }
  }

  private handleMessageStatus(data: { messageId: string, status: string }, status: 'delivered' | 'read'): void {
    console.log(`📋 Statut de message mis à jour: ${status}`, data);
  }

  private handleUserOnline(data: { userId: string }): void {
    const currentUsers = this.onlineUsersSubject.value;
    if (!currentUsers.includes(data.userId)) {
      this.onlineUsersSubject.next([...currentUsers, data.userId]);
    }
  }

  private handleUserOffline(data: { userId: string }): void {
    const currentUsers = this.onlineUsersSubject.value;
    this.onlineUsersSubject.next(currentUsers.filter(id => id !== data.userId));
  }


  // Méthodes pour envoyer des événements
  joinConversation(conversationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('conversation:join', { conversationId });
      console.log('🏠 Rejoint la conversation:', conversationId);
    }
  }

  leaveConversation(conversationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('conversation:leave', { conversationId });
      console.log('🚪 Quitté la conversation:', conversationId);
    }
  }

  sendMessage(conversationId: string, content: string, messageType: string = 'text', replyToId?: string): void {
    if (this.socket?.connected) {
      this.socket.emit('message:send', {
        conversationId,
        content,
        messageType,
        replyToId
      });
      console.log('📤 Message envoyé via WebSocket:', { conversationId, content });
    }
  }


  startTyping(conversationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('typing:start', { conversationId });
    }
  }

  stopTyping(conversationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('typing:stop', { conversationId });
    }
  }

  // Gestion de la connexion
  disconnect(): void {
    if (this.socket) {
      console.log('🔌 Déconnexion WebSocket...');
      this.socket.disconnect();
      this.socket = null;
      this.connectionStatusSubject.next(false);
      this.onlineUsersSubject.next([]);
    }
  }

  reconnect(): void {
    this.disconnect();
    setTimeout(() => this.connect(), 1000);
  }

  // Getters utilitaires
  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  getSocketId(): string | null {
    return this.socket?.id || null;
  }

  // Gérer les mises à jour de conversation
  private handleConversationUpdate(data: any): void {
    console.log('🔄 Traitement mise à jour conversation:', data);
    this.conversationUpdateSubject.next({
      conversationId: data.conversationId,
      action: data.action
    });
  }

  // ================================================
  // GESTION DES INDICATEURS DE FRAPPE (US010)
  // ================================================

  private handleUserStartTyping(data: { conversationId: string, user: any }): void {
    const currentTypingUsers = this.typingUsersSubject.value;
    const conversationTypers = currentTypingUsers[data.conversationId] || [];
    const username = data.user.username;
    
    if (!conversationTypers.includes(username)) {
      const updatedTypingUsers = {
        ...currentTypingUsers,
        [data.conversationId]: [...conversationTypers, username]
      };
      this.typingUsersSubject.next(updatedTypingUsers);
    }
  }

  private handleUserStopTyping(data: { conversationId: string, user: any }): void {
    const currentTypingUsers = this.typingUsersSubject.value;
    const conversationTypers = currentTypingUsers[data.conversationId] || [];
    const username = data.user.username;
    
    const updatedTypers = conversationTypers.filter(name => name !== username);
    const updatedTypingUsers = {
      ...currentTypingUsers,
      [data.conversationId]: updatedTypers
    };
    
    this.typingUsersSubject.next(updatedTypingUsers);
  }

  // Obtenir les utilisateurs qui tapent dans une conversation
  getTypingUsers(conversationId: string): string[] {
    return this.typingUsersSubject.value[conversationId] || [];
  }

  // Écouter des événements personnalisés
  on(eventName: string): Observable<any> {
    return new Observable(observer => {
      if (this.socket) {
        this.socket.on(eventName, (data) => observer.next(data));
      }
    });
  }

  // Émettre des événements personnalisés
  emit(eventName: string, data: any): void {
    if (this.socket?.connected) {
      this.socket.emit(eventName, data);
    }
  }

  // ================================================
  // GESTION DES DEMANDES DE CONVERSATION (US022)
  // ================================================

  private handleConversationAccepted(data: any): void {
    console.log('✅ Gestion acceptation conversation:', data);
    // Recharger les conversations pour mettre à jour les statuts
    this.conversationService.loadConversations().subscribe();
  }

  private handleConversationRejected(data: any): void {
    console.log('❌ Gestion rejet conversation:', data);
    // Recharger les conversations pour mettre à jour les statuts
    this.conversationService.loadConversations().subscribe();
  }

  // Accepter une conversation via WebSocket
  acceptConversation(conversationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('conversation:accept', { conversationId });
      console.log('✅ Acceptation conversation via WebSocket:', conversationId);
    }
  }

  // Refuser une conversation via WebSocket
  rejectConversation(conversationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('conversation:reject', { conversationId });
      console.log('❌ Rejet conversation via WebSocket:', conversationId);
    }
  }

  // ================================================
  // GESTION DES STATUTS DE LECTURE (US009)
  // ================================================

  private handleMessageReadStatus(data: any): void {
    console.log('👁️ Gestion statut lecture message:', data);
    // Émettre un événement pour les composants qui écoutent
    // TODO: Implémenter la mise à jour des indicateurs de lecture dans l'interface
  }

  private handleConversationReadStatus(data: any): void {
    console.log('👁️ Gestion statut lecture conversation:', data);
    // Émettre un événement pour les composants qui écoutent
    // TODO: Implémenter la mise à jour des indicateurs de lecture dans l'interface
  }

  // Marquer un message comme lu via WebSocket
  markMessageAsRead(messageId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('message:markAsRead', { messageId });
      console.log('👁️ Marquage message lu via WebSocket:', messageId);
    }
  }

  // Marquer une conversation comme lue via WebSocket
  markConversationAsRead(conversationId: string, lastMessageId?: string): void {
    if (this.socket?.connected) {
      this.socket.emit('conversation:markAsRead', { 
        conversationId,
        lastMessageId
      });
      console.log('👁️ Marquage conversation lue via WebSocket:', conversationId);
    }
  }
}