import { Component, OnInit, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormArray,
  AbstractControl,
} from '@angular/forms';
import { MatStep, MatStepperModule } from '@angular/material/stepper';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';

import { IGovernateService } from '../../Services/Governate/igovernate-service';
import { GetAllGovernate } from '../../Domain/Entity/Governate/GetAllGovernate';
import { IAreaService } from '../../Services/Area/iarea-service';
import { GetAllArea } from '../../Domain/Entity/Area/GetAllArea';
import { GetAllLightPattern } from '../../Domain/Entity/LightPattern/GetAllLightPattern';
import { LightPatternService } from '../../Services/LightPattern/light-pattern-service';

import { AddSignBoxWithUpdateLightPattern } from '../../Domain/Entity/SignControlBox/AddSignBoxWithUpdateLightPattern';
import { ISignBoxControlService } from '../../Services/SignControlBox/isign-box-controlService';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';

import { RoundaboutComponent } from '../roundabout-component/roundabout-component';
import { ResultError } from '../../Domain/ResultPattern/Error';
import { ResultV } from '../../Domain/ResultPattern/ResultV';
import { LanguageService } from '../../Services/Language/language-service';
import { Subscription } from 'rxjs';

type RoundDirection = {
  name?: string;
  order?: number;
  lightPatternId?: number;
  left: boolean;
  right: boolean;
};

// Simple IPv4 regex
const IPV4_REGEX = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

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
    RoundaboutComponent,
    MatStep,
  ],
  templateUrl: './traffic-wizard.html',
  styleUrl: './traffic-wizard.css',
})
export class TrafficWizard implements OnInit, OnDestroy {
  private readonly governateService = inject(IGovernateService);
  private readonly lightPatternService = inject(LightPatternService);
  private readonly signBoxService = inject(ISignBoxControlService);
  private readonly areaService = inject(IAreaService);
  public fb = inject(FormBuilder);
  public langService = inject(LanguageService);

  get isAr() {
    return this.langService.current === 'ar';
  }

  governates: GetAllGovernate[] = [];
  areas: GetAllArea[] = [];
  lightPatternEntity: ResultV<GetAllLightPattern> = {
    value: [],
    isSuccess: false,
    isFailure: false,
    error: {} as ResultError,
  };

  trafficForm: FormGroup;

  toasts: Array<{
    id: number;
    message: string;
    type: 'success' | 'error' | 'warn';
    active: boolean;
  }> = [];
  private toastSeq = 0;
  private toastTimers = new Map<number, any>();

  // sync light patterns across conflicts
  private patternSyncSubs = new Map<string, Subscription>();

  constructor() {
    this.trafficForm = this.fb.group({
      // Step 1
      governorate: [null, Validators.required],
      area: [null, Validators.required],

      // Step 2
      name: ['', Validators.required],

      id: [
        null,
        [
          Validators.required,
          Validators.min(1),
          Validators.max(40_000_000),
          Validators.pattern(/^[1-9]\d*$/),
        ],
      ],

      ipAddress: ['', [Validators.required, Validators.pattern(IPV4_REGEX)]],

      ipCabinet: [
        null,
        [
          Validators.required,
          Validators.min(0),
          Validators.pattern(
            /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/
          ),
        ],
      ],

      latitude: ['', Validators.required],
      longitude: ['', Validators.required],

      directions: this.fb.array([this.buildDirectionGroup(1)]),
    });
  }

  ngOnInit(): void {
    this.loadGovernate();
    this.loadLightPattern();
    this.directions.valueChanges.subscribe(() => this.reconcileConflicts());
  }

  ngOnDestroy(): void {
    this.clearAllPatternSyncSubs();
  }

  // ======= Data loading =======
  loadLightPattern() {
    this.lightPatternService.getAll().subscribe((data) => {
      this.lightPatternEntity = data;
    });
  }

  loadGovernate() {
    this.governateService.getAll({}).subscribe((data) => {
      this.governates = data.value;
    });
  }

  getAreas(id: number) {
    this.areaService.getAll(id).subscribe((data) => {
      this.areas = data.value;
    });
  }

  onGovernorateChangeValue(id: number | null): void {
    this.trafficForm.patchValue({ governorate: id, area: null });
    if (id != null && !Number.isNaN(id)) {
      this.getAreas(id);
    }
  }

  // ======= Form getters =======
  get directions(): FormArray {
    return this.trafficForm.get('directions') as FormArray;
  }

  // ========== Build / Add / Remove ==========
  private buildDirectionGroup(order: number): FormGroup {
    return this.fb.group({
      name: ['', Validators.required],
      lightPatternId: [null, Validators.required],
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

    for (let i = 0; i < this.directions.length; i++) {
      if (i === index) continue;
      const g = this.getDir(i);
      const cw = g.get('conflictWith')?.value as number | null;
      if (cw === index) {
        g.get('conflictWith')?.setValue(null, { emitEvent: false });
      }
    }

    this.directions.removeAt(index);

    for (let i = 0; i < this.directions.length; i++) {
      const g = this.getDir(i);
      const cw = g.get('conflictWith')?.value as number | null;
      if (cw != null && cw > index) {
        g.get('conflictWith')?.setValue(cw - 1, { emitEvent: false });
      }
    }

    this.reindexOrders();
    this.reconcileConflicts();
  }

  private reindexOrders() {
    this.directions.controls.forEach((g, i) =>
      g.get('order')?.setValue(i + 1, { emitEvent: false })
    );
  }

  onPatternChanged(_item: any, _lightPatternId: number) {}

  getGovernorateName(id: number | null): string {
    if (!id) return '';
    return this.governates.find((g) => g.id === id)?.name ?? '';
  }

  getAreaName(id: number | null): string {
    if (!id) return '';
    return this.areas.find((a) => a.id === id)?.name ?? '';
  }

  getPatternName(id: number | null): string {
    if (!id) return '';
    return this.lightPatternEntity.value.find((p) => p.id === id)?.name ?? '';
  }

  private prettifyField(name: string): string {
    if (!name) return '';
    const lower = name.toLowerCase();
    if (lower === 'ipaddress' || lower === 'ip_address' || lower === 'ip') return 'IP Address';
    if (lower === 'ipcabinet' || lower === 'ip_cabinet') return 'IP Cabinet';
    return name
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^(\w)/, (c) => c.toUpperCase());
  }

  getDirectionsForRoundabout(): RoundDirection[] {
    const raw = (this.directions.getRawValue() || []) as Array<{
      name?: string;
      order?: number;
      lightPatternId?: number | null;
      left?: boolean;
      right?: boolean;
    }>;

    const sorted = [...raw]
      .filter(Boolean)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .slice(0, 4);
    return sorted.map((d, i) => ({
      name: d.name ?? (this.isAr ? `اتجاه ${i + 1}` : `Direction ${i + 1}`),
      order: d.order ?? i + 1,
      lightPatternId: d.lightPatternId ?? undefined,
      left: !!d.left,
      right: !!d.right,
    }));
  }

  onRoundaboutChanged(updated: any[]): void {
    const count = Math.min(this.directions.length, (updated ?? []).length);
    for (let i = 0; i < count; i++) {
      const u = updated[i] ?? {};
      const g = this.directions.at(i) as FormGroup;
      const name = (u?.name ?? (this.isAr ? `اتجاه ${i + 1}` : `Direction ${i + 1}`))
        .toString()
        .trim();
      const order = Number(u?.order ?? i + 1);
      g.get('name')?.setValue(name);
      g.get('order')?.setValue(order, { emitEvent: false });
      const lp: number | null = typeof u?.lightPatternId === 'number' ? u.lightPatternId : null;
      const ctrl = g.get('lightPatternId');
      const wasDisabled = ctrl?.disabled;
      if (wasDisabled) ctrl?.enable({ emitEvent: false });
      ctrl?.setValue(lp, { emitEvent: false });
      if (wasDisabled) ctrl?.disable({ emitEvent: false });
      g.get('left')?.setValue(!!u?.left, { emitEvent: false });
      g.get('right')?.setValue(!!u?.right, { emitEvent: false });
    }
    this.reconcileConflicts();
  }

  onConflictSelected(currentIndex: number, selectedIndex: number | null) {
    const current = this.getDir(currentIndex);
    const oldIndex = current.get('conflictWith')?.value as number | null;

    if (oldIndex != null && this.existsDir(oldIndex)) {
      this.releaseConflict(oldIndex);
    }

    if (selectedIndex == null || selectedIndex === currentIndex) {
      current.get('conflictWith')?.setValue(null, { emitEvent: false });
      this.reconcileConflicts();
      return;
    }

    current.get('conflictWith')?.setValue(selectedIndex, { emitEvent: false });
    this.reconcileConflicts();
  }

  private getDir(i: number): FormGroup {
    return this.directions.at(i) as FormGroup;
  }
  private existsDir(i: number): boolean {
    return i >= 0 && i < this.directions.length;
  }
  private enablePattern(ctrl: AbstractControl | null) {
    if (ctrl && ctrl.disabled) ctrl.enable({ emitEvent: false });
  }
  private disablePattern(ctrl: AbstractControl | null) {
    if (ctrl && ctrl.enabled) ctrl.disable({ emitEvent: false });
  }
  private copyPattern(src: FormGroup, dst: FormGroup) {
    const srcCtrl = src.get('lightPatternId');
    const dstCtrl = dst.get('lightPatternId');
    const wasDisabled = dstCtrl?.disabled;
    if (wasDisabled) dstCtrl?.enable({ emitEvent: false });
    dstCtrl?.setValue(srcCtrl?.value ?? null, { emitEvent: false });
    if (wasDisabled) dstCtrl?.disable({ emitEvent: false });
  }
  private key(i: number, j: number) {
    return `${i}->${j}`;
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
      this.enablePattern(g.get('lightPatternId'));
    }

    const usedAsConflict = new Set<number>();
    for (let i = 0; i < this.directions.length; i++) {
      const g = this.getDir(i);
      const j = g.get('conflictWith')?.value as number | null;

      if (j == null || !this.existsDir(j) || j === i) {
        g.get('conflictWith')?.setValue(null, { emitEvent: false });
        continue;
      }

      if (usedAsConflict.has(j)) {
        g.get('conflictWith')?.setValue(null, { emitEvent: false });
        continue;
      }

      usedAsConflict.add(j);

      const primary = g;
      const conflict = this.getDir(j);

      this.copyPattern(primary, conflict);

      conflict.get('isConflict')?.setValue(true, { emitEvent: false });
      this.disablePattern(conflict.get('lightPatternId'));

      const sub = primary.get('lightPatternId')?.valueChanges.subscribe((val) => {
        const cCtrl = conflict.get('lightPatternId');
        const wasDisabled = cCtrl?.disabled;
        if (wasDisabled) cCtrl?.enable({ emitEvent: false });
        cCtrl?.setValue(val, { emitEvent: false });
        if (wasDisabled) cCtrl?.disable({ emitEvent: false });
      });
      if (sub) this.patternSyncSubs.set(this.key(i, j), sub);
    }
  }

  private releaseConflict(conflictIndex: number) {
    if (!this.existsDir(conflictIndex)) return;
    const conflict = this.getDir(conflictIndex);
    conflict.get('isConflict')?.setValue(false, { emitEvent: false });
    this.enablePattern(conflict.get('lightPatternId'));
  }

  onApply(): void {
    if (this.trafficForm.invalid) {
      this.trafficForm.markAllAsTouched();
      this.showPopup(
        this.isAr ? '⚠️ من فضلك املأ جميع الحقول المطلوبة' : '⚠️ Please fill all required fields',
        'warn'
      );
      return;
    }

    const v = this.trafficForm.getRawValue();
    const areaId = Number(v.area);
    if (areaId <= 0) {
      this.showPopup(
        this.isAr ? '⚠️ من فضلك اختر الحي قبل الحفظ' : '⚠️ Please select an area before saving',
        'warn'
      );
      return;
    }

    const payload = {
      id: Number(v.id),
      name: (v.name || '').trim(),
      areaId: areaId,
      ipAddress: (v.ipAddress || '').trim(),
      ipCabinet: (v.ipCabinet ?? '').trim(),
      latitude: String(v.latitude),
      longitude: String(v.longitude),
      directions: (v.directions as any[]).map((d: any) => ({
        name: d.name,
        order: d.order,
        lightPatternId: d.lightPatternId,
        left: !!d.left,
        right: !!d.right,
        isConflict: !!d.isConflict,
      })),
    } as AddSignBoxWithUpdateLightPattern;

    // ✅ استدعاء الإضافة عبر AddWithUpdateLightPattern (وليس AddSignBox)
    this.signBoxService.AddWithUpdateLightPattern(payload).subscribe({
      next: () => {
        this.showPopup(this.isAr ? '✅ تم الحفظ بنجاح' : '✅ Saved successfully!', 'success');
        this.trafficForm.reset();
        this.clearAllPatternSyncSubs();
        this.directions.clear();
        this.addDirection();
      },
      error: (err) => {
        console.error('❌ Save failed', err);
        this.showPopup(this.isAr ? '❌ حدث خطأ أثناء الحفظ' : '❌ Error while saving', 'error');
      },
    });
  }

  private showPopup(message: string, type: 'success' | 'error' | 'warn') {
    const id = ++this.toastSeq;
    this.toasts = [...this.toasts, { id, message, type, active: false }];
    setTimeout(() => {
      this.toasts = this.toasts.map((t) => (t.id === id ? { ...t, active: true } : t));
    }, 0);

    const lifetime = 4000;
    const timer = setTimeout(() => this.dismissToast(id), lifetime);
    this.toastTimers.set(id, timer);
  }

  dismissToast(id: number) {
    const timer = this.toastTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.toastTimers.delete(id);
    }
    this.toasts = this.toasts.map((t) => (t.id === id ? { ...t, active: false } : t));
    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    }, 500);
  }

  private dirAt(i: number): FormGroup {
    return this.directions.at(i) as FormGroup;
  }
  getRawPatternId(i: number): number | null {
    const raw = this.dirAt(i).getRawValue();
    return (raw?.lightPatternId ?? null) as number | null;
  }
  isConflict(i: number): boolean {
    return this.dirAt(i).get('isConflict')?.value === true;
  }
  isPatternLocked(i: number): boolean {
    return this.dirAt(i).get('lightPatternId')?.disabled === true;
  }
  getDirectionDisplayName(i: number): string {
    const g = this.dirAt(i);
    const name = (g.get('name')?.value || '').toString().trim();
    if (name) return name;
    return this.isAr ? `اتجاه ${i + 1}` : `Direction ${i + 1}`;
  }
  getDirectionOrder(i: number): number {
    return Number(this.dirAt(i).get('order')?.value ?? i + 1);
  }
  getConflictWithIndex(i: number): number | null {
    const val = this.dirAt(i).get('conflictWith')?.value;
    return val === 0 || val ? Number(val) : null;
  }
}
