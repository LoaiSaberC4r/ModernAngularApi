import {
  Component,
  AfterViewInit,
  ViewChild,
  ElementRef,
  Renderer2,
  ViewEncapsulation,
  Input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-roundabout-component',
  standalone: true,
  imports: [MatIconModule, CommonModule],
  templateUrl: './roundabout-component.html',
  styleUrls: ['./roundabout-component.css'],
  encapsulation: ViewEncapsulation.None,
})
export class RoundaboutComponent implements AfterViewInit {
  @ViewChild('container', { static: true }) containerRef!: ElementRef<HTMLDivElement>;
  @Input() directions: { name: string; lightPatternId: number | null; order: number }[] = [];

  private systemState = {
    activeDirection: null as null | 'north' | 'south' | 'east' | 'west',
    activeType: null as null | 'straight' | 'right',
  };

  constructor(private renderer: Renderer2) {}

  ngAfterViewInit(): void {
    // setTimeout(() => {
    //   this.initSystem();
    // }, 0);
  }

  private initSystem(): void {
    this.resetAllLights();
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    const arrows = this.containerRef.nativeElement.querySelectorAll<HTMLElement>('.arrow-btn');
    arrows.forEach((btn) => {
      this.renderer.listen(btn, 'click', () => {
        const dir = btn.getAttribute('data-dir');
        const type = btn.getAttribute('data-type');
        if (dir && type) {
          this.activateDirection(dir as any, type as any, btn);
        }
      });
    });
  }

  private activateDirection(
    direction: 'north' | 'south' | 'east' | 'west',
    type: 'straight' | 'right',
    button: HTMLElement
  ): void {
    if (this.systemState.activeDirection) {
      this.deactivateDirection(
        this.systemState.activeDirection,
        this.systemState.activeType ?? 'straight'
      );
    }

    this.systemState.activeDirection = direction;
    this.systemState.activeType = type;

    this.resetAllLights();
    const greenLight = this.containerRef.nativeElement.querySelector<HTMLElement>(
      `.${direction}-light .green`
    );
    if (greenLight) greenLight.classList.add('active');

    button.classList.add('active');
  }

  private deactivateDirection(
    direction: 'north' | 'south' | 'east' | 'west',
    type: 'straight' | 'right'
  ): void {
    const greenLight = this.containerRef.nativeElement.querySelector<HTMLElement>(
      `.${direction}-light .green`
    );
    if (greenLight) greenLight.classList.remove('active');

    const btn = this.containerRef.nativeElement.querySelector<HTMLElement>(
      `.arrow-btn[data-dir="${direction}"][data-type="${type}"]`
    );
    if (btn) btn.classList.remove('active');
  }

  private resetAllLights(): void {
    const lights = this.containerRef.nativeElement.querySelectorAll<HTMLElement>('.light');
    lights.forEach((light) => light.classList.remove('active'));
  }

  // دوال إضافية (اختيارية)
  setAllLightsGreen(): void {
    this.resetAllLights();
    const greens = this.containerRef.nativeElement.querySelectorAll<HTMLElement>('.light.green');
    greens.forEach((g) => g.classList.add('active'));
  }

  resetSystem(): void {
    this.resetAllLights();
    this.systemState.activeDirection = null;
    this.systemState.activeType = null;
    const arrows = this.containerRef.nativeElement.querySelectorAll<HTMLElement>('.arrow-btn');
    arrows.forEach((btn) => btn.classList.remove('active'));
  }
  getDirectionName(index: number): string {
    return this.directions[index]?.name || `Direction ${index + 1}`;
  }
}
