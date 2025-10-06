import { Component, HostListener, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { SwitcherLangComponent } from '../../Shared/language-switcher/switcher-lang-component/switcher-lang-component';
import { LanguageService } from '../../Services/Language/language-service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, SwitcherLangComponent],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  isMenuOpen = false;
  private router = inject(Router);
  public langService = inject(LanguageService);

  constructor() {
    this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) this.isMenuOpen = false;
    });
  }

  // Getter بسيط نستخدمه في الـHTML
  get isAr(): boolean {
    return this.langService.current === 'ar';
  }

  toggleMenu(): void {
    this.isMenuOpen = !this.isMenuOpen;
  }

  @HostListener('window:resize')
  onResize(): void {
    if (window.innerWidth >= 992) this.isMenuOpen = false;
  }
}
