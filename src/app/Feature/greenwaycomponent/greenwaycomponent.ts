import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  NgZone,
  HostListener,
  inject,
} from '@angular/core';
import * as L from 'leaflet';

const defaultIcon = L.icon({
  iconUrl: '../../../assets/img/marker-green-40.png',
  shadowUrl: '../../../assets/img/marker-green.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

@Component({
  selector: 'app-greenwaycomponent',
  imports: [],
  templateUrl: './greenwaycomponent.html',
  styleUrl: './greenwaycomponent.css',
})
export class Greenwaycomponent {}
