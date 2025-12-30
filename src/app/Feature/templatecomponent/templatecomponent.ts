import { Component, OnInit, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import { ITemplateService } from '../../Services/Template/itemplate-service';
import { ITemplatePatternService } from '../../Services/TemplatePattern/itemplate-pattern-service';
import { LightPatternService } from '../../Services/LightPattern/light-pattern-service';

import { GetAllTemplate } from '../../Domain/Entity/Template/GetAllTemplate';
import { GetAllLightPattern } from '../../Domain/Entity/LightPattern/GetAllLightPattern';
import { AddLightPatternCommand } from '../../Domain/Entity/LightPattern/AddLightPattern';
import {
  LightPatternForTemplatePattern,
  TemplatePattern,
} from '../../Domain/Entity/TemplatePattern/TemplatePattern';
import { ResultV } from '../../Domain/ResultPattern/ResultV';
import { LanguageService } from '../../Services/Language/language-service';
import { ToasterService } from '../../Services/Toster/toaster-service';

import { Time24hInputComponent } from '../../Shared/Components/time-24h-input/time-24h-input.component';

@Component({
  selector: 'app-templatecomponent',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Time24hInputComponent],
  templateUrl: './templatecomponent.html',
  styleUrl: './templatecomponent.css',
})
export class Templatecomponent implements OnInit {
  readonly NEW_CODE = '__NEW__';

  private readonly fb = inject(FormBuilder);
  private readonly templateService = inject(ITemplateService);
  private readonly templatePatternService = inject(ITemplatePatternService);
  private readonly lightPatternService = inject(LightPatternService);
  public readonly lang = inject(LanguageService);

  private readonly toaster = inject(ToasterService);

  @ViewChild('templateNameRef') templateNameRef!: ElementRef<HTMLInputElement>;
  @ViewChild('patternNameRef') patternNameRef!: ElementRef<HTMLInputElement>;

  get isAr() {
    return this.lang.current === 'ar';
  }

  // i18n
  private dict = {
    en: {
      templateManager: 'Template Manager',
      configurePatterns: 'Configure traffic light patterns and schedules',
      templateConfig: 'Template Configuration',
      selectTemplate: 'Select Template',
      chooseTemplate: 'Choose a template...',
      addNewTemplate: '  Add new template…',
      templateName: ' Add Template Name',
      templateNamePh: 'Enter a descriptive name',
      templateNameReq: 'Template name is required',
      scheduleTimeline: 'Schedule Timeline',
      lightPattern: 'LightPattern',
      editTemplateName: 'Edit Selected Template Name',
      editPatternName: 'Edit Selected Pattern Name',
      removeRow: 'Remove row',
      start: 'Start',
      end: 'End',
      noSchedule: 'No schedule entries yet',
      selectPatternHint: 'Select a pattern or click "Add New Light Pattern".',
      chooseLightPattern: 'Choose a light pattern...',
      pattern: 'Pattern',
      addToSchedule: 'Add to Template',
      deleteTemplate: 'Delete Template',
      saveTemplate: 'Save Template',
      saving: 'Saving…',
      lightPatternEditor: 'Light Pattern Editor',
      patternName: 'Add Pattern Name',
      patternNamePh: 'Enter pattern name',
      patternNameReq: 'Pattern name is required',
      loadExisting: 'Load Existing Pattern',
      createNewPattern: 'Create new pattern...',
      addNewLightPattern: 'Add New Light Pattern',
      lightDurations: 'Light Durations',
      green: 'Green',
      yellow: 'Yellow',
      red: 'Red',
      greenSec: 'Green seconds',
      yellowSec: 'Yellow seconds',
      redSec: 'Red seconds',
      sec: 'sec',
      mergeWith: 'Merge with',
      selectLight: 'Select light',
      none: 'None',
      delete: 'Delete',
      createPattern: 'Create / Update Pattern',
      defaultPattern: 'Default pattern',
      allLightsZeroError: 'At least one light must have a non-zero value',
    },
    ar: {
      templateManager: 'إدارة القوالب',
      configurePatterns: 'إعداد أنماط إشارات المرور والجداول الزمنية',
      templateConfig: 'تهيئة القالب',
      selectTemplate: 'اختر القالب',
      chooseTemplate: 'اختر قالبًا...',
      addNewTemplate: '  إنشاء قالب جديد…',
      templateName: 'إضافة اسم القالب',
      templateNamePh: 'اكتب اسمًا وصفيًا',
      templateNameReq: 'اسم القالب مطلوب',
      scheduleTimeline: 'الخط الزمني للجدول',
      lightPattern: 'نمط الإشارة',
      removeRow: 'حذف الصف',
      editTemplateName: 'تعديل اسم القالب',
      editPatternName: 'تعديل اسم النمط',
      start: 'البداية',
      end: 'النهاية',
      noSchedule: 'لا توجد إدخالات جدول بعد',
      selectPatternHint: 'اختر نمطًا أو اضغط "إضافة نمط إشارة جديد".',
      chooseLightPattern: 'اختر نمط الإشارة...',
      pattern: 'النمط',
      addToSchedule: 'إضافة إلى الجدول',
      deleteTemplate: 'حذف القالب',
      saveTemplate: 'حفظ القالب',
      saving: 'جارٍ الحفظ…',
      lightPatternEditor: 'محرر نمط الإشارة',
      patternName: 'إضافة اسم النمط',
      patternNamePh: 'اكتب اسم النمط',
      patternNameReq: 'اسم النمط مطلوب',
      loadExisting: 'تحميل نمط موجود',
      createNewPattern: 'إنشاء نمط جديد...',
      addNewLightPattern: 'إضافة نمط إشارة جديد',
      lightDurations: 'مدد الإشارات',
      green: 'أخضر',
      yellow: 'أصفر',
      red: 'أحمر',
      greenSec: 'ثواني الأخضر',
      yellowSec: 'ثواني الأصفر',
      redSec: 'ثواني الأحمر',
      sec: 'ث',
      mergeWith: 'دمج مع',
      selectLight: 'اختر الإشارة',
      none: 'لا شيء',
      delete: 'حذف',
      createPattern: 'إنشاء / تعديل النمط',
      defaultPattern: 'النمط الافتراضي',
      allLightsZeroError: 'يجب أن يكون لإشارة واحدة على الأقل قيمة غير صفر',
    },
  } as const;

  tr(key: keyof (typeof this.dict)['en']): string {
    const lang = this.isAr ? 'ar' : 'en';
    return this.dict[lang][key] ?? key;
  }

  templates: GetAllTemplate[] = [];
  lightPatterns: GetAllLightPattern[] = [];

  submitting = false;
  showPatternFields = false;
  showTemplateName = false;

  templateForm: FormGroup = this.fb.group({
    templateId: new FormControl<number>(0, { nonNullable: true }),
    templateName: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    rows: this.fb.array<FormGroup>([]),
  });

  patternForm: FormGroup = this.fb.group(
    {
      name: ['', Validators.required],
      selectedPattern: [undefined as GetAllLightPattern | undefined],

      green: [null, [Validators.required, Validators.min(0)]],
      yellow: [null, [Validators.required, Validators.min(0)]],
      red: [null, [Validators.required, Validators.min(0)]],

      blinkGreen: [false],
      blinkYellow: [false],
      blinkRed: [false],

      blinkInterval: [500, [Validators.required, Validators.min(0), Validators.max(10000)]],
      mergeYellowWith: ['none'],
    },
    { validators: this.atLeastOneLightValidator() }
  );

  get rows(): FormArray<FormGroup> {
    return this.templateForm.get('rows') as FormArray<FormGroup>;
  }

  private atLeastOneLightValidator() {
    return (formGroup: any) => {
      const green = formGroup.get('green')?.value || 0;
      const yellow = formGroup.get('yellow')?.value || 0;
      const red = formGroup.get('red')?.value || 0;

      if (green === 0 && yellow === 0 && red === 0) {
        return { allLightsZero: true };
      }
      return null;
    };
  }

  ngOnInit(): void {
    this.loadTemplates();
    this.loadLightPatterns();

    this.patternForm
      .get('selectedPattern')!
      .valueChanges.subscribe((p: GetAllLightPattern | undefined) => {
        if (p) {
          // Convert mergeWith to mergeYellowWith
          let mergeYellowWith = 'none';
          const mergeVal = p.mergeWith ?? (p as any).MergeWith ?? 0;
          if (mergeVal === 1) mergeYellowWith = 'red';
          else if (mergeVal === 3) mergeYellowWith = 'green';

          this.patternForm.patchValue(
            {
              name: p.name,
              green: (p as any).green ?? (p as any).Green ?? 0,
              yellow: (p as any).yellow ?? (p as any).Yellow ?? 0,
              red: (p as any).red ?? (p as any).Red ?? 0,
              blinkInterval: p.blinkInterval ?? 500,
              blinkGreen: !!p.blinkGreen,
              blinkYellow: !!p.blinkYellow,
              blinkRed: !!p.blinkRed,
              mergeYellowWith: mergeYellowWith,
            },
            { emitEvent: false }
          );
          this.showPatternFields = true;
          setTimeout(() => this.patternNameRef?.nativeElement?.focus(), 0);
        } else {
          this.resetPatternEditor(false);
        }
      });
  }

  private loadTemplates() {
    this.templateService.GetAll().subscribe({
      next: (resp) => {
        this.templates = resp?.value ?? [];
      },
      error: (err) => {
        const { messages } = this.extractApiErrors(err);
        if (messages.length) this.toaster.errorMany(messages, { durationMs: 4500 });
        else this.toaster.error(this.isAr ? '❌ فشل تحميل القوالب' : '❌ Failed to load templates');
      },
    });
  }

  private loadLightPatterns() {
    this.lightPatternService.getAll().subscribe({
      next: (resp) => {
        const list = (resp?.value ?? []).map((p: any) => ({
          ...p,
          blinkInterval: typeof p.blinkInterval === 'number' ? p.blinkInterval : 500,
          blinkGreen: !!p.blinkGreen,
          blinkYellow: !!p.blinkYellow,
          blinkRed: !!p.blinkRed,
        }));
        this.lightPatterns = list;
      },
      error: (err) => {
        const { messages } = this.extractApiErrors(err);
        if (messages.length) this.toaster.errorMany(messages, { durationMs: 4500 });
        else
          this.toaster.error(
            this.isAr ? '❌ فشل تحميل أنماط الإشارات' : '❌ Failed to load light patterns'
          );
      },
    });
  }

  AddNewTemplate(): void {
    this.templateForm.reset({ templateId: 0, templateName: '' });
    this.rows.clear();
    this.showTemplateName = true;
    setTimeout(() => this.templateNameRef?.nativeElement?.focus(), 0);
  }

  onTemplateChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    const value = select.value;

    if (value === this.NEW_CODE) {
      this.AddNewTemplate();
      return;
    }

    const id = value ? Number(value) : 0;

    if (!id) {
      this.templateForm.reset({ templateId: 0, templateName: '' });
      this.rows.clear();
      this.showTemplateName = false;
      return;
    }

    this.templatePatternService.GetAllTemplatePatternByTemplateId(id).subscribe({
      next: (resp: ResultV<LightPatternForTemplatePattern>) => {
        const list = resp?.value ?? [];
        const patterns: LightPatternForTemplatePattern[] = list.map((p: any) => ({
          ...p,
          isDefault: !!p.isDefault || !!p.IsDefault,
          lightPatternName:
            p.lightPatternName ||
            this.lightPatterns.find((lp) => lp.id === p.lightPatternId)?.name ||
            `#${p.lightPatternId}`,
        }));

        this.templateForm.patchValue({
          templateId: id,
          templateName: this.templates.find((t) => t.id === id)?.name ?? '',
        });

        this.rows.clear();
        patterns.forEach((p) => this.rows.push(this.createRow(p)));

        this.showTemplateName = true;
        setTimeout(() => this.templateNameRef?.nativeElement?.focus(), 0);
      },
      error: (err) => {
        const { messages } = this.extractApiErrors(err);
        if (messages.length) this.toaster.errorMany(messages, { durationMs: 4500 });
        else
          this.toaster.error(
            this.isAr ? '❌ فشل تحميل جدول القالب' : '❌ Failed to load template schedule'
          );
      },
    });
  }

  private createRow(p: LightPatternForTemplatePattern): FormGroup {
    return this.fb.group({
      lightPatternId: new FormControl<number>(p.lightPatternId, { nonNullable: true }),
      lightPatternName: new FormControl<string>(p.lightPatternName ?? `#${p.lightPatternId}`, {
        nonNullable: true,
      }),
      // ✅ values are "HH:mm" (24h) already
      startFrom: new FormControl<string>(this.toHHmm(p.startFrom), { nonNullable: true }),
      finishBy: new FormControl<string>(this.toHHmm(p.finishBy), { nonNullable: true }),
      isDefault: new FormControl<boolean>(!!(p as any).isDefault, { nonNullable: true }),
      blinkGreen: new FormControl<boolean>(!!(p as any).blinkGreen, { nonNullable: true }),
      blinkYellow: new FormControl<boolean>(!!(p as any).blinkYellow, { nonNullable: true }),
      blinkRed: new FormControl<boolean>(!!(p as any).blinkRed, { nonNullable: true }),
      blinkInterval: new FormControl<number>((p as any).blinkInterval ?? 500, {
        nonNullable: true,
      }),
    });
  }

  addRowFromSelect(lightPatternId: number) {
    if (!lightPatternId) return;
    const lp = this.lightPatterns.find((x) => x.id === lightPatternId);
    this.rows.push(
      this.createRow({
        lightPatternId,
        lightPatternName: lp?.name || `#${lightPatternId}`,
        startFrom: '00:00',
        finishBy: '00:00',
        isDefault: false,
      } as any)
    );
  }

  removeRow(index: number) {
    this.rows.removeAt(index);
  }

  saveTemplatePattern() {
    if (!this.templateForm.valid || this.rows.length === 0) {
      this.templateForm.markAllAsTouched();
      this.toaster.warning(
        this.isAr ? '⚠️ من فضلك أكمل البيانات المطلوبة' : '⚠️ Please complete required fields'
      );
      return;
    }

    const defaultRow = this.rows.controls.find((g) => !!g.get('isDefault')?.value);
    const defaultLightPatternId = defaultRow
      ? (defaultRow.get('lightPatternId')!.value as number)
      : 0;

    const payload: TemplatePattern & { defaultLightPatternId?: number } = {
      templateId: this.templateForm.value.templateId as number,
      templateName: this.templateForm.value.templateName as string,
      lightPatterns: this.rows.value.map((r: any) => ({
        lightPatternId: r.lightPatternId,
        lightPatternName: r.lightPatternName,
        startFrom: this.toHHmmss(r.startFrom),
        finishBy: this.toHHmmss(r.finishBy),
        isDefault: !!r.isDefault,
        blinkGreen: !!r.blinkGreen,
        blinkYellow: !!r.blinkYellow,
        blinkRed: !!r.blinkRed,
        blinkInterval: r.blinkInterval,
      })),
      defaultLightPatternId,
    };

    this.submitting = true;

    this.templatePatternService.AddOrUpdateLightPattern(payload).subscribe({
      next: (resp) => {
        this.submitting = false;

        if (resp?.isSuccess) {
          this.toaster.success(this.isAr ? '✅ تم حفظ القالب بنجاح' : '✅ Template saved');

          const currentId = payload.templateId || 0;
          if (currentId > 0) {
            const fakeEvent = { target: { value: String(currentId) } } as unknown as Event;
            this.onTemplateChange(fakeEvent);
          } else {
            this.templateForm.reset({ templateId: 0, templateName: '' });
            this.rows.clear();
            this.loadTemplates();
            this.showTemplateName = false;
          }
          return;
        }

        const { messages } = this.extractApiErrors(resp);
        if (messages.length) this.toaster.errorMany(messages, { durationMs: 4500 });
        else this.toaster.error(this.isAr ? '❌ فشل حفظ القالب' : '❌ Failed to save template');
      },
      error: (err) => {
        this.submitting = false;
        const { messages } = this.extractApiErrors(err);

        if (messages.length) {
          this.toaster.error(this.isAr ? '❌ فشل الحفظ' : '❌ Save failed', { durationMs: 2800 });
          this.toaster.errorMany(messages, { durationMs: 4500 });
        } else {
          this.toaster.error(this.isAr ? '❌ فشل حفظ القالب' : '❌ Failed to save template');
        }
        console.error('Save template failed', err);
      },
    });
  }

  deleteTemplate() {
    const id = (this.templateForm.value.templateId as number) || 0;
    if (id <= 0) return;

    if (
      !confirm(
        this.isAr
          ? 'هل أنت متأكد من حذف هذا القالب؟'
          : 'Are you sure you want to delete this template?'
      )
    )
      return;

    this.submitting = true;

    this.templatePatternService.deleteTemplate(id).subscribe({
      next: (resp) => {
        this.submitting = false;

        if (resp?.isSuccess) {
          this.toaster.success(this.isAr ? '✅ تم حذف القالب' : '✅ Template deleted');

          this.templateForm.reset({ templateId: 0, templateName: '' });
          this.rows.clear();
          this.loadTemplates();
          this.showTemplateName = false;
          return;
        }

        const { messages } = this.extractApiErrors(resp);
        if (messages.length) this.toaster.errorMany(messages, { durationMs: 4500 });
        else this.toaster.error(this.isAr ? '❌ فشل حذف القالب' : '❌ Failed to delete template');
      },
      error: (err) => {
        this.submitting = false;
        const { messages } = this.extractApiErrors(err);
        if (messages.length) this.toaster.errorMany(messages, { durationMs: 4500 });
        else this.toaster.error(this.isAr ? '❌ فشل حذف القالب' : '❌ Failed to delete template');
      },
    });
  }

  startAddNewLightPattern(): void {
    this.patternForm.patchValue(
      {
        selectedPattern: undefined,
        name: '',
        green: null,
        yellow: null,
        red: null,
        blinkInterval: 500,
        blinkGreen: false,
        blinkYellow: false,
        blinkRed: false,
        mergeYellowWith: 'none',
      },
      { emitEvent: false }
    );

    this.showPatternFields = true;
    setTimeout(() => this.patternNameRef?.nativeElement?.focus(), 0);
  }

  onAddSectionPatternChange(e: Event): void {
    const id = Number((e.target as HTMLSelectElement).value || 0);
    if (!id) return;
    const lp = this.lightPatterns.find((x) => x.id === id);
    if (lp) this.patternForm.get('selectedPattern')!.setValue(lp);
  }

  onPatternChange(): void {
    const selected: GetAllLightPattern | undefined = this.patternForm.value.selectedPattern;
    if (selected) {
      this.patternForm.patchValue(
        {
          name: selected.name,
          red: (selected as any).red ?? (selected as any).Red ?? 0,
          green: (selected as any).green ?? (selected as any).Green ?? 0,
          yellow: (selected as any).yellow ?? (selected as any).Yellow ?? 0,
          blinkInterval: selected.blinkInterval ?? 500,
          blinkGreen: !!selected.blinkGreen,
          blinkYellow: !!selected.blinkYellow,
          blinkRed: !!selected.blinkRed,
          mergeYellowWith:
            (selected.mergeWith ?? (selected as any).MergeWith) === 1
              ? 'red'
              : (selected.mergeWith ?? (selected as any).MergeWith) === 3
              ? 'green'
              : 'none',
        },
        { emitEvent: false }
      );
      this.showPatternFields = true;
      setTimeout(() => this.patternNameRef?.nativeElement?.focus(), 0);
    } else {
      this.resetPatternEditor(false);
    }
  }

  createPattern(): void {
    if (this.patternForm.invalid) {
      this.patternForm.markAllAsTouched();
      this.toaster.warning(
        this.isAr ? '⚠️ من فضلك أكمل بيانات النمط' : '⚠️ Please complete pattern fields'
      );
      return;
    }
    this.submitting = true;

    const raw = this.patternForm.getRawValue();
    const selected: GetAllLightPattern | undefined = raw.selectedPattern;

    let isMerged = false;
    let mergedWith = 0;

    if (raw.mergeYellowWith === 'red') {
      isMerged = true;
      mergedWith = 1;
    } else if (raw.mergeYellowWith === 'green') {
      isMerged = true;
      mergedWith = 3;
    }

    const payload: AddLightPatternCommand = {
      id: selected ? selected.id : 0,
      name: raw.name,
      greenTime: Number(raw.green) || 0,
      yellowTime: Number(raw.yellow) || 0,
      redTime: Number(raw.red) || 0,
      BlinkInterval:
        raw.blinkInterval !== null && raw.blinkInterval !== '' ? Number(raw.blinkInterval) : 500,
      BlinkGreen: !!raw.blinkGreen,
      BlinkYellow: !!raw.blinkYellow,
      BlinkRed: !!raw.blinkRed,
      IsMerged: isMerged,
      MergedWith: mergedWith,
    };

    console.log('📤 Sending Light Pattern Payload:', payload);

    this.lightPatternService.add(payload).subscribe({
      next: (resp) => {
        this.submitting = false;

        if (resp?.isSuccess) {
          this.toaster.success(this.isAr ? '✅ تم حفظ النمط' : '✅ Pattern saved');
          this.resetPatternEditor(true);
          this.loadLightPatterns();
          return;
        }

        const { messages, fieldMap } = this.extractApiErrors(resp);
        this.applyServerValidationErrors(fieldMap);

        if (messages.length) this.toaster.errorMany(messages, { durationMs: 4500 });
        else this.toaster.error(this.isAr ? '❌ فشل حفظ النمط' : '❌ Failed to save pattern');
      },
      error: (err) => {
        this.submitting = false;
        const { messages, fieldMap } = this.extractApiErrors(err);
        this.applyServerValidationErrors(fieldMap);

        if (messages.length) this.toaster.errorMany(messages, { durationMs: 4500 });
        else this.toaster.error(this.isAr ? '❌ فشل حفظ النمط' : '❌ Failed to save pattern');
      },
    });
  }

  private applyServerValidationErrors(fieldMap: Record<string, string[]>) {
    for (const [key, errors] of Object.entries(fieldMap)) {
      const controlName = key.charAt(0).toLowerCase() + key.slice(1);
      // Map known backend names to frontend controls if needed
      let targetControl = controlName;

      // Special mappings
      if (key.toLowerCase() === 'yellowtime') targetControl = 'yellow';
      else if (key.toLowerCase() === 'greentime') targetControl = 'green';
      else if (key.toLowerCase() === 'redtime') targetControl = 'red';

      const control = this.patternForm.get(targetControl);
      if (control) {
        control.setErrors({ serverError: errors[0] });
        control.markAsTouched();
      }
    }
  }

  deletePattern(): void {
    const selected: GetAllLightPattern | undefined = this.patternForm.value.selectedPattern;
    if (!selected) return;
    if (!confirm(this.isAr ? `حذف "${selected.name}"؟` : `Delete "${selected.name}"?`)) return;

    this.lightPatternService.delete(selected.id).subscribe({
      next: (resp) => {
        if (resp?.isSuccess) {
          this.toaster.success(this.isAr ? '✅ تم حذف النمط' : '✅ Pattern deleted');
          this.resetPatternEditor(true);
          this.loadLightPatterns();
          return;
        }

        const { messages } = this.extractApiErrors(resp);
        if (messages.length) this.toaster.errorMany(messages, { durationMs: 4500 });
        else this.toaster.error(this.isAr ? '❌ فشل حذف النمط' : '❌ Failed to delete pattern');
      },
      error: (err) => {
        const { messages } = this.extractApiErrors(err);
        if (messages.length) this.toaster.errorMany(messages, { durationMs: 4500 });
        else this.toaster.error(this.isAr ? '❌ فشل حذف النمط' : '❌ Failed to delete pattern');
      },
    });
  }

  private resetPatternEditor(hide: boolean) {
    this.patternForm.reset({
      name: '',
      selectedPattern: undefined,
      green: null,
      yellow: null,
      red: null,
      blinkInterval: 500,
      blinkGreen: false,
      blinkYellow: false,
      blinkRed: false,
      mergeYellowWith: 'none',
    });
    this.showPatternFields = !hide ? this.showPatternFields : false;
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

  get hasDefaultSelected(): boolean {
    return this.rows.controls.some((g) => !!g.get('isDefault')?.value);
  }

  onDefaultChange(index: number): void {
    const nowChecked = !!this.rows.at(index).get('isDefault')?.value;
    if (nowChecked) {
      for (let i = 0; i < this.rows.length; i++) {
        if (i !== index) {
          this.rows.at(i).get('isDefault')!.setValue(false, { emitEvent: false });
        }
      }
    }
  }

  private extractApiErrors(err: any): { messages: string[]; fieldMap: Record<string, string[]> } {
    const messages: string[] = [];
    const fieldMap: Record<string, string[]> = {};

    const e = err?.error ?? err;

    if (e?.errors && typeof e.errors === 'object') {
      for (const [field, arr] of Object.entries(e.errors)) {
        const list = Array.isArray(arr) ? arr : [String(arr)];
        fieldMap[String(field)] = list.map(String);
        list.forEach((m) => messages.push(String(m)));
      }
    }

    if (Array.isArray(e?.errorMessages) && e.errorMessages.length) {
      const errs = e.errorMessages.map((x: unknown) => String(x));
      const props = Array.isArray(e?.propertyNames)
        ? e.propertyNames.map((x: unknown) => String(x))
        : [];

      if (props.length === errs.length && props.length) {
        for (let i = 0; i < props.length; i++) {
          const field = props[i] || 'General';
          const msg = errs[i] || '';
          fieldMap[field] = [...(fieldMap[field] || []), msg];
          messages.push(msg);
        }
      } else {
        errs.forEach((m: string) => messages.push(m));
      }
    }

    if (e?.title && !messages.length) messages.push(String(e.title));
    if (e?.detail) messages.push(String(e.detail));
    if (!messages.length && typeof e === 'string') messages.push(e);
    if (!messages.length && err?.message) messages.push(String(err.message));

    const uniq = Array.from(new Set(messages.map((x) => String(x).trim()).filter(Boolean)));
    return { messages: uniq, fieldMap };
  }
}
