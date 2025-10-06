import { Component, signal, computed, inject, HostListener } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { AppLang, LanguageService } from '../../../Services/Language/language-service';

@Component({
  selector: 'app-switcher-lang-component',
  standalone: true,
  imports: [CommonModule, NgIf], // <-- أضفنا NgIf صراحة
  templateUrl: './switcher-lang-component.html',
  styleUrls: ['./switcher-lang-component.css'],
})
export class SwitcherLangComponent {
  private langService = inject(LanguageService);

  // Signal قابلة للكتابة
  open = signal<boolean>(false);
  current = computed(() => this.langService.current);

  toggle() {
    this.open.update((v) => !v);
  }
  close() {
    this.open.set(false);
  }

  pick(lang: AppLang) {
    this.langService.set(lang);
    this.open.set(false);
  }

  // إغلاق القائمة عند الضغط Escape
  @HostListener('document:keydown.escape')
  onEsc() {
    this.close();
  }
}
