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
  patternForm!: FormGroup;
  submitting = false;

  // Reactive Form
  templateForm: FormGroup = this.fb.group({
    templateId: new FormControl<number | null>(null),
    templateName: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    rows: this.fb.array<FormGroup>([]),
  });
  constructor(private fbb: FormBuilder) {}

  get rows(): FormArray<FormGroup> {
    return this.templateForm.get('rows') as FormArray<FormGroup>;
  }

  ngOnInit(): void {
    this.patternForm = this.fb.group({
      name: ['', Validators.required],
      selectedPattern: [null],
      green: [0, [Validators.required, Validators.min(0)]],
      yellow: [0, [Validators.required, Validators.min(0)]],
      red: [0],
    }); 
    this.patternForm.get('selectedPattern')!.valueChanges.subscribe((p: GetAllLightPattern | null) => {
      if (p) {
        this.patternForm.patchValue({
          name: p.name,
          green: p.green,
          yellow: p.yellow,
          red: p.red,
        }, { emitEvent: false });
      } else {
        // Reset للقيم لو لغى الاختيار
        this.patternForm.patchValue({
          name: '',
          green: 0,
          yellow: 0,
          red: 0,
        }, { emitEvent: false });
      }
    });
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
      alert('success');
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
  onPatternChange(event: any): void {
    const selected: GetAllLightPattern = this.patternForm.value.selectedPattern;

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
      id: selected ? selected.id : 0, // 👈 لو في اختيار ياخد id وإلا 0
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
      // امسح الفورم بعد الحذف
      this.patternForm.reset({
        name: '',
        selectedPattern: null,
        green: 0,
        yellow: 0,
        red: 0,
      });
      // تقدر تعمل reload للـ list
      // this.loadPatterns();
    } else {
      alert(resp?.error?.description ?? 'Delete failed');
    }
  });
}

} 


