import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService, User } from '../../services/auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-profile-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule
  ],
  template: `
    <div class="profile-dialog">
      <mat-dialog-content>
        <div class="profile-header">
          <div class="profile-avatar">
            <mat-icon>account_circle</mat-icon>
          </div>
          <h2>Mon profil</h2>
        </div>

        <form [formGroup]="profileForm" (ngSubmit)="onSave()">
          <!-- Nom d'utilisateur (lecture seule) -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Nom d'utilisateur</mat-label>
            <input matInput [value]="currentUser()?.username" readonly>
            <mat-icon matSuffix>person</mat-icon>
          </mat-form-field>

          <!-- Email (lecture seule pour l'instant) -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Email</mat-label>
            <input matInput [value]="currentUser()?.email" readonly>
            <mat-icon matSuffix>email</mat-icon>
          </mat-form-field>

          <!-- Nom d'affichage (modifiable) -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Nom d'affichage</mat-label>
            <input 
              matInput 
              formControlName="displayName"
              placeholder="Votre nom d'affichage"
              maxlength="50">
            <mat-icon matSuffix>badge</mat-icon>
            <mat-hint>Ce nom sera visible par les autres utilisateurs</mat-hint>
            @if (profileForm.get('displayName')?.hasError('required')) {
              <mat-error>Le nom d'affichage est requis</mat-error>
            }
            @if (profileForm.get('displayName')?.hasError('minlength')) {
              <mat-error>Le nom doit contenir au moins 2 caractères</mat-error>
            }
          </mat-form-field>

          <!-- Statut (modifiable) -->
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Statut</mat-label>
            <mat-select formControlName="status">
              <mat-option value="online">
                <div class="status-option">
                  <span class="status-indicator online"></span>
                  En ligne
                </div>
              </mat-option>
              <mat-option value="away">
                <div class="status-option">
                  <span class="status-indicator away"></span>
                  Absent
                </div>
              </mat-option>
              <mat-option value="busy">
                <div class="status-option">
                  <span class="status-indicator busy"></span>
                  Occupé
                </div>
              </mat-option>
            </mat-select>
            <mat-icon matSuffix>visibility</mat-icon>
          </mat-form-field>
        </form>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button 
          mat-button 
          type="button"
          (click)="onCancel()"
          [disabled]="isLoading()">
          Annuler
        </button>
        <button 
          mat-raised-button 
          color="primary"
          type="button"
          (click)="onSave()"
          [disabled]="profileForm.invalid || isLoading() || !hasChanges()">
          @if (isLoading()) {
            <mat-spinner diameter="18" style="margin-right: 8px;"></mat-spinner>
          }
          Sauvegarder
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styleUrl: './profile-dialog.component.scss'
})
export class ProfileDialogComponent {
  private dialogRef = inject(MatDialogRef<ProfileDialogComponent>);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);

  currentUser = signal<any>(null);
  isLoading = signal(false);

  profileForm: FormGroup;
  initialValues: any;

  constructor() {
    // S'abonner aux données utilisateur
    this.authService.currentUser$.subscribe(user => {
      this.currentUser.set(user);
      if (user && this.profileForm) {
        this.updateFormWithUserData(user);
      }
    });

    // Obtenir l'utilisateur actuel
    const currentUserValue = this.currentUser();
    
    this.profileForm = this.fb.group({
      displayName: [
        currentUserValue?.displayName || '', 
        [Validators.required, Validators.minLength(2), Validators.maxLength(50)]
      ],
      status: [currentUserValue?.status || 'online', [Validators.required]]
    });

    // Sauvegarder les valeurs initiales pour détecter les changements
    this.initialValues = this.profileForm.value;
  }

  private updateFormWithUserData(user: any): void {
    if (this.profileForm) {
      this.profileForm.patchValue({
        displayName: user.displayName || '',
        status: user.status || 'online'
      });
      this.initialValues = this.profileForm.value;
    }
  }

  hasChanges(): boolean {
    const currentValues = this.profileForm.value;
    return JSON.stringify(currentValues) !== JSON.stringify(this.initialValues);
  }

  onSave(): void {
    if (this.profileForm.valid && this.hasChanges()) {
      this.isLoading.set(true);
      
      const formData = this.profileForm.value;
      
      this.authService.updateProfile({
        displayName: formData.displayName,
        // Note: le statut pourrait nécessiter une API séparée selon l'implémentation backend
        status: formData.status
      }).subscribe({
        next: (response) => {
          this.isLoading.set(false);
          if (response.success) {
            this.snackBar.open('Profil mis à jour avec succès', 'Fermer', {
              duration: 3000,
              panelClass: ['success-snackbar']
            });
            this.dialogRef.close(true);
          } else {
            this.snackBar.open(response.message || 'Erreur lors de la mise à jour', 'Fermer', {
              duration: 4000,
              panelClass: ['error-snackbar']
            });
          }
        },
        error: (error) => {
          this.isLoading.set(false);
          this.snackBar.open('Erreur lors de la mise à jour du profil', 'Fermer', {
            duration: 4000,
            panelClass: ['error-snackbar']
          });
        }
      });
    }
  }

  onCancel(): void {
    if (this.hasChanges()) {
      // Pourrait ajouter une confirmation de sortie ici
    }
    this.dialogRef.close(false);
  }
}