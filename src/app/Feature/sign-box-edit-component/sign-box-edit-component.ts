import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { IeditSignBox } from '../../Services/edit-sign-box/iedit-sign-box';
import { GetAllSignControlBoxWithLightPattern } from '../../Domain/Entity/SignControlBox/GetAllSignControlBoxWithLightPattern';
import { LightPatternService } from '../../Services/LightPattern/light-pattern-service';
import { SearchParameters } from '../../Domain/ResultPattern/SearchParameters';
import { ResultV } from '../../Domain/ResultPattern/ResultV';
import { GetAllLightPattern } from '../../Domain/Entity/LightPattern/GetAllLightPattern';
import { IAreaService } from '../../Services/Area/iarea-service';
import { IGovernateService } from '../../Services/Governate/igovernate-service';
import { GetAllGovernate } from '../../Domain/Entity/Governate/GetAllGovernate';
import { GetAllArea } from '../../Domain/Entity/Area/GetAllArea';

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
  private service = inject(IeditSignBox);
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

  ngOnInit(): void {
    this.loadLightPatterns();
    this.loadGovernate();

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
    const params: SearchParameters = { page: 1, pageSize: 200, sortOrder: 'Newest' };
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

    this.form.patchValue({
      id: data.id,
      name: data.name ?? '',
      ipAddress: data.ipAddress ?? '',
      latitude: data.latitude ?? '',
      longitude: data.longitude ?? '',
    });

    const dirs = this.normalizeDirections(data);
    if (dirs.length === 0) {
      this.addDirection();
    } else {
      dirs.forEach((d) =>
        this.directions.push(
          this.fb.group({
            name: [d.name ?? '', Validators.required],
            order: [d.order ?? null],
            lightPatternId: [d.lightPatternId ?? null],
            lightPatternName: [d.lightPatternName ?? ''],
          })
        )
      );
    }
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
        order: [null],
        lightPatternId: [null],
        lightPatternName: [''],
      })
    );
  }

  removeDirection(index: number): void {
    this.directions.removeAt(index);
    if (this.directions.length === 0) this.addDirection();
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

    const payload = {
      id: this.form.value.id,
      name: this.form.value.name,
      ipAddress: this.form.value.ipAddress,
      latitude: this.form.value.latitude ?? null,
      longitude: this.form.value.longitude ?? null,
      directions: (this.form.value.directions ?? []).map((d: any) => ({
        name: d.name,
        order: d.order,
        lightPatternId: d.lightPatternId,
      })),
    };

    this.service.update(payload).subscribe({
      next: () => this.router.navigate(['/signbox']),
      error: (err) => console.error('update failed', err),
    });
  }

  cancel(): void {
    this.router.navigate(['/signbox']);
  }
  onGovernorateChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const id = Number(select.value);
    if (id) {
      this.getAreas(id);
      this.form.get('areaId')?.setValue(null);
    } else {
      this.areas = [];
      this.form.get('areaId')?.setValue(null);
    }
  }
  loadGovernate() {
    this.governateService.getAll({}).subscribe((data) => (this.governates = data.value));
  }
  getAreas(id: number) {
    this.areaService.getAll(id).subscribe((data) => (this.areas = data.value));
  }
}
