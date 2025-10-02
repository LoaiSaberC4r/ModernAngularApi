import {
  Component, AfterViewInit, ViewChild, ElementRef, Renderer2,
  ViewEncapsulation, Input, Output, EventEmitter
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { SignDirection } from '../../Domain/Entity/SignControlBox/AddSignBoxCommandDto';

type DirectionKey = 'north' | 'south' | 'east' | 'west';
type Side = 'left' | 'right';

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

  /** نستقبل فقط ما أرسله الأب (1..4 عناصر) ونطبع القيم لبووليني */
  @Input() set directions(value: SignDirection[] | null) {
    const arr = (value ?? []).slice(0, 4).map((d, i) => ({
      name: d.name ?? `اتجاه ${i + 1}`,
      order: d.order ?? (i + 1),
      lightPatternId: d.lightPatternId,       // غير مستخدمة بصريًا هنا
      lightPatternName: d.lightPatternName,   // غير مستخدمة بصريًا هنا
      left: !!d.left,
      right: !!d.right,
    }));
    this._dto = arr;
    this.directionsChange.emit(this._dto.map(x => ({ ...x })));
  }
  get directions(): SignDirection[] { return this._dto; }

  @Output() directionsChange = new EventEmitter<SignDirection[]>();

  /** الحالة الداخلية (على قد اللي جاي من الأب) */
  public _dto: SignDirection[] = [];

  private readonly dirIndexMap: Record<DirectionKey, number> = {
    north: 0, south: 1, east: 2, west: 3
  };

  constructor(private renderer: Renderer2) {}

  ngAfterViewInit(): void { /* لا listeners إضافية */ }

  getDirectionName(index: number): string {
    return (this._dto[index]?.name ?? `اتجاه ${index + 1}`);
  }

  onNameEdited(key: DirectionKey, ev: Event): void {
    const idx = this.dirIndexMap[key];
    if (idx >= this._dto.length) return;
    const el = ev.target as HTMLElement;
    const newName = (el.innerText || '').trim() || `اتجاه ${idx + 1}`;
    this._dto[idx].name = newName;
    this.emitChange();
  }

  toggleSide(key: DirectionKey, side: Side): void {
    const idx = this.dirIndexMap[key];
    if (idx >= this._dto.length) return;
    this._dto[idx][side] = !this._dto[idx][side];
    this.emitChange();
  }

  private emitChange(): void {
    this.directionsChange.emit(this._dto.map(x => ({ ...x })));
  }
}
