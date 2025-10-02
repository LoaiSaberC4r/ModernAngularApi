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
import { AddLightPatternCommand } from '../../Domain/Entity/LightPattern/AddLightPattern';
import {
  LightPatternForTemplatePattern,
  TemplatePattern,
} from '../../Domain/Entity/TemplatePattern/TemplatePattern';
import { ResultV } from '../../Domain/ResultPattern/ResultV';

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

  // UI state
  submitting = false;

  // =========================
  // Forms (templateId يبدأ بـ 0 دائمًا)
  // =========================
  templateForm: FormGroup = this.fb.group({
    templateId: new FormControl<number>(0, { nonNullable: true }), // 👈 default = 0
    templateName: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    rows: this.fb.array<FormGroup>([]),
  });

  patternForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    selectedPattern: [null as GetAllLightPattern | null],
    green: [0, [Validators.required, Validators.min(0)]],
    yellow: [0, [Validators.required, Validators.min(0)]],
    red: [0, [Validators.required, Validators.min(0)]],
  });

  get rows(): FormArray<FormGroup> {
    return this.templateForm.get('rows') as FormArray<FormGroup>;
  }

  // =========================
  // Lifecycle
  // =========================
  ngOnInit(): void {
    this.loadTemplates();
    this.loadLightPatterns();

    // Auto-fill من الاختيار
    this.patternForm
      .get('selectedPattern')!
      .valueChanges.subscribe((p: GetAllLightPattern | null) => {
        if (p) {
          this.patternForm.patchValue(
            { name: p.name, green: p.green, yellow: p.yellow, red: p.red },
            { emitEvent: false }
          );
        } else {
          this.patternForm.patchValue(
            { name: '', green: 0, yellow: 0, red: 0 },
            { emitEvent: false }
          );
        }
      });
  }

  // =========================
  // Loaders
  // =========================
  private loadTemplates() {
    this.templateService.GetAll().subscribe((resp) => {
      this.templates = resp?.value ?? [];
    });
  }

  private loadLightPatterns() {
    this.lightPatternService.getAll().subscribe((resp) => {
      this.lightPatterns = resp?.value ?? [];
    });
  }

  // =========================
  // Template selection
  // =========================
  onTemplateChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    const id = select.value ? Number(select.value) : 0; // 👈 لو فاضي يبقى 0

    if (!id) {
      // رجّع 0 بدل null
      this.templateForm.reset({ templateId: 0, templateName: '' });
      this.rows.clear();
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
      });
  }

  // =========================
  // Row helpers
  // =========================
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
      })
    );
  }

  removeRow(index: number) {
    this.rows.removeAt(index);
  }

  // =========================
  // Save / Delete (Templates)
  // =========================
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
        alert('Template saved successfully ✅');

        // لو فيه id (حتى لو 0) هنعمل refresh مناسب:
        const currentId = payload.templateId || 0;
        if (currentId > 0) {
          const fakeEvent = { target: { value: String(currentId) } } as unknown as Event;
          this.onTemplateChange(fakeEvent);
        } else {
          // لو 0 امسح الجدول وخلي الاسم فاضي
          this.templateForm.reset({ templateId: 0, templateName: '' });
          this.rows.clear();
        }
      } else {
        alert(resp?.error?.description ?? 'Save failed');
      }
    });
  }

  deleteTemplate() {
    const id = (this.templateForm.value.templateId as number) || 0;
    if (id <= 0) {
      alert('Please select a template to delete.');
      return;
    }
    if (!confirm('Are you sure you want to delete this template?')) return;

    this.submitting = true;
    this.templatePatternService.deleteTemplate(id).subscribe((resp) => {
      this.submitting = false;
      if (resp?.isSuccess) {
        alert('Template deleted successfully 🗑️');
        this.templateForm.reset({ templateId: 0, templateName: '' }); // 👈 ارجاع 0
        this.rows.clear();
        this.loadTemplates();
      } else {
        alert(resp?.error?.description ?? 'Delete failed');
      }
    });
  }

  // =========================
  // Light Pattern CRUD (اختياري)
  // =========================
  onPatternChange(): void {
    const selected: GetAllLightPattern | null = this.patternForm.value.selectedPattern;
    if (selected) {
      this.patternForm.patchValue({
        red: selected.red,
        green: selected.green,
        yellow: selected.yellow,
      });
    }
  }

  createPattern(): void {
    if (this.patternForm.invalid) return;
    this.submitting = true;

    const raw = this.patternForm.getRawValue();
    const selected: GetAllLightPattern | null = raw.selectedPattern;

    const payload: AddLightPatternCommand = {
      id: selected ? selected.id : 0,
      name: raw.name,
      greenTime: Number(raw.green) || 0,
      yellowTime: Number(raw.yellow) || 0,
      redTime: Number(raw.red) || 0,
    };

    this.lightPatternService.add(payload).subscribe((resp) => {
      this.submitting = false;
      if (resp?.isSuccess) {
        alert('Pattern saved successfully!');
        this.patternForm.reset({
          name: '',
          selectedPattern: null,
          green: 0,
          yellow: 0,
          red: 0,
        });
        this.loadLightPatterns();
      } else {
        alert(resp?.error?.description ?? 'Failed to save pattern');
      }
    });
  }

  deletePattern(): void {
    const selected: GetAllLightPattern | null = this.patternForm.value.selectedPattern;
    if (!selected) {
      alert('Please select a pattern to delete.');
      return;
    }
    if (!confirm(`Delete "${selected.name}"?`)) return;

    this.lightPatternService.delete(selected.id).subscribe((resp) => {
      if (resp?.isSuccess) {
        alert('Pattern deleted successfully!');
        this.patternForm.reset({
          name: '',
          selectedPattern: null,
          green: 0,
          yellow: 0,
          red: 0,
        });
        this.loadLightPatterns();
      } else {
        alert(resp?.error?.description ?? 'Delete failed');
      }
    });
  }

  // =========================
  // Time utils
  // =========================
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
