// src/app/Core/i18n/language-interceptor.ts
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { LanguageService } from '../Services/Language/language-service';

export const languageInterceptorFn: HttpInterceptorFn = (req, next) => {
  const lang = inject(LanguageService).current;
  const cloned = req.clone({
    setHeaders: { 'Accept-Language': lang },
  });
  return next(cloned);
};
