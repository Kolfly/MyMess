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

  // Si l'authentification est déjà vérifiée et positive
  if (isInitialized && isAuth) {
    console.log('🛡️ AuthGuard: SUCCÈS - Déjà authentifié');
    return of(true);
  }

  // Si l'authentification est déjà vérifiée mais négative
  if (isInitialized && !isAuth) {
    console.log('🛡️ AuthGuard: ÉCHEC - Token invalide (déjà vérifié)');
    router.navigate(['/login']);
    return of(false);
  }

  // Attendre la vérification si elle est en cours
  console.log('🛡️ AuthGuard: ATTENTE - Vérification en cours...');
  
  return authService.isAuthenticated$.pipe(
    filter(() => {
      const currentlyInitialized = authService.isAuthInitialized();
      console.log('🛡️ AuthGuard: Poll initialization:', currentlyInitialized);
      return currentlyInitialized;
    }),
    take(1),
    timeout(2000),
    map(isAuthenticated => {
      console.log('🛡️ AuthGuard: Résultat final après attente =', isAuthenticated);
      if (!isAuthenticated) {
        console.log('🛡️ AuthGuard: ÉCHEC FINAL - Redirection vers /login');
        router.navigate(['/login']);
        return false;
      }
      console.log('🛡️ AuthGuard: SUCCÈS FINAL - Accès autorisé');
      return true;
    }),
    catchError((error) => {
      console.error('🛡️ AuthGuard: ERREUR/TIMEOUT:', error);
      router.navigate(['/login']);
      return of(false);
    })
  );
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
      timeout(2000),
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