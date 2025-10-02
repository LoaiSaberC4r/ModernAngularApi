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

type Direction = 'north' | 'south' | 'east' | 'west';
type MovementType = 'straight' | 'right';
type SignalColor = 'red' | 'yellow' | 'green';

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

  public systemState = {
    activeDirection: null as null | Direction,
    activeType: null as null | MovementType,
    movementRules: {
      north: { straight: 'south', right: 'east' },
      south: { straight: 'north', right: 'west' },
      east: { straight: 'west', right: 'north' },
      west: { straight: 'east', right: 'south' },
    } as Record<Direction, { straight: Direction; right: Direction }>,
    conflicts: {
      north: ['south'],
      south: ['north'],
      east: ['west'],
      west: ['east'],
    } as Record<Direction, Direction[]>,
    signals: {
      north: 'red',
      south: 'red',
      east: 'red',
      west: 'red',
    } as Record<Direction, SignalColor>,
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
        const dir = btn.getAttribute('data-dir') as Direction | null;
        const type = btn.getAttribute('data-type') as MovementType | null;

        if (dir && type) {
          this.handleMovementRequest(dir, type, btn);
        }
      });
    });
  }

  private handleMovementRequest(
    direction: Direction,
    type: MovementType,
    button: HTMLElement
  ): void {
    const canMove = this.canAllowMovement(direction, type);

    if (!canMove.allowed) {
      this.showNotification(`🚫 ${canMove.message}`);
      return;
    }

    if (this.systemState.activeDirection) {
      this.deactivateCurrentMovement();
    }

    this.activateMovement(direction, type, button);
  }

  private canAllowMovement(
    direction: Direction,
    type: MovementType
  ): { allowed: boolean; message: string } {
    const conflictingDirections = this.systemState.conflicts[direction];

    // تحقق من التعارض مع اتجاه نشط
    if (
      this.systemState.activeDirection &&
      conflictingDirections.includes(this.systemState.activeDirection)
    ) {
      const activeDirName = this.getDirectionArabic(this.systemState.activeDirection);
      return {
        allowed: false,
        message: `الحركة غير مسموحة بسبب تعارض مع اتجاه "${activeDirName}" النشط`,
      };
    }

    const signalState = this.systemState.signals[direction];
    if (signalState === 'red') {
      if (type === 'straight') {
        return {
          allowed: false,
          message: `الإشارة حمراء — لا يمكن المرور مستقيمًا`,
        };
      } else if (type === 'right') {
        const targetDirection = this.systemState.movementRules[direction].right;
        const isTargetClear = !this.isDirectionActive(targetDirection);

        if (isTargetClear) {
          return {
            allowed: true,
            message: `الإشارة حمراء لكن الالتفاف يمينًا مسموح لأنه لا يوجد تعارض`,
          };
        } else {
          // هنا نعرض اسم الاتجاه النشط الذي يمنع الالتفاف
          const activeDirName = this.getDirectionArabic(this.systemState.activeDirection!);
          return {
            allowed: false,
            message: `الإشارة حمراء — لا يمكن الالتفاف يمينًا لأن الاتجاه "${activeDirName}" مفتوح حاليًا`,
          };
        }
      }
    }

    return {
      allowed: true,
      message: `الحركة مسموحة`,
    };
  }

  private isDirectionActive(direction: Direction): boolean {
    return this.systemState.activeDirection === direction;
  }

  private activateMovement(direction: Direction, type: MovementType, button: HTMLElement): void {
    this.systemState.activeDirection = direction;
    this.systemState.activeType = type;

    this.systemState.signals[direction] = 'green';

    const conflictingDirections = this.systemState.conflicts[direction];
    conflictingDirections.forEach((conflictDir) => {
      this.systemState.signals[conflictDir] = 'red';
    });

    button.classList.add('active');

    const directionArabic = this.getDirectionArabic(direction);
    const movementType = type === 'straight' ? 'مستقيم' : 'يمين';
    this.showNotification(`✅ تم السماح بالمرور من اتجاه ${directionArabic} (${movementType})`);

    setTimeout(() => {
      this.deactivateCurrentMovement();
    }, 5000);
  }

  private deactivateCurrentMovement(): void {
    if (this.systemState.activeDirection && this.systemState.activeType) {
      const btn = this.containerRef.nativeElement.querySelector<HTMLElement>(
        `.arrow-btn[data-dir="${this.systemState.activeDirection}"][data-type="${this.systemState.activeType}"]`
      );
      btn?.classList.remove('active');

      this.systemState.signals[this.systemState.activeDirection] = 'red';
    }

    this.systemState.activeDirection = null;
    this.systemState.activeType = null;
  }

  private getDirectionArabic(direction: Direction): string {
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

  private showNotification(message: string): void {
    let notification = document.querySelector<HTMLElement>('.roundabout-notification');
    if (!notification) {
      notification = this.renderer.createElement('div');
      this.renderer.addClass(notification, 'roundabout-notification');
      const host = document.querySelector('.traffic-control-container') || document.body;
      this.renderer.appendChild(host, notification);
    }
    notification!.textContent = message;
    this.renderer.addClass(notification, 'show');
    setTimeout(() => {
      notification?.classList.remove('show');
    }, 3000);
  }
}
