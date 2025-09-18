import { Component, OnInit, OnDestroy, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { NgZone } from '@angular/core';
import * as L from 'leaflet';
@Component({
  selector: 'app-mapviewcomponent',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './mapviewcomponent.html',
  styleUrl: './mapviewcomponent.css',
})
export class Mapviewcomponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;

  private ngZone = inject(NgZone);
  map!: L.Map;
  resizeObserver!: ResizeObserver;

  readonly defaultCenter: L.LatLngExpression = [30.0444, 31.2357];
  readonly defaultZoom = 13;

  ngOnInit(): void {
    this.initMap();
    this.observeResize();
  }

  ngOnDestroy(): void {
    if (this.map) this.map.remove();
    if (this.resizeObserver) this.resizeObserver.disconnect();
  }

  private initMap() {
    this.map = L.map(this.mapContainer.nativeElement, {
      center: this.defaultCenter,
      zoom: this.defaultZoom,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.map);

    L.control.scale({ position: 'bottomleft' }).addTo(this.map);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const userLocation: L.LatLngExpression = [pos.coords.latitude, pos.coords.longitude];
        this.map.setView(userLocation, 15);
        L.marker(userLocation).addTo(this.map).bindPopup('You are here!');
      });
    }
  }

  private observeResize() {
    this.resizeObserver = new ResizeObserver(() =>
      setTimeout(() => this.map.invalidateSize(), 100)
    );
    this.resizeObserver.observe(this.mapContainer.nativeElement);
  }
}
