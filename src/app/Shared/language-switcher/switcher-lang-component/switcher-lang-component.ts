import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService } from '../../../Services/Language/language-service';
import { AppLang } from '../../../Domain/Entity/Language/AppLang/AppLang';

@Component({
  selector: 'app-switcher-lang-component',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './switcher-lang-component.html',
  styleUrls: ['./switcher-lang-component.css'],
})
export class SwitcherLangComponent {
  public langService = inject(LanguageService);

  toggleNow(ev?: MouseEvent) {
    (ev?.currentTarget as HTMLElement)?.blur?.();

    const next: AppLang = this.langService.current === 'ar' ? 'en' : 'ar';
    this.langService.set(next);
  }
}
