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

@Component({
  selector: 'app-templatecomponent',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
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
      delete: 'Delete',
      createPattern: 'Create / Update Pattern',
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
      delete: 'حذف',
      createPattern: 'إنشاء / تعديل النمط',
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

  // Forms
  templateForm: FormGroup = this.fb.group({
    templateId: new FormControl<number>(0, { nonNullable: true }),
    templateName: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    rows: this.fb.array<FormGroup>([]),
  });

  patternForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    selectedPattern: [undefined as GetAllLightPattern | undefined],

    green: [0, [Validators.required, Validators.min(0)]],
    yellow: [0, [Validators.required, Validators.min(0)]],
    red: [0, [Validators.required, Validators.min(0)]],

    blinkGreen: [false],
    blinkYellow: [false],
    blinkRed: [false],

    blinkInterval: [500, [Validators.required, Validators.min(50), Validators.max(10000)]],
  });

  get rows(): FormArray<FormGroup> {
    return this.templateForm.get('rows') as FormArray<FormGroup>;
  }

  ngOnInit(): void {
    this.loadTemplates();
    this.loadLightPatterns();

    this.patternForm
      .get('selectedPattern')!
      .valueChanges.subscribe((p: GetAllLightPattern | undefined) => {
        if (p) {
          this.patternForm.patchValue(
            {
              name: p.name,
              green: p.green,
              yellow: p.yellow,
              red: p.red,
              blinkInterval: (p as any).BlinkInterval ?? 500,
              blinkGreen: false,
              blinkYellow: false,
              blinkRed: false,
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
    this.templateService.GetAll().subscribe((resp) => {
      this.templates = resp?.value ?? [];
    });
  }

  private loadLightPatterns() {
    this.lightPatternService.getAll().subscribe((resp) => {
      const list = (resp?.value ?? []).map((p: any) => ({
        ...p,
        BlinkInterval: typeof p.BlinkInterval === 'number' ? p.BlinkInterval : 500,
      }));
      this.lightPatterns = list;
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

    this.templatePatternService
      .GetAllTemplatePatternByTemplateId(id)
      .subscribe((resp: ResultV<LightPatternForTemplatePattern>) => {
        const list = resp?.value ?? [];
        const patterns: LightPatternForTemplatePattern[] = list.map((p) => ({
          ...p,
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
      });
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

  addRowFromSelect(lightPatternId: number) {
    if (!lightPatternId) return;
    const lp = this.lightPatterns.find((x) => x.id === lightPatternId);
    this.rows.push(
      this.createRow({
        lightPatternId,
        lightPatternName: lp?.name || `#${lightPatternId}`,
        startFrom: '00:00',
        finishBy: '00:00',
      } as any)
    );
  }

  removeRow(index: number) {
    this.rows.removeAt(index);
  }

  saveTemplatePattern() {
    if (!this.templateForm.valid || this.rows.length === 0) {
      this.templateForm.markAllAsTouched();
      return;
    }

    const payload: TemplatePattern = {
      templateId: this.templateForm.value.templateId as number,
      templateName: this.templateForm.value.templateName as string,
      lightPatterns: this.rows.value.map((r: any) => ({
        lightPatternId: r.lightPatternId,
        lightPatternName: r.lightPatternName,
        startFrom: this.toHHmmss(r.startFrom),
        finishBy: this.toHHmmss(r.finishBy),
      })),
    };

    this.submitting = true;
    this.templatePatternService.AddOrUpdateLightPattern(payload).subscribe((resp) => {
      this.submitting = false;
      if (resp?.isSuccess) {
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
      }
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
    this.templatePatternService.deleteTemplate(id).subscribe((resp) => {
      this.submitting = false;
      if (resp?.isSuccess) {
        this.templateForm.reset({ templateId: 0, templateName: '' });
        this.rows.clear();
        this.loadTemplates();
        this.showTemplateName = false;
      }
    });
  }

  startAddNewLightPattern(): void {
    this.patternForm.patchValue(
      {
        selectedPattern: undefined,
        name: '',
        green: 0,
        yellow: 0,
        red: 0,
        blinkInterval: 500,
        blinkGreen: false,
        blinkYellow: false,
        blinkRed: false,
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
    if (lp) this.patternForm.get('selectedPattern')!.setValue(lp); // triggers valueChanges
  }

  onPatternChange(): void {
    const selected: GetAllLightPattern | undefined = this.patternForm.value.selectedPattern;
    if (selected) {
      this.patternForm.patchValue(
        {
          name: selected.name,
          red: selected.red,
          green: selected.green,
          yellow: selected.yellow,
          blinkInterval: (selected as any).BlinkInterval ?? 500,
          blinkGreen: false,
          blinkYellow: false,
          blinkRed: false,
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
      return;
    }
    this.submitting = true;

    const raw = this.patternForm.getRawValue();
    const selected: GetAllLightPattern | undefined = raw.selectedPattern;

    const payload: AddLightPatternCommand = {
      id: selected ? selected.id : 0,
      name: raw.name,
      greenTime: Number(raw.green) || 0,
      yellowTime: Number(raw.yellow) || 0,
      redTime: Number(raw.red) || 0,
      BlinkInterval: Number(raw.blinkInterval) || 500,
      BlinkGreen: !!raw.blinkGreen,
      BlinkYellow: !!raw.blinkYellow,
      BlinkRed: !!raw.blinkRed,
    };

    this.lightPatternService.add(payload).subscribe((resp) => {
      this.submitting = false;
      if (resp?.isSuccess) {
        this.resetPatternEditor(true);
        this.loadLightPatterns();
      }
    });
  }

  deletePattern(): void {
    const selected: GetAllLightPattern | undefined = this.patternForm.value.selectedPattern;
    if (!selected) return;
    if (!confirm(this.isAr ? `حذف "${selected.name}"؟` : `Delete "${selected.name}"?`)) return;

    this.lightPatternService.delete(selected.id).subscribe((resp) => {
      if (resp?.isSuccess) {
        this.resetPatternEditor(true);
        this.loadLightPatterns();
      }
    });
  }

  private resetPatternEditor(hide: boolean) {
    this.patternForm.reset({
      name: '',
      selectedPattern: undefined,
      green: 0,
      yellow: 0,
      red: 0,
      blinkInterval: 500,
      blinkGreen: false,
      blinkYellow: false,
      blinkRed: false,
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

  trPublic(key: keyof (typeof this.dict)['en']) {
    return this.tr(key);
  }
}
