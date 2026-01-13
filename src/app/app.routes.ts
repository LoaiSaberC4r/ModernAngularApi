import { Routes } from '@angular/router';
import { MainLayoutComponent } from './Shared/Layout/main-layout/main-layout.component';
import { authGuard } from './Shared/Guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'trafficSignal', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () => import('./Feature/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'map',
        loadComponent: () =>
          import('./Feature/greenwaycomponent/greenwaycomponent').then((m) => m.Greenwaycomponent),
      },
      {
        path: 'trafficSignal',
        loadComponent: () =>
          import('./Feature/sign-box-component/sign-box-component').then((m) => m.SignBoxComponent),
      },
      {
        path: 'trafficController',
        loadComponent: () =>
          import('./Feature/sign-box-controller/sign-box-controller').then(
            (m) => m.SignBoxController
          ),
      },
      {
        path: 'trafficController/edit-sign-box/:id',
        loadComponent: () =>
          import('./Feature/sign-box-edit-component/sign-box-edit-component').then(
            (m) => m.SignBoxEditComponent
          ),
      },
      {
        path: 'mapview',
        loadComponent: () =>
          import('./Feature/mapviewcomponent/mapviewcomponent').then((m) => m.Mapviewcomponent),
      },
      {
        path: 'template',
        loadComponent: () =>
          import('./Feature/templatecomponent/templatecomponent').then((m) => m.Templatecomponent),
      },
      {
        path: 'trafficWizard',
        loadComponent: () =>
          import('./Feature/traffic-wizard/traffic-wizard').then((m) => m.TrafficWizard),
      },
    ],
  },

  { path: '**', redirectTo: 'map' },
];
