import { Component, OnInit, inject } from '@angular/core';
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

export interface TemplatePattern {
  templateId: number;
  templateName: string;
  lightPatterns: LightPatternForTemplatePattern[];
}

export interface LightPatternForTemplatePattern {
  lightPatternId: number;
  startFrom: string; // "HH:mm" أو "HH:mm:ss"
  finishBy: string; // "HH:mm" أو "HH:mm:ss"
  lightPatternName: string; // تمت الإضافة
}

@Component({
  selector: 'app-templatecomponent',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './templatecomponent.html',
  styleUrl: './templatecomponent.css',
})
export class Templatecomponent implements OnInit {
  // DI
  private readonly fb = inject(FormBuilder);
  private readonly templateService = inject(ITemplateService);
  private readonly templatePatternService = inject(ITemplatePatternService);
  private readonly lightPatternService = inject(LightPatternService);

  // Data
  templates: GetAllTemplate[] = [];
  lightPatterns: GetAllLightPattern[] = [];

  // Reactive Form
  templateForm: FormGroup = this.fb.group({
    templateId: new FormControl<number | null>(null),
    templateName: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    rows: this.fb.array<FormGroup>([]),
  });

  get rows(): FormArray<FormGroup> {
    return this.templateForm.get('rows') as FormArray<FormGroup>;
  }

  ngOnInit(): void {
    this.loadTemplates();
    this.loadLightPatterns();
  }

  // Loaders
  private loadTemplates() {
    this.templateService.GetAll().subscribe((resp) => {
      this.templates = resp?.value ?? [];
    });
  }

  private loadLightPatterns() {
    this.lightPatternService.getAll({}).subscribe((resp) => {
      this.lightPatterns = resp?.value ?? [];
    });
  }

  // On select template
  onTemplateChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    const id = select.value ? Number(select.value) : null;

    if (!id) {
      this.templateForm.reset({ templateId: null, templateName: '' });
      this.rows.clear();
      return;
    }

    this.templatePatternService.GetAllByTemplateId(id).subscribe((resp) => {
      // backend بيرجع name؟ لو لأ، هنجيب الاسم من كاش lightPatterns
      const patterns: LightPatternForTemplatePattern[] = (resp?.value ?? []).map((p) => ({
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
    });
  }

  // Row helpers
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
    const lp = this.lightPatterns.find((x) => x.id === lightPatternId);
    this.rows.push(
      this.createRow({
        lightPatternId,
        lightPatternName: lp?.name || `#${lightPatternId}`,
        startFrom: '00:00',
        finishBy: '00:00',
      })
    );
  }

  removeRow(index: number) {
    this.rows.removeAt(index);
  }

  // Save
  saveTemplatePattern() {
    if (!this.templateForm.valid) return;

    const payload: TemplatePattern = {
      templateId: this.templateForm.value.templateId!,
      templateName: this.templateForm.value.templateName!,
      lightPatterns: this.rows.value.map((r) => ({
        lightPatternId: r.lightPatternId,
        lightPatternName: r.lightPatternName, // نحافظ عليها لو الـ API بقى يدعمها
        startFrom: this.toHHmmss(r.startFrom),
        finishBy: this.toHHmmss(r.finishBy),
      })),
    };

    // بدّل بالميثود الصحيح في خدمتك
    this.templatePatternService.AddOrUpdateLightPattern(payload).subscribe(() => {
      // TODO: Toast/Alert success
    });
  }

  // Time utils
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
