import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
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

type RoundDirection = {
  name?: string;
  order?: number;
  lightPatternId?: number;
  left: boolean;
  right: boolean;
};

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
export class TrafficWizard implements OnInit {
  private readonly governateService = inject(IGovernateService);
  private readonly lightPatternService = inject(LightPatternService);
  private readonly signBoxService = inject(ISignBoxControlService);
  private readonly areaService = inject(IAreaService);
  public fb = inject(FormBuilder);

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

  constructor() {
    this.trafficForm = this.fb.group({
      // Step 1
      governorate: [null, Validators.required],
      area: [null, Validators.required],

      // Step 2
      name: ['', Validators.required],
      ipAddress: ['', Validators.required],
      latitude: ['', Validators.required],
      longitude: ['', Validators.required],

      // Directions
      directions: this.fb.array([this.buildDirectionGroup(1)]),
    });
  }

  private buildDirectionGroup(order: number): FormGroup {
    return this.fb.group({
      name: ['', Validators.required],
      lightPatternId: [null, Validators.required],
      order: [order, [Validators.required, Validators.min(1)]],
      left: [false],
      right: [false],
    });
  }

  ngOnInit(): void {
    this.loadGovernate();
    this.loadLightPattern();
  }

  // Data loading
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

  // Form getters
  get directions(): FormArray {
    return this.trafficForm.get('directions') as FormArray;
  }

  addDirection() {
    if (this.directions.length < 4) {
      this.directions.push(this.buildDirectionGroup(this.directions.length + 1));
    }
  }

  removeDirection(index: number) {
    if (this.directions.length > 1) {
      this.directions.removeAt(index);
      // إعادة ترقيم order 1..n
      this.directions.controls.forEach((g, i) =>
        g.get('order')?.setValue(i + 1, { emitEvent: false })
      );
    }
  }

  onPatternChanged(_item: any, _lightPatternId: number) {
    // hook اختياري
  }

  // Helpers
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

  // Pretty-print backend field names for user-facing messages
  private prettifyField(name: string): string {
    if (!name) return '';
    const lower = name.toLowerCase();
    if (lower === 'ipaddress' || lower === 'ip_address' || lower === 'ip') {
      return 'IP Address';
    }
    return name
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^(\w)/, (c) => c.toUpperCase());
  }

  getDirectionsForRoundabout(): RoundDirection[] {
    const raw = (this.directions.value || []) as Array<{
      name?: string;
      order?: number;
      lightPatternId?: number | null;
      left?: boolean;
      right?: boolean;
    }>;

    const sorted = [...raw]
      .filter((x) => !!x)
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .slice(0, 4);

    return sorted.map((d, i) => ({
      name: d.name ?? `اتجاه ${i + 1}`,
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

      const name = (u?.name ?? `اتجاه ${i + 1}`).toString().trim();
      const order = Number(u?.order ?? i + 1);

      g.get('name')?.setValue(name);
      g.get('order')?.setValue(order, { emitEvent: false });

      const lp: number | null = typeof u?.lightPatternId === 'number' ? u.lightPatternId : null;
      g.get('lightPatternId')?.setValue(lp, { emitEvent: false });

      g.get('left')?.setValue(!!u?.left, { emitEvent: false });
      g.get('right')?.setValue(!!u?.right, { emitEvent: false });
    }
  }

  // Submit
  onApply(): void {
    if (this.trafficForm.invalid) {
      this.trafficForm.markAllAsTouched();
      this.showPopup('⚠️ Please fill all required fields', 'warn');
      return;
    }

    const v = this.trafficForm.value;
    const areaId = Number(v.area);
    if (areaId <= 0) {
      this.showPopup('⚠️ Please select an area before saving', 'warn');
      return;
    }

    const payload: AddSignBoxWithUpdateLightPattern = {
      name: v.name.trim(),
      areaId: areaId,
      ipAddress: v.ipAddress.trim(),
      latitude: String(v.latitude),
      longitude: String(v.longitude),
      directions: (v.directions as any[]).map((d) => ({
        name: d.name,
        order: d.order,
        lightPatternId: d.lightPatternId,
        left: d.left,
        right: d.right,
      })),
    };

    this.signBoxService.AddSignBox(payload).subscribe({
      next: () => {
        this.showPopup(' Saved successfully!', 'success');
        this.trafficForm.reset();
        this.directions.clear();
        this.addDirection();
      },
      error: (err) => {
        console.error('❌ Save failed', err);

        if (err?.error?.errorMessages?.length) {
          const ipTyped = this.trafficForm?.value?.ipAddress ?? '';
          const messages = err.error.errorMessages
            .map((m: string, i: number) => {
              const rawProp: string = err.error.propertyNames?.[i] || '';
              const prop = this.prettifyField(rawProp);
              // Normalize message text for IP wording
              let text = m.replace(/ip\s*address|ipaddress/gi, 'IP Address');
              if (prop) {
                text += `: ${prop}`;
              }
              // If the error is about IP Address, append the entered value for clarity
              const isIpError = rawProp.toLowerCase() === 'ipaddress' || /ip\s*address/i.test(m);
              if (isIpError && ipTyped) {
                text += `: ${ipTyped}`;
              }
              return text;
            })
            .join('\n');
          this.showPopup('⚠️ ' + messages, 'warn');
        } else {
          this.showPopup('❌ Error while saving', 'error');
        }
      },
    });
  }

  // ===== Template-driven popup API =====
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
}
