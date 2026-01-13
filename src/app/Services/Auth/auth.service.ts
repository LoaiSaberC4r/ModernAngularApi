import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { environment } from '../../Shared/environment/environment';
import { LoginRequest } from '../../Domain/Entity/Auth/LoginRequest';
import { LoginResponse } from '../../Domain/Entity/Auth/LoginResponse';
import { ChangePasswordRequest } from '../../Domain/Entity/Auth/ChangePasswordRequest';
import { TokenData } from '../../Domain/Entity/Auth/TokenData';

interface UserData {
  email: string;
  role: string;
  permissions: string[];
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  currentUser = signal<UserData | null>(this.getUserFromStorage());
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  login(credentials: LoginRequest): Observable<LoginResponse> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    return this.http.post<LoginResponse>(`${environment.baseUrl}/Auth/Login`, credentials).pipe(
      tap((response) => {
        // Store token
        localStorage.setItem('authToken', response.token.token);

        // Store user data
        const userData: UserData = {
          email: credentials.email,
          role: response.token.roleName,
          permissions: response.token.permissions,
        };
        localStorage.setItem('currentUser', JSON.stringify(userData));
        this.currentUser.set(userData);

        this.isLoading.set(false);

        // Handle password change requirement
        if (response.requiresPasswordChange) {
          this.router.navigate(['/change-password']);
        } else {
          this.router.navigate(['/map']);
        }
      }),
      catchError((error) => {
        this.isLoading.set(false);
        const errorMsg = error?.error?.message || 'فشل تسجيل الدخول / Login failed';
        this.errorMessage.set(errorMsg);
        console.error('Login error:', error);
        return of(null as any);
      })
    );
  }

  changeInitialPassword(request: ChangePasswordRequest): Observable<any> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    return this.http.post(`${environment.baseUrl}/Auth/change-initial-password`, request).pipe(
      tap(() => {
        this.isLoading.set(false);
        // After password change, redirect to home/map
        this.router.navigate(['/map']);
      }),
      catchError((error) => {
        this.isLoading.set(false);
        const errorMsg = error?.error?.message || 'فشل تغيير كلمة المرور / Password change failed';
        this.errorMessage.set(errorMsg);
        console.error('Change password error:', error);
        return of(null);
      })
    );
  }

  logout(): void {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    const token = localStorage.getItem('authToken');
    return !!token && this.currentUser() !== null;
  }

  getToken(): string | null {
    return localStorage.getItem('authToken');
  }

  hasPermission(permission: string): boolean {
    const user = this.currentUser();
    return user?.permissions?.includes(permission) ?? false;
  }

  private getUserFromStorage(): UserData | null {
    const stored = localStorage.getItem('currentUser');
    return stored ? JSON.parse(stored) : null;
  }
}
