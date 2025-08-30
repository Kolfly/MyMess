import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export interface Message {
  id: string;
  content: string;
  messageType: 'text' | 'image' | 'file' | 'system';
  senderId: string;
  conversationId: string;
  status: 'sent' | 'delivered' | 'read';
  isEdited: boolean;
  createdAt: string;
  editedAt?: string;
  // Nouveaux champs pour les statuts de lecture (US009)
  isReadByCurrentUser?: boolean;
  readByCount?: number;
  readers?: {
    userId: string;
    readAt: string;
    user: {
      id: string;
      username: string;
      displayName: string;
    };
  }[];
  sender: {
    id: string;
    username: string;
    displayName: string;
    status?: string;
  };
  replyTo?: {
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
  };
}

export interface Conversation {
  id: string;
  name?: string;
  description?: string;
  type: 'private' | 'group';
  status: 'pending' | 'accepted' | 'rejected'; // US022: Statut de la conversation
  createdBy: string;
  avatar?: string;
  isActive: boolean;
  lastActivityAt: string;
  lastMessage?: Message;
  unreadCount?: number;
  allMembers: {
    id: string;
    userId: string;
    role: 'member' | 'admin' | 'owner';
    joinedAt: string;
    user: {
      id: string;
      username: string;
      displayName: string;
      status: string;
    };
  }[];
}

export interface ConversationListResponse {
  success: boolean;
  data: {
    conversations: Conversation[];
    total: number;
    hasMore: boolean;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ConversationService {
  private readonly API_URL = 'http://localhost:3000/api/messages';
  
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  // État des conversations
  private conversationsSubject = new BehaviorSubject<Conversation[]>([]);
  private selectedConversationSubject = new BehaviorSubject<Conversation | null>(null);
  
  public conversations$ = this.conversationsSubject.asObservable();
  public selectedConversation$ = this.selectedConversationSubject.asObservable();

  // ================================================
  // GESTION DES CONVERSATIONS
  // ================================================

  loadConversations(): Observable<ConversationListResponse> {
    return this.http.get<ConversationListResponse>(`${this.API_URL}/conversations`, {
      headers: this.authService.getAuthHeaders()
    }).pipe(
      tap(response => {
        if (response.success) {
          this.conversationsSubject.next(response.data.conversations);
        }
      }),
      catchError(this.handleError)
    );
  }

  selectConversation(conversation: Conversation): void {
    this.selectedConversationSubject.next(conversation);
  }

  getSelectedConversation(): Conversation | null {
    return this.selectedConversationSubject.value;
  }

  // ================================================
  // CRÉATION DE CONVERSATIONS
  // ================================================

  createPrivateConversation(otherUserId: string): Observable<any> {
    return this.http.post(`${this.API_URL}/conversations/private`, 
      { otherUserId },
      { headers: this.authService.getAuthHeaders() }
    ).pipe(
      tap((response: any) => {
        if (response.success) {
          // Ajouter la nouvelle conversation à la liste
          const currentConversations = this.conversationsSubject.value;
          this.conversationsSubject.next([response.data, ...currentConversations]);
        }
      }),
      catchError(this.handleError)
    );
  }

  createGroupConversation(name: string, description?: string, memberIds: string[] = []): Observable<any> {
    return this.http.post(`${this.API_URL}/conversations/group`,
      { name, description, memberIds },
      { headers: this.authService.getAuthHeaders() }
    ).pipe(
      tap((response: any) => {
        if (response.success) {
          const currentConversations = this.conversationsSubject.value;
          this.conversationsSubject.next([response.data, ...currentConversations]);
        }
      }),
      catchError(this.handleError)
    );
  }

  // ================================================
  // GESTION DES MESSAGES
  // ================================================

  getConversationMessages(conversationId: string, limit = 50, offset = 0, before?: string): Observable<any> {
    let params: { [key: string]: string } = { 
      limit: limit.toString(), 
      offset: offset.toString() 
    };
    
    if (before) {
      params['before'] = before;
    }
    
    return this.http.get(`${this.API_URL}/conversations/${conversationId}/messages`, {
      headers: this.authService.getAuthHeaders(),
      params
    }).pipe(catchError(this.handleError));
  }

  sendMessage(conversationId: string, content: string, messageType: string = 'text', replyToId?: string): Observable<any> {
    return this.http.post(`${this.API_URL}/`,
      { conversationId, content, messageType, replyToId },
      { headers: this.authService.getAuthHeaders() }
    ).pipe(catchError(this.handleError));
  }

  editMessage(messageId: string, content: string): Observable<any> {
    return this.http.put(`${this.API_URL}/${messageId}`,
      { content },
      { headers: this.authService.getAuthHeaders() }
    ).pipe(catchError(this.handleError));
  }

  deleteMessage(messageId: string): Observable<any> {
    return this.http.delete(`${this.API_URL}/${messageId}`, {
      headers: this.authService.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  markAsRead(conversationId: string, messageId?: string): Observable<any> {
    return this.http.post(`${this.API_URL}/conversations/${conversationId}/read`,
      { messageId },
      { headers: this.authService.getAuthHeaders() }
    ).pipe(catchError(this.handleError));
  }

  // ================================================
  // UTILITAIRES
  // ================================================

  updateConversationLastMessage(conversationId: string, message: Message): void {
    console.log('🔄 Updating last message for conversation:', conversationId, 'from:', message.sender?.displayName || message.sender?.username);
    
    const currentConversations = this.conversationsSubject.value;
    
    const conversations = currentConversations.map(conv => {
      if (conv.id === conversationId) {
        return {
          ...conv,
          lastMessage: message,
          lastActivityAt: message.createdAt
        };
      }
      return conv;
    });
    
    // Réorganiser pour mettre la conversation mise à jour en premier
    const updatedConv = conversations.find(c => c.id === conversationId);
    const otherConvs = conversations.filter(c => c.id !== conversationId);
    
    if (updatedConv) {
      console.log('✅ Conversation list updated');
      this.conversationsSubject.next([updatedConv, ...otherConvs]);
    } else {
      console.warn('⚠️ Could not find conversation to update:', conversationId);
    }
  }

  updateUnreadCount(conversationId: string, increment: boolean = true): void {
    const conversations = this.conversationsSubject.value.map(conv => {
      if (conv.id === conversationId) {
        const currentCount = conv.unreadCount || 0;
        return {
          ...conv,
          unreadCount: increment ? currentCount + 1 : Math.max(0, currentCount - 1)
        };
      }
      return conv;
    });
    
    this.conversationsSubject.next(conversations);
  }

  clearUnreadCount(conversationId: string): void {
    const conversations = this.conversationsSubject.value.map(conv => {
      if (conv.id === conversationId) {
        return { ...conv, unreadCount: 0 };
      }
      return conv;
    });
    
    this.conversationsSubject.next(conversations);
  }

  // Obtenir le nom d'affichage d'une conversation
  getConversationDisplayName(conversation: Conversation, currentUserId: string): string {
    if (!conversation) {
      return 'Conversation inconnue';
    }
    
    if (conversation.type === 'group') {
      return conversation.name || 'Groupe sans nom';
    } else {
      // Pour les conversations privées, afficher le nom de l'autre utilisateur
      if (!conversation.allMembers || conversation.allMembers.length === 0) {
        return 'Conversation privée';
      }
      
      const otherUser = conversation.allMembers.find(member => member.userId !== currentUserId);
      return otherUser?.user?.displayName || otherUser?.user?.username || 'Utilisateur inconnu';
    }
  }

  // Obtenir l'avatar d'une conversation
  getConversationAvatar(conversation: Conversation, currentUserId: string): string | null {
    if (conversation.type === 'group') {
      return conversation.avatar || null;
    } else {
      // Pour les conversations privées, on pourrait retourner l'avatar de l'autre utilisateur
      // Pour l'instant, on retourne null
      return null;
    }
  }

  // ================================================
  // STATUTS DE LECTURE (US009)
  // ================================================

  // Marquer un message comme lu
  markMessageAsRead(messageId: string): Observable<any> {
    return this.http.post(`${this.API_URL}/${messageId}/read`, {}, {
      headers: this.authService.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  // Marquer une conversation comme lue
  markConversationAsRead(conversationId: string, lastMessageId?: string): Observable<any> {
    return this.http.post(`${this.API_URL}/conversations/${conversationId}/mark-read`, 
      { lastMessageId },
      { headers: this.authService.getAuthHeaders() }
    ).pipe(catchError(this.handleError));
  }

  // Obtenir les statuts de lecture pour plusieurs messages
  getReadStatuses(messageIds: string[]): Observable<any> {
    return this.http.post(`${this.API_URL}/read-statuses`, 
      { messageIds },
      { headers: this.authService.getAuthHeaders() }
    ).pipe(catchError(this.handleError));
  }

  // Obtenir les lecteurs d'un message
  getMessageReaders(messageId: string): Observable<any> {
    return this.http.get(`${this.API_URL}/${messageId}/readers`, {
      headers: this.authService.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  // Obtenir les messages non lus d'une conversation
  getUnreadMessages(conversationId: string): Observable<any> {
    return this.http.get(`${this.API_URL}/conversations/${conversationId}/unread`, {
      headers: this.authService.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  // ================================================
  // DEMANDES DE CONVERSATION (US022)
  // ================================================

  // Récupérer les conversations en attente
  getPendingConversations(): Observable<ConversationListResponse> {
    return this.http.get<ConversationListResponse>(`${this.API_URL}/conversations/pending`, {
      headers: this.authService.getAuthHeaders()
    }).pipe(catchError(this.handleError));
  }

  // Accepter une conversation
  acceptConversation(conversationId: string): Observable<any> {
    return this.http.post(`${this.API_URL}/conversations/${conversationId}/accept`, 
      {},
      { headers: this.authService.getAuthHeaders() }
    ).pipe(
      tap((response: any) => {
        if (response.success) {
          // Recharger la liste des conversations pour mettre à jour les statuts
          this.loadConversations().subscribe();
        }
      }),
      catchError(this.handleError)
    );
  }

  // Refuser une conversation
  rejectConversation(conversationId: string): Observable<any> {
    return this.http.post(`${this.API_URL}/conversations/${conversationId}/reject`, 
      {},
      { headers: this.authService.getAuthHeaders() }
    ).pipe(
      tap((response: any) => {
        if (response.success) {
          // Retirer la conversation de la liste locale
          const currentConversations = this.conversationsSubject.value;
          const updatedConversations = currentConversations.filter(conv => conv.id !== conversationId);
          this.conversationsSubject.next(updatedConversations);
          
          // Si la conversation rejetée était sélectionnée, désélectionner
          const selectedConv = this.selectedConversationSubject.value;
          if (selectedConv && selectedConv.id === conversationId) {
            this.selectedConversationSubject.next(null);
          }
        }
      }),
      catchError(this.handleError)
    );
  }

  // ================================================
  // GESTION DES GROUPES (US012)
  // ================================================

  // 👤 AJOUTER DES MEMBRES À UN GROUPE
  addMembersToGroup(conversationId: string, memberIds: string[]): Observable<any> {
    return this.http.post(`http://localhost:3000/api/groups/${conversationId}/members`,
      { memberIds },
      { headers: this.authService.getAuthHeaders() }
    ).pipe(catchError(this.handleError));
  }

  // ❌ SUPPRIMER UN MEMBRE D'UN GROUPE
  removeMemberFromGroup(conversationId: string, memberId: string): Observable<any> {
    return this.http.delete(`http://localhost:3000/api/groups/${conversationId}/members/${memberId}`,
      { headers: this.authService.getAuthHeaders() }
    ).pipe(catchError(this.handleError));
  }

  // ⚙️ MODIFIER LES PARAMÈTRES D'UN GROUPE
  updateGroupSettings(conversationId: string, name: string, description?: string): Observable<any> {
    return this.http.put(`http://localhost:3000/api/groups/${conversationId}/settings`,
      { name, description },
      { headers: this.authService.getAuthHeaders() }
    ).pipe(catchError(this.handleError));
  }

  // 👑 MODIFIER LE RÔLE D'UN MEMBRE
  updateMemberRole(conversationId: string, memberId: string, role: string): Observable<any> {
    return this.http.patch(`http://localhost:3000/api/groups/${conversationId}/members/${memberId}/role`,
      { role },
      { headers: this.authService.getAuthHeaders() }
    ).pipe(catchError(this.handleError));
  }

  // 📋 OBTENIR LES DÉTAILS D'UN GROUPE
  getGroupDetails(conversationId: string): Observable<any> {
    return this.http.get(`http://localhost:3000/api/groups/${conversationId}/details`,
      { headers: this.authService.getAuthHeaders() }
    ).pipe(catchError(this.handleError));
  }

  // ================================================
  // GESTION DES CONVERSATIONS (US023 & US025)
  // ================================================

  // 🗑️ SUPPRIMER UNE CONVERSATION
  deleteConversation(conversationId: string): Observable<any> {
    return this.http.delete(`http://localhost:3000/api/messages/conversations/${conversationId}`,
      { headers: this.authService.getAuthHeaders() }
    ).pipe(catchError(this.handleError));
  }

  // 🚪 QUITTER UN GROUPE
  leaveGroup(conversationId: string): Observable<any> {
    return this.http.post(`http://localhost:3000/api/groups/${conversationId}/leave`, {},
      { headers: this.authService.getAuthHeaders() }
    ).pipe(catchError(this.handleError));
  }

  // ================================================
  // GESTION D'ERREURS
  // ================================================

  private handleError = (error: any) => {
    console.error('❌ Erreur ConversationService:', error);
    return throwError(() => error);
  };
}