import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap, catchError, throwError, timeout } from 'rxjs';

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  status: 'online' | 'offline' | 'away' | 'busy';
}

export interface AuthResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    accessToken: string;
    refreshToken: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = 'http://localhost:3000/api/auth';
  private readonly TOKEN_KEY = 'access_token';
  private readonly REFRESH_TOKEN_KEY = 'refresh_token';
  
  private http = inject(HttpClient);
  private router = inject(Router);

  // État de l'utilisateur connecté
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private isAuthenticatedSubject = new BehaviorSubject<boolean>(false);
  private authInitialized = false;

  public currentUser$ = this.currentUserSubject.asObservable();
  public isAuthenticated$ = this.isAuthenticatedSubject.asObservable();

  constructor() {
    this.initializeAuth();
  }

  // ================================================
  // INITIALISATION
  // ================================================

  private initializeAuth(): void {
    const token = this.getToken();
    if (token) {
      console.log('🔍 Token trouvé, vérification en cours...');
      
      // Vérifier si le token est encore valide avec timeout plus court
      this.getMe().pipe(
        timeout(2000)
      ).subscribe({
        next: (response) => {
          if (response.success) {
            console.log('✅ Token valide, utilisateur authentifié');
            this.currentUserSubject.next(response.data.user);
            this.isAuthenticatedSubject.next(true);
          } else {
            console.log('❌ Token invalide, déconnexion');
            this.logout();
          }
          this.authInitialized = true;
        },
        error: () => {
          console.log('❌ Erreur validation token, déconnexion');
          this.logout();
          this.authInitialized = true;
        }
      });
    } else {
      console.log('❌ Pas de token trouvé');
      this.isAuthenticatedSubject.next(false);
      this.authInitialized = true;
    }
  }

  // ================================================
  // AUTHENTIFICATION
  // ================================================

  register(userData: {
    username: string;
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/register`, userData)
      .pipe(
        tap(response => {
          if (response.success) {
            this.handleAuthSuccess(response);
          }
        }),
        catchError(this.handleError)
      );
  }

  login(credentials: { 
    email: string; 
    password: string; 
  }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/login`, credentials)
      .pipe(
        tap(response => {
          if (response.success) {
            this.handleAuthSuccess(response);
          }
        }),
        catchError(this.handleError)
      );
  }

  logout(): void {
    // Appeler l'API de logout si connecté
    if (this.isAuthenticated()) {
      this.http.post(`${this.API_URL}/logout`, {}).subscribe();
    }

    // Nettoyer le stockage local
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    
    // Réinitialiser les sujets
    this.currentUserSubject.next(null);
    this.isAuthenticatedSubject.next(false);
    
    // Rediriger vers la page de connexion
    this.router.navigate(['/login']);
  }

  // ================================================
  // GESTION DES TOKENS
  // ================================================

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  refreshToken(): Observable<AuthResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return throwError(() => new Error('Aucun refresh token disponible'));
    }

    return this.http.post<AuthResponse>(`${this.API_URL}/refresh`, {
      refreshToken
    }).pipe(
      tap(response => {
        if (response.success) {
          this.handleAuthSuccess(response);
        }
      }),
      catchError(this.handleError)
    );
  }

  // ================================================
  // PROFIL UTILISATEUR
  // ================================================

  getMe(): Observable<{ success: boolean; data: { user: User } }> {
    return this.http.get<{ success: boolean; data: { user: User } }>(`${this.API_URL}/me`, {
      headers: this.getAuthHeaders()
    })
      .pipe(catchError(this.handleError));
  }

  updateProfile(profileData: {
    displayName?: string;
    email?: string;
  }): Observable<any> {
    return this.http.put(`${this.API_URL}/profile`, profileData, {
      headers: this.getAuthHeaders()
    })
      .pipe(
        tap((response: any) => {
          if (response.success && response.data.user) {
            this.currentUserSubject.next(response.data.user);
          }
        }),
        catchError(this.handleError)
      );
  }

  searchUsers(query: string, limit: number = 10): Observable<any> {
    const params = { q: query, limit: limit.toString() };
    return this.http.get(`${this.API_URL}/search`, { 
      params,
      headers: this.getAuthHeaders()
    })
      .pipe(catchError(this.handleError));
  }

  changePassword(passwordData: {
    currentPassword: string;
    newPassword: string;
  }): Observable<any> {
    return this.http.put(`${this.API_URL}/change-password`, passwordData, {
      headers: this.getAuthHeaders()
    })
      .pipe(catchError(this.handleError));
  }

  // ================================================
  // UTILITAIRES
  // ================================================

  isAuthenticated(): boolean {
    return this.isAuthenticatedSubject.value;
  }

  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  isAuthInitialized(): boolean {
    return this.authInitialized;
  }

  // Créer les headers d'autorisation pour les requêtes
  getAuthHeaders(): { [key: string]: string } {
    const token = this.getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  // ================================================
  // MÉTHODES PRIVÉES
  // ================================================

  private handleAuthSuccess(response: AuthResponse): void {
    const { user, accessToken, refreshToken } = response.data;
    
    // Stocker les tokens
    localStorage.setItem(this.TOKEN_KEY, accessToken);
    localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    
    // Mettre à jour les sujets
    this.currentUserSubject.next(user);
    this.isAuthenticatedSubject.next(true);
  }

  private handleError = (error: any) => {
    console.error('❌ Erreur AuthService:', error);
    
    // Si erreur 401, token expiré
    if (error.status === 401) {
      this.logout();
    }
    
    return throwError(() => error);
  };
}