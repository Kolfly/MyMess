import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatCheckboxModule
  ],
  templateUrl: './register.html',
  styleUrl: './register.scss'
})
export class Register {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  registerForm: FormGroup;
  isLoading = false;
  hidePassword = true;
  hideConfirmPassword = true;

  constructor() {
    this.registerForm = this.fb.group({
      username: ['', [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(20),
        Validators.pattern(/^[a-zA-Z0-9_-]+$/)
      ]],
      email: ['', [
        Validators.required, 
        Validators.email
      ]],
      password: ['', [
        Validators.required,
        Validators.minLength(6),
        Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      ]],
      confirmPassword: ['', [
        Validators.required
      ]],
      firstName: ['', [
        Validators.maxLength(50)
      ]],
      lastName: ['', [
        Validators.maxLength(50)
      ]],
      acceptTerms: [false, [
        Validators.requiredTrue
      ]]
    }, {
      validators: this.passwordMatchValidator
    });

    // Rediriger si déjà connecté
    this.authService.isAuthenticated$.subscribe(isAuth => {
      if (isAuth) {
        this.router.navigate(['/chat']);
      }
    });
  }

  // Validateur personnalisé pour vérifier que les mots de passe correspondent
  passwordMatchValidator(control: AbstractControl) {
    const password = control.get('password');
    const confirmPassword = control.get('confirmPassword');
    
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    
    return null;
  }

  onSubmit(): void {
    if (this.registerForm.valid && !this.isLoading) {
      this.isLoading = true;
      
      const formData = this.registerForm.value;
      const registerData = {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName || undefined,
        lastName: formData.lastName || undefined
      };

      this.authService.register(registerData).subscribe({
        next: (response) => {
          this.isLoading = false;
          if (response.success) {
            this.snackBar.open(
              `Inscription réussie ! Bienvenue ${response.data.user.displayName || response.data.user.username} !`, 
              'Fermer', 
              {
                duration: 5000,
                panelClass: ['success-snackbar']
              }
            );
            
            // Rediriger vers le chat après inscription réussie
            this.router.navigate(['/chat']);
          }
        },
        error: (error) => {
          this.isLoading = false;
          const message = error.error?.message || 'Erreur lors de l\'inscription';
          this.snackBar.open(message, 'Fermer', {
            duration: 5000,
            panelClass: ['error-snackbar']
          });
          
          // Si erreur de validation spécifique, marquer les champs concernés
          if (error.error?.errors) {
            this.handleValidationErrors(error.error.errors);
          }
        }
      });
    } else {
      // Marquer tous les champs comme touchés pour afficher les erreurs
      this.markFormGroupTouched();
    }
  }

  private handleValidationErrors(errors: any[]): void {
    errors.forEach(error => {
      const field = this.getFieldNameFromPath(error.path);
      if (field && this.registerForm.get(field)) {
        this.registerForm.get(field)?.setErrors({ serverError: error.message });
      }
    });
  }

  private getFieldNameFromPath(path: string): string | null {
    const mapping: { [key: string]: string } = {
      'username': 'username',
      'email': 'email', 
      'password': 'password',
      'firstName': 'firstName',
      'lastName': 'lastName'
    };
    return mapping[path] || null;
  }

  private markFormGroupTouched(): void {
    Object.keys(this.registerForm.controls).forEach(key => {
      const control = this.registerForm.get(key);
      control?.markAsTouched();
      
      if (control && typeof control === 'object' && 'controls' in control) {
        this.markFormGroupTouched();
      }
    });
  }

  // Méthodes pour les messages d'erreur
  getUsernameErrorMessage(): string {
    const usernameControl = this.registerForm.get('username');
    if (usernameControl?.hasError('required')) {
      return 'Le nom d\'utilisateur est requis';
    }
    if (usernameControl?.hasError('minlength')) {
      return 'Le nom d\'utilisateur doit faire au moins 3 caractères';
    }
    if (usernameControl?.hasError('maxlength')) {
      return 'Le nom d\'utilisateur ne peut pas dépasser 20 caractères';
    }
    if (usernameControl?.hasError('pattern')) {
      return 'Le nom d\'utilisateur ne peut contenir que des lettres, chiffres, tirets et underscores';
    }
    if (usernameControl?.hasError('serverError')) {
      return usernameControl.errors?.['serverError'];
    }
    return '';
  }

  getEmailErrorMessage(): string {
    const emailControl = this.registerForm.get('email');
    if (emailControl?.hasError('required')) {
      return 'L\'email est requis';
    }
    if (emailControl?.hasError('email')) {
      return 'Format d\'email invalide';
    }
    if (emailControl?.hasError('serverError')) {
      return emailControl.errors?.['serverError'];
    }
    return '';
  }

  getPasswordErrorMessage(): string {
    const passwordControl = this.registerForm.get('password');
    if (passwordControl?.hasError('required')) {
      return 'Le mot de passe est requis';
    }
    if (passwordControl?.hasError('minlength')) {
      return 'Le mot de passe doit faire au moins 6 caractères';
    }
    if (passwordControl?.hasError('pattern')) {
      return 'Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre';
    }
    return '';
  }

  getConfirmPasswordErrorMessage(): string {
    const confirmPasswordControl = this.registerForm.get('confirmPassword');
    if (confirmPasswordControl?.hasError('required')) {
      return 'Veuillez confirmer le mot de passe';
    }
    if (confirmPasswordControl?.hasError('passwordMismatch')) {
      return 'Les mots de passe ne correspondent pas';
    }
    return '';
  }

  getFirstNameErrorMessage(): string {
    const firstNameControl = this.registerForm.get('firstName');
    if (firstNameControl?.hasError('maxlength')) {
      return 'Le prénom ne peut pas dépasser 50 caractères';
    }
    return '';
  }

  getLastNameErrorMessage(): string {
    const lastNameControl = this.registerForm.get('lastName');
    if (lastNameControl?.hasError('maxlength')) {
      return 'Le nom ne peut pas dépasser 50 caractères';
    }
    return '';
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}