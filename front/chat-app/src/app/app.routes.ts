import { Routes } from '@angular/router';
import { authGuard, noAuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  { 
    path: '', 
    loadComponent: () => import('./components/chat/chat').then(c => c.Chat),
    canActivate: [authGuard]
  },
  { 
    path: 'login', 
    loadComponent: () => import('./components/login/login').then(c => c.Login),
    canActivate: [noAuthGuard]
  },
  { 
    path: 'register', 
    loadComponent: () => import('./components/register/register').then(c => c.Register),
    canActivate: [noAuthGuard]
  },
  { 
    path: 'chat', 
    loadComponent: () => import('./components/chat/chat').then(c => c.Chat),
    canActivate: [authGuard]
  },
  { path: '**', redirectTo: '/chat' }
];
