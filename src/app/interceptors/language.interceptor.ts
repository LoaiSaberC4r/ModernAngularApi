import { inject } from '@angular/core';
import { HttpInterceptorFn } from '@angular/common/http';
import { Observable } from 'rxjs';

export const LanguageInterceptor: HttpInterceptorFn = (req, next) => {
  const clone = req.clone({
    setHeaders: {
      'Accept-Language': 'en',
      'X-Language': 'en',
      'Prefer-Language': 'en',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
    },
    params: req.params.set('lang', 'en'),
  });

  return next(clone);
};
