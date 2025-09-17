import { Component } from '@angular/core';
import { CommonModule, NgFor } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-traffic-point-config-component',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NgFor],
  templateUrl: './traffic-point-config-component.html',
  styleUrls: ['./traffic-point-config-component.css'],
})
export class TrafficPointConfigComponent {
  trafficForm: FormGroup;
  governorates: any[] = [];
  areas: any[] = [];

  constructor(private fb: FormBuilder) {
    this.trafficForm = this.fb.group({
      governorate: [null],
      area: [null],
      name: ['', [Validators.required]],
      latitude: ['', [Validators.required]],
      longitude: ['', [Validators.required]],
      ipAddress: ['', [Validators.required]],
      pattern: [null],
      green: [0],
      yellow: [0],
      red: [0],
      blinkGreen: [{ value: false, disabled: true }],
      blinkYellow: [{ value: false, disabled: true }],
      blinkRed: [{ value: false, disabled: true }],
      blinkMs: [500],
    });

    this.trafficForm.get('blinkGreen')?.disable();
    this.trafficForm.get('blinkYellow')?.disable();
    this.trafficForm.get('blinkRed')?.disable();
  }
}
