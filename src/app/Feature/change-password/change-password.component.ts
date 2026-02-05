import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../Services/Auth/auth.service';
import { ChangePasswordRequest } from '../../Domain/Entity/Auth/ChangePasswordRequest/ChangePasswordRequest';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './change-password.component.html',
  styleUrls: ['./change-password.component.css'],
})
export class ChangePasswordComponent {
  private fb = inject(FormBuilder);
  authService = inject(AuthService);

  hideCurrentPassword = signal(true);
  hideNewPassword = signal(true);
  hideConfirmPassword = signal(true);

  changePasswordForm: FormGroup;

  constructor() {
    this.changePasswordForm = this.fb.group({
      currentPassword: ['', [Validators.required, Validators.minLength(6)]],
      newPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    });
  }

  togglePasswordVisibility(field: 'current' | 'new' | 'confirm', event: MouseEvent) {
    event.preventDefault();
    if (field === 'current') {
      this.hideCurrentPassword.update((val) => !val);
    } else if (field === 'new') {
      this.hideNewPassword.update((val) => !val);
    } else {
      this.hideConfirmPassword.update((val) => !val);
    }
  }

  onSubmit() {
    if (this.changePasswordForm.invalid) {
      this.changePasswordForm.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = this.changePasswordForm.value;

    if (newPassword !== confirmPassword) {
      this.authService.errorMessage.set('كلمة المرور الجديدة غير متطابقة / Passwords do not match');
      return;
    }

    const request: ChangePasswordRequest = {
      currentPassword,
      newPassword,
    };

    this.authService.changeInitialPassword(request).subscribe();
  }
}
