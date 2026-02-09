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
import { GetAllGovernate } from '../../Domain/Entity/Governate/GetAllGovernate/GetAllGovernate';
import { GreenWaveApiService } from '../../Services/GreenWave/green-wave-api.service';
import { ApplyGreenWaveRequest } from '../../Domain/Entity/GreenWave/ApplyGreenWaveRequest/ApplyGreenWaveRequest';
import { GreenWavePreview } from '../../Domain/Entity/GreenWave/GreenWavePreview/GreenWavePreview';
import { PreviewGreenWaveRequest } from '../../Domain/Entity/GreenWave/PreviewGreenWaveRequest/PreviewGreenWaveRequest';
import { ToasterService } from '../../Services/Toster/toaster-service';
import { TileCacheService } from '../../Services/Map/tile-cache.service';
import { OfflineWarmupService } from '../../Services/Map/offline-warmup.service';
import { Subscription } from 'rxjs';

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
  private greenWaveApiService = inject(GreenWaveApiService);
  private toaster = inject(ToasterService);
  private tileCache = inject(TileCacheService);
  private warmupService = inject(OfflineWarmupService);
  roadLoadingMessage = '';

  private workerSubscription?: Subscription;

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

  private updateLinesTimeout: any;
  private cabinetSearchTimeout: any;

  isLoadingRoads = false;
  routingEnabled = false;
  private isFromCache = false;

  // Near-by cabinets on route
  nearByCabinets: any[] = [];
  readonly NEARBY_DISTANCE_KM = 0.1; // 100 meters

  governates: GetAllGovernate[] = [];
  selectedGovernateId: number | null = null;
  private governatesLayer?: L.GeoJSON;
  private selectedFeatureLayer?: L.Layer;

  // Green Wave Preview State
  routeSegments: string[] = [];
  currentPreview?: GreenWavePreview;
  lastPreviewRequest?: PreviewGreenWaveRequest;
  previewMarkers: L.Marker[] = [];
  isPreviewLoading = false;

  // Fallback coordinates for Egyptian Governorates

  readonly defaultCenter: L.LatLngExpression = [30.0444, 31.2357];
  readonly defaultZoom = 13;

  // Custom Icons
  readonly HighZoomAreas = [
    L.latLngBounds([29.95, 31.05], [30.2, 31.45]),
    L.latLngBounds([30.74, 30.54], [30.86, 31.06]),
  ];
  readonly CAIRO_MAX_ZOOM = 19;
  readonly DEFAULT_MAX_ZOOM = 14;

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
    this.initWorkerSubscription();
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
      this.toaster.error(this.isAr ? 'فشل الاتصال بـ SignalR' : 'SignalR Connection Error');
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
      error: (err) => this.toaster.errorFromBackend(err),
    });
  }

  ngOnDestroy(): void {
    if (this.updateLinesTimeout) clearTimeout(this.updateLinesTimeout);
    if (this.cabinetSearchTimeout) clearTimeout(this.cabinetSearchTimeout);
    this.signalrService.disconnect();
    this.workerSubscription?.unsubscribe();

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

      // Layer 1: Base Layer (Scales up from level 14 to avoid "MISSING TILE")
      const baseLayer = this.tileCache.createCachedTileLayer(
        'http://localhost:8081/tiles/{z}/{x}/{y}.png',
        {
          maxZoom: 19,
          maxNativeZoom: 14,
          minZoom: 6,
          attribution: 'Offline Map (Base)',
        },
      );

      // Layer 2: High-Zoom Data Layer (Shows native level 19 where available)
      const dataLayer = this.tileCache.createCachedTileLayer(
        'http://localhost:8081/tiles/{z}/{x}/{y}.png',
        {
          maxZoom: 19,
          maxNativeZoom: 19,
          minZoom: 15,
          attribution: 'Offline Map (High Detail)',
          errorTileUrl:
            'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', // Transparent
        },
      );

      this.map = L.map(this.mapContainer.nativeElement, {
        center: this.defaultCenter,
        zoom: this.defaultZoom,
        minZoom: 6,
        maxZoom: 19,
        layers: [baseLayer, dataLayer],
        maxBounds: [
          [22.0, 24.0],
          [32.0, 37.0],
        ],
        maxBoundsViscosity: 1.0,
        zoomControl: false,
      });

      baseLayer.on('tileerror', (error) => {
        console.warn('Tile not found:', error);
      });

      L.control.scale({ position: 'bottomleft' }).addTo(this.map);

      this.map.on('click', (e: L.LeafletMouseEvent) => this.addMarker(e.latlng));

      // Dynamic Zoom Limiting:
      this.map.on('moveend', () => this.updateMaxZoomLevel());
      this.updateMaxZoomLevel(); // Initial check

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
      this.toaster.errorFromBackend(err);
      this.mapError = 'Map failed to load';
      this.isLoading = false;
    }
  }

  private updateMaxZoomLevel() {
    if (!this.map) return;
    const center = this.map.getCenter();
    const isInsideHighZoomArea = this.HighZoomAreas.some((bounds) => bounds.contains(center));

    if (isInsideHighZoomArea) {
      if (this.map.getMaxZoom() !== this.CAIRO_MAX_ZOOM) {
        this.map.setMaxZoom(this.CAIRO_MAX_ZOOM);
      }
    } else {
      if (this.map.getMaxZoom() !== this.DEFAULT_MAX_ZOOM) {
        // If we are currently deeper than 14, zoom out first
        if (this.map.getZoom() > this.DEFAULT_MAX_ZOOM) {
          this.map.setZoom(this.DEFAULT_MAX_ZOOM);
        }
        this.map.setMaxZoom(this.DEFAULT_MAX_ZOOM);
      }
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
    if (!this.routingEnabled) {
      this.updateLinesStraight();
      return;
    }

    const mCount = this.markers.length;
    for (let i = 0; i < Math.floor(mCount / 2); i++) {
      this.calculateRoute(i);
    }
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
   * Find all cabinets on the route using Green Wave Preview API
   */
  private debouncedCabinetSearch() {
    if (this.cabinetSearchTimeout) clearTimeout(this.cabinetSearchTimeout);
    this.cabinetSearchTimeout = setTimeout(() => this.findNearbyCabinets(), 500);
  }

  private findNearbyCabinets() {
    // Check if we have route segments from the worker
    if (this.routeSegments.length === 0) {
      this.nearByCabinets = [];
      return;
    }

    // Call Green Wave Preview API
    this.greenWaveApiService
      .preview({
        routeSegments: this.routeSegments,
        speedKmh: 40,
        greenSeconds: 18,
        cabinetSearchRadiusMeters: 500,
        maxCabinets: 50,
      })
      .subscribe({
        next: (preview) => {
          // Map the API response to the format expected by the UI
          this.nearByCabinets = preview.cabinets.map((cab, index) => ({
            id: cab.cabinetId,
            cabinetId: cab.cabinetId,
            name: `Cabinet ${cab.cabinetId}`,
            lat: cab.cabinetLat,
            lng: cab.cabinetLon,
            distance: cab.distanceToRouteMeters.toFixed(0),
            offsetSeconds: cab.offsetSeconds,
            openDirectionId: cab.openDirectionId,
            sequence: index + 1,
          }));

          this.visualizePreview(preview);
        },
        error: (err) => {
          this.toaster.errorFromBackend(err);
          this.nearByCabinets = [];
        },
      });
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
    this.clearPreview();
    this.markers = [];
    this.lines = [];
    this.nearByCabinets = [];
    this.routeSegments = [];
  }

  clearPreview() {
    this.previewMarkers.forEach((m) => this.map.removeLayer(m));
    this.previewMarkers = [];
    this.currentPreview = undefined;
    this.nearByCabinets = [];
  }

  requestGreenWavePreview() {
    if (this.routeSegments.length === 0) {
      this.toaster.warning(
        this.isAr ? 'الرجاء تحديد مسار أولاً' : 'Please determine a route first',
      );
      return;
    }

    const req: PreviewGreenWaveRequest = {
      routeSegments: this.routeSegments,
      speedKmh: 40,
      greenSeconds: 18,
      cabinetSearchRadiusMeters: 500, // Default or gathered from UI
      maxCabinets: 50, // Default or gathered from UI
    };

    this.lastPreviewRequest = req;
    this.isPreviewLoading = true;
    this.greenWaveApiService.preview(req).subscribe({
      next: (res) => {
        this.isPreviewLoading = false;
        this.currentPreview = res;

        // Populate nearByCabinets from preview response
        this.nearByCabinets = res.cabinets.map((cab, index) => ({
          id: cab.cabinetId,
          cabinetId: cab.cabinetId,
          name: `Cabinet ${cab.cabinetId}`,
          lat: cab.cabinetLat,
          lng: cab.cabinetLon,
          distance: cab.distanceToRouteMeters.toFixed(0),
          offsetSeconds: cab.offsetSeconds,
          openDirectionId: cab.openDirectionId,
          sequence: index + 1,
        }));

        if (res.cabinets.length === 0) {
          this.toaster.warning(
            this.isAr
              ? 'لم يتم العثور على كباين على هذا المسار'
              : 'No mapped cabinets found on this route',
          );
        }

        this.visualizePreview(res);
      },
      error: (err) => {
        this.isPreviewLoading = false;
        this.toaster.errorFromBackend(err);
      },
    });
  }

  private visualizePreview(preview: GreenWavePreview) {
    this.previewMarkers.forEach((m) => this.map.removeLayer(m));
    this.previewMarkers = [];
    this.cabinetMarkersMap.clear();

    if (preview.cabinets.length === 0) {
      return;
    }

    preview.cabinets.forEach((cab) => {
      const marker = L.marker([cab.cabinetLat, cab.cabinetLon], {
        icon: this.iconGreen, // Representing Green Wave
      }).addTo(this.map);

      marker.bindPopup(`
        <div style="font-family: inherit;">
          <strong>Cabinet: ${cab.cabinetId}</strong><br/>
          Direction: ${cab.openDirectionId}<br/>
          Offset: ${cab.offsetSeconds}s
        </div>
      `);

      this.cabinetMarkersMap.set(cab.cabinetId, marker);
      this.previewMarkers.push(marker);

      const label = L.divIcon({
        className: 'green-wave-label',
        html: `<div style="background: white; border: 2px solid green; padding: 2px 5px; border-radius: 5px; font-weight: bold; position: relative; top: -45px; left: 15px; white-space: nowrap;">
                D${cab.openDirectionId} | ${cab.offsetSeconds}s
               </div>`,
        iconAnchor: [0, 0],
      });

      const labelMarker = L.marker([cab.cabinetLat, cab.cabinetLon], { icon: label }).addTo(
        this.map,
      );

      this.previewMarkers.push(marker, labelMarker);
    });

    this.toaster.success(
      this.isAr
        ? `تم تحميل ${preview.cabinets.length} كباين على المسار`
        : `Green Wave preview loaded (${preview.cabinets.length} cabinets)`,
    );
  }

  applyGreenWavePlan() {
    if (!this.currentPreview || !this.lastPreviewRequest) return;

    const applyReq: ApplyGreenWaveRequest = {
      ...this.lastPreviewRequest,
      planId: this.currentPreview.planId,
    };

    this.greenWaveApiService.apply(applyReq).subscribe({
      next: () => {
        this.toaster.success(
          this.isAr ? 'تم تطبيق المسار الأخضر' : 'Green Wave applied successfully',
        );
      },
      error: (err) => this.toaster.errorFromBackend(err),
    });
  }

  copyCoordinates() {
    if (this.currentCoords) {
      const text = `${this.currentCoords.lat.toFixed(6)}, ${this.currentCoords.lng.toFixed(6)}`;
      this.clipboard.copy(text);
    }
  }

  initWorkerSubscription() {
    this.workerSubscription = this.warmupService.workerMessages$.subscribe(({ type, payload }) => {
      if (type === 'init-complete') {
        this.ngZone.run(() => {
          this.isLoadingRoads = false;
          this.routingEnabled = true;
          this.roadLoadingMessage = this.isAr ? 'جاهز ✅' : 'Ready ✅';
          this.updateLines();
        });
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

          // Accumulate segments for Green Wave preview (union of all segments from all pairs)
          const allSegments = new Set<string>();
          this.routeSegments.forEach((s) => allSegments.add(s));
          (payload.routeSegments || []).forEach((s: string) => allSegments.add(s));
          this.routeSegments = Array.from(allSegments);

          this.debouncedCabinetSearch();
        });
      } else if (type === 'error') {
        this.ngZone.run(() => {
          this.isLoadingRoads = false;
          this.roadLoadingMessage = this.isAr ? 'خطأ' : 'Error';
        });
      }
    });
  }

  async loadRoadNetwork() {
    if (this.warmupService.getIsWarmedUp()) {
      this.isLoadingRoads = false;
      this.routingEnabled = true;
      this.roadLoadingMessage = this.isAr ? 'جاهز ✅' : 'Ready ✅';
      this.updateLines();
      return;
    }

    this.isLoadingRoads = true;
    this.roadLoadingMessage = this.isAr
      ? 'جاري التجهيز في الخلفية...'
      : 'Preparing in background...';
  }

  calculateRoute(index: number) {
    const m1 = this.markers[index * 2];
    const m2 = this.markers[index * 2 + 1];
    if (!m1 || !m2) return;

    this.warmupService.requestPath({
      index,
      start: { lat: m1.getLatLng().lat, lng: m1.getLatLng().lng },
      end: { lat: m2.getLatLng().lat, lng: m2.getLatLng().lng },
    });
  }

  toggleRouting() {
    this.routingEnabled = !this.routingEnabled;
    this.updateLines();
  }

  // Optional debug helpers (uncomment in HTML if needed)
  debugCacheInfo() {
    // Hidden in production
  }
  clearRoadCache() {
    this.mapCache.clearCache();
  }

  async testSegmentIdGeneration() {
    const cached = await this.mapCache.getProcessedRoadNetwork();

    if (!cached || !cached.roadNetwork || cached.roadNetwork.features.length === 0) {
      this.toaster.warning(
        this.isAr ? 'بيانات الطرق غير متوفرة حالياً' : 'Road network data not available',
      );
      return;
    }

    const roadNetwork = cached.roadNetwork;
    const firstFeature = roadNetwork.features[0];

    if (firstFeature.geometry.type !== 'LineString') {
      return;
    }

    const coords = firstFeature.geometry.coordinates;
    const first = coords[0];
    const last = coords[coords.length - 1];

    const fromNodeId = `N_${first[1].toFixed(6)}_${first[0].toFixed(6)}`;
    const toNodeId = `N_${last[1].toFixed(6)}_${last[0].toFixed(6)}`;

    // SHA256 on all points: {lat:F6},{lon:F6};
    let hashInput = '';
    for (const p of coords) {
      hashInput += `${p[1].toFixed(6)},${p[0].toFixed(6)};`;
    }

    const msgUint8 = new TextEncoder().encode(hashInput);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
    const hash12 = hashHex.substring(0, 12);

    const segmentId = `SEG_${fromNodeId}_${toNodeId}_${hash12}`;

    // For debugging, we can copy to clipboard or show a toast
    this.clipboard.copy(segmentId);
    this.toaster.success(`Segment ID: ${segmentId} (Copied)`);
  }
}
