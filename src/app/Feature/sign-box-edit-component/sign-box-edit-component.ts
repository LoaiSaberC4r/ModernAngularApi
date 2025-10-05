import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { ISignBoxControlService } from '../../Services/SignControlBox/isign-box-controlService';
import { GetAllSignControlBoxWithLightPattern } from '../../Domain/Entity/SignControlBox/GetAllSignControlBoxWithLightPattern';
import { LightPatternService } from '../../Services/LightPattern/light-pattern-service';
import { ResultV } from '../../Domain/ResultPattern/ResultV';
import { GetAllLightPattern } from '../../Domain/Entity/LightPattern/GetAllLightPattern';

import { IAreaService } from '../../Services/Area/iarea-service';
import { IGovernateService } from '../../Services/Governate/igovernate-service';
import { GetAllGovernate } from '../../Domain/Entity/Governate/GetAllGovernate';
import { GetAllArea } from '../../Domain/Entity/Area/GetAllArea';

import { UpdateSignControlBox } from '../../Domain/Entity/SignControlBox/UpdateSignBox';
import { SignDirection } from '../../Domain/Entity/SignControlBox/AddSignBoxCommandDto';

type DirectionView = {
  name: string;
  order: number | null;
  lightPatternId: number | null;
  lightPatternName: string | null;
};

type LightPatternItem = { id: number; name: string };

@Component({
  selector: 'app-sign-box-edit-component',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './sign-box-edit-component.html',
  styleUrls: ['./sign-box-edit-component.css'],
})
export class SignBoxEditComponent implements OnInit {
  // DI
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private service = inject(ISignBoxControlService);
  private lpService = inject(LightPatternService);
  private readonly areaService = inject(IAreaService);
  private readonly governateService = inject(IGovernateService);

  governates: GetAllGovernate[] = [];
  areas: GetAllArea[] = [];

  loading = false;
  id!: number;

  // مصدر الدروب داون
  lightPatterns: LightPatternItem[] = [];

  form: FormGroup = this.fb.group({
    id: [0],
    name: ['', Validators.required],
    ipAddress: ['', Validators.required],
    governateId: [null, Validators.required],
    areaId: [null, Validators.required],
    latitude: [''],
    longitude: [''],
    directions: this.fb.array<FormGroup>([]),
  });

  get directions(): FormArray<FormGroup> {
    return this.form.get('directions') as FormArray<FormGroup>;
  }

  // ========= Duplicate order validator for directions =========
  private uniqueOrderValidator = (ctrl: AbstractControl): ValidationErrors | null => {
    const fa = ctrl as FormArray;
    if (!fa?.controls?.length) return null;

    // clear previous duplicate flags
    fa.controls.forEach((g) => {
      const c = (g as FormGroup).get('order')!;
      if (!c) return;
      const errs = { ...(c.errors || {}) };
      delete (errs as any).duplicateOrder;
      c.setErrors(Object.keys(errs).length ? errs : null);
    });

    // collect valid orders (1..4)
    const map = new Map<number, number[]>();
    fa.controls.forEach((g, idx) => {
      const raw = (g as FormGroup).get('order')?.value;
      const val = raw === '' || raw === null || raw === undefined ? null : Number(raw);
      if (val !== null && !Number.isNaN(val) && val >= 1 && val <= 4) {
        const arr = map.get(val) ?? [];
        arr.push(idx);
        map.set(val, arr);
      }
    });

    let hasDup = false;
    map.forEach((idxs) => {
      if (idxs.length > 1) {
        hasDup = true;
        idxs.forEach((i) => {
          const c = (fa.at(i) as FormGroup).get('order')!;
          c.setErrors({ ...(c.errors || {}), duplicateOrder: true });
        });
      }
    });

    return hasDup ? { duplicateOrder: true } : null;
  };

  ngOnInit(): void {
    this.loadLightPatterns();
    this.loadGovernate();

    // attach validator for unique order
    this.directions.setValidators([this.uniqueOrderValidator]);
    this.directions.updateValueAndValidity({ onlySelf: true });

    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) {
      this.router.navigate(['/signbox']);
      return;
    }
    this.id = Number(idParam);

    const fromState = history.state?.signbox as GetAllSignControlBoxWithLightPattern | undefined;
    if (fromState && fromState.id === this.id) this.hydrateForm(fromState);
    else this.loadFromApi();
  }

  // ========== Light Patterns ==========
  private loadLightPatterns(): void {
    this.lpService.getAll().subscribe((resp: ResultV<GetAllLightPattern> | any) => {
      const arr = (resp?.value?.data ?? resp?.value ?? resp?.data ?? resp?.items ?? []) as any[];
      this.lightPatterns = (Array.isArray(arr) ? arr : []).map((x: any) => ({
        id: Number(x.id ?? x.Id),
        name: String(x.name ?? x.Name ?? `#${x.id ?? x.Id}`),
      }));
    });
  }

  // ========== Load Box ==========
  private loadFromApi(): void {
    this.loading = true;
    this.service.getById(this.id).subscribe({
      next: (data) => {
        this.hydrateForm(data);
        this.loading = false;
      },
      error: () => (this.loading = false),
    });
  }

  private hydrateForm(data: GetAllSignControlBoxWithLightPattern): void {
    while (this.directions.length) this.directions.removeAt(0);

    // patch base fields
    this.form.patchValue({
      id: data.id,
      name: data.name ?? '',
      ipAddress: data.ipAddress ?? '',
      latitude: data.latitude ?? '',
      longitude: data.longitude ?? '',
    });

    // governorate/area if returned by API
    const anyData = data as any;
    const govId = anyData.governateId ?? null;
    const areaId = anyData.areaId ?? null;

    if (govId) {
      this.form.patchValue({ governateId: govId });
      this.getAreas(govId, areaId ?? null);
    }

    // directions
    const dirs = this.normalizeDirections(data);
    if (dirs.length === 0) {
      this.addDirection();
    } else {
      dirs.forEach((d) =>
        this.directions.push(
          this.fb.group({
            name: [d.name ?? '', Validators.required],
            order: [d.order ?? null, [Validators.required, Validators.min(1), Validators.max(4)]],
            lightPatternId: [d.lightPatternId ?? null],
            lightPatternName: [d.lightPatternName ?? ''],
          })
        )
      );
    }

    this.directions.updateValueAndValidity({ onlySelf: true });
  }

  private normalizeDirections(src: any): DirectionView[] {
    const raw = src?.directions ?? src?.Directions ?? [];
    const boxLevelName =
      src?.lightPatterName ?? src?.lightPatternName ?? src?.LightPatternName ?? null;

    if (!Array.isArray(raw)) return [];
    return raw.map((d: any) => ({
      name: d?.name ?? d?.Name ?? '',
      order: d?.order ?? d?.Order ?? null,
      lightPatternId: d?.lightPatternId ?? d?.LightPatternId ?? null,
      lightPatternName: d?.lightPatternName ?? d?.LightPatternName ?? boxLevelName ?? null,
    }));
  }

  // ========== Form actions ==========
  addDirection(): void {
    this.directions.push(
      this.fb.group({
        name: ['', Validators.required],
        order: [null, [Validators.required, Validators.min(1), Validators.max(4)]],
        lightPatternId: [null],
        lightPatternName: [''],
      })
    );
    this.directions.updateValueAndValidity({ onlySelf: true });
  }

  removeDirection(index: number): void {
    this.directions.removeAt(index);
    if (this.directions.length === 0) this.addDirection();
    this.directions.updateValueAndValidity({ onlySelf: true });
  }

  onPatternChange(index: number): void {
    const grp = this.directions.at(index) as FormGroup;
    const selectedId = Number(grp.get('lightPatternId')?.value);
    const lp = this.lightPatterns.find((x) => x.id === selectedId);
    grp.get('lightPatternName')?.setValue(lp?.name ?? '');
  }

  apply(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();

    const payload: UpdateSignControlBox = {
      id: Number(v.id),
      name: String(v.name ?? ''),
      ipAddress: String(v.ipAddress ?? ''),
      latitude: String(v.latitude ?? ''),
      longitude: String(v.longitude ?? ''),
      areaId: Number(v.areaId),
      directions: (v.directions as SignDirection[]).map((d) => ({
        name: d?.name ?? '',
        order: d?.order,
        lightPatternId: d?.lightPatternId,
      })),
    };

    this.service.Update(payload).subscribe({
      next: () => this.router.navigate(['/trafficController']),
      error: (err) => console.error('update failed', err),
    });
  }

  cancel(): void {
    this.router.navigate(['/trafficController']);
  }

  onGovernorateChange(): void {
    const id = this.form.get('governateId')?.value as number | null;
    if (id != null) {
      this.getAreas(id);
      this.form.get('areaId')?.reset();
    } else {
      this.areas = [];
      this.form.get('areaId')?.reset();
    }
  }

  loadGovernate(): void {
    this.governateService.getAll({}).subscribe((data) => (this.governates = data.value ?? []));
  }

  getAreas(governateId: number, selectedAreaId?: number | null): void {
    this.areaService.getAll(governateId).subscribe((data) => {
      this.areas = data.value ?? [];
      if (selectedAreaId) {
        this.form.get('areaId')?.setValue(selectedAreaId);
      }
    });
  }
}
