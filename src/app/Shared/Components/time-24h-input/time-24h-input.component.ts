import { Component, Input, forwardRef, HostListener, ElementRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-time-24h-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './time-24h-input.component.html',
  styleUrls: ['./time-24h-input.component.css'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Time24hInputComponent),
      multi: true,
    },
  ],
})
export class Time24hInputComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() dir: 'ltr' | 'rtl' = 'ltr';
  @Input() minuteStep = 1;
  @Input() disabled = false;

  isOpen = false;
  hour = 0;
  minute = 0;

  private _value = '00:00';
  private onChange: any = () => {};
  private onTouched: any = () => {};
  private isTouched = false;

  constructor(private elementRef: ElementRef) {}

  get value(): string {
    return this._value;
  }

  set value(val: string) {
    if (val !== this._value) {
      this._value = val;
      this.parseValue(val);
      this.onChange(val);
    }
  }

  // ControlValueAccessor implementation
  writeValue(val: string): void {
    if (val) {
      this._value = val;
      this.parseValue(val);
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  // Parse value into hour and minute
  private parseValue(val: string) {
    const parts = val.split(':');
    if (parts.length >= 2) {
      this.hour = parseInt(parts[0], 10) || 0;
      this.minute = parseInt(parts[1], 10) || 0;
    } else {
      this.hour = 0;
      this.minute = 0;
    }
  }

  // Update the value
  private updateValue() {
    const h = String(this.hour).padStart(2, '0');
    const m = String(this.minute).padStart(2, '0');
    this.value = `${h}:${m}`;
  }

  // Generate hours array (0-23)
  hours(): number[] {
    return Array.from({ length: 24 }, (_, i) => i);
  }

  // Generate minutes array (0-59)
  minutes(): number[] {
    return Array.from({ length: 60 }, (_, i) => i);
  }

  // Set hour
  setHour(h: number) {
    this.hour = Math.max(0, Math.min(23, h));
    this.updateValue();
  }

  // Set minute
  setMinute(m: number) {
    this.minute = Math.max(0, Math.min(59, m));
    this.updateValue();
  }

  // Step minute by delta
  stepMinute(delta: number) {
    let newMinute = this.minute + delta;

    // Handle overflow/underflow
    if (newMinute >= 60) {
      newMinute = 0;
      this.hour = (this.hour + 1) % 24;
    } else if (newMinute < 0) {
      newMinute = 59;
      this.hour = this.hour === 0 ? 23 : this.hour - 1;
    }

    this.minute = newMinute;
    this.updateValue();
  }

  // Toggle panel
  toggle() {
    if (!this.disabled) {
      this.isOpen = !this.isOpen;
    }
  }

  // Close panel
  close() {
    this.isOpen = false;
    this.markTouched();
  }

  // Clear value
  clear() {
    this.hour = 0;
    this.minute = 0;
    this.updateValue();
    this.close();
  }

  // Mark as touched
  markTouched() {
    if (!this.isTouched) {
      this.isTouched = true;
      this.onTouched();
    }
  }

  // Close on click outside
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (this.isOpen && !this.elementRef.nativeElement.contains(event.target)) {
      this.close();
    }
  }
}
