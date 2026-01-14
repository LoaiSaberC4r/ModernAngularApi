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
  FormControl,
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
import { LanguageService } from '../../Services/Language/language-service';
import { ToasterService } from '../../Services/Toster/toaster-service';
import { ITemplateService } from '../../Services/Template/itemplate-service';
import { ITemplatePatternService } from '../../Services/TemplatePattern/itemplate-pattern-service';
import { GetAllTemplate } from '../../Domain/Entity/Template/GetAllTemplate';
import { LightPatternForTemplatePattern } from '../../Domain/Entity/TemplatePattern/TemplatePattern';

import { EMPTY, catchError, concatMap, from, map, of, tap, Observable } from 'rxjs';

const IPV4_REGEX = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

type DirectionView = {
  name: string;
  order: number | null;
  lightPatternId: number | null;
  lightPatternName: string | null;
  templateId?: number | null;
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
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private service = inject(ISignBoxControlService);
  private lpService = inject(LightPatternService);
  private readonly areaService = inject(IAreaService);
  private readonly governateService = inject(IGovernateService);
  public langService = inject(LanguageService);
  private readonly templateService = inject(ITemplateService);
  private readonly templatePatternService = inject(ITemplatePatternService);
  private readonly toaster = inject(ToasterService);

  get isAr() {
    return this.langService.current === 'ar';
  }

  // sync flags + pending IDs
  private governatesLoaded = false;
  private pendingGovId: number | null = null;
  private pendingAreaId: number | null = null;
  private resolvingGovFromArea = false;

  governates: GetAllGovernate[] = [];
  areas: GetAllArea[] = [];
  templates: GetAllTemplate[] = [];
  loading = false;
  id!: number;

  lightPatterns: LightPatternItem[] = [];

  // applying state
  isApplying = false;

  form: FormGroup = this.fb.group({
    id: [0],
    name: ['', Validators.required],
    ipAddress: ['', [Validators.required, Validators.pattern(IPV4_REGEX)]],
    governateId: [null, Validators.required],
    areaId: [null, Validators.required],
    latitude: [''],
    longitude: [''],
    cabinetId: [{ value: null, disabled: false }],
    directions: this.fb.array<FormGroup>([]),
  });

  get directions(): FormArray<FormGroup> {
    return this.form.get('directions') as FormArray<FormGroup>;
  }

  // ====== unique lane validator ======
  private uniqueOrderValidator = (ctrl: AbstractControl): ValidationErrors | null => {
    const fa = ctrl as FormArray;
    if (!fa?.controls?.length) return null;

    fa.controls.forEach((g) => {
      const c = (g as FormGroup).get('order')!;
      const errs = { ...(c.errors || {}) };
      delete (errs as any).duplicateOrder;
      c.setErrors(Object.keys(errs).length ? errs : null);
    });

    const map = new Map<number, number[]>();
    fa.controls.forEach((g, idx) => {
      const raw = (g as FormGroup).get('order')?.value;
      const val = raw === '' || raw == null ? null : Number(raw);
      if (val != null && !Number.isNaN(val) && val >= 1 && val <= 4) {
        const arr = map.get(val) ?? [];
        arr.push(idx);
        map.set(val, arr);
      }
    });

    let dup = false;
    map.forEach((idxs) => {
      if (idxs.length > 1) {
        dup = true;
        idxs.forEach((i) => {
          const c = (fa.at(i) as FormGroup).get('order')!;
          c.setErrors({ ...(c.errors || {}), duplicateOrder: true });
        });
      }
    });
    return dup ? { duplicateOrder: true } : null;
  };

  ngOnInit(): void {
    this.loadLightPatterns();
    this.loadGovernate();
    this.loadTemplates();

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

  // ====== Light Patterns (optional) ======
  private loadLightPatterns(): void {
    this.lpService.getAll().subscribe((resp: any) => {
      // resp is now the array directly, but keeping defensive check just in case
      const arr = Array.isArray(resp)
        ? resp
        : resp?.value?.data ?? resp?.value ?? resp?.data ?? resp?.items ?? [];
      this.lightPatterns = arr.map((x: any) => ({
        id: Number(x.id ?? x.Id),
        name: String(x.name ?? x.Name ?? `#${x.id ?? x.Id}`),
      }));
    });
  }

  // ====== Box by Id ======
  private loadFromApi(): void {
    this.loading = true;
    this.service.getById(this.id).subscribe({
      next: (data) => {
        this.hydrateForm(data);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  private hydrateForm(data: GetAllSignControlBoxWithLightPattern): void {
    while (this.directions.length) this.directions.removeAt(0);

    const anyData = data as any;

    const govId = this.toNumber(
      anyData.governateId ??
        anyData.governorateId ??
        anyData.governId ??
        anyData.governorId ??
        anyData.governate?.id ??
        anyData.governorate?.id
    );

    const areaId = this.toNumber(anyData.areaId ?? anyData.area?.id);

    const cabinetId = this.toNumber(anyData.cabinetId ?? anyData.CabinetId ?? anyData.cabinet?.id);

    this.form.patchValue({
      id: data.id,
      name: data.name ?? '',
      ipAddress: data.ipAddress ?? '',
      latitude: data.latitude ?? '',
      longitude: data.longitude ?? '',
      cabinetId: cabinetId ?? null,
    });

    this.pendingGovId = govId ?? null;
    this.pendingAreaId = areaId ?? null;

    if (this.governatesLoaded) {
      if (this.pendingGovId != null) {
        this.form.get('governateId')?.setValue(this.pendingGovId, { emitEvent: false });
        this.getAreas(this.pendingGovId, this.pendingAreaId);
      } else if (this.pendingAreaId != null) {
        this.resolveGovernorateFromArea(this.pendingAreaId);
      }
    }

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
            templateId: [d.templateId ?? null],
          })
        )
      );
    }

    this.directions.updateValueAndValidity({ onlySelf: true });
  }

  private resolveGovernorateFromArea(areaId: number): void {
    if (this.resolvingGovFromArea || !this.governatesLoaded) return;
    this.resolvingGovFromArea = true;

    let found = false;
    let pending = 0;

    const finish = () => {
      this.resolvingGovFromArea = false;
    };

    for (const g of this.governates) {
      if (found) break;
      pending++;
      this.areaService.getAll(g.governateId).subscribe({
        next: (resp) => {
          if (found) return;
          const list = resp ?? [];
          const hit = list.find((a) => a.areaId === areaId);
          if (hit) {
            found = true;
            this.form.get('governateId')?.setValue(g.governateId, { emitEvent: false });
            this.areas = list;
            this.form.get('areaId')?.setValue(areaId, { emitEvent: false });
          }
        },
        complete: () => {
          pending--;
          if (pending === 0) finish();
        },
        error: () => {
          pending--;
          if (pending === 0) finish();
        },
      });
    }

    if (this.governates.length === 0) finish();
  }

  private toNumber(v: any): number | null {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
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
      templateId: d?.templateId ?? d?.TemplateId ?? null,
    }));
  }

  // ====== Form actions ======
  addDirection(): void {
    this.directions.push(
      this.fb.group({
        name: ['', Validators.required],
        order: [null, [Validators.required, Validators.min(1), Validators.max(4)]],
        lightPatternId: [null],
        lightPatternName: [''],
        templateId: [null],
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

  apply(isForced: boolean = false): void {
    if (this.isApplying) return;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toaster.warning(
        this.isAr ? 'يرجى ملء الحقول المطلوبة' : 'Please fill all required fields'
      );
      return;
    }

    this.isApplying = true;

    const v = this.form.getRawValue();

    const payload: UpdateSignControlBox = {
      id: Number(v.id),
      name: String(v.name ?? ''),
      ipAddress: String(v.ipAddress ?? ''),
      latitude: String(v.latitude ?? ''),
      longitude: String(v.longitude ?? ''),
      areaId: Number(v.areaId),
      cabinetId: Number((v as any).cabinetId ?? 0),
      directions: (v.directions as any[]).map((d) => ({
        name: d?.name ?? '',
        order: d?.order,
        templateId: d?.templateId ?? null,
      })) as unknown as SignDirection[],
    };

    // 1) Update
    let process$: Observable<any> = this.service.Update(payload).pipe(
      tap((resp) => {
        this.toaster.successFromBackend(resp, {
          fallback: this.isAr ? 'تم التحديث بنجاح' : 'Updated successfully!',
        });
        const { fieldMap, isSuccess } = this.toaster.extractMessages(resp);
        if (!isSuccess) this.applyServerValidationErrors(fieldMap);
      }),
      catchError((err) => {
        const { fieldMap } = this.toaster.extractMessages(err);
        this.applyServerValidationErrors(fieldMap);
        this.toaster.errorFromBackend(err);
        this.isApplying = false;
        return EMPTY;
      })
    );

    // 2) Apply (Only if forced)
    if (isForced) {
      process$ = process$.pipe(
        concatMap(() =>
          this.service.applySignBox({ id: this.id, isForced }).pipe(
            tap((resp) =>
              this.toaster.successFromBackend(resp, {
                fallback: this.isAr ? 'تم التطبيق بنجاح' : 'Applied successfully!',
              })
            ),
            map(() => ({ ok: true as const })),
            catchError((err) => {
              this.toaster.errorFromBackend(err);
              return of({ ok: false as const, err });
            })
          )
        ),
        map((res) => res)
      );
    }

    process$.subscribe({
      next: () => {
        this.isApplying = false;
      },
      error: () => {
        this.isApplying = false;
      },
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
    this.governateService.getAll({ pageSize: 1000 }).subscribe((data) => {
      this.governates = data ?? [];
      this.governatesLoaded = true;

      if (this.pendingGovId != null) {
        this.form.get('governateId')?.setValue(this.pendingGovId, { emitEvent: false });
        this.getAreas(this.pendingGovId, this.pendingAreaId);
      } else if (this.pendingAreaId != null) {
        this.resolveGovernorateFromArea(this.pendingAreaId);
      }
    });
  }

  getAreas(governateId: number, selectedAreaId?: number | null): void {
    this.areaService.getAll(governateId).subscribe((data) => {
      this.areas = data ?? [];
      if (selectedAreaId != null) {
        this.form.get('areaId')?.setValue(selectedAreaId, { emitEvent: false });
      }
    });
  }

  private prettifyField(name: string): string {
    if (!name) return '';
    const lower = name.toLowerCase();
    if (lower === 'ipaddress' || lower === 'ip_address' || lower === 'ip') return 'IP Address';
    return name
      .replace(/_/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^(\w)/, (c) => c.toUpperCase());
  }

  private createRow(p: LightPatternForTemplatePattern): FormGroup {
    return this.fb.group({
      lightPatternId: new FormControl<number>(p.lightPatternId, { nonNullable: true }),
      lightPatternName: new FormControl<string>(p.lightPatternName ?? `#${p.lightPatternId}`, {
        nonNullable: true,
      }),
      startFrom: new FormControl<string>(this.toHHmm(p.startFrom), { nonNullable: true }),
      finishBy: new FormControl<string>(this.toHHmm(p.finishBy), { nonNullable: true }),
    });
  }

  private toHHmm(s?: string | null): string {
    if (!s) return '00:00';
    const [h = '00', m = '00'] = s.split(':');
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
  }

  private toHHmmss(s?: string | null): string {
    if (!s) return '00:00:00';
    const [h = '00', m = '00'] = s.split(':');
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`;
  }

  onTemplateChange(index: number, event: any): void {
    const direction = this.directions.at(index) as FormGroup;
    const templateId = Number(event.target.value);
    const template = this.templates.find((t) => t.id === templateId);
    direction.get('lightPatternId')?.setValue(template?.id ?? null);
    direction.get('lightPatternName')?.setValue(template?.name ?? '');
  }

  private loadTemplates(): void {
    this.templateService.GetAll().subscribe({
      next: (resp) => {
        this.templates = resp ?? [];
      },
      error: (err) => {
        console.error('Failed to load templates', err);
        this.templates = [];
      },
    });
  }

  forceApply(): void {
    this.apply(true);
  }

  restartSignBox(): void {
    if (!this.id) return;
    this.service.Restart(this.id).subscribe({
      next: (resp) => {
        this.toaster.successFromBackend(resp, {
          fallback: this.isAr ? 'تم البدء في إعادة التشغيل' : 'Restart initiated successfully',
        });
      },
      error: (err) => this.toaster.errorFromBackend(err),
    });
  }

  deleteSignBox(): void {
    const confirmMsg = this.isAr
      ? 'هل أنت متأكد أنك تريد حذف صندوق الإشارة هذا؟'
      : 'Are you sure you want to delete this SignBox?';

    if (confirm(confirmMsg)) {
      this.service.Delete(this.id).subscribe({
        next: (res: any) => {
          this.toaster.successFromBackend(res, {
            fallback: this.isAr ? 'تم الحذف بنجاح' : 'Deleted successfully',
          });
          const { isSuccess } = this.toaster.extractMessages(res);
          if (isSuccess || res === null) {
            this.router.navigate(['/signbox']);
          }
        },
        error: (err) => this.toaster.errorFromBackend(err),
      });
    }
  }

  private applyServerValidationErrors(fieldMap: Record<string, string[]>) {
    for (const [apiField, msgs] of Object.entries(fieldMap)) {
      const ctrlName = this.mapApiFieldToControlName(apiField);
      if (!ctrlName) continue;

      if (ctrlName.startsWith('__dir__')) {
        const [, idxStr, field] = ctrlName.split('__');
        const idx = Number(idxStr);
        const g = this.directions.at(idx) as FormGroup;
        const c = g?.get(field);
        if (c) {
          c.setErrors({ ...c.errors, server: msgs[0] });
          c.markAsTouched();
        }
      } else {
        const c = this.form.get(ctrlName);
        if (c) {
          c.setErrors({ ...c.errors, server: msgs[0] });
          c.markAsTouched();
        }
      }
    }
  }

  private mapApiFieldToControlName(apiField: string): string | null {
    const f = apiField?.toLowerCase();
    if (f.includes('ip')) return 'ipAddress';
    if (f.includes('cabinet')) return 'cabinetId';
    if (f.includes('name')) return 'name';
    if (f.includes('latitude') || f.includes('lat')) return 'latitude';
    if (f.includes('longitude') || f.includes('lng') || f.includes('long')) return 'longitude';
    if (f.includes('governorate') || f.includes('governate')) return 'governateId';
    if (f.includes('area')) return 'areaId';

    if (f.startsWith('directions[')) {
      const m = f.match(/directions\[(\d+)\]\.(.+)/i);
      if (m) {
        const idx = Number(m[1]);
        const field = m[2];
        return `__dir__${idx}__${field}`;
      }
    }
    return null;
  }
}
