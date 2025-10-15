import { Component, OnInit, inject, OnDestroy } from '@angular/core';
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

import { ISignBoxControlService } from '../../Services/SignControlBox/isign-box-controlService';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';

import { RoundaboutComponent } from '../roundabout-component/roundabout-component';
import { ResultError } from '../../Domain/ResultPattern/Error';
import { ResultV } from '../../Domain/ResultPattern/ResultV';
import { LanguageService } from '../../Services/Language/language-service';
import { Subscription } from 'rxjs';
import { GetAllTemplate } from '../../Domain/Entity/Template/GetAllTemplate';
import { ITemplateService } from '../../Services/Template/itemplate-service';
import { ITemplatePatternService } from '../../Services/TemplatePattern/itemplate-pattern-service';
import { LightPatternForTemplatePattern } from '../../Domain/Entity/TemplatePattern/TemplatePattern';
import {
  AddSignBoxCommandDto,
  DirectionWithPatternDto,
} from '../../Domain/Entity/SignControlBox/AddSignBoxCommandDto';
import { Router } from '@angular/router';

type RoundDirection = {
  name?: string;
  order?: number;
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
  private readonly signBoxService = inject(ISignBoxControlService);
  private readonly areaService = inject(IAreaService);
  public fb = inject(FormBuilder);
  public langService = inject(LanguageService);
  private readonly templateService = inject(ITemplateService);
  private readonly templatePatternService = inject(ITemplatePatternService);
  private readonly router = inject(Router);

  get isAr() {
    return this.langService.current === 'ar';
  }

  templates: GetAllTemplate[] = [];

  governates: GetAllGovernate[] = [];
  areas: GetAllArea[] = [];

  trafficForm: FormGroup;

  toasts: Array<{
    id: number;
    message: string;
    type: 'success' | 'error' | 'warn';
    active: boolean;
  }> = [];
  private toastSeq = 0;
  private toastTimers = new Map<number, any>();

  // sync (templateId) across conflicts
  private patternSyncSubs = new Map<string, Subscription>();

  constructor() {
    this.trafficForm = this.fb.group({
      // Step 1
      governorate: [null, Validators.required],
      area: [null, Validators.required],

      // Step 2
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
    this.directions.valueChanges.subscribe(() => this.reconcileConflicts());
  }

  ngOnDestroy(): void {
    this.clearAllPatternSyncSubs();
  }

  // ======= Data loading =======
  private loadTemplates(): void {
    this.templateService.GetAll().subscribe((res) => {
      this.templates = res?.value ?? [];
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

    const removedOrder = Number(this.getDir(index).get('order')?.value ?? index + 1);

    for (let i = 0; i < this.directions.length; i++) {
      if (i === index) continue;
      const g = this.getDir(i);
      const cwLane = g.get('conflictWith')?.value as number | null;
      if (cwLane === removedOrder) {
        g.get('conflictWith')?.setValue(null, { emitEvent: false });
      }
    }

    this.directions.removeAt(index);

    this.reindexOrders();
    for (let i = 0; i < this.directions.length; i++) {
      const g = this.getDir(i);
      const cwLane = g.get('conflictWith')?.value as number | null;
      if (cwLane != null && cwLane > removedOrder) {
        g.get('conflictWith')?.setValue(cwLane - 1, { emitEvent: false });
      }
    }

    this.reconcileConflicts();
  }

  private reindexOrders() {
    this.directions.controls.forEach((g, i) =>
      g.get('order')?.setValue(i + 1, { emitEvent: false })
    );
  }

  getGovernorateName(id: number | null): string {
    if (!id) return '';
    return this.governates.find((g) => g.id === id)?.name ?? '';
  }

  getAreaName(id: number | null): string {
    if (!id) return '';
    return this.areas.find((a) => a.id === id)?.name ?? '';
  }

  templateName(id: number | null | undefined): string {
    const notSet = this.isAr ? 'غير محدد' : 'Not set';
    const n = Number(id || 0);
    if (!n) return notSet;
    const t = this.templates?.find((t) => t.id === n);
    return t?.name ?? notSet;
  }

  conflictTargetName(lane: number | null | undefined): string {
    if (!lane) return '';
    const n = Number(lane);
    const grp = this.directions.controls.find((g) => Number(g.get('order')?.value) === n);
    const raw = (grp?.get('name')?.value || '').toString().trim();
    return raw || (this.isAr ? `اتجاه ${n}` : `Direction ${n}`);
  }

  getDirectionsForRoundabout(): RoundDirection[] {
    const raw = (this.directions.getRawValue() || []) as Array<{
      name?: string;
      order?: number;
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
      left: !!d.left,
      right: !!d.right,
    }));
  }

  onRoundaboutChanged(updated: any[]): void {
    const count = Math.min(this.directions.length, (updated ?? []).length);
    for (let i = 0; i < count; i++) {
      const u = updated[i] ?? {};
      const g = this.directions.at(i) as FormGroup;
      const name = (u?.name ?? (this.isAr ? `اتجاه ${i + 1}` : `Direction ${i + 1}`)).toString();

      const order = Number(u?.order ?? i + 1);
      g.get('name')?.setValue(name);
      g.get('order')?.setValue(order, { emitEvent: false });
      g.get('left')?.setValue(!!u?.left, { emitEvent: false });
      g.get('right')?.setValue(!!u?.right, { emitEvent: false });
    }
    this.reconcileConflicts();
  }

  onConflictSelected(currentIndex: number, selectedLane: number | null) {
    const current = this.getDir(currentIndex);
    const oldLane = current.get('conflictWith')?.value as number | null;

    if (oldLane != null) {
      const oldIdx = this.findIndexByLane(oldLane);
      if (oldIdx !== null) this.releaseConflict(oldIdx);
    }

    if (selectedLane == null) {
      current.get('conflictWith')?.setValue(null, { emitEvent: false });
      this.reconcileConflicts();
      return;
    }

    current.get('conflictWith')?.setValue(selectedLane, { emitEvent: false });
    this.reconcileConflicts();
  }

  private getDir(i: number): FormGroup {
    return this.directions.at(i) as FormGroup;
  }
  private existsDir(i: number): boolean {
    return i >= 0 && i < this.directions.length;
  }

  private key(i: number, j: number) {
    return `${i}->${j}`;
  }
  private clearAllPatternSyncSubs() {
    this.patternSyncSubs.forEach((s) => s.unsubscribe());
    this.patternSyncSubs.clear();
  }

  /**
   * تحويل ConflictWith من رقم مسار إلى index + ربط القوالب (templateId فقط)
   */
  private reconcileConflicts() {
    this.clearAllPatternSyncSubs();

    // reset
    for (let i = 0; i < this.directions.length; i++) {
      const g = this.getDir(i);
      g.get('isConflict')?.setValue(false, { emitEvent: false });
      this.enableCtrl(g.get('templateId'));
    }

    const usedAsConflictLane = new Set<number>();
    for (let i = 0; i < this.directions.length; i++) {
      const primary = this.getDir(i);
      const lane = primary.get('conflictWith')?.value as number | null;

      if (lane == null) {
        primary.get('conflictWith')?.setValue(null, { emitEvent: false });
        continue;
      }

      const j = this.findIndexByLane(lane);
      if (j === null || j === i) {
        primary.get('conflictWith')?.setValue(null, { emitEvent: false });
        continue;
      }

      if (usedAsConflictLane.has(lane)) {
        primary.get('conflictWith')?.setValue(null, { emitEvent: false });
        continue;
      }
      usedAsConflictLane.add(lane);

      const conflict = this.getDir(j);

      // copy + lock (templateId only)
      this.copyValue(primary.get('templateId'), conflict.get('templateId'));

      conflict.get('isConflict')?.setValue(true, { emitEvent: false });
      this.disableCtrl(conflict.get('templateId'));

      // live sync subscriptions
      const sub2 = primary.get('templateId')?.valueChanges.subscribe(() => {
        this.copyValue(primary.get('templateId'), conflict.get('templateId'));
      });
      if (sub2) this.patternSyncSubs.set(this.key(i, j) + '/tp', sub2);
    }
  }

  private releaseConflict(conflictIndex: number) {
    if (!this.existsDir(conflictIndex)) return;
    const conflict = this.getDir(conflictIndex);
    conflict.get('isConflict')?.setValue(false, { emitEvent: false });
    this.enableCtrl(conflict.get('templateId'));
  }

  private findIndexByLane(lane: number | null): number | null {
    if (lane == null) return null;
    for (let i = 0; i < this.directions.length; i++) {
      const g = this.getDir(i);
      if (Number(g.get('order')?.value) === Number(lane)) return i;
    }
    return null;
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

    const directions: DirectionWithPatternDto[] = (v.directions as any[]).map(
      (d: any, idx: number) => ({
        name: (d.name || '').trim(),
        order: Number(d.order || idx + 1),
        lightPatternId: 0,
        left: !!d.left,
        right: !!d.right,
        isConflict: !!d.isConflict,
        templateId: Number(d.templateId || 0),
      })
    );

    const badDir = directions.findIndex(
      (x) => !(Number.isFinite(x.templateId) && x.templateId! > 0)
    );
    if (badDir !== -1) {
      this.showPopup(
        this.isAr
          ? `⚠️ اختر القالب للاتجاه رقم ${badDir + 1}`
          : `⚠️ Select a template for direction ${badDir + 1}`,
        'warn'
      );
      return;
    }

    const formTpl = Number(this.templateForm.get('templateId')?.value || 0);
    const payloadTemplateId = formTpl > 0 ? formTpl : directions[0]?.templateId ?? 0;

    if (!(payloadTemplateId > 0)) {
      this.showPopup(
        this.isAr ? '⚠️ اختر قالبًا رئيسيًا' : '⚠️ Please select a main template',
        'warn'
      );
      return;
    }

    const cabinetId = Number(v.cabinetId);
    if (cabinetId <= 0) {
      this.showPopup(
        this.isAr ? '⚠️ من فضلك اختر المخزن قبل الحفظ' : '⚠️ Please select a cabinet before saving',
        'warn'
      );
      return;
    }

    const payload: AddSignBoxCommandDto = {
      ...v,
      name: (v.name || '').trim(),
      areaId: Number(v.area),
      ipAddress: (v.ipAddress || '').trim(),
      latitude: String(v.latitude),
      longitude: String(v.longitude),
      cabinetId: cabinetId,
      templateId: payloadTemplateId,
      directions,
    };

    console.log('PAYLOAD =>', JSON.stringify(payload, null, 2));

    this.signBoxService.AddSignBox(payload).subscribe({
      next: () => {
        this.showPopup(this.isAr ? '✅ تم الحفظ بنجاح' : '✅ Saved successfully!', 'success');
        this.trafficForm.reset();
        this.clearAllPatternSyncSubs();
        this.directions.clear();
        this.addDirection();
      },
      error: (err) => {
        const { messages, fieldMap } = this.extractApiErrors(err);

        this.applyServerFieldErrors(fieldMap);

        const bullet = this.isAr ? '• ' : '• ';
        const header = this.isAr ? '❌ حدث خطأ أثناء الحفظ:\n' : '❌ Failed to save:\n';
        const body = messages.length
          ? messages.map((m) => `${bullet}${m}`).join('\n')
          : this.isAr
          ? 'خطأ غير معروف'
          : 'Unknown error';

        this.showPopup(header + body, 'error');

        console.error('Save failed', err);
        console.log('Server error body:', JSON.stringify(err?.error ?? err, null, 2));
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

  isConflict(i: number): boolean {
    return this.dirAt(i).get('isConflict')?.value === true;
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
    const lane = this.dirAt(i).get('conflictWith')?.value as number | null;
    return this.findIndexByLane(lane);
  }

  get templateForm(): FormGroup {
    return this.trafficForm.get('templateForm') as FormGroup;
  }
  get rows(): FormArray<FormGroup> {
    return this.templateForm.get('rows') as FormArray<FormGroup>;
  }

  private createRow(p: LightPatternForTemplatePattern): FormGroup {
    return this.fb.group({
      lightPatternId: new FormControl<number>(p.lightPatternId, { nonNullable: true }),
      lightPatternName: new FormControl<string>(p.lightPatternName ?? `#${p.lightPatternId}`, {
        nonNullable: true,
      }),
      startFrom: new FormControl<string>(this.toHHmm(p.startFrom), { nonNullable: true }),
      finishBy: new FormControl<string>(this.toHHmm(p.finishBy), { nonNullable: true }),
    });
  }

  onTemplateChange(id: number | null) {
    const templateId = Number(id || 0);

    if (!templateId) {
      this.templateForm.reset({ templateId: 0, templateName: '' });
      this.rows.clear();
      return;
    }

    this.templatePatternService
      .GetAllTemplatePatternByTemplateId(templateId)
      .subscribe((resp: ResultV<LightPatternForTemplatePattern>) => {
        const list = resp?.value ?? [];
        const patterns: LightPatternForTemplatePattern[] = list.map((p) => ({
          ...p,
          lightPatternName: p.lightPatternName || `#${p.lightPatternId}`,
        }));

        this.templateForm.patchValue({
          templateId,
          templateName: this.templates.find((t) => t.id === templateId)?.name ?? '',
        });

        this.rows.clear();
        patterns.forEach((p) => this.rows.push(this.createRow(p)));
      });
  }

  private toHHmm(s?: string | null): string {
    if (!s) return '00:00';
    const [h = '00', m = '00'] = s.split(':');
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
  }

  private toHHmmss(s?: string | null): string {
    if (!s) return '00:00:00';
    const [h = '00', m = '00'] = s.split(':');
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`;
  }

  isStep2Invalid(): boolean {
    const baseInvalid =
      this.trafficForm.get('name')?.invalid ||
      this.trafficForm.get('cabinetId')?.invalid ||
      this.trafficForm.get('ipAddress')?.invalid ||
      this.trafficForm.get('latitude')?.invalid ||
      this.trafficForm.get('longitude')?.invalid;

    const anyDirInvalid = this.directions.controls.some(
      (g) => g.get('name')?.invalid || g.get('order')?.invalid
    );

    return !!(baseInvalid || anyDirInvalid);
  }

  private enableCtrl(ctrl: AbstractControl | null) {
    if (ctrl && ctrl.disabled) ctrl.enable({ emitEvent: false });
  }
  private disableCtrl(ctrl: AbstractControl | null) {
    if (ctrl && ctrl.enabled) ctrl.disable({ emitEvent: false });
  }
  private copyValue(src: AbstractControl | null, dst: AbstractControl | null) {
    const wasDisabled = !!dst && dst.disabled;
    if (wasDisabled) dst?.enable({ emitEvent: false });
    dst?.setValue(src?.value ?? null, { emitEvent: false });
    if (wasDisabled) dst?.disable({ emitEvent: false });
  }

  onDirectionTemplateChange(index: number, templateId: number | null) {
    const g = this.directions.at(index) as FormGroup;
    g.get('templateId')?.setValue(Number(templateId || 0), { emitEvent: true });
    this.reconcileConflicts();
  }
  directionLabel(i: number): string {
    return this.isAr ? `اسم الاتجاه ${i + 1}` : `Direction ${i + 1} Name`;
  }

  forceSpaceAtCaret(e: Event, dir: FormGroup) {
    const input = e.target as HTMLInputElement;
    if (!input) return;

    e.stopPropagation();
    e.preventDefault();

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;

    const before = input.value.slice(0, start);
    const after = input.value.slice(end);
    const newVal = before + ' ' + after;

    input.value = newVal;
    dir.get('name')?.setValue(newVal);

    const caret = start + 1;
    setTimeout(() => {
      try {
        input.setSelectionRange(caret, caret);
      } catch {}
    });
  }
  private extractApiErrors(err: any): { messages: string[]; fieldMap: Record<string, string[]> } {
    const messages: string[] = [];
    const fieldMap: Record<string, string[]> = {};

    const e = err?.error ?? err;

    if (e?.errors && typeof e.errors === 'object') {
      for (const [field, arr] of Object.entries(e.errors)) {
        const list = Array.isArray(arr) ? arr : [String(arr)];
        fieldMap[field] = list.map(String);
        list.forEach((m) => messages.push(m));
      }
    }

    if (Array.isArray(e?.errorMessages) && e.errorMessages.length) {
      if (Array.isArray(e?.propertyNames) && e.propertyNames.length === e.errorMessages.length) {
        for (let i = 0; i < e.propertyNames.length; i++) {
          const field = String(e.propertyNames[i] || 'General');
          const msg = String(e.errorMessages[i] || '');
          fieldMap[field] = [...(fieldMap[field] || []), msg];
          messages.push(msg);
        }
      } else {
        e.errorMessages.forEach((m: any) => messages.push(String(m)));
      }
    }

    if (e?.title && !messages.length) messages.push(String(e.title));
    if (e?.detail) messages.push(String(e.detail));

    if (!messages.length && typeof e === 'string') messages.push(e);
    if (!messages.length && err?.message) messages.push(String(err.message));

    const uniq = Array.from(new Set(messages.filter(Boolean).map(String)));

    return { messages: uniq, fieldMap };
  }

  private mapApiFieldToControlName(apiField: string): string | null {
    const f = apiField?.toLowerCase();

    if (f.includes('ip')) return 'ipAddress';
    if (f.includes('cabinet')) return 'cabinetId';
    if (f.includes('name')) return 'name';
    if (f.includes('latitude') || f.includes('lat')) return 'latitude';
    if (f.includes('longitude') || f.includes('lng') || f.includes('long')) return 'longitude';
    if (f.includes('governorate') || f.includes('governate')) return 'governorate';
    if (f.includes('area')) return 'area';

    if (f.startsWith('directions[')) {
      const m = f.match(/directions\[(\d+)\]\.(.+)/i);
      if (m) {
        const idx = Number(m[1]);
        const field = m[2];
        const ctrl = this.directions.at(idx) as FormGroup;
        if (ctrl?.get(field)) return `__dir__${idx}__${field}`;
      }
    }

    return null;
  }

  private applyServerFieldErrors(fieldMap: Record<string, string[]>) {
    for (const [apiField, msgs] of Object.entries(fieldMap)) {
      const ctrlName = this.mapApiFieldToControlName(apiField);
      if (!ctrlName) continue;

      if (ctrlName.startsWith('__dir__')) {
        // directions
        const [, idxStr, field] = ctrlName.split('__');
        const idx = Number(idxStr);
        const g = this.directions.at(idx) as FormGroup;
        const c = g?.get(field);
        if (c) {
          const prev = c.errors || {};
          c.setErrors({ ...prev, server: true });
          c.markAsTouched();
        }
      } else {
        const c = this.trafficForm.get(ctrlName);
        if (c) {
          const prev = c.errors || {};
          c.setErrors({ ...prev, server: true });
          c.markAsTouched();
        }
      }
    }
  }
}
