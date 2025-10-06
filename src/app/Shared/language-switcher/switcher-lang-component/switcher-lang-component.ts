import { Component } from '@angular/core';

@Component({
  selector: 'app-switcher-lang-component',
  imports: [],
  templateUrl: './switcher-lang-component.html',
  styleUrl: './switcher-lang-component.css',
})
export class SwitcherLangComponent {
  constructor() {}

  toggleLanguage(): void {
    const lang = localStorage.getItem('lang') === 'en' ? 'ar' : 'en';
    localStorage.setItem('lang', lang);
    location.reload();
  }
}
