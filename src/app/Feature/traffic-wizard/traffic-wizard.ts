import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
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

  private fb = inject(FormBuilder);
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
      name: ['', Validators.required],
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
    });

    // Auto-calc red
    this.trafficForm.get('green')?.valueChanges.subscribe(() => this.updateRedTime());
    this.trafficForm.get('yellow')?.valueChanges.subscribe(() => this.updateRedTime());

    // Disable blink checkboxes initially
    this.trafficForm.get('blinkGreen')?.disable();
    this.trafficForm.get('blinkYellow')?.disable();
    this.trafficForm.get('blinkRed')?.disable();
  }

  ngOnInit(): void {
    this.loadGovernate();
    this.loadAllTemplates();

    this.loadLightPattern();
  }

  // Data loading
  loadLightPattern() {
    this.lightPatternService.getAll({}).subscribe((data) => {
      this.pattern = data.value;
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

    const clampByte = (n: unknown) => Math.max(0, Math.min(255, Number(n) || 0));

    const v = this.trafficForm.value as {
      name: string;
      latitude: number | string;
      longitude: number | string;
      ipAddress: string;
      area: number | string | null;
      pattern: GetAllLightPattern | null;
      red: number | string;
      yellow: number | string;
      green: number | string;
    };

    const payload: AddSignBoxWithUpdateLightPattern = {
      name: (v.name ?? '').trim(),
      latitude: String(v.latitude ?? ''),
      longitude: String(v.longitude ?? ''),
      lightPatternId: v.pattern?.id ?? 0,
      areaId: Number(v.area) || 0,
      redTime: clampByte(v.red),
      yellowTime: clampByte(v.yellow),
      greenTime: clampByte(v.green),
      ipAddress: (v.ipAddress ?? '').trim(),
    };

    console.log('Wizard Apply payload ->', payload);

    this.signBoxControlService.AddWithUpdateLightPattern(payload).subscribe(() => {});
  }
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
}
