import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type AppLang = 'ar' | 'en';
@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  private readonly LS_KEY = 'app.lang';
  private readonly _lang$ = new BehaviorSubject<AppLang>(this.getInitialLang());

  readonly lang$ = this._lang$.asObservable();

  get current(): AppLang {
    return this._lang$.value;
  }

  set(lang: AppLang) {
    if (lang === this.current) return;
    localStorage.setItem(this.LS_KEY, lang);
    this.applyDomDirection(lang);
    this._lang$.next(lang);
  }

  private getInitialLang(): AppLang {
    const saved = localStorage.getItem(this.LS_KEY) as AppLang | null;
    const initial = saved ?? (navigator.language?.startsWith('ar') ? 'ar' : 'en');
    this.applyDomDirection(initial);
    return initial;
  }

  private applyDomDirection(lang: AppLang) {
    const dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', dir);
  }
}
