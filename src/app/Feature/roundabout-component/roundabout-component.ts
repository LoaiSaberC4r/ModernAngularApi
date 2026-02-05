import {
  Component,
  AfterViewInit,
  ViewChild,
  ElementRef,
  Renderer2,
  ViewEncapsulation,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { SignDirection } from '../../Domain/Entity/SignControlBox/SignDirection/SignDirection';

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

  /** أربع خانات ثابتة + قناع يحدد أيها فعّال بناءً على الـ DTO القادم */
  private readonly TOTAL = 4;
  public _dtoFull: SignDirection[] = [
    { name: 'اتجاه 1', order: 1, left: false, right: false },
    { name: 'اتجاه 2', order: 2, left: false, right: false },
    { name: 'اتجاه 3', order: 3, left: false, right: false },
    { name: 'اتجاه 4', order: 4, left: false, right: false },
  ];
  private _activeMask: boolean[] = [false, false, false, false];

  @Input() set directions(value: SignDirection[] | null) {
    const incoming = (value ?? []).slice(0, this.TOTAL);

    // reset
    this._activeMask = [false, false, false, false];
    this._dtoFull = [
      { name: 'اتجاه 1', order: 1, left: false, right: false },
      { name: 'اتجاه 2', order: 2, left: false, right: false },
      { name: 'اتجاه 3', order: 3, left: false, right: false },
      { name: 'اتجاه 4', order: 4, left: false, right: false },
    ];

    // merge الموجود واعتبره فعّال
    for (let i = 0; i < incoming.length; i++) {
      const d = incoming[i];
      if (!d) continue;
      this._dtoFull[i] = {
        name: d.name ?? this._dtoFull[i].name,
        order: d.order ?? this._dtoFull[i].order,
        lightPatternId: d.lightPatternId,
        lightPatternName: d.lightPatternName,
        left: !!d.left,
        right: !!d.right,
      };
      this._activeMask[i] = true;
    }

    this.emitChange(); // نبعث فقط الفعّال
  }
  get directions(): SignDirection[] {
    return this._dtoFull.filter((_, i) => this._activeMask[i]);
  }

  @Output() directionsChange = new EventEmitter<SignDirection[]>();

  constructor(private renderer: Renderer2) {}
  ngAfterViewInit(): void {}

  isActive(index: number): boolean {
    return !!this._activeMask[index];
  }

  getDirectionName(index: number): string {
    return this._dtoFull[index]?.name ?? `اتجاه ${index + 1}`;
  }

  onNameEdited(key: DirectionKey, ev: Event): void {
    const idx = this.keyToIndex(key);
    if (!this.isActive(idx)) return;
    const el = ev.target as HTMLElement;
    const newName = (el.innerText || '').trim() || `اتجاه ${idx + 1}`;
    this._dtoFull[idx].name = newName;
    this.emitChange();
  }

  toggleSide(key: DirectionKey, side: Side): void {
    const idx = this.keyToIndex(key);
    if (!this.isActive(idx)) return; // تجاهل غير الفعّال
    this._dtoFull[idx][side] = !this._dtoFull[idx][side];
    this.emitChange();
  }

  private emitChange(): void {
    const out = this._dtoFull.map((x) => ({ ...x })).filter((_, i) => this._activeMask[i]);
    this.directionsChange.emit(out);
  }

  private keyToIndex(key: DirectionKey): number {
    switch (key) {
      case 'north':
        return 0;
      case 'south':
        return 1;
      case 'east':
        return 2;
      case 'west':
        return 3;
    }
  }
}
