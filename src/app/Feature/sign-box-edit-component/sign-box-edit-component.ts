import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IeditSignBox } from '../../Services/edit-sign-box/iedit-sign-box';
import { GetAllSignControlBoxWithLightPattern } from '../../Domain/Entity/SignControlBox/GetAllSignControlBoxWithLightPattern';
import { DirectionWithPatternDto } from '../../Domain/Entity/SignControlBox/AddSignBoxCommandDto';

@Component({
  selector: 'app-sign-box-edit-component',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './sign-box-edit-component.html',
  styleUrl: './sign-box-edit-component.css',
})
export class SignBoxEditComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private service = inject(IeditSignBox);

  form: FormGroup;
  id!: number;
  loading = false;

  constructor() {
    this.form = this.fb.group({
      id: [0],
      name: ['', Validators.required],
      ipAddress: ['', Validators.required],
      directions: this.fb.array<FormGroup>([]),
    });
  }

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) {
      this.router.navigate(['/signbox']);
      return;
    }
    this.id = Number(idParam);
    this.load();
  }

  get directions(): FormArray {
    return this.form.get('directions') as FormArray;
  }

  private load(): void {
    this.loading = true;
    this.service.getById(this.id).subscribe({
      next: (data: GetAllSignControlBoxWithLightPattern) => {
        while (this.directions.length) {
          this.directions.removeAt(0);
        }

        this.form.patchValue({
          id: data.id,
          name: data.name ?? '',
          ipAddress: data.ipAddress ?? '',
        });

        const dirs: (DirectionWithPatternDto | { name?: string })[] = data.directions ?? [];

        dirs.forEach((d: DirectionWithPatternDto | { name?: string }) => {
          this.directions.push(
            this.fb.group({
              name: [d.name ?? '', Validators.required],
            })
          );
        });

        if (this.directions.length === 0) this.addDirection();
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  addDirection(name = '') {
    this.directions.push(this.fb.group({ name: [name, Validators.required] }));
  }

  removeDirection(index: number) {
    if (this.directions.length > 1) {
      this.directions.removeAt(index);
    } else {
      // لو عايز تسمح بحذف حتى لو واحد بس - احذف الشرط
      this.directions.removeAt(index);
    }
  }

  apply() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const payload = {
      id: this.form.value.id,
      name: this.form.value.name,
      ipAddress: this.form.value.ipAddress,
      directions: (this.form.value.directions ?? []).map((d: any) => ({ name: d.name })),
    };
    this.service.update(payload).subscribe({
      next: () => {
        this.router.navigate(['/signbox']);
      },
      error: (err) => {
        console.error('update failed', err);
      },
    });
  }

  cancel() {
    this.router.navigate(['/signbox']);
  }
}
