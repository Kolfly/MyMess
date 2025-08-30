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
  
  
  if (!token) {
    router.navigate(['/login']);
    return of(false);
  }

  // VERSION SIMPLIFIÉE: Si on a un token, on considère que c'est valide
  // Cela évite les problèmes de timeout avec l'initialisation async
  return of(true);
};

// Guard pour rediriger les utilisateurs déjà connectés (pour login/register)
export const noAuthGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Si on a un token, attendre la vérification
  const token = authService.getToken();
  if (token) {
    
    return authService.isAuthenticated$.pipe(
      // Attendre que l'authentification soit vérifiée
      filter(() => {
        const isInitialized = authService.isAuthInitialized();
        return isInitialized;
      }),
      take(1),
      timeout(6000),
      map(isAuthenticated => {
        if (isAuthenticated) {
          router.navigate(['/chat']);
          return false;
        }
        return true;
      }),
      catchError((error) => {
        // En cas de timeout, permettre l'accès à login/register
        return of(true);
      })
    );
  } else {
    return of(true);
  }
};