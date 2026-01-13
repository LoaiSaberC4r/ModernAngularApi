import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  // Simple signal to track if user is logged in
  currentUser = signal<{ username: string } | null>(this.getUserFromStorage());

  constructor(private router: Router) {}

  login(username: string): void {
    const user = { username };
    localStorage.setItem('currentUser', JSON.stringify(user));
    this.currentUser.set(user);
    this.router.navigate(['/map']);
  }

  logout(): void {
    localStorage.removeItem('currentUser');
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return this.currentUser() !== null;
  }

  private getUserFromStorage(): { username: string } | null {
    const stored = localStorage.getItem('currentUser');
    return stored ? JSON.parse(stored) : null;
  }
}
