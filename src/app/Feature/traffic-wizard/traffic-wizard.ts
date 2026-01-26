import {
  Component,
  OnInit,
  inject,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewInit,
  NgZone,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormArray,
  AbstractControl,
  FormControl,
} from '@angular/forms';
import { MatStep, MatStepperModule, MatStepper } from '@angular/material/stepper';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { IGovernateService } from '../../Services/Governate/igovernate-service';
import { GetAllGovernate } from '../../Domain/Entity/Governate/GetAllGovernate';
import { IAreaService } from '../../Services/Area/iarea-service';
import { GetAllArea } from '../../Domain/Entity/Area/GetAllArea';

import { ISignBoxControlService } from '../../Services/SignControlBox/isign-box-controlService';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';

import { LanguageService } from '../../Services/Language/language-service';
import { Subscription, Subject, fromEvent, interval } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, takeUntil } from 'rxjs/operators';
import { GetAllTemplate } from '../../Domain/Entity/Template/GetAllTemplate';
import { ITemplateService } from '../../Services/Template/itemplate-service';
import { ITemplatePatternService } from '../../Services/TemplatePattern/itemplate-pattern-service';
import { LightPatternForTemplatePattern } from '../../Domain/Entity/TemplatePattern/TemplatePattern';
import {
  AddSignBoxCommandDto,
  DirectionWithPatternDto,
} from '../../Domain/Entity/SignControlBox/AddSignBoxCommandDto';
import { Router } from '@angular/router';
import { ToasterService } from '../../Services/Toster/toaster-service';
import { ITrafficDepartmentService } from '../../Services/TrafficDepartment/itraffic-department-service';
import { TrafficDepartment } from '../../Domain/Entity/TrafficDepartment/TrafficDepartment';
import {
  IMapAdminService,
  NearestRoadNode,
  RoadSegment,
} from '../../Services/MapAdmin/map-admin.service';
import * as L from 'leaflet';
import { MatProgressSpinner } from '@angular/material/progress-spinner';

type RoundDirection = {
  name?: string;
  order?: number;
  left: boolean;
  right: boolean;
};

const IPV4_REGEX = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const STORAGE_KEY = 'TRAFFIC_WIZARD_PERSISTENCE';

@Component({
  selector: 'app-traffic-wizard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatStepperModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatDividerModule,
    MatStep,
    MatProgressSpinnerModule,
  ],
  templateUrl: './traffic-wizard.html',
  styleUrl: './traffic-wizard.css',
})
export class TrafficWizard implements OnInit, OnDestroy, AfterViewInit {
  private readonly governateService = inject(IGovernateService);
  private readonly signBoxService = inject(ISignBoxControlService);
  private readonly areaService = inject(IAreaService);
  public fb = inject(FormBuilder);
  public langService = inject(LanguageService);
  private readonly templateService = inject(ITemplateService);
  private readonly templatePatternService = inject(ITemplatePatternService);
  private readonly router = inject(Router);
  private readonly trafficDeptService = inject(ITrafficDepartmentService);
  private readonly mapAdminService = inject(IMapAdminService);
  private readonly ngZone = inject(NgZone);
  private readonly toaster = inject(ToasterService);

  @ViewChild('wizardMap') wizardMapContainer?: ElementRef;
  @ViewChild('step4MapContainer') step4MapContainer?: ElementRef;
  @ViewChild('stepper') private stepper!: MatStepper;

  get isAr() {
    return this.langService.current === 'ar';
  }

  private readonly destroy$ = new Subject<void>();
  private readonly softRefresh$ = interval(30000);
  private isRefreshing = false;
  isSavingStep2 = false;

  // New state for 5-step flow
  savedCabinetId: number | null = null;
  savedDirectionIds: { directionId: number; name: string; order: number }[] = [];
  incomingSegments: RoadSegment[] = [];
  selectedDirectionId: number | null = null;
  directionalBindings = new Map<number, string>(); // directionId -> roadSegmentId

  templates: GetAllTemplate[] = [];
  governates: GetAllGovernate[] = [];
  areas: GetAllArea[] = [];
  trafficDepartments: TrafficDepartment[] = [];

  trafficForm: FormGroup;
  private patternSyncSubs = new Map<string, Subscription>();

  // Map step state (Step 3)
  nearestNodes: NearestRoadNode[] = [];
  selectedNodeId: string | null = null;
  isLoadingNodes = false;
  wizardMap: L.Map | null = null;
  cabinetMarker: L.Marker | null = null;
  nodeMarkers: L.Marker[] = [];

  // Step 4 Map State
  step4Map: L.Map | null = null;
  segmentLayers = new Map<string, L.Polyline>();

  constructor() {
    this.trafficForm = this.fb.group({
      governorate: [null, Validators.required],
      area: [null, Validators.required],
      trafficDepartment: [null, Validators.required],
      name: ['', Validators.required],
      cabinetId: [
        null,
        [
          Validators.required,
          Validators.min(1),
          Validators.max(40_000_000),
          Validators.pattern(/^[1-9]\d*$/),
        ],
      ],
      ipAddress: ['', [Validators.required, Validators.pattern(IPV4_REGEX)]],
      latitude: ['', Validators.required],
      longitude: ['', Validators.required],
      directions: this.fb.array([this.buildDirectionGroup(1)]),
      templateForm: this.fb.group({
        templateId: new FormControl<number>(0, { nonNullable: true }),
        templateName: new FormControl<string>('', { nonNullable: true }),
        rows: this.fb.array<FormGroup>([]),
      }),
    });
  }

  ngOnInit(): void {
    this.loadGovernate();
    this.loadTemplates();
    this.loadTrafficDepartments();
    this.reconcileConflicts();

    this.directions.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.reconcileConflicts());

    fromEvent(document, 'visibilitychange')
      .pipe(
        takeUntil(this.destroy$),
        filter(() => document.visibilityState === 'visible'),
        debounceTime(150),
      )
      .subscribe(() => this.hardRefreshLists());

    this.softRefresh$.pipe(takeUntil(this.destroy$)).subscribe(() => this.softRefreshLists());

    this.trafficForm
      .get('governorate')!
      .valueChanges.pipe(takeUntil(this.destroy$), distinctUntilChanged())
      .subscribe((id) => {
        this.trafficForm.patchValue({ area: null }, { emitEvent: false });
        if (id != null && !Number.isNaN(id)) this.getAreas(Number(id));
      });

    this.templateForm
      .get('templateId')!
      .valueChanges.pipe(takeUntil(this.destroy$), distinctUntilChanged())
      .subscribe((id) => this.onTemplateChange(Number(id || 0)));

    // Load persisted state
    this.loadPersistence();

    // Auto-save on form change
    this.trafficForm.valueChanges
      .pipe(takeUntil(this.destroy$), debounceTime(1000))
      .subscribe(() => this.savePersistence());
  }

  ngAfterViewInit(): void {
    // Restore stepper index after view init if needed
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved && this.stepper) {
      const data = JSON.parse(saved);
      if (data.stepIndex != null) {
        setTimeout(() => (this.stepper.selectedIndex = data.stepIndex), 200);
      }
    }
  }

  ngOnDestroy(): void {
    this.clearAllPatternSyncSubs();
    this.clearMapMarkersAndState();
    this.clearStep4Map();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadTemplates(): void {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    this.templateService.GetAll().subscribe({
      next: (res) => {
        const incoming = res || [];
        this.templates = incoming;
      },
      complete: () => (this.isRefreshing = false),
      error: () => (this.isRefreshing = false),
    });
  }

  private loadGovernate() {
    this.governateService.getAll({}).subscribe((data) => {
      this.governates = data || [];
    });
  }

  private getAreas(id: number) {
    this.areaService.getAll(id).subscribe((data) => {
      this.areas = data || [];
    });
  }

  private loadTrafficDepartments() {
    this.trafficDeptService.getAll().subscribe((data) => {
      this.trafficDepartments = data || [];
    });
  }

  private hardRefreshLists() {
    this.loadTemplates();
    this.loadGovernate();
    this.loadTrafficDepartments();
    const govId = Number(this.trafficForm.get('governorate')?.value || 0);
    if (govId > 0) this.getAreas(govId);
  }

  private softRefreshLists() {
    this.loadTemplates();
  }

  onGovernorateChangeValue(id: number | null): void {
    this.trafficForm.patchValue({ governorate: id, area: null });
    if (id != null && !Number.isNaN(id)) {
      this.getAreas(Number(id));
    }
  }

  get directions(): FormArray<FormGroup> {
    return this.trafficForm.get('directions') as FormArray<FormGroup>;
  }

  private buildDirectionGroup(order: number): FormGroup {
    return this.fb.group({
      name: ['', Validators.required],
      templateId: [0, [Validators.required, Validators.min(1)]],
      order: [order, [Validators.required, Validators.min(1)]],
      left: [false],
      right: [false],
      isConflict: [false],
      conflictWith: [null],
    });
  }

  addDirection() {
    if (this.directions.length < 4) {
      this.directions.push(this.buildDirectionGroup(this.directions.length + 1));
      this.reindexOrders();
      this.reconcileConflicts();
    }
  }

  removeDirection(index: number) {
    if (this.directions.length <= 1) return;
    this.directions.removeAt(index);
    this.reindexOrders();
    this.reconcileConflicts();
  }

  private reindexOrders() {
    this.directions.controls.forEach((g, i) =>
      g.get('order')?.setValue(i + 1, { emitEvent: false }),
    );
  }

  getGovernorateName(id: number | null): string {
    if (!id) return '';
    return this.governates.find((g) => g.governateId === id)?.name ?? '';
  }

  getAreaName(id: number | null): string {
    if (!id) return '';
    return this.areas.find((a) => a.areaId === id)?.name ?? '';
  }

  conflictTargetName(lane: number | null | undefined): string {
    if (!lane) return '';
    const n = Number(lane);
    const grp = this.directions.controls.find((g) => Number(g.get('order')?.value) === n);
    const raw = (grp?.get('name')?.value || '').toString().trim();
    return raw || (this.isAr ? `اتجاه ${n}` : `Direction ${n}`);
  }

  getTrafficDepartmentName(id: string | null): string {
    if (!id) return '';
    const dept = this.trafficDepartments.find((d) => d.id === id);
    return this.isAr ? (dept?.nameAr ?? '') : (dept?.nameEn ?? '');
  }

  templateName(id: number | null | undefined): string {
    const notSet = this.isAr ? 'غير محدد' : 'Not set';
    const n = Number(id || 0);
    if (!n) return notSet;
    const t = this.templates?.find((t) => t.id === n);
    return t?.name ?? notSet;
  }

  onConflictSelected(currentIndex: number, selectedLane: number | null) {
    const current = this.getDir(currentIndex);
    current.get('conflictWith')?.setValue(selectedLane, { emitEvent: false });
    this.reconcileConflicts();
  }

  private getDir(i: number): FormGroup {
    return this.directions.at(i) as FormGroup;
  }

  private clearAllPatternSyncSubs() {
    this.patternSyncSubs.forEach((s) => s.unsubscribe());
    this.patternSyncSubs.clear();
  }

  private reconcileConflicts() {
    this.clearAllPatternSyncSubs();
    for (let i = 0; i < this.directions.length; i++) {
      const g = this.getDir(i);
      g.get('isConflict')?.setValue(false, { emitEvent: false });
      this.enableCtrl(g.get('templateId'));
    }

    const usedAsConflictLane = new Set<number>();
    for (let i = 0; i < this.directions.length; i++) {
      const primary = this.getDir(i);
      const lane = primary.get('conflictWith')?.value as number | null;
      if (lane == null) continue;
      const j = this.findIndexByLane(lane);
      if (j === null || j === i || usedAsConflictLane.has(lane)) continue;
      usedAsConflictLane.add(lane);
      const conflict = this.getDir(j);
      this.copyValue(primary.get('templateId'), conflict.get('templateId'));
      conflict.get('isConflict')?.setValue(true, { emitEvent: false });
      this.disableCtrl(conflict.get('templateId'));
      const sub = primary.get('templateId')?.valueChanges.subscribe(() => {
        this.copyValue(primary.get('templateId'), conflict.get('templateId'));
      });
      if (sub) this.patternSyncSubs.set(`${i}->${j}`, sub);
    }
  }

  private findIndexByLane(lane: number | null): number | null {
    if (lane == null) return null;
    for (let i = 0; i < this.directions.length; i++) {
      if (Number(this.getDir(i).get('order')?.value) === Number(lane)) return i;
    }
    return null;
  }

  // Step 2 Save Logic
  onStep2Next(stepper: any): void {
    if (this.isSavingStep2) return;
    if (this.trafficForm.invalid) {
      this.trafficForm.markAllAsTouched();
      this.toaster.warning(this.isAr ? 'من فضلك املأ جميع الحقول' : 'Please fill all fields');
      return;
    }

    const v = this.trafficForm.getRawValue();

    // 1. Initialize directions with false/0 defaults
    const directions: DirectionWithPatternDto[] = v.directions.map((d: any, idx: number) => ({
      name: d.name.trim(),
      order: Number(d.order || idx + 1),
      left: !!d.left,
      right: !!d.right,
      isConflict: false,
      templateId: Number(d.templateId),
      conflictWith: 0,
    }));

    // 2. Map conflicts from the form to the server's expected orientation
    // Form: Direction A (isConflict:false) has conflictWith: B
    // Server: Direction B (isConflict:true) must have conflictWith: A
    v.directions.forEach((formDir: any) => {
      const targetLane = Number(formDir.conflictWith);
      if (targetLane > 0) {
        const slave = directions.find((resDir) => resDir.order === targetLane);
        if (slave) {
          slave.isConflict = true;
          slave.conflictWith = Number(formDir.order);
        }
      }
    });

    const cabinetId = Number(v.cabinetId);
    const payload: AddSignBoxCommandDto = {
      name: v.name.trim(),
      areaId: Number(v.area),
      ipAddress: v.ipAddress.trim(),
      latitude: String(v.latitude),
      longitude: String(v.longitude),
      cabinetId: cabinetId,
      trafficDepartmentId: v.trafficDepartment,
      directions,
    };

    this.isSavingStep2 = true;
    this.signBoxService.AddSignBox(payload).subscribe({
      next: (resp) => {
        this.isSavingStep2 = false;
        if (resp.isSuccess) {
          this.savedCabinetId = cabinetId;
          this.toaster.success(this.isAr ? 'تم الحفظ' : 'Saved');
          this.fetchDirectionIds(cabinetId);

          // Force step navigation
          setTimeout(() => {
            if (this.stepper) {
              this.stepper.selectedIndex = 2; // Jump to Step 3 (0-indexed)
            } else if (stepper) {
              stepper.selectedIndex = 2;
            }
          }, 100);
        } else {
          this.toaster.errorFromBackend(resp);
        }
      },
      error: (err) => {
        this.isSavingStep2 = false;
        this.toaster.errorFromBackend(err);
      },
    });
  }

  private fetchDirectionIds(cabinetId: number) {
    this.mapAdminService.getDirectionIds(cabinetId).subscribe((res) => {
      this.savedDirectionIds = res.directions || [];
      if (this.savedDirectionIds.length > 0 && !this.selectedDirectionId) {
        this.selectedDirectionId = this.savedDirectionIds[0].directionId;
      }
    });
  }

  onApply(): void {
    this.toaster.success(this.isAr ? 'تم الإعداد' : 'Configured');
    sessionStorage.removeItem(STORAGE_KEY);
    this.router.navigate(['/']);
  }

  isStep2Invalid(): boolean {
    const baseInvalid =
      this.trafficForm.get('name')?.invalid ||
      this.trafficForm.get('cabinetId')?.invalid ||
      this.trafficForm.get('ipAddress')?.invalid ||
      this.trafficForm.get('latitude')?.invalid ||
      this.trafficForm.get('longitude')?.invalid;

    const anyDirInvalid = this.directions.controls.some(
      (g) => g.get('name')?.invalid || g.get('order')?.invalid,
    );

    return !!(baseInvalid || anyDirInvalid);
  }

  isConflict(i: number): boolean {
    return this.getDir(i).get('isConflict')?.value === true;
  }

  getDirectionDisplayName(i: number): string {
    const g = this.getDir(i);
    const name = (g.get('name')?.value || '').toString().trim();
    if (name) return name;
    return this.isAr ? `اتجاه ${i + 1}` : `Direction ${i + 1}`;
  }

  onDirectionTemplateChange(index: number, templateId: number | null) {
    const g = this.directions.at(index) as FormGroup;
    g.get('templateId')?.setValue(Number(templateId || 0), { emitEvent: true });
    this.reconcileConflicts();
  }

  directionLabel(i: number): string {
    return this.isAr ? `اسم الاتجاه ${i + 1}` : `Direction ${i + 1} Name`;
  }

  forceSpaceAtCaret(event: any, group: AbstractControl) {
    const input = event.target as HTMLInputElement;
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    const oldValue = input.value;
    const newValue = oldValue.substring(0, start) + ' ' + oldValue.substring(end);
    group.get('name')?.setValue(newValue);
    setTimeout(() => {
      input.selectionStart = input.selectionEnd = start + 1;
    }, 0);
    event.preventDefault();
  }

  // ========= Step 3: Map Methods =========
  loadNearestNodesOnStep3(): void {
    const cabinetId = Number(this.trafficForm.get('cabinetId')?.value);
    const lat = Number(this.trafficForm.get('latitude')?.value);
    const lng = Number(this.trafficForm.get('longitude')?.value);

    this.isLoadingNodes = true;
    setTimeout(() => this.initWizardMap(lat, lng), 100);

    this.mapAdminService.getNearestNodes(cabinetId, 2000, 15).subscribe({
      next: (nodes) => {
        this.ngZone.run(() => {
          this.nearestNodes = nodes || [];
          this.isLoadingNodes = false;
          this.displayNodesOnMap();
        });
      },
      error: (err) => {
        this.isLoadingNodes = false;
        this.toaster.errorFromBackend(err);
      },
    });
  }

  initWizardMap(lat: number, lng: number): void {
    if (!this.wizardMapContainer) return;
    if (this.wizardMap) this.wizardMap.remove();
    this.wizardMap = L.map(this.wizardMapContainer.nativeElement).setView([lat, lng], 16);
    L.tileLayer('http://localhost:8081/tiles/{z}/{x}/{y}.png').addTo(this.wizardMap);
    L.marker([lat, lng]).addTo(this.wizardMap).bindPopup('Cabinet').openPopup();
  }

  displayNodesOnMap(): void {
    if (!this.wizardMap) return;
    this.nodeMarkers.forEach((m) => this.wizardMap?.removeLayer(m));
    this.nodeMarkers = [];

    this.nearestNodes.forEach((node, index) => {
      const marker = L.marker([node.latitude, node.longitude]).addTo(this.wizardMap!);
      marker.bindPopup(
        `Node #${index + 1}<br><button onclick="window.selectNode(${index})">Select</button>`,
      );
      this.nodeMarkers.push(marker);
      (window as any).selectNode = (i: number) => this.onNodeSelected(this.nearestNodes[i]);
    });
  }

  onNodeSelected(node: NearestRoadNode): void {
    const cabinetId = this.savedCabinetId || Number(this.trafficForm.get('cabinetId')?.value);
    this.selectedNodeId = node.roadNodeId;

    if (cabinetId > 0) {
      this.mapAdminService.bindCabinetToNode(cabinetId, node.roadNodeId).subscribe({
        next: () => this.toaster.success(this.isAr ? 'تم الربط بنجاح' : 'Bound successfully'),
        error: (err) => this.toaster.errorFromBackend(err),
      });
    } else {
      this.toaster.warning(
        this.isAr ? 'برجاء حفظ بيانات الكبينة أولاً' : 'Please save cabinet data first',
      );
    }
  }

  clearMapMarkersAndState(): void {
    if (this.wizardMap) this.wizardMap.remove();
    this.nearestNodes = [];
    this.selectedNodeId = null;
  }

  // ========= Step 4: Step 4 Methods =========
  loadIncomingSegmentsOnStep4(): void {
    const cabinetId = this.savedCabinetId || Number(this.trafficForm.get('cabinetId')?.value);
    if (!cabinetId || cabinetId <= 0) {
      this.toaster.warning(
        this.isAr
          ? 'برجاء إدخال رقم الكبينة وحفظها أولاً'
          : 'Please enter and save Cabinet ID first',
      );
      return;
    }

    this.isLoadingNodes = true;

    // Proactively fetch direction IDs if they are missing
    if (this.savedDirectionIds.length === 0) {
      this.fetchDirectionIds(cabinetId);
    }

    this.mapAdminService.getIncomingSegments(cabinetId).subscribe({
      next: (res) => {
        this.ngZone.run(() => {
          this.incomingSegments = res || [];
          this.isLoadingNodes = false;
          const lat = Number(this.trafficForm.get('latitude')?.value);
          const lng = Number(this.trafficForm.get('longitude')?.value);
          if (lat && lng) {
            setTimeout(() => {
              this.initStep4Map(lat, lng);
              this.displaySegmentsOnMap();
            }, 100);
          }
        });
      },
      error: (err) => {
        this.isLoadingNodes = false;
        this.toaster.errorFromBackend(err);
      },
    });
  }

  displaySegmentsOnMap(): void {
    if (!this.step4Map) return;
    this.segmentLayers.forEach((layer) => this.step4Map?.removeLayer(layer));
    this.segmentLayers.clear();

    this.incomingSegments.forEach((seg) => {
      const points = this.parseSegmentGeometry(seg.externalSegmentId);
      if (points.length < 2) return;

      const polyline = L.polyline(points, {
        color: '#3f51b5',
        weight: 6,
        opacity: 0.6,
        lineJoin: 'round',
      }).addTo(this.step4Map!);

      polyline.on('mouseover', () => {
        polyline.setStyle({ color: '#ff4081', opacity: 1, weight: 8 });
        polyline.bringToFront();
      });

      polyline.on('mouseout', () => {
        if (this.directionalBindings.get(this.selectedDirectionId!) !== seg.roadSegmentId) {
          polyline.setStyle({ color: '#3f51b5', opacity: 0.6, weight: 6 });
        }
      });

      polyline.on('click', () => {
        if (this.selectedDirectionId) {
          this.onDirectionSegmentSelected(this.selectedDirectionId, seg.roadSegmentId);
        }
      });

      polyline.bindTooltip(seg.name, { sticky: true });
      this.segmentLayers.set(seg.roadSegmentId, polyline);
    });

    if (this.incomingSegments.length > 0) {
      const allPoints = this.incomingSegments
        .flatMap((s) => this.parseSegmentGeometry(s.externalSegmentId))
        .filter((p) => p.length === 2);
      if (allPoints.length > 0) {
        this.step4Map.fitBounds(L.latLngBounds(allPoints as L.LatLngExpression[]), {
          padding: [50, 50],
        });
      }
    }
  }

  private parseSegmentGeometry(externalId: string): L.LatLngTuple[] {
    const matches = [...externalId.matchAll(/_(\d+\.\d+)_(\d+\.\d+)/g)];
    return matches.map((m) => [Number(m[1]), Number(m[2])] as L.LatLngTuple);
  }

  highlightSegmentOnMap(segId: string): void {
    this.segmentLayers.forEach((layer, id) => {
      if (id === segId) {
        layer.setStyle({ color: '#ff4081', opacity: 1, weight: 10 });
        layer.bringToFront();
      } else {
        const isBound = [...this.directionalBindings.values()].includes(id);
        layer.setStyle({
          color: isBound ? '#4caf50' : '#3f51b5',
          opacity: isBound ? 0.8 : 0.6,
          weight: 6,
        });
      }
    });
  }

  initStep4Map(lat: number, lng: number): void {
    if (!this.step4MapContainer) return;
    if (this.step4Map) this.step4Map.remove();
    this.step4Map = L.map(this.step4MapContainer.nativeElement).setView([lat, lng], 16);
    L.tileLayer('http://localhost:8081/tiles/{z}/{x}/{y}.png').addTo(this.step4Map);

    // Initial draw if segments exist
    if (this.incomingSegments.length > 0) this.displaySegmentsOnMap();
  }

  onDirectionSegmentSelected(dirId: number, segId: string): void {
    this.mapAdminService.bindDirectionToSegment(dirId, segId).subscribe({
      next: () => {
        this.directionalBindings.set(dirId, segId);
        this.highlightSegmentOnMap(segId);
        this.toaster.success(this.isAr ? 'تم الربط' : 'Bound');
      },
      error: (err) => this.toaster.errorFromBackend(err),
    });
  }

  isDirectionBound(id: number): boolean {
    return this.directionalBindings.has(id);
  }

  allDirectionsBound(): boolean {
    return (
      this.savedDirectionIds.length > 0 &&
      this.savedDirectionIds.every((d) => this.directionalBindings.has(d.directionId))
    );
  }

  clearStep4Map(): void {
    if (this.step4Map) this.step4Map.remove();
  }

  // ========= Template Helpers =========
  get templateForm(): FormGroup {
    return this.trafficForm.get('templateForm') as FormGroup;
  }
  get rows(): FormArray<FormGroup> {
    return this.templateForm.get('rows') as FormArray<FormGroup>;
  }
  onTemplateChange(id: number) {
    if (!id) {
      this.rows.clear();
      return;
    }
    this.templatePatternService.GetAllTemplatePatternByTemplateId(id).subscribe((resp) => {
      this.rows.clear();
      (resp || []).forEach((p: any) => this.rows.push(this.createRow(p)));
    });
  }
  private createRow(p: any): FormGroup {
    return this.fb.group({
      lightPatternId: [p.lightPatternId],
      lightPatternName: [p.lightPatternName || `#${p.lightPatternId}`],
      startFrom: [this.toHHmm(p.startFrom)],
      finishBy: [this.toHHmm(p.finishBy)],
    });
  }
  private toHHmm(s: any): string {
    if (!s) return '00:00';
    const [h = '00', m = '00'] = s.split(':');
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
  }
  private enableCtrl(c: any) {
    if (c && c.disabled) c.enable({ emitEvent: false });
  }
  private disableCtrl(c: any) {
    if (c && c.enabled) c.disable({ emitEvent: false });
  }
  private copyValue(s: any, d: any) {
    if (!s || !d) return;
    const was = d.disabled;
    if (was) d.enable({ emitEvent: false });
    d.setValue(s.value, { emitEvent: false });
    if (was) d.disable({ emitEvent: false });
  }

  getSelectedNodeId(): string {
    return (
      this.nearestNodes.find((n) => n.roadNodeId === this.selectedNodeId)?.externalNodeId || ''
    );
  }
  getSelectedNodeDistance(): number {
    return this.nearestNodes.find((n) => n.roadNodeId === this.selectedNodeId)?.distanceMeters || 0;
  }

  getBoundSegmentName(directionId: number): string {
    const segmentId = this.directionalBindings.get(directionId);
    if (!segmentId) return '';
    return this.incomingSegments.find((s) => s.roadSegmentId === segmentId)?.name || segmentId;
  }

  // Persistence Logic
  public savePersistence(): void {
    const state = {
      formData: this.trafficForm.getRawValue(),
      stepIndex: this.stepper?.selectedIndex || 0,
      savedCabinetId: this.savedCabinetId,
      savedDirectionIds: this.savedDirectionIds,
      bindings: Array.from(this.directionalBindings.entries()),
      selectedNodeId: this.selectedNodeId,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  private loadPersistence(): void {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const data = JSON.parse(saved);
      if (!data) return;

      // 1. Rebuild Directions FormArray
      if (data.formData?.directions) {
        this.directions.clear({ emitEvent: false });
        data.formData.directions.forEach((_: any, i: number) => {
          this.directions.push(this.buildDirectionGroup(i + 1), { emitEvent: false });
        });
      }

      // 2. Patch values
      this.trafficForm.patchValue(data.formData, { emitEvent: false });

      // 3. Restore IDs and bindings
      this.savedCabinetId = data.savedCabinetId;
      this.savedDirectionIds = data.savedDirectionIds || [];
      this.selectedNodeId = data.selectedNodeId;

      if (data.bindings) {
        this.directionalBindings = new Map(data.bindings);
      }

      // 4. Trigger child data loads
      if (data.formData.governorate) this.getAreas(data.formData.governorate);

      // Reconcile visuals if we have directions
      this.reconcileConflicts();
    } catch (e) {
      console.warn('Failed to load persistence', e);
    }
  }
}
