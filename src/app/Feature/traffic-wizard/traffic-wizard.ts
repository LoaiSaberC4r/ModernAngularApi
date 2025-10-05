import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormArray } from '@angular/forms';
import { MatStepperModule } from '@angular/material/stepper';
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
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';

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
    MatSnackBarModule,
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
  private readonly snackBar = inject(MatSnackBar);

  governates: GetAllGovernate[] = [];
  areas: GetAllArea[] = [];
  lightPatternEntity: ResultV<GetAllLightPattern> = {
    value: [],
    isSuccess: false,
    isFailure: false,
    error: {} as ResultError,
  };

  trafficForm: FormGroup;

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

      // Directions (ابدأ باتجاه واحد فقط)
      directions: this.fb.array([this.buildDirectionGroup(1)]),
    });
  }

  /** يبني فورم-جروب لاتجاه */
  private buildDirectionGroup(order: number): FormGroup {
    return this.fb.group({
      name: ['', Validators.required],
      lightPatternId: [null, Validators.required], // في الفورم نسمح بـ null
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
      // إعادة ترقيم order المتبقية 1..n
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

  /**
   * تجهيز بيانات الخريطة:
   * - ترتيب بالـ order
   * - بدون إكمال تلقائي لـ 4 عناصر (حسب ما المستخدم أضاف فقط)
   * - تحويل lightPatternId = null -> undefined
   * - ضمان left/right boolean
   */
  getDirectionsForRoundabout(): RoundDirection[] {
    const raw = (this.directions.value || []) as Array<{
      name?: string;
      order?: number;
      lightPatternId?: number | null;
      left?: boolean;
      right?: boolean;
    }>;

    const sorted = [...raw]
      .filter((x) => !!x) // أمان
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .slice(0, 4); // أقصى 4 فقط

    // لا نكمّل عناصر ناقصة — نرجع العدد الحقيقي
    return sorted.map((d, i) => ({
      name: d.name ?? `اتجاه ${i + 1}`,
      order: d.order ?? i + 1,
      lightPatternId: d.lightPatternId ?? undefined, // الخريطة لا تحتاج null
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

      // في الفورم نفضّل null عند عدم الاختيار
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
      this.showPopup('⚠️ من فضلك أكمل جميع الحقول المطلوبة', 'إغلاق', 'warn');
      return;
    }

    const v = this.trafficForm.value;
    const areaId = Number(v.area);
    if (areaId <= 0) {
      this.showPopup('⚠️ يجب اختيار المنطقة قبل الحفظ', 'حسنًا', 'warn');
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
      next: (res) => {
        this.showPopup('✅ تم حفظ البيانات بنجاح', 'إغلاق', 'success');
        this.trafficForm.reset();
        this.directions.clear();
        this.addDirection();
      },
      error: (err) => {
        console.error('❌ فشل الحفظ', err);

        if (err.error?.errorMessages?.length) {
          const messages = err.error.errorMessages
            .map((m: string, i: number) => `${m}: ${err.error.propertyNames?.[i] || ''}`)
            .join('\n');
          this.showPopup(`⚠️ ${messages}`, 'إغلاق', 'error');
        } else {
          this.showPopup('❌ حدث خطأ أثناء الحفظ. تحقق من البيانات.', 'إغلاق', 'error');
        }
      },
    });
  }
  private showPopup(message: string, action: string, type: 'success' | 'error' | 'warn') {
    this.snackBar.open(message, action, {
      duration: 4000,
      horizontalPosition: 'start',
      verticalPosition: 'bottom',
      panelClass: [`snack-${type}`, 'snack-animate'],
    });
  }
}
