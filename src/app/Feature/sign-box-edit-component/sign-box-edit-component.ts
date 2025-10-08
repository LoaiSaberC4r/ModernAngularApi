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
import { ITemplateService } from '../../Services/Template/itemplate-service';
import { ITemplatePatternService } from '../../Services/TemplatePattern/itemplate-pattern-service';
import { GetAllTemplate } from '../../Domain/Entity/Template/GetAllTemplate';
import { LightPatternForTemplatePattern } from '../../Domain/Entity/TemplatePattern/TemplatePattern';

// Simple IPv4 regex
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
  // DI
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

  get isAr() {
    return this.langService.current === 'ar';
  }

  governates: GetAllGovernate[] = [];
  areas: GetAllArea[] = [];
  templates: GetAllTemplate[] = [];
  loading = false;
  id!: number;

  // مصدر الدروب داون (لو احتجته لاحقاً)
  lightPatterns: LightPatternItem[] = [];

  form: FormGroup = this.fb.group({
    id: [0],
    name: ['', Validators.required],
    ipAddress: ['', [Validators.required, Validators.pattern(IPV4_REGEX)]],
    governateId: [null, Validators.required],
    areaId: [null, Validators.required],
    latitude: [''],
    longitude: [''],
    directions: this.fb.array<FormGroup>([]),
  });

  // Toast state (template-driven popup)
  toasts: Array<{
    id: number;
    message: string;
    type: 'success' | 'error' | 'warn';
    active: boolean;
    duration?: number;
    onClose?: () => void;
  }> = [];
  private toastSeq = 0;
  private toastTimers = new Map<number, any>();

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
    // تحميل القوائم المرجعية
    this.loadLightPatterns();
    this.loadGovernate();
    this.loadTemplates();

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

  // ========== Light Patterns (optional source) ==========
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
            templateId: [d.templateId ?? null],
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
      templateId: d?.templateId ?? d?.TemplateId ?? null,
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

  apply(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.showPopup(
        this.isAr ? '⚠️ يرجى ملء الحقول المطلوبة' : '⚠️ Please fill all required fields',
        'warn'
      );
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
      directions: (v.directions as any[]).map((d) => ({
        name: d?.name ?? '',
        order: d?.order,
        templateId: d?.templateId ?? null,
      })) as unknown as SignDirection[],
    };

    this.service.Update(payload).subscribe({
      next: () => {
        // Show success toast and navigate after it closes
        this.showPopup(this.isAr ? '✅ تم التحديث بنجاح' : '✅ Updated successfully!', 'success', {
          duration: 2000,
          onClose: () => this.router.navigate(['/trafficController']),
        });
      },
      error: (err) => {
        console.error('update failed', err);
        const ipTyped = this.form?.value?.ipAddress ?? '';
        const msgs: string[] = Array.isArray(err?.error?.errorMessages)
          ? (err.error.errorMessages as string[]).map((m: string, i: number) => {
              const rawProp: string = err.error.propertyNames?.[i] || '';
              const prop = this.prettifyField(rawProp);
              let text = String(m || '').replace(/ip\s*address|ipaddress/gi, 'IP Address');
              if (prop) text += `: ${prop}`;
              const isIpError = rawProp.toLowerCase() === 'ipaddress' || /ip\s*address/i.test(text);
              if (isIpError && ipTyped) text += `: ${ipTyped}`;
              return text;
            })
          : [this.isAr ? 'حدث خطأ أثناء التحديث' : 'Update failed'];
        this.showPopup(msgs.join('\n'), 'error');
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

  // ===== Templates (list for dropdown) =====
  private loadTemplates() {
    this.templateService.GetAll().subscribe((resp) => {
      this.templates = resp?.value ?? [];
    });
  }

  // تغيير القالب لكل صف اتجاه
  onTemplateChange(index: number, e: Event) {
    const select = e.target as HTMLSelectElement;
    const id = select.value ? Number(select.value) : null;
    const grp = this.directions.at(index) as FormGroup;
    grp.get('templateId')?.setValue(id);
  }

  // ===== Helpers for user-friendly messages & toasts =====
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

  private showPopup(
    message: string,
    type: 'success' | 'error' | 'warn',
    opts?: { duration?: number; onClose?: () => void }
  ) {
    const id = ++this.toastSeq;
    const duration = Math.max(0, opts?.duration ?? 4000);
    this.toasts = [
      ...this.toasts,
      { id, message, type, active: false, duration, onClose: opts?.onClose },
    ];
    setTimeout(() => {
      this.toasts = this.toasts.map((t) => (t.id === id ? { ...t, active: true } : t));
    }, 0);

    const timer = setTimeout(() => this.dismissToast(id), duration);
    this.toastTimers.set(id, timer);
  }

  dismissToast(id: number) {
    const timer = this.toastTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.toastTimers.delete(id);
    }
    let onClose: (() => void) | undefined;
    this.toasts = this.toasts.map((t) => {
      if (t.id === id) onClose = t.onClose;
      return t.id === id ? { ...t, active: false } : t;
    });
    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t.id !== id);
      if (onClose) {
        try {
          onClose();
        } catch {}
      }
    }, 500);
  }

  // Mini i18n helper for template strings used in HTML
  tr(key: string): string {
    const en: Record<string, string> = {
      selectTemplate: 'Template',
      chooseTemplate: '-- Select Template --',
    };
    const ar: Record<string, string> = {
      selectTemplate: 'القالب',
      chooseTemplate: '-- اختر القالب --',
    };
    const dict = this.isAr ? ar : en;
    return dict[key] ?? key;
  }

  // (kept from earlier if you later want to render time ranges)
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
}
