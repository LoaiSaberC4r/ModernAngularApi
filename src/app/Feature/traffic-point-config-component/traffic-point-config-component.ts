import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IGovernateService } from '../../Services/Governate/igovernate-service';
import { GetAllGovernate } from '../../Domain/Entity/Governate/GetAllGovernate';
import { IAreaService } from '../../Services/Area/iarea-service';
import { GetAllArea } from '../../Domain/Entity/Area/GetAllArea';
import { GetAllLightPattern } from '../../Domain/Entity/LightPattern/GetAllLightPattern';
import { LightPatternService } from '../../Services/LightPattern/light-pattern-service';
import { AddSignBoxWithUpdateLightPattern } from '../../Domain/Entity/SignControlBox/AddSignBoxWithUpdateLightPattern';
import { ISignBoxControlService } from '../../Services/SignControlBox/isign-box-controlService';

@Component({
  selector: 'app-traffic-point-config-component',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './traffic-point-config-component.html',
  styleUrls: ['./traffic-point-config-component.css'],
})
export class TrafficPointConfigComponent implements OnInit {
  private readonly governateService = inject(IGovernateService);
  private readonly areaServoce = inject(IAreaService);
  private readonly lightPatternService = inject(LightPatternService);
  private readonly signBoxControlService = inject(ISignBoxControlService);

  trafficForm: FormGroup;
  governorates: GetAllGovernate[] = [];
  areas: GetAllArea[] = [];
  pattern: GetAllLightPattern[] = [];

  constructor(private fb: FormBuilder) {
    this.trafficForm = this.fb.group({
      governorate: [],
      area: [],
      name: ['', [Validators.required]],
      latitude: ['', [Validators.required]],
      longitude: ['', [Validators.required]],
      ipAddress: ['', [Validators.required]],

      pattern: [],

      id: [
        null,
        [
          Validators.required,
          Validators.min(1),
          Validators.max(42_944_696),

          Validators.pattern(/^[1-9]\d*$/),
        ],
      ],
      ipCabinet: [null, [Validators.required, Validators.min(0), Validators.pattern(/^\d+$/)]],

      green: 0,
      yellow: 0,
      red: [{ value: 0, disabled: true }],
      blinkGreen: [{ value: false, disabled: true }],
      blinkYellow: [{ value: false, disabled: true }],
      blinkRed: [{ value: false, disabled: true }],
      BlinkInterval: [500],
    });

    this.trafficForm.get('green')?.valueChanges.subscribe(() => this.updateRedTime());
    this.trafficForm.get('yellow')?.valueChanges.subscribe(() => this.updateRedTime());

    this.trafficForm.get('blinkGreen')?.disable();
    this.trafficForm.get('blinkYellow')?.disable();
    this.trafficForm.get('blinkRed')?.disable();
  }

  // Update red time
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

  ngOnInit(): void {
    this.loadGovernate();
    this.loadLightPattern();
  }
  loadLightPattern() {
    this.lightPatternService.getAll().subscribe((data) => {
      console.log(data);
      this.pattern = data || [];
    });
  }
  loadGovernate() {
    this.governateService.getAll({}).subscribe((data) => {
      this.governorates = data || [];
    });
  }
  onGovernorateChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    const id = select.value === '' ? null : Number(select.value);

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
  getAreas(id: number) {
    this.areaServoce.getAll(id).subscribe((data) => {
      this.areas = data || [];
    });
  }

  onApply(): void {
    if (this.trafficForm.invalid) {
      this.trafficForm.markAllAsTouched();
      return;
    }

    const id = Number(this.trafficForm.get('id')?.value);
    const ipCabinet = Number(this.trafficForm.get('ipCabinet')?.value);
    const name = (this.trafficForm.get('name')?.value ?? '').trim();
    const ipAddress = (this.trafficForm.get('ipAddress')?.value ?? '').trim();
    const latitude = String(this.trafficForm.get('latitude')?.value ?? '');
    const longitude = String(this.trafficForm.get('longitude')?.value ?? '');
    const areaId = Number(this.trafficForm.get('area')?.value) || 0;
    const pattern = this.trafficForm.get('pattern')?.value as GetAllLightPattern | null;

    const payload: AddSignBoxWithUpdateLightPattern = {
      id,
      name,
      areaId,
      ipAddress,
      ipCabinet,
      latitude,
      longitude,
      directions: [
        {
          name: 'Direction 1',
          order: 1,
          lightPatternId: Number(pattern?.id ?? 0),
        },
      ],
    };

    console.log('Apply payload ->', payload);
    this.signBoxControlService.AddWithUpdateLightPattern(payload).subscribe(() => {});
  }
}
