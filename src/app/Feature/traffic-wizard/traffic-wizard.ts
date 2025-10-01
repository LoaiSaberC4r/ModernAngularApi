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
      directions: this.fb.array([
        this.fb.group({
          name: ['', Validators.required],
          lightPatternId: [null, Validators.required],
          order: [1, [Validators.required, Validators.min(1)]],
        }),
      ]),
    });
  }

  ngOnInit(): void {
    this.loadGovernate();
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

  onPatternChanged(item: any, lightPatternId: number) {
    // This method can be empty or used for additional logic
  }

  // Helper methods
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

  // Submit
  onApply(): void {
    if (this.trafficForm.invalid) {
      this.trafficForm.markAllAsTouched();
      console.log('Form is invalid:', this.trafficForm.errors);
      return;
    }

    const v = this.trafficForm.value;

    // Validate required fields
    const areaId = Number(v.area);
    if (areaId <= 0) {
      console.error('Area is required and must be a positive number');
      return;
    }

    const payload: AddSignBoxWithUpdateLightPattern = {
      name: v.name.trim(),
      areaId: areaId,
      ipAddress: v.ipAddress.trim(),
      latitude: String(v.latitude),
      longitude: String(v.longitude),
      directions: v.directions.map((d: any, index: number) => ({
        name: d.name,
        order: d.order,
        lightPatternId: d.lightPatternId,
      })),
    };

    console.log('Sending payload:', payload);

    this.signBoxService.AddSignBox(payload).subscribe({
      next: (res) => {
        console.log('تم إضافة SignBox بنجاح', res);
      },
      error: (err) => {
        console.error('فشل الإضافة', err);
      },
    });
  }
}
