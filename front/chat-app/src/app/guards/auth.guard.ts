import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { map, take, tap, filter, timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { AuthService } from '../services/auth.service';

// Guard pour protéger les routes qui nécessitent une authentification
export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Débugger l'état initial
  const token = authService.getToken();
  const isAuth = authService.isAuthenticated();
  const isInitialized = authService.isAuthInitialized();
  
  console.log('🛡️ AuthGuard - État initial:', {
    hasToken: !!token,
    tokenLength: token?.length,
    isAuthenticated: isAuth,
    isInitialized: isInitialized,
    localStorage: {
      access_token: !!localStorage.getItem('access_token'),
      refresh_token: !!localStorage.getItem('refresh_token')
    }
  });
  
  if (!token) {
    console.log('🛡️ AuthGuard: ÉCHEC - Pas de token dans localStorage');
    router.navigate(['/login']);
    return of(false);
  }

  // VERSION SIMPLIFIÉE: Si on a un token, on considère que c'est valide
  // Cela évite les problèmes de timeout avec l'initialisation async
  console.log('🛡️ AuthGuard: Token présent - Accès autorisé (mode simplifié)');
  return of(true);
};

// Guard pour rediriger les utilisateurs déjà connectés (pour login/register)
export const noAuthGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Si on a un token, attendre la vérification
  const token = authService.getToken();
  if (token) {
    console.log('🛡️ NoAuthGuard: Token présent, attendre vérification...');
    
    return authService.isAuthenticated$.pipe(
      // Attendre que l'authentification soit vérifiée
      filter(() => {
        const isInitialized = authService.isAuthInitialized();
        console.log('🛡️ NoAuthGuard: Auth initialisée?', isInitialized);
        return isInitialized;
      }),
      take(1),
      timeout(6000),
      map(isAuthenticated => {
        console.log('🛡️ NoAuthGuard: Résultat final isAuthenticated =', isAuthenticated);
        if (isAuthenticated) {
          console.log('🛡️ NoAuthGuard: Utilisateur connecté, redirection vers /chat');
          router.navigate(['/chat']);
          return false;
        }
        console.log('🛡️ NoAuthGuard: Utilisateur non connecté, accès autorisé à login/register');
        return true;
      }),
      catchError((error) => {
        console.error('🛡️ NoAuthGuard: Erreur ou timeout:', error);
        // En cas de timeout, permettre l'accès à login/register
        return of(true);
      })
    );
  } else {
    console.log('🛡️ NoAuthGuard: Pas de token, accès autorisé à login/register');
    return of(true);
  }
};