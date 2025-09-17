import { Routes } from '@angular/router';
import { Greenwaycomponent } from './Feature/greenwaycomponent/greenwaycomponent';
import { SignBoxComponent } from './Feature/sign-box-component/sign-box-component';
import { SignBoxController } from './Feature/sign-box-controller/sign-box-controller';
import { Mapviewcomponent } from './Feature/mapviewcomponent/mapviewcomponent';
import { TrafficPointConfigComponent } from './Feature/traffic-point-config-component/traffic-point-config-component';
import { Templatecomponent } from './Feature/templatecomponent/templatecomponent';

export const routes: Routes = [
  { path: '', redirectTo: 'map', pathMatch: 'full' },
  { path: 'map', component: Greenwaycomponent },
  { path: 'trafficSignal', component: SignBoxComponent },
  { path: 'trafficController', component: SignBoxController },

  { path: 'mapview', component: Mapviewcomponent },
  { path: 'trafficPointConfig', component: TrafficPointConfigComponent },
  { path: 'template', component: Templatecomponent },
  { path: '**', redirectTo: 'map' },
];
