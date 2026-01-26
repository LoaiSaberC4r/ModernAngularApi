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
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MapCacheService } from './map-cache.service';
import { IGovernateService } from '../../Services/Governate/igovernate-service';
import { GetAllGovernate } from '../../Domain/Entity/Governate/GetAllGovernate';

const defaultIcon = L.icon({
  iconUrl: 'assets/img/marker-green-40.png',
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
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

  //.\run-map-server.bat
  // to run map server

  private ngZone = inject(NgZone);
  private clipboard = inject(Clipboard);
  private langService = inject(LanguageService);
  private destroyRef = inject(DestroyRef);
  private http = inject(HttpClient);

  private mapCache = inject(MapCacheService);

  private signBoxService = inject(ISignBoxControlService);
  private signalrService = inject(CabinetSignalrService);
  private globalSignalR = inject(ISignalrService);
  private governateService = inject(IGovernateService);
  roadLoadingMessage = '';

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

  cabinetMarkersMap = new Map<number, L.Marker>();
  private cabinetLocationsMap = new Map<number, any>();

  private worker?: Worker;
  private updateLinesTimeout?: any;

  isLoadingRoads = false;
  routingEnabled = false;
  private isFromCache = false;

  // Near-by cabinets on route
  nearByCabinets: any[] = [];
  readonly NEARBY_DISTANCE_KM = 0.03; // 30 meters

  governates: GetAllGovernate[] = [];
  selectedGovernateId: number | null = null;
  private governatesLayer?: L.GeoJSON;
  private selectedFeatureLayer?: L.Layer;

  // Fallback coordinates for Egyptian Governorates

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

    // 2. Listen to Global Traffic Broadcast
    toObservable(this.globalSignalR.trafficBroadcast)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg) => {
        if (msg?.message) {
          const broadcast = msg.message;
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

    const color = this.normalizeColor(msg.l1);

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
    this.loadRoadNetwork();
    this.loadGovernates();
  }

  loadGovernates() {
    // Hardcoded list of all 27 Egyptian Governorates for consistent selection
    this.governates = [
      { governateId: 1, name: 'Cairo', latitude: '30.0444', longitude: '31.2357', areas: [] },
      { governateId: 2, name: 'Alexandria', latitude: '31.2001', longitude: '29.9187', areas: [] },
      { governateId: 3, name: 'Giza', latitude: '30.0131', longitude: '31.2089', areas: [] },
      { governateId: 4, name: 'Port Said', latitude: '31.2653', longitude: '32.3019', areas: [] },
      { governateId: 5, name: 'Suez', latitude: '29.9668', longitude: '32.5498', areas: [] },
      { governateId: 6, name: 'Luxor', latitude: '25.6872', longitude: '32.6396', areas: [] },
      { governateId: 7, name: 'Aswan', latitude: '24.0889', longitude: '32.8998', areas: [] },
      { governateId: 8, name: 'Sohag', latitude: '26.5592', longitude: '31.6957', areas: [] },
      { governateId: 9, name: 'Qena', latitude: '26.1551', longitude: '32.716', areas: [] },
      { governateId: 10, name: 'Asyut', latitude: '27.181', longitude: '31.1837', areas: [] },
      { governateId: 11, name: 'Minya', latitude: '28.0991', longitude: '30.75', areas: [] },
      { governateId: 12, name: 'Beni Suef', latitude: '29.0744', longitude: '31.0978', areas: [] },
      { governateId: 13, name: 'Fayyum', latitude: '29.3084', longitude: '30.8428', areas: [] },
      { governateId: 14, name: 'Damietta', latitude: '31.4172', longitude: '31.8144', areas: [] },
      { governateId: 15, name: 'Dakahlia', latitude: '31.0422', longitude: '31.3785', areas: [] },
      { governateId: 16, name: 'Gharbia', latitude: '30.7865', longitude: '31.0004', areas: [] },
      { governateId: 17, name: 'Sharqia', latitude: '30.5877', longitude: '31.502', areas: [] },
      { governateId: 18, name: 'Monufia', latitude: '30.55', longitude: '30.9833', areas: [] },
      {
        governateId: 19,
        name: 'Kafr El Sheikh',
        latitude: '31.1042',
        longitude: '30.9401',
        areas: [],
      },
      { governateId: 20, name: 'Beheira', latitude: '31.0364', longitude: '30.4694', areas: [] },
      { governateId: 21, name: 'Ismailia', latitude: '30.5965', longitude: '32.2715', areas: [] },
      { governateId: 22, name: 'Qalyubia', latitude: '30.41', longitude: '31.15', areas: [] },
      { governateId: 23, name: 'Red Sea', latitude: '26.7292', longitude: '33.9365', areas: [] },
      { governateId: 24, name: 'New Valley', latitude: '25.439', longitude: '30.5586', areas: [] },
      { governateId: 25, name: 'Matrouh', latitude: '31.3543', longitude: '27.2373', areas: [] },
      {
        governateId: 26,
        name: 'North Sinai',
        latitude: '30.5982',
        longitude: '33.7828',
        areas: [],
      },
      { governateId: 27, name: 'South Sinai', latitude: '28.5', longitude: '34.0', areas: [] },
    ];

    // Localized names based on language
    if (this.isAr) {
      const arNames: Record<string, string> = {
        Cairo: 'القاهرة',
        Alexandria: 'الإسكندرية',
        Giza: 'الجيزة',
        'Port Said': 'بورسعيد',
        Suez: 'السويس',
        Luxor: 'الأقصر',
        Aswan: 'أسوان',
        Sohag: 'سوهاج',
        Qena: 'قنا',
        Asyut: 'أسيوط',
        Minya: 'المنيا',
        'Beni Suef': 'بني سويف',
        Fayyum: 'الفيوم',
        Damietta: 'دمياط',
        Dakahlia: 'الدقهلية',
        Gharbia: 'الغربية',
        Sharqia: 'الشرقية',
        Monufia: 'المنوفية',
        'Kafr El Sheikh': 'كفر الشيخ',
        Beheira: 'البحيرة',
        Ismailia: 'الإسماعيلية',
        Qalyubia: 'القليوبية',
        'Red Sea': 'البحر الأحمر',
        'New Valley': 'الوادي الجديد',
        Matrouh: 'مطروح',
        'North Sinai': 'شمال سيناء',
        'South Sinai': 'جنوب سيناء',
      };
      this.governates.forEach((g) => (g.name = arNames[g.name] || g.name));
    }
  }

  onGovernateChange() {
    if (!this.selectedGovernateId) return;

    const gov = this.governates.find((g) => g.governateId === Number(this.selectedGovernateId));
    if (!gov) return;

    // 1. Highlight on map and zoom using boundaries if layer exists
    if (this.governatesLayer) {
      let found = false;
      this.governatesLayer.eachLayer((layer: any) => {
        const feature = layer.feature;
        const nameEn = feature.properties.name_en;

        // Match using name mapping
        const isMatch =
          nameEn.toLowerCase() === gov.name.toLowerCase() || this.isArabicMatch(gov.name, nameEn);

        if (isMatch) {
          this.applySelectionEffect(layer);
          this.map?.fitBounds(layer.getBounds(), { padding: [50, 50] });
          found = true;
        }
      });

      if (!found) {
        // Fallback to center coordinates if polygon match fails
        const lat = parseFloat(gov.latitude);
        const lng = parseFloat(gov.longitude);
        if (lat && lng && this.map) {
          this.map.setView([lat, lng], 13);
        }
      }
    } else {
      // Fallback if layer is not yet loaded
      const lat = parseFloat(gov.latitude);
      const lng = parseFloat(gov.longitude);
      if (lat && lng && this.map) {
        this.map.setView([lat, lng], 13);
      }
    }
  }

  private applySelectionEffect(layer: L.Layer) {
    if (this.selectedFeatureLayer) {
      this.governatesLayer?.resetStyle(this.selectedFeatureLayer);
    }
    this.selectedFeatureLayer = layer;
    (layer as L.Path).setStyle({
      weight: 3,
      color: '#ff7800',
      fillOpacity: 0.5,
      fillColor: '#ff7800',
    });
    (layer as L.Path).bringToFront();
  }

  async loadCabinetLocations() {
    try {
      await this.signalrService.connect();
      await this.globalSignalR.connect();
    } catch (err) {
      console.error('SignalR Connection Error:', err);
    }

    this.signBoxService.getAll({ pageSize: 10000 }).subscribe({
      next: (result) => {
        if (result && result.data) {
          result.data.forEach((loc) => {
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

              // Use primary ID (prefer loc.id, fallback to cabinetId)
              const primaryId = loc.id || Number(loc.cabinetId);
              if (primaryId) {
                this.cabinetMarkersMap.set(primaryId, marker);
                this.cabinetLocationsMap.set(primaryId, { lat, lng, ...loc });
                this.signalrService.monitorCabinet(primaryId).catch(() => {});
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

    if (this.worker) {
      this.worker.terminate();
      this.worker = undefined;
    }

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
        maxZoom: 19,
        maxBounds: [
          [22.0, 24.0],
          [32.0, 37.0],
        ],
        maxBoundsViscosity: 1.0,
      });

      const tileLayer = L.tileLayer('http://localhost:8081/tiles/{z}/{x}/{y}.png', {
        maxZoom: 19,
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

      const updateCenter = () => {
        this.ngZone.run(() => {
          const center = this.map.getCenter();
          this.currentCoords = { lat: center.lat, lng: center.lng };
        });
      };

      this.map.on('move', updateCenter);
      updateCenter();

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

  private selectGovernate(e: L.LeafletMouseEvent, feature: any) {
    const layer = e.target;
    // The GeoJSON has name_en.
    const nameEn = feature.properties.name_en;

    // Find governorate in our hardcoded list
    const gov = this.governates.find((g) => {
      return g.name.toLowerCase() === nameEn.toLowerCase() || this.isArabicMatch(g.name, nameEn);
    });

    if (gov) {
      this.selectedGovernateId = gov.governateId;
      this.applySelectionEffect(layer);
      this.map?.fitBounds((layer as L.Polyline).getBounds(), { padding: [50, 50] });
    }
  }

  private isArabicMatch(dbName: string, geoNameEn: string): boolean {
    // Mapping of GeoJSON name_en to Arabic for selection synchronization
    const mapping: Record<string, string> = {
      Cairo: 'القاهرة',
      Alexandria: 'الإسكندرية',
      Giza: 'الجيزة',
      'Port Said': 'بورسعيد',
      Suez: 'السويس',
      Luxor: 'الأقصر',
      Aswan: 'أسوان',
      Sohag: 'سوهاج',
      Qena: 'قنا',
      Asyut: 'أسيوط',
      Minya: 'المنيا',
      'Beni Suef': 'بني سويف',
      Fayyum: 'الفيوم',
      Damietta: 'دمياط',
      Dakahlia: 'الدقهلية',
      Gharbia: 'الغربية',
      Sharqia: 'الشرقية',
      Monufia: 'المنوفية',
      'Kafr el-Sheikh': 'كفر الشيخ',
      Beheira: 'البحيرة',
      Ismailia: 'الإسماعيلية',
      Qalyubia: 'القليوبية',
      'Red Sea': 'البحر الأحمر',
      'New Valley': 'الوادي الجديد',
      Matrouh: 'مطروح',
      'North Sinai': 'شمال سيناء',
      'South Sinai': 'جنوب سيناء',
    };
    return mapping[geoNameEn] === dbName;
  }

  private invalidateSize() {
    if (this.map) {
      setTimeout(() => this.map.invalidateSize(), 100);
    }
  }

  addMarker(latLng: L.LatLng) {
    const marker = L.marker(latLng, { draggable: true }).addTo(this.map);
    this.markers.push(marker);

    marker.on('drag', () => this.updateLinesDebounced());
    marker.on('dragend', () => this.updateLines());

    if (this.markers.length % 2 === 0) {
      const lastTwo = this.markers.slice(-2).map((m) => m.getLatLng());
      const line = L.polyline(lastTwo, { color: 'blue', weight: 3 }).addTo(this.map);
      this.lines.push(line);

      this.updateLines();
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

    this.inputLat = '';
    this.inputLng = '';
  }

  removeMarker(index: number) {
    if (index < 0 || index >= this.markers.length) return;

    const marker = this.markers[index];
    this.map.removeLayer(marker);
    this.markers.splice(index, 1);

    this.rebuildLines();
    this.updateLines();
  }

  updateMarkerCoords(index: number, lat: number, lng: number) {
    const marker = this.markers[index];
    if (marker) {
      marker.setLatLng([lat, lng]);
      this.updateLinesDebounced();
    }
  }

  private rebuildLines() {
    this.lines.forEach((line) => this.map.removeLayer(line));
    this.lines = [];

    for (let i = 0; i < this.markers.length - 1; i += 2) {
      const m1 = this.markers[i];
      const m2 = this.markers[i + 1];
      if (m1 && m2) {
        const line = L.polyline([m1.getLatLng(), m2.getLatLng()], { color: 'blue' }).addTo(
          this.map,
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

  public updateLinesDebounced() {
    if (this.updateLinesTimeout) clearTimeout(this.updateLinesTimeout);
    this.updateLinesTimeout = setTimeout(() => this.updateLines(), 50);
  }

  public updateLines() {
    if (!this.routingEnabled || !this.worker) {
      this.updateLinesStraight();
      return;
    }

    this.lines.forEach((line, i) => {
      const m1 = this.markers[i * 2];
      const m2 = this.markers[i * 2 + 1];
      if (m1 && m2) {
        const start = m1.getLatLng();
        const end = m2.getLatLng();

        this.worker!.postMessage({
          type: 'findPath',
          payload: {
            index: i,
            start: { lat: start.lat, lng: start.lng },
            end: { lat: end.lat, lng: end.lng },
          },
        });
      }
    });
  }

  private updateLinesStraight() {
    this.lines.forEach((line, i) => {
      const m1 = this.markers[i * 2];
      const m2 = this.markers[i * 2 + 1];
      if (m1 && m2) {
        line.setLatLngs([m1.getLatLng(), m2.getLatLng()]);
        line.setStyle({ color: 'blue', weight: 2, dashArray: '' });
      }
    });

    // Find nearby cabinets on all routes
    this.findNearbyCabinets();
  }

  /**
   * Find all cabinets within NEARBY_DISTANCE_KM of any route line
   */
  private findNearbyCabinets() {
    if (this.lines.length === 0 || this.cabinetLocationsMap.size === 0) {
      this.nearByCabinets = [];
      console.log('No lines or cabinets:', {
        lines: this.lines.length,
        cabinets: this.cabinetLocationsMap.size,
      });
      return;
    }

    const nearby = new Map<number, { cabinet: any; distance: number }>();

    // For each line (route)
    this.lines.forEach((line, lineIdx) => {
      const routeCoords = line.getLatLngs() as L.LatLng[];
      console.log(`Line ${lineIdx}: ${routeCoords.length} coordinates`);

      if (routeCoords.length < 2) return;

      // For each cabinet
      this.cabinetLocationsMap.forEach((cabData, cabId) => {
        const cabPoint = { lat: cabData.lat, lng: cabData.lng };

        // Find minimum distance from cabinet to any point on the route
        let minDistance = Infinity;

        for (let i = 0; i < routeCoords.length - 1; i++) {
          const p1 = routeCoords[i];
          const p2 = routeCoords[i + 1];
          const dist = this.distancePointToLineSegment(
            cabPoint,
            { lat: p1.lat, lng: p1.lng },
            { lat: p2.lat, lng: p2.lng },
          );
          minDistance = Math.min(minDistance, dist);
        }

        console.log(
          `Cabinet ${cabId} (${cabData.name}): distance = ${(minDistance * 1000).toFixed(0)}m, threshold = ${this.NEARBY_DISTANCE_KM * 1000}m`,
        );

        // If within range and not already recorded with a smaller distance
        if (minDistance <= this.NEARBY_DISTANCE_KM) {
          if (!nearby.has(cabId) || nearby.get(cabId)!.distance > minDistance) {
            nearby.set(cabId, { cabinet: cabData, distance: minDistance });
          }
        }
      });
    });

    // Convert to sorted array
    this.nearByCabinets = Array.from(nearby.values())
      .sort((a, b) => a.distance - b.distance)
      .map((item, index) => ({
        ...item.cabinet,
        distance: (item.distance * 1000).toFixed(0), // Convert to meters
        sequence: index + 1,
      }));

    console.log('Found nearby cabinets:', this.nearByCabinets.length, this.nearByCabinets);
  }

  /**
   * Calculate distance from a point to a line segment (in km)
   */
  private distancePointToLineSegment(
    point: { lat: number; lng: number },
    lineStart: { lat: number; lng: number },
    lineEnd: { lat: number; lng: number },
  ): number {
    const dx = lineEnd.lng - lineStart.lng;
    const dy = lineEnd.lat - lineStart.lat;
    const denom = dx * dx + dy * dy;

    if (denom === 0) {
      // Line segment is a point
      return this.distanceInKm(point, lineStart);
    }

    let t = ((point.lng - lineStart.lng) * dx + (point.lat - lineStart.lat) * dy) / denom;
    t = Math.max(0, Math.min(1, t));

    const closestPoint = {
      lng: lineStart.lng + t * dx,
      lat: lineStart.lat + t * dy,
    };

    return this.distanceInKm(point, closestPoint);
  }

  /**
   * Calculate distance between two points in km using Haversine formula
   */
  private distanceInKm(
    point1: { lat: number; lng: number },
    point2: { lat: number; lng: number },
  ): number {
    const R = 6371; // Earth radius in km
    const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
    const dLng = ((point2.lng - point1.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((point1.lat * Math.PI) / 180) *
        Math.cos((point2.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  clearMarkers() {
    this.markers.forEach((m) => this.map.removeLayer(m));
    this.lines.forEach((l) => this.map.removeLayer(l));
    this.markers = [];
    this.lines = [];
    this.nearByCabinets = [];
  }

  copyCoordinates() {
    if (this.currentCoords) {
      const text = `${this.currentCoords.lat.toFixed(6)}, ${this.currentCoords.lng.toFixed(6)}`;
      this.clipboard.copy(text);
    }
  }

  async loadRoadNetwork() {
    if (typeof Worker === 'undefined') {
      console.warn('Web Workers are not supported in this environment.');
      return;
    }

    this.isLoadingRoads = true;

    // Init worker
    if (this.worker) {
      this.worker.terminate();
    }
    this.worker = new Worker(new URL('./routing.worker', import.meta.url));

    this.worker.onmessage = ({ data }) => {
      const { type, payload } = data;

      if (type === 'init-complete') {
        this.ngZone.run(() => {
          this.isLoadingRoads = false;
          this.routingEnabled = true;
          this.roadLoadingMessage = this.isAr ? 'جاهز ✅' : 'Ready ✅';
          this.updateLines();
        });

        // If this is from fresh load (not cache), save the processed data
        if (payload && payload.roadNetwork && payload.nodesCache && !payload.isFromCache) {
          console.log(
            'Saving processed road data to cache, roadNetwork size:',
            payload.roadNetwork?.features?.length || 'unknown',
            'nodesCache size:',
            payload.nodesCache?.length || 'unknown',
          );
          this.mapCache
            .saveProcessedRoadNetwork({
              roadNetwork: payload.roadNetwork,
              nodesCache: payload.nodesCache,
            })
            .then(({ savedTo }) => {
              console.log('Processed road data saved to:', savedTo);
            });
        }
      } else if (type === 'path-found') {
        const { index, path } = payload;
        const line = this.lines[index];
        if (!line) return;

        this.ngZone.run(() => {
          if (path && path.length > 0) {
            const routeCoords = path.map((coord: number[]) => L.latLng(coord[1], coord[0]));
            line.setLatLngs(routeCoords);
            line.setStyle({ color: 'green', weight: 4, opacity: 0.8, dashArray: '' });
          } else {
            const m1 = this.markers[index * 2];
            const m2 = this.markers[index * 2 + 1];
            if (m1 && m2) line.setLatLngs([m1.getLatLng(), m2.getLatLng()]);
            line.setStyle({ color: 'red', weight: 3, opacity: 0.6, dashArray: '10, 10' });
          }

          // Re-calculate nearby cabinets after route update
          this.findNearbyCabinets();
        });
      } else if (type === 'error') {
        console.error('Worker error:', payload);
        this.ngZone.run(() => {
          this.isLoadingRoads = false;
          this.roadLoadingMessage = this.isAr
            ? 'خطأ أثناء تجهيز المسارات'
            : 'Error while preparing routing';
        });
      }
    };

    try {
      // 1) Try cache (localStorage OR IndexedDB)
      this.ngZone.run(() => {
        this.roadLoadingMessage = this.isAr ? 'تحميل من الكاش...' : 'Loading from cache...';
      });

      console.log('Attempting to get processed road network from cache...');
      const cached = await this.mapCache.getProcessedRoadNetwork();
      if (cached) {
        console.log(
          'Processed road network found in cache, roadNetwork size:',
          cached.roadNetwork?.features?.length || 'unknown',
          'nodesCache size:',
          cached.nodesCache?.length || 'unknown',
        );
        this.isFromCache = true;
        this.worker.postMessage({
          type: 'init-from-cache',
          payload: { roadNetwork: cached.roadNetwork, nodesCache: cached.nodesCache },
        });
        return;
      }
      console.log('Processed road network NOT found in cache. Proceeding to download.');

      // 2) Cache miss -> download (Service Worker handles HTTP caching)
      this.ngZone.run(() => {
        this.roadLoadingMessage = this.isAr ? 'تنزيل بيانات الطرق...' : 'Downloading road data...';
      });

      const roadNetwork = await firstValueFrom(this.http.get<any>('assets/roads.geojson'));
      console.log('Road network downloaded, features:', roadNetwork?.features?.length);

      // 3) Process in Worker (no main thread blocking)
      this.ngZone.run(() => {
        this.roadLoadingMessage = this.isAr ? 'معالجة البيانات...' : 'Processing data...';
      });

      this.isFromCache = false;
      this.worker.postMessage({ type: 'init-raw', payload: { roadNetwork } });

      // 4) Cache processed data for next reload
      setTimeout(() => {
        // Save processed data after worker starts (fire & forget)
        if (this.worker) {
          // We'll save in the worker message handler when init-complete is received
        }
      }, 0);
    } catch (err) {
      console.error('Failed to initialize road network worker', err);
      this.ngZone.run(() => {
        this.isLoadingRoads = false;
        this.mapError = 'فشل تحميل بيانات الطرق / Failed to load road data';
        this.roadLoadingMessage = this.isAr ? 'فشل تحميل بيانات الطرق' : 'Failed to load road data';
      });
    }
  }

  toggleRouting() {
    this.routingEnabled = !this.routingEnabled;
    this.updateLines();
  }

  // Optional debug helpers (uncomment in HTML if needed)
  debugCacheInfo() {
    console.log(this.mapCache.getCacheInfo());
  }
  clearRoadCache() {
    this.mapCache.clearCache();
    console.log('Road cache cleared');
  }
}
