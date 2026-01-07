import {
  Component,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  NgZone,
  HostListener,
  inject,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Clipboard } from '@angular/cdk/clipboard';
import { LanguageService } from '../../Services/Language/language-service';
import * as L from 'leaflet';
import { ISignBoxControlService } from '../../Services/SignControlBox/isign-box-controlService';
import { CabinetSignalrService } from '../../Services/Signalr/cabinet-signalr.service';
import { CabinetStatusMessage } from '../../Domain/SignalR/cabinet-status-message';
import { FormsModule } from '@angular/forms';
import { ISignalrService } from '../../Services/Signalr/isignalr-service';

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
  imports: [FormsModule],
  templateUrl: './greenwaycomponent.html',
  styleUrl: './greenwaycomponent.css',
})
export class Greenwaycomponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;

  private ngZone = inject(NgZone);
  private clipboard = inject(Clipboard);
  private langService = inject(LanguageService);
  private destroyRef = inject(DestroyRef);

  private signBoxService = inject(ISignBoxControlService);
  private signalrService = inject(CabinetSignalrService);
  private globalSignalR = inject(ISignalrService);

  get isAr() {
    return this.langService.current === 'ar';
  }

  map!: L.Map;
  markers: L.Marker[] = [];
  lines: L.Polyline[] = [];
  resizeObserver!: ResizeObserver;

  isLoading = true;
  mapError: string | null = null;
  currentCoords: { lat: number; lng: number } | null = null;

  // Sidebar state
  inputLat: string = '';
  inputLng: string = '';

  cars: L.Marker[] = [];
  cabinetMarkers: L.Marker[] = [];

  // Map for O(1) access to markers by ID
  private cabinetMarkersMap = new Map<number, L.Marker>();

  readonly defaultCenter: L.LatLngExpression = [30.0444, 31.2357];
  readonly defaultZoom = 13;

  // Custom Icons
  readonly iconGray = L.icon({
    iconUrl: 'assets/img/r.png',
    iconSize: [35, 35],
    iconAnchor: [17, 35],
    popupAnchor: [0, -35],
    className: 'gray-icon',
  });

  readonly iconDefault = L.icon({
    iconUrl: 'assets/img/traffic-light-305721.png',
    iconSize: [35, 35],
    iconAnchor: [17, 35],
    popupAnchor: [0, -35],
  });

  readonly iconRed = L.icon({
    iconUrl: 'assets/img/r.png',
    iconSize: [35, 35],
    iconAnchor: [17, 35],
    popupAnchor: [0, -35],
  });

  readonly iconGreen = L.icon({
    iconUrl: 'assets/img/g.png',
    iconSize: [35, 35],
    iconAnchor: [17, 35],
    popupAnchor: [0, -35],
  });

  readonly iconAmber = L.icon({
    iconUrl: 'assets/img/a.png',
    iconSize: [35, 35],
    iconAnchor: [17, 35],
    popupAnchor: [0, -35],
  });

  constructor() {
    // 1. Listen to Specific Cabinet Status (Targeted)
    toObservable(this.signalrService.cabinetStatus)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg) => {
        if (msg) {
          this.updateMarkerStatus(msg);
        }
      });

    // 2. Listen to Global Traffic Broadcast (Broad) - proven to work in SignBoxComponent
    toObservable(this.globalSignalR.trafficBroadcast)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg) => {
        if (msg?.message) {
          const broadcast = msg.message;
          // Map broadcast to our status format
          this.updateMarkerStatus({
            id: broadcast.ID,
            l1: broadcast.L1,
            t1: broadcast.T1,
            l2: broadcast.L2,
            t2: broadcast.T2,
            l3: broadcast.L3,
            t3: broadcast.T3,
            l4: broadcast.L4,
            t4: broadcast.T4,
          });
        }
      });
  }

  updateMarkerStatus(msg: CabinetStatusMessage) {
    const marker = this.cabinetMarkersMap.get(msg.id);
    if (!marker) return;

    // Normalize and determine color from L1
    const color = this.normalizeColor(msg.l1);

    // Debug log to confirm update
    // console.log(`Traffic Update: ID=${msg.id}, Color=${color}`);

    let newIcon = this.iconGray;
    if (color === 'R') newIcon = this.iconRed;
    else if (color === 'G') newIcon = this.iconGreen;
    else if (color === 'Y') newIcon = this.iconAmber;

    marker.setIcon(newIcon);
  }

  private normalizeColor(c: any): 'R' | 'G' | 'Y' | null {
    const val = (c || '').toString().toLowerCase();
    if (val === 'r' || val === 'red') return 'R';
    if (val === 'g' || val === 'green') return 'G';
    if (val === 'y' || val === 'yellow') return 'Y';
    return null;
  }

  ngOnInit(): void {
    this.initMap();
    this.observeResize();
    this.loadCabinetLocations();
  }

  async loadCabinetLocations() {
    // Connect to BOTH services to ensure we get updates
    try {
      await this.signalrService.connect();
      await this.globalSignalR.connect();
    } catch (err) {
      console.error('SignalR Connection Error:', err);
    }

    this.signBoxService.getAll({ pageSize: 10000 }).subscribe({
      next: (result) => {
        if (result.isSuccess && result.value && result.value.data) {
          result.value.data.forEach((loc) => {
            const lat = parseFloat(loc.latitude);
            const lng = parseFloat(loc.longitude);
            if (!isNaN(lat) && !isNaN(lng)) {
              const popupContent = `
                <div style="font-family: 'Cairo', sans-serif; text-align: ${
                  this.isAr ? 'right' : 'left'
                }">
                  <strong>${loc.name ?? (this.isAr ? 'كابينة' : 'Cabinet')}</strong><br/>
                  <hr style="margin: 5px 0;">
                  <small><b>IP:</b> ${loc.ipAddress ?? 'N/A'}</small><br/>
                 </div>
              `;

              const marker = L.marker([lat, lng], {
                draggable: false,
                icon: this.iconGray,
              })
                .bindPopup(popupContent)
                .addTo(this.map);

              // Map by Database ID
              if (loc.id) {
                this.cabinetMarkersMap.set(loc.id, marker);
                this.signalrService.monitorCabinet(loc.id).catch(() => {});
              }

              // Map by Cabinet ID (Hardware ID) if available
              const cabId = Number(loc.cabinetId);
              if (Number.isFinite(cabId) && cabId > 0) {
                this.cabinetMarkersMap.set(cabId, marker);
                this.signalrService.monitorCabinet(cabId).catch(() => {});
              }

              this.cabinetMarkers.push(marker);
            }
          });
        }
      },
      error: (err) => console.error('Failed to load cabinets', err),
    });
  }

  ngOnDestroy(): void {
    this.signalrService.disconnect();

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
        minZoom: 6,
        maxZoom: 14,
        maxBounds: [
          [22.0, 24.0],
          [32.0, 37.0],
        ],
        maxBoundsViscosity: 1.0,
      });

      const tileLayer = L.tileLayer('assets/tiles/{z}/{x}/{y}.png', {
        maxZoom: 14,
        minZoom: 6,
        attribution: 'Offline Map',
        errorTileUrl: 'assets/img/no-tile.png',
      });

      tileLayer.on('tileerror', (error) => {
        console.warn('Tile not found:', error);
      });

      tileLayer.addTo(this.map);

      L.control.scale({ position: 'bottomleft' }).addTo(this.map);

      this.map.on('click', (e: L.LeafletMouseEvent) => this.addMarker(e.latlng));

      // move => update coordinates display to map center
      const updateCenter = () => {
        this.ngZone.run(() => {
          const center = this.map.getCenter();
          this.currentCoords = { lat: center.lat, lng: center.lng };
        });
      };

      this.map.on('move', updateCenter);
      // Initialize with start center
      updateCenter();

      // fix tile loading
      this.map.whenReady(() => {
        this.isLoading = false;
        setTimeout(() => this.map.invalidateSize(), 200);
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

    // Update lines if marker is dragged
    marker.on('drag', () => this.updateLines());

    // Connect every two markers
    if (this.markers.length % 2 === 0) {
      const lastTwo = this.markers.slice(-2).map((m) => m.getLatLng());
      const line = L.polyline(lastTwo, { color: 'blue' }).addTo(this.map);
      this.lines.push(line);
    }
  }

  addMarkerFromInput() {
    const lat = parseFloat(this.inputLat);
    const lng = parseFloat(this.inputLng);

    if (isNaN(lat) || isNaN(lng)) {
      alert(this.isAr ? 'الرجاء إدخال إحداثيات صحيحة' : 'Please enter valid coordinates');
      return;
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      alert(this.isAr ? 'الإحداثيات خارج النطاق المسموح' : 'Coordinates are out of range');
      return;
    }

    const latLng = L.latLng(lat, lng);
    this.addMarker(latLng);
    this.map.setView(latLng, this.map.getZoom());

    // Clear input
    this.inputLat = '';
    this.inputLng = '';
  }

  removeMarker(index: number) {
    if (index < 0 || index >= this.markers.length) return;

    const marker = this.markers[index];
    this.map.removeLayer(marker);
    this.markers.splice(index, 1);

    // Rebuild lines
    this.rebuildLines();
  }

  private rebuildLines() {
    // Remove all lines
    this.lines.forEach((line) => this.map.removeLayer(line));
    this.lines = [];

    // Recreate lines for every two markers
    for (let i = 0; i < this.markers.length - 1; i += 2) {
      const m1 = this.markers[i];
      const m2 = this.markers[i + 1];
      if (m1 && m2) {
        const line = L.polyline([m1.getLatLng(), m2.getLatLng()], { color: 'blue' }).addTo(
          this.map
        );
        this.lines.push(line);
      }
    }
  }

  getMarkerCoordinates(): Array<{ index: number; lat: number; lng: number }> {
    return this.markers.map((marker, index) => {
      const latLng = marker.getLatLng();
      return { index, lat: latLng.lat, lng: latLng.lng };
    });
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

          // Add marker
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

  copyCoordinates() {
    if (this.currentCoords) {
      const text = `${this.currentCoords.lat.toFixed(6)}, ${this.currentCoords.lng.toFixed(6)}`;
      this.clipboard.copy(text);
      // Optional: add toast notification here
    }
  }
}
