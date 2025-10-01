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
  @Input() directions: { name: string; lightPatternId: number | null; order: number }[] = [];
  @ViewChild('container', { static: true }) containerRef!: ElementRef<HTMLDivElement>;

  private systemState = {
    activeDirection: null as null | 'north' | 'south' | 'east' | 'west',
    activeType: null as null | 'straight' | 'right',
    // قواعد الحركة: من الاتجاه X يمكن الذهاب إلى الاتجاهات Y
    movementRules: {
      north: { straight: 'south', right: 'east' },
      south: { straight: 'north', right: 'west' },
      east: { straight: 'west', right: 'north' },
      west: { straight: 'east', right: 'south' },
    },
    // التعارضات: الاتجاهات التي لا يمكن فتحها معًا
    conflicts: {
      north: ['south'],
      south: ['north'],
      east: ['west'],
      west: ['east'],
    },
  };

  constructor(private renderer: Renderer2) {}

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initSystem();
    }, 0);
  }

  ngOnDestroy(): void {}

  private initSystem(): void {
    this.setupEventListeners();
  }

  getDirectionName(index: number): string {
    return this.directions[index]?.name || `اتجاه ${index + 1}`;
  }

  private setupEventListeners(): void {
    const arrows = this.containerRef.nativeElement.querySelectorAll<HTMLElement>('.arrow-btn');
    arrows.forEach((btn) => {
      this.renderer.listen(btn, 'click', () => {
        const dir = btn.getAttribute('data-dir') as 'north' | 'south' | 'east' | 'west';
        const type = btn.getAttribute('data-type') as 'straight' | 'right';

        if (dir && type) {
          this.handleMovementRequest(dir, type, btn);
        }
      });
    });
  }

  private handleMovementRequest(
    direction: 'north' | 'south' | 'east' | 'west',
    type: 'straight' | 'right',
    button: HTMLElement
  ): void {
    // إيقاف الحركة السابقة
    if (this.systemState.activeDirection) {
      this.deactivateCurrentMovement();
    }

    // تفعيل الحركة الجديدة
    this.activateMovement(direction, type, button);
  }

  private canAllowMovement(
    direction: 'north' | 'south' | 'east' | 'west',
    type: 'straight' | 'right'
  ): boolean {
    // التحقق من التعارضات
    const conflictingDirections = this.systemState.conflicts[direction];
    if (
      this.systemState.activeDirection &&
      conflictingDirections.includes(this.systemState.activeDirection)
    ) {
      return false;
    }

    // التحقق من قواعد الالتفاف الأيمن
    if (type === 'right') {
      const targetDirection = this.systemState.movementRules[direction].right;
      // يمكنك إضافة منطق إضافي هنا للتحقق من ازدحام الطريق
      // حاليًا نسمح دائمًا بالالتفاف الأيمن
    }

    return true;
  }

  private activateMovement(
    direction: 'north' | 'south' | 'east' | 'west',
    type: 'straight' | 'right',
    button: HTMLElement
  ): void {
    this.systemState.activeDirection = direction;
    this.systemState.activeType = type;

    // تفعيل الزر
    button.classList.add('active');

    // عرض الإشعار
    const directionArabic = this.getDirectionArabic(direction);
    const movementType = type === 'straight' ? 'مستقيم' : 'يمين';

    // محاكاة وقت الانتظار
    setTimeout(() => {
      this.deactivateCurrentMovement();
    }, 5000); // 5 ثواني
  }

  private deactivateCurrentMovement(): void {
    if (this.systemState.activeDirection && this.systemState.activeType) {
      const btn = this.containerRef.nativeElement.querySelector<HTMLElement>(
        `.arrow-btn[data-dir="${this.systemState.activeDirection}"][data-type="${this.systemState.activeType}"]`
      );
      btn?.classList.remove('active');
    }

    this.systemState.activeDirection = null;
    this.systemState.activeType = null;
  }

  private getDirectionArabic(direction: string): string {
    // تحويل الاتجاهات إلى الأسماء الفعلية من الـ Wizard
    switch (direction) {
      case 'north':
        return this.directions[0]?.name || 'الشمال';
      case 'south':
        return this.directions[1]?.name || 'الجنوب';
      case 'east':
        return this.directions[2]?.name || 'الشرق';
      case 'west':
        return this.directions[3]?.name || 'الغرب';
      default:
        return direction;
    }
  }
}
