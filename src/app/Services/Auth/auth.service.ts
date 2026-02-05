import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { environment } from '../../Shared/environment/environment';
import { LoginRequest } from '../../Domain/Entity/Auth/LoginRequest/LoginRequest';
import { LoginResponse } from '../../Domain/Entity/Auth/LoginResponse/LoginResponse';
import { ChangePasswordRequest } from '../../Domain/Entity/Auth/ChangePasswordRequest/ChangePasswordRequest';
import { TokenData } from '../../Domain/Entity/Auth/TokenData/TokenData';
import { ToasterService } from '../Toster/toaster-service';

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

  private toaster = inject(ToasterService);
  private refreshTimer?: any;

  constructor() {
    this.initSession();
  }

  private initSession() {
    const token = this.getToken();
    if (token) {
      this.scheduleRefresh(token);
    }
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    return this.http.post<LoginResponse>(`${environment.baseUrl}/Auth/Login`, credentials).pipe(
      tap((response) => {
        // Store token
        localStorage.setItem('authToken', response.token.token);
        this.scheduleRefresh(response.token.token);

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
        this.toaster.errorFromBackend(error);
        console.error('Login error:', error);
        return of(null as any);
      }),
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
        this.toaster.errorFromBackend(error);
        console.error('Change password error:', error);
        return of(null);
      }),
    );
  }

  logout(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }
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

  private refreshToken(): void {
    this.http.post<any>(`${environment.baseUrl}/Auth/RefreshToken`, {}).subscribe({
      next: (resp) => {
        const newToken = resp.newToken;
        if (newToken) {
          localStorage.setItem('authToken', newToken);
          this.scheduleRefresh(newToken);
          console.log('[Auth] Token refreshed successfully');
        }
      },
      error: (err) => {
        console.error('[Auth] Refresh token failed', err);
        this.logout();
      },
    });
  }

  private decodeToken(token: string): any {
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload));
    } catch (e) {
      return null;
    }
  }

  private scheduleRefresh(token: string): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) return;

    const expiryTime = decoded.exp * 1000; // to ms
    const currentTime = Date.now();
    const timeout = expiryTime - currentTime - 3 * 60 * 1000; // 3 minutes before

    if (timeout > 0) {
      console.log(`[Auth] Scheduling refresh in ${Math.round(timeout / 1000 / 60)} minutes`);
      this.refreshTimer = setTimeout(() => this.refreshToken(), timeout);
    } else {
      // If already expired or less than 3 mins left, refresh now
      this.refreshToken();
    }
  }

  private getUserFromStorage(): UserData | null {
    const stored = localStorage.getItem('currentUser');
    return stored ? JSON.parse(stored) : null;
  }
}
