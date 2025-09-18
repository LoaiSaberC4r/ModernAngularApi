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
      red: 0,
      blinkGreen: [{ value: false, disabled: true }],
      blinkYellow: [{ value: false, disabled: true }],
      blinkRed: [{ value: false, disabled: true }],
      blinkMs: [500],
    });

    this.trafficForm.get('blinkGreen')?.disable();
    this.trafficForm.get('blinkYellow')?.disable();
    this.trafficForm.get('blinkRed')?.disable();
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
    // هتاخد الـ Object المختار (لأننا مستخدمين [ngValue]="p" في الـ <option>)
    const selected = this.trafficForm.get('pattern')!.value as GetAllLightPattern | null;
    if (!selected) return;

    // Helper صغير لضبط القيمة بين 0..255 وتحويلها لرقم
    const clampByte = (n: unknown) => Math.max(0, Math.min(255, Number(n) || 0));

    // حدّث القيم كلها مرة واحدة
    this.trafficForm.patchValue(
      {
        green: clampByte((selected as any).green),
        yellow: clampByte((selected as any).yellow),
        red: clampByte((selected as any).red),
      },
      // لو مش عايز تشغّل valueChanges لكونترولز تانية خليه false
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
      latitude: String(v.latitude ?? ''), // الواجهة طالبة string
      longitude: String(v.longitude ?? ''), // الواجهة طالبة string
      lightPatternId: v.pattern?.id ?? 0, // جاي من [ngValue]="p"
      areaId: Number(v.area) || 0, // جاي من [value]="a.id"
      redTime: clampByte(v.red),
      yellowTime: clampByte(v.yellow),
      greenTime: clampByte(v.green),
      ipAddress: (v.ipAddress ?? '').trim(),
    };

    console.log('Apply payload ->', payload);

    this.signBoxControlService.AddWithUpdateLightPattern(payload).subscribe((data) => {});
  }
}
