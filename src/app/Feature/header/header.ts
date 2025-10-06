import { Component, HostListener, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SwitcherLangComponent } from '../../Shared/language-switcher/switcher-lang-component/switcher-lang-component';

@Component({
  selector: 'app-header',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SwitcherLangComponent],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  isMenuOpen = false;
  private router = inject(Router);

  constructor() {
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) this.isMenuOpen = false;
    });
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  @HostListener('window:resize')
  onResize(): void {
    if (window.innerWidth >= 992) this.isMenuOpen = false;
  }
}
