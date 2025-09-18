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
export class Greenwaycomponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;

  private ngZone = inject(NgZone);

  map!: L.Map;
  markers: L.Marker[] = [];
  lines: L.Polyline[] = [];
  resizeObserver!: ResizeObserver;

  isLoading = true;
  mapError: string | null = null;

  readonly defaultCenter: L.LatLngExpression = [51.505, -0.09];
  readonly defaultZoom = 13;

  ngOnInit(): void {
    this.initMap();
    this.observeResize();
  }

  ngOnDestroy(): void {
    if (this.map) this.map.remove();
    if (this.resizeObserver) this.resizeObserver.disconnect();
  }

  @HostListener('window:resize')
  onResize() {
    this.invalidateSize();
  }

  public initMap() {
    try {
      this.isLoading = true;
      this.mapError = null;

      this.map = L.map(this.mapContainer.nativeElement, {
        center: this.defaultCenter,
        zoom: this.defaultZoom,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap contributors',
      }).addTo(this.map);

      L.control.scale({ position: 'bottomleft' }).addTo(this.map);

      // click => add marker
      this.map.on('click', (e: L.LeafletMouseEvent) => this.addMarker(e.latlng));

      // fix tile loading
      this.map.whenReady(() => {
        this.isLoading = false;
        setTimeout(() => this.map.invalidateSize(), 200);

        this.getCurrentLocation();
      });
    } catch (err) {
      console.error(err);
      this.mapError = 'Map failed to load';
      this.isLoading = false;
    }
  }

  private observeResize() {
    this.resizeObserver = new ResizeObserver(() => this.invalidateSize());
    this.resizeObserver.observe(this.mapContainer.nativeElement);
  }

  private invalidateSize() {
    if (this.map) {
      setTimeout(() => this.map.invalidateSize(), 100);
    }
  }

  addMarker(latLng: L.LatLng) {
    const marker = L.marker(latLng, { draggable: true }).addTo(this.map);
    this.markers.push(marker);

    // حدث الخطوط لو اتحرك marker
    marker.on('drag', () => this.updateLines());

    // كل اتنين markers اعمل خط
    if (this.markers.length % 2 === 0) {
      const lastTwo = this.markers.slice(-2).map((m) => m.getLatLng());
      const line = L.polyline(lastTwo, { color: 'blue' }).addTo(this.map);
      this.lines.push(line);
    }
  }

  private updateLines() {
    this.lines.forEach((line, i) => {
      const m1 = this.markers[i * 2];
      const m2 = this.markers[i * 2 + 1];
      if (m1 && m2) {
        line.setLatLngs([m1.getLatLng(), m2.getLatLng()]);
      }
    });
  }

  clearMarkers() {
    this.markers.forEach((m) => this.map.removeLayer(m));
    this.lines.forEach((l) => this.map.removeLayer(l));
    this.markers = [];
    this.lines = [];
  }
  getCurrentLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;

          const latLng: L.LatLngExpression = [lat, lng];

          // حط marker
          const marker = L.marker(latLng, {
            draggable: false,
            icon: L.icon({
              iconUrl: 'https://cdn-icons-png.flaticon.com/512/447/447031.png',
              iconSize: [32, 32],
            }),
          }).addTo(this.map);

          this.map.setView(latLng, 15);

          this.markers.push(marker);
        },
        (error) => {
          console.error('Geolocation error:', error);
          this.mapError = 'Unable to fetch location';
        }
      );
    } else {
      this.mapError = 'Geolocation is not supported by this browser.';
    }
  }
}
