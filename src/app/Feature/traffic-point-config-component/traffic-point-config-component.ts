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
      green: 0,
      yellow: 0,
      red: [{ value: 0, disabled: true }],
      blinkGreen: [{ value: false, disabled: true }],
      blinkYellow: [{ value: false, disabled: true }],
      blinkRed: [{ value: false, disabled: true }],
      blinkMs: [500],
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
    this.lightPatternService.getAll({}).subscribe((data) => {
      console.log(data);
      this.pattern = data.value;
    });
  }
  loadGovernate() {
    this.governateService.getAll({}).subscribe((data) => {
      this.governorates = data.value;
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
      this.areas = data.value;
    });
  }

  onApply(): void {
    // لو في أي validator، أظهره للمستخدم وامنع الإرسال
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
      areaId: Number(v.area) || 0,
      ipAddress: (v.ipAddress ?? '').trim(),
      directions: [
        {
          name: 'Direction 1',
          order: 1,
          lightPatternId: v.pattern?.id ?? 0,
        },
      ],
    };

    console.log('Apply payload ->', payload);

    this.signBoxControlService.AddWithUpdateLightPattern(payload).subscribe((data) => {});
  }
}
