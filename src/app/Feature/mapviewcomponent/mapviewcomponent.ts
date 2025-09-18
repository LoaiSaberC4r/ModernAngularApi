import { Component, OnInit, OnDestroy, ElementRef, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import * as L from 'leaflet';

import { IGovernateService } from '../../Services/Governate/igovernate-service';
import { IAreaService } from '../../Services/Area/iarea-service';
import { ISignBoxControlService } from '../../Services/SignControlBox/isign-box-controlService';

import { GetAllGovernate } from '../../Domain/Entity/Governate/GetAllGovernate';
import { GetAllArea } from '../../Domain/Entity/Area/GetAllArea';
import { GetAllSignBoxLocation } from '../../Domain/Entity/SignControlBox/GetAllSignBoxLocation';

@Component({
  selector: 'app-mapviewcomponent',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './mapviewcomponent.html',
  styleUrl: './mapviewcomponent.css',
})
export class Mapviewcomponent implements OnInit, OnDestroy {
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef<HTMLDivElement>;

  private fb = inject(FormBuilder);
  private readonly governateService = inject(IGovernateService);
  private readonly areaService = inject(IAreaService);
  private readonly signBoxxControlService = inject(ISignBoxControlService);

  map!: L.Map;
  resizeObserver!: ResizeObserver;

  // Marker لموقع المستخدم
  marker?: L.Marker;

  // طبقة خاصة بكل ماركرات صناديق الإشارة
  markersLayer!: L.LayerGroup;

  readonly defaultCenter: L.LatLngExpression = [30.0444, 31.2357];
  readonly defaultZoom = 13;

  // ✅ مسار مطلق للأيقونة علشان يشتغل مع الروتر/البيس
  signIcon = L.icon({
    iconUrl: '/assets/img/traffic-light-305721.png',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -28],
  });

  // Data
  governates: GetAllGovernate[] = [];
  areas: GetAllArea[] = [];
  signBoxLocations: GetAllSignBoxLocation[] = [];

  // Reactive form
  trafficForm!: FormGroup;

  // Flags للجهوزية
  private mapReady = false;
  private pointsReady = false;

  ngOnInit(): void {
    // 1) بناء الفورم
    this.trafficForm = this.fb.group({
      governorate: ['', Validators.required],
      area: [null, Validators.required],
      name: ['', Validators.required],
      latitude: [
        '',
        [
          Validators.required,
          Validators.pattern(/^(-?([0-8]?\d(\.\d{1,6})?|90(\.0{1,6})?))$/), // -90..90
        ],
      ],
      longitude: [
        '',
        [
          Validators.required,
          Validators.pattern(/^(-?((1[0-7]\d|[0-9]?\d)(\.\d{1,6})?|180(\.0{1,6})?))$/), // -180..180
        ],
      ],
      ipAddress: [
        '',
        [
          Validators.required,
          Validators.pattern(
            /^(25[0-5]|2[0-4]\d|1?\d?\d)\.(25[0-5]|2[0-4]\d|1?\d?\d)\.(25[0-5]|2[0-4]\d|1?\d?\d)\.(25[0-5]|2[0-4]\d|1?\d?\d)$/
          ),
        ],
      ],
      template: ['0'],
      greenTime: [0, [Validators.min(0), Validators.max(1000)]],
      amberTime: [0, [Validators.min(0), Validators.max(1000)]],
      redTime: [{ value: 0, disabled: true }],
    });

    // 2) تحميل الداتا
    this.loadGovernate();
    this.loadSignBoxOnMap();

    // 3) تجهيز الخريطة
    this.initMap();
    this.observeResize();
  }

  ngOnDestroy(): void {
    if (this.map) this.map.remove();
    if (this.resizeObserver) this.resizeObserver.disconnect();
  }

  // ================= Map =================
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

    // طبقة ماركرات صناديق الإشارة
    this.markersLayer = L.layerGroup().addTo(this.map);

    // جيولوكيشن اختياري
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        const userLocation: L.LatLngExpression = [pos.coords.latitude, pos.coords.longitude];
        this.map.setView(userLocation, 15);
        this.marker = L.marker(userLocation).addTo(this.map).bindPopup('You are here!');
        this.trafficForm.patchValue({
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        });
      });
    }

    // تحديث الإحداثيات عند الضغط
    this.bindMapClickToForm();

    // الماب أصبحت جاهزة
    this.map.whenReady(() => {
      this.mapReady = true;
      this.tryRenderSignBoxes();
    });
  }

  private bindMapClickToForm() {
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      const lat = e.latlng.lat.toFixed(6);
      const lng = e.latlng.lng.toFixed(6);

      this.trafficForm.patchValue({ latitude: lat, longitude: lng });

      if (!this.marker) {
        this.marker = L.marker(e.latlng).addTo(this.map);
      } else {
        this.marker.setLatLng(e.latlng);
      }
    });
  }

  private tryRenderSignBoxes() {
    if (!this.mapReady || !this.pointsReady || !this.markersLayer) return;

    this.markersLayer.clearLayers();
    const bounds = L.latLngBounds([]);

    for (const s of this.signBoxLocations) {
      const lat = parseFloat((s as any).latitude);
      const lng = parseFloat((s as any).longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

      L.marker([lat, lng], { icon: this.signIcon })
        .addTo(this.markersLayer)
        .bindPopup(`Lat: ${lat.toFixed(6)}<br>Lng: ${lng.toFixed(6)}`);

      bounds.extend([lat, lng]);
    }

    if (bounds.isValid()) this.map.fitBounds(bounds.pad(0.1));
  }

  private observeResize() {
    this.resizeObserver = new ResizeObserver(() =>
      setTimeout(() => this.map.invalidateSize(), 100)
    );
    this.resizeObserver.observe(this.mapContainer.nativeElement);
  }

  // ================ Form helpers ================
  get f() {
    return this.trafficForm.controls;
  }

  onApply() {
    if (this.trafficForm.invalid) {
      this.trafficForm.markAllAsTouched();
      return;
    }
    const payload = this.trafficForm.getRawValue();
    console.log('Apply payload:', payload);
    // TODO: call API
  }

  // ================ Data loading ================
  loadGovernate() {
    this.governateService.getAll({}).subscribe((data) => {
      this.governates = data?.value ?? [];
    });
  }

  onGovernorateChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    const id = select.value === '' ? null : Number(select.value);
    this.trafficForm.patchValue({ governorate: id, area: null });

    if (id != null && !Number.isNaN(id)) {
      this.getAreas(id);
    } else {
      this.areas = [];
    }
  }

  getAreas(id: number) {
    this.areaService.getAll(id).subscribe((data) => {
      this.areas = data?.value ?? [];
    });
  }

  // تحميل مواقع صناديق الإشارة + تطبيع أسماء الحقول + الرندر
  loadSignBoxOnMap() {
    this.signBoxxControlService.getAllLocatopn().subscribe((data) => {
      const raw = data?.value ?? [];

      // تطبيع: نقبل latitude/Latitude/lat/Lat و longitude/Longitude/lng/Lng/lon
      this.signBoxLocations = raw
        .map((s: any) => {
          const latStr = String(s.latitude ?? s.Latitude ?? s.lat ?? s.Lat ?? '');
          const lngStr = String(s.longitude ?? s.Longitude ?? s.lng ?? s.Lng ?? s.lon ?? '');
          const lat = parseFloat(latStr);
          const lng = parseFloat(lngStr);
          return Number.isFinite(lat) && Number.isFinite(lng)
            ? ({ latitude: latStr, longitude: lngStr } as GetAllSignBoxLocation)
            : null;
        })
        .filter((x: GetAllSignBoxLocation | null) => x !== null) as GetAllSignBoxLocation[];

      this.pointsReady = true;
      this.tryRenderSignBoxes();
    });
  }
}
