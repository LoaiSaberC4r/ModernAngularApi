import { Directive, ElementRef, HostListener, OnInit, Renderer2 } from '@angular/core';

@Directive({
  selector: 'input[type="time"][time24h]',
  standalone: true,
})
export class Time24hDirective implements OnInit {
  constructor(private el: ElementRef<HTMLInputElement>, private renderer: Renderer2) {}

  ngOnInit() {
    const input = this.el.nativeElement;

    // Remove any step attribute and force 24h format
    this.renderer.removeAttribute(input, 'step');

    // Set initial value to force format
    if (input.value) {
      this.formatTo24Hour(input.value);
    }
  }

  @HostListener('input', ['$event'])
  onInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.formatTo24Hour(input.value);
  }

  @HostListener('change', ['$event'])
  onChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.formatTo24Hour(input.value);
  }

  @HostListener('blur')
  onBlur() {
    const input = this.el.nativeElement;
    if (input.value) {
      this.formatTo24Hour(input.value);
    }
  }

  private formatTo24Hour(value: string) {
    if (!value) return;

    const input = this.el.nativeElement;

    // Parse the time value
    const parts = value.split(':');
    if (parts.length >= 2) {
      let hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);

      // Ensure hours are in 24-hour format (0-23)
      if (!isNaN(hours) && !isNaN(minutes)) {
        // Normalize hours to 0-23 range
        hours = hours % 24;

        const formattedHours = hours.toString().padStart(2, '0');
        const formattedMinutes = minutes.toString().padStart(2, '0');
        const formatted = `${formattedHours}:${formattedMinutes}`;

        if (input.value !== formatted) {
          this.renderer.setProperty(input, 'value', formatted);

          // Trigger change event manually
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }
  }
}
