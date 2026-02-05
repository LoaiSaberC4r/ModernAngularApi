import {
  ApplicationConfig,
  importProvidersFrom,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
  APP_INITIALIZER,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { languageInterceptorFn } from './interceptors/LanguageInterceptorFn';
import { authInterceptor } from './Shared/Interceptors/auth.interceptor';
import { routes } from './app.routes';
import { RouteReuseStrategy } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { AppRouteReuseStrategy } from './Shared/routing/app-route-reuse-strategy';
import { OfflineWarmupService } from './Services/Map/offline-warmup.service';

function initializeApp(warmup: OfflineWarmupService) {
  return () => warmup.warmup();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, languageInterceptorFn])),
    provideNoopAnimations(),
    importProvidersFrom(MatSnackBarModule),
    { provide: RouteReuseStrategy, useClass: AppRouteReuseStrategy },
    {
      provide: APP_INITIALIZER,
      useFactory: initializeApp,
      deps: [OfflineWarmupService],
      multi: true,
    },
  ],
};
