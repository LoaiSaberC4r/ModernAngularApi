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
import { ITemplatePatternService } from '../../Services/TemplatePattern/itemplate-pattern-service';
import { ITemplateService } from '../../Services/Template/itemplate-service';
import { LightPatternForTemplatePattern } from '../../Domain/Entity/TemplatePattern/TemplatePattern';
import { GetLightPattern } from '../../Domain/Entity/LightPattern/GetLightPattern';
import { GetAllTemplate } from '../../Domain/Entity/Template/GetAllTemplate';
import { MatIconModule } from '@angular/material/icon';
import { Pagination } from '../../Domain/ResultPattern/Pagination';
import { ResultError } from '../../Domain/ResultPattern/Error';
import { ResultV } from '../../Domain/ResultPattern/ResultV';
import { MatDividerModule } from '@angular/material/divider';
import { RoundaboutComponent } from '../roundabout-component/roundabout-component';
import { GetAllSignControlBoxWithLightPattern } from '../../Domain/Entity/SignControlBox/GetAllSignControlBoxWithLightPattern';
import { AddSignBoxCommandDto } from '../../Domain/Entity/SignControlBox/AddSignBoxCommandDto';

@Component({
  selector: 'app-traffic-wizard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    // Angular Material
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
  ],
  templateUrl: './traffic-wizard.html',
  styleUrl: './traffic-wizard.css',
})
export class TrafficWizard implements OnInit {
  private readonly governateService = inject(IGovernateService);
  private readonly lightPatternService = inject(LightPatternService);
  private readonly signBoxControlService = inject(ISignBoxControlService);
  private map!: L.Map;
  private marker!: L.Marker;

  public fb = inject(FormBuilder);
  private readonly areaService = inject(IAreaService);
  private readonly signBoxService = inject(ISignBoxControlService);
  private readonly templatePatternService = inject(ITemplatePatternService);
  private readonly templateService = inject(ITemplateService);

  governates: GetAllGovernate[] = [];
  areas: GetAllArea[] = [];
  templates: GetAllTemplate[] = [];
  templatePatterns: LightPatternForTemplatePattern[] = [];
  selectedLightPatternId: number | null = null;
  lightPattern: GetLightPattern | null = null;

  trafficForm: FormGroup;
  pattern: GetAllLightPattern[] = [];

  constructor() {
    this.trafficForm = this.fb.group({
      // Step 1
      governorate: ['', Validators.required],
      area: [null, Validators.required],

      // Step 2
      latitude: ['', Validators.required],
      longitude: ['', Validators.required],
      ipAddress: ['', Validators.required],

      // Step 3
      pattern: [],
      template: ['0'],
      green: 0,
      yellow: 0,
      red: [{ value: 0, disabled: true }],
      blinkGreen: [{ value: false, disabled: true }],
      blinkYellow: [{ value: false, disabled: true }],
      blinkRed: [{ value: false, disabled: true }],
      blinkMs: [500],

      greenTime: [0],
      amberTime: [0],
      redTime: [{ value: 0, disabled: true }],

      directions: this.fb.array([
        this.fb.group({
          name: ['', Validators.required],
          lightPatternId: [null, Validators.required],
          order: [1, [Validators.required, Validators.min(1)]],
          redTime: [0, Validators.required],
          yellowTime: [0, Validators.required],
          greenTime: [0, Validators.required],
        }),
      ]),
    });

    // Auto-calc red
    this.trafficForm.get('green')?.valueChanges.subscribe(() => this.updateRedTime());
    this.trafficForm.get('yellow')?.valueChanges.subscribe(() => this.updateRedTime());

    // Disable blink checkboxes initially
    this.trafficForm.get('blinkGreen')?.disable();
    this.trafficForm.get('blinkYellow')?.disable();
    this.trafficForm.get('blinkRed')?.disable();
  }

  signBoxEntity: Pagination<GetAllSignControlBoxWithLightPattern> = {
    value: {
      data: [],
      pageSize: 0,
      totalPages: 0,
      currentPage: 1,
      hasNextPage: false,
      hasPreviousPage: false,
      totalItems: 0,
    },
    isSuccess: false,
    isFailure: false,
    error: {} as ResultError,
  };
  lightPatternEntity: ResultV<GetAllLightPattern> = {
    value: [],
    isSuccess: false,
    isFailure: false,
    error: {} as ResultError,
  };

  ngOnInit(): void {
    this.loadGovernate();
    this.loadAllTemplates();

    this.loadLightPattern();
  }

  // Data loading
  loadLightPattern() {
    this.lightPatternService.getAll({}).subscribe((data) => {
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
    console.log(this.areas);
  }

  //  Events
  onGovernorateChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    const id = select.value === '' ? null : Number(select.value);

    this.trafficForm.patchValue({ governorate: id, area: null });

    if (id != null && !Number.isNaN(id)) {
      this.getAreas(id);
    }
    console.log(this.areas);
  }
  onGovernorateChangeValue(id: number | null): void {
    this.trafficForm.patchValue({ governorate: id, area: null });
    if (id != null && !Number.isNaN(id)) {
      this.getAreas(id);
    }
  }

  onLightPatternChange(): void {
    const selected = this.trafficForm.get('pattern')!.value as GetAllLightPattern | null;
    if (!selected) return;

    const clampByte = (n: unknown) => Math.max(0, Math.min(255, Number(n) || 0));

    this.trafficForm.patchValue(
      {
        green: clampByte((selected as any).green),
        yellow: clampByte((selected as any).yellow),
        red: clampByte((selected as any).red),
      },
      { emitEvent: true }
    );
  }

  private updateRedTime(): void {
    const selectedPattern = this.trafficForm.get('pattern')?.value;
    if (selectedPattern) return;

    const green = Number(this.trafficForm.get('green')?.value) || 0;
    const yellow = Number(this.trafficForm.get('yellow')?.value) || 0;
    const redCtrl = this.trafficForm.get('red');

    if (redCtrl) {
      redCtrl.setValue(green + yellow, { emitEvent: false });
    }
  }

  // Submit
  onApply(): void {
    if (this.trafficForm.invalid) {
      this.trafficForm.markAllAsTouched();
      return;
    }

    const v = this.trafficForm.value;

    // IP Address
    const ipAddress = (v.ipAddress ?? '').trim();
    if (!ipAddress) {
      console.error('IP Address is required');
      return;
    }

    // خذ أول اتجاه
    const firstDirection = v.directions?.[0];
    const lightPatternId = firstDirection?.lightPatternId;

    if (!lightPatternId) {
      console.error('No light pattern selected');
      return;
    }

    // ابحث عن الـ pattern
    const selectedPattern = this.lightPatternEntity.value.find((p) => p.id === lightPatternId);

    if (!selectedPattern) {
      console.error('Selected light pattern not found in list');
      return;
    }

    // تحقق من قيم الـ pattern
    if (selectedPattern.red <= 0 || selectedPattern.yellow <= 0 || selectedPattern.green <= 0) {
      console.error('Light pattern times must be greater than 0');
      return;
    }

    // استخدم القيم الآمنة (مع التأكد أنها > 0)
    const redTime = Math.max(1, selectedPattern.red);
    const yellowTime = Math.max(1, selectedPattern.yellow);
    const greenTime = Math.max(1, selectedPattern.green);

    // Area ID
    const areaId = Number(v.area) || 0;
    if (areaId <= 0) {
      console.error('Area is required and must be a positive number');
      return;
    }

    const payload: AddSignBoxWithUpdateLightPattern = {
      name: v.name,
      areaId: v.area,
      ipAddress: v.ipAddress,
      latitude: v.latitude,
      longitude: v.longitude,
      lightPatternId: this.selectedLightPatternId ?? 0,
      redTime: v.redTime,
      yellowTime: v.amberTime,
      greenTime: v.greenTime,
      directions: v.directions.map((d: any, index: number) => ({
        name: d.name,
        order: index + 1,
        lightPatternId: d.lightPatternId,
        redTime: d.redTime,
        yellowTime: d.yellowTime,
        greenTime: d.greenTime,
      })),
    };
    
    this.signBoxService.AddWithUpdateLightPattern(payload).subscribe({
      next: (res) => {
        console.log('تم إضافة SignBox بنجاح', res);
      },
      error: (err) => {
        console.error('فشل الإضافة', err);
      },
    });
  }

  // Template
  onTemplateChange(event: any) {
    const templateId = event.value;
    if (!templateId) {
      this.templatePatterns = [];
      return;
    }
    this.templatePatternService
      .GetAllTemplatePatternByTemplateId(templateId)
      .subscribe((result) => (this.templatePatterns = result.value));
  }
  onTemplatePatternChange(lightPatternId: number) {
    this.selectedLightPatternId = lightPatternId;
    this.lightPatternService.getById(lightPatternId).subscribe((result) => {
      const lp = Array.isArray(result.value) ? result.value[0] : result.value;
      if (!lp) return;
      this.lightPattern = lp;
      const redCtrl = this.trafficForm.get('redTime');
      redCtrl?.enable();
      this.trafficForm.patchValue({ greenTime: lp.green, amberTime: lp.yellow, redTime: lp.red });
      redCtrl?.disable();
    });
  }
  loadAllTemplates() {
    this.templateService.GetAll().subscribe((result) => (this.templates = result.value));
  }
  get directions(): FormArray {
    return this.trafficForm.get('directions') as FormArray;
  }
  addDirection() {
    if (this.directions.length < 4) {
      this.directions.push(
        this.fb.group({
          name: ['', Validators.required],
          lightPatternId: [null, Validators.required],
          order: [this.directions.length + 1, Validators.required],
        })
      );
    }
  }

  removeDirection(index: number) {
    if (this.directions.length > 1) {
      this.directions.removeAt(index);
    }
  }
  onPatternChanged(item: GetAllSignControlBoxWithLightPattern, lightPatternId: number) {
    item.lightPatternId = lightPatternId;
  }

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

  getDirectionsForRoundabout(): { name: string; lightPatternId: number | null; order: number }[] {
    const directions = this.directions.value || [];
    return [...directions].sort((a, b) => (a.order || 0) - (b.order || 0));
  }
  onDirectionPatternChange(directionIndex: number, lightPatternId: number) {
    this.lightPatternService.getById(lightPatternId).subscribe((result) => {
      const lp = Array.isArray(result.value) ? result.value[0] : result.value;
      if (!lp) return;

      const directionGroup = this.directions.at(directionIndex);
      directionGroup.patchValue({
        lightPatternId: lp.id,
        redTime: lp.red,
        yellowTime: lp.yellow,
        greenTime: lp.green,
      });
    });
  }
}
