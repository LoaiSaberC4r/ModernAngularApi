import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

import { ISignBoxControlService } from '../../Services/SignControlBox/isign-box-controlService';
import { ISignalrService } from '../../Services/Signalr/isignalr-service';

import { SearchParameters } from '../../Domain/ResultPattern/SearchParameters';
import { Pagination } from '../../Domain/ResultPattern/Pagination';
import { GetAllSignControlBox } from '../../Domain/Entity/SignControlBox/GetAllSignControlBox';
import { ResultError } from '../../Domain/ResultPattern/Error';

import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { PopUpSignBox, TrafficColor } from '../../Domain/PopUpSignBox/PopUpSignBox';
import {
  ApplySignBox,
  GetAllSignControlBoxWithLightPattern,
} from '../../Domain/Entity/SignControlBox/GetAllSignControlBoxWithLightPattern';

export interface ReceiveMessage {
  L1: 'R' | 'Y' | 'G';
  L2: 'R' | 'Y' | 'G';
  T1: number;
  T2: number;
  ID: number;
}
export interface ChatMessage {
  user: string;
  message: ReceiveMessage;
  at: Date;
}

@Component({
  selector: 'app-sign-box-controller',
  imports: [FormsModule, CommonModule, RouterModule],
  templateUrl: './sign-box-controller.html',
  styleUrl: './sign-box-controller.css',
})
export class SignBoxController {
  private readonly signalr = inject(ISignalrService);
  private readonly signBoxControlService = inject(ISignBoxControlService);
  private readonly router = inject(Router);

  readonly status = this.signalr.status;
  readonly lastError = this.signalr.lastError;
  readonly messages = this.signalr.messages;

  searchParameter: SearchParameters = {};
  hasPreviousPage = false;
  hasNextPage = false;

  // Table data
  signBoxEntity: Pagination<GetAllSignControlBox> = {
    value: {
      data: [],
      pageSize: 0,
      totalPages: 0,
      currentPage: 1,
      hasNextPage: false,
      hasPreviousPage: false,
      totalItems: 0,
    },
    isSuccess: false,
    isFailure: false,
    error: {} as ResultError,
  };

  // ===== Active Filter =====
  activeFilter: 'ALL' | 'ACTIVE' | 'INACTIVE' = 'ALL';
  showActiveFilter = false;

  // ===== Popup state =====
  popupVisible = false;
  popupX = 0;
  popupY = 0;
  popupData: PopUpSignBox | null = null;
  popupLive: ReceiveMessage | null = null;
  latestById: Record<number, ReceiveMessage> = {};

  constructor() {
    toObservable(this.signalr.messages)
      .pipe(takeUntilDestroyed())
      .subscribe(({ message }) => {
        if (!message) {
          const cur = this.signBoxEntity;

          this.signBoxEntity = {
            ...cur,
            value: {
              ...cur.value,
              data: cur.value.data.map((x) => ({
                ...x,
                active: false,
              })),
            },
          };
          return;
        }

        const id = message.ID;
        this.latestById[id] = message;

        const cur = this.signBoxEntity;
        this.signBoxEntity = {
          ...cur,
          value: {
            ...cur.value,
            data: cur.value.data.map((x) => ({
              ...x,
              active: x.id === id,
            })),
          },
        };
      });
  }

  ngOnInit(): void {
    this.signalr.connect().catch(console.error);
    this.loadData();
  }

  ngOnDestroy(): void {
    this.signalr.disconnect().catch(() => {});
  }

  loadData(): void {
    this.signBoxControlService.getAll(this.searchParameter).subscribe((data) => {
      console.log(data);
      this.signBoxEntity = data;
      this.hasPreviousPage = data.value.hasPreviousPage;
      this.hasNextPage = data.value.hasNextPage;
    });
  }

  onSearchEnter(): void {
    this.loadData();
  }

  // ===== Active Filter logic =====
  setActiveFilter(filter: 'ALL' | 'ACTIVE' | 'INACTIVE') {
    this.activeFilter = filter;
    this.showActiveFilter = false;
  }

  get filteredData(): GetAllSignControlBox[] {
    return this.signBoxEntity.value.data.filter((item) => {
      if (this.activeFilter === 'ACTIVE') return item.active;
      if (this.activeFilter === 'INACTIVE') return !item.active;
      return true;
    });
  }

  // ===== Popup =====
  showPopup(row: GetAllSignControlBox, event: MouseEvent) {
    const live = this.latestById[row.id] ?? null;

    this.popupData = {
      Id: row.id,
      name: row.name ?? '—',
      Latitude: row.latitude ?? '—',
      Longitude: row.longitude ?? '—',
      directions: (row.directions ?? []).map((d, idx) => ({
        name: d.name,
        code: (live ? (live as any)[`L${idx + 1}`] : 'R') as TrafficColor,
        timer: (live ? (live as any)[`T${idx + 1}`] : 0) as number,
      })),
    };

    this.popupLive = live;
    this.popupVisible = true;
    this.updatePopupPosition(event);
  }

  movePopup(event: MouseEvent) {
    if (this.popupVisible) this.updatePopupPosition(event);
  }

  hidePopup() {
    this.popupVisible = false;
    this.popupData = null;
    this.popupLive = null;
  }

  private updatePopupPosition(event: MouseEvent) {
    const offset = 5,
      pw = 280,
      ph = 210;
    let x = event.clientX + offset,
      y = event.clientY - ph - offset;
    if (x + pw > window.innerWidth) x = event.clientX - pw - offset;
    if (y < 0) y = event.clientY + offset;
    this.popupX = x + window.scrollX;
    this.popupY = y + window.scrollY;
  }

  mapCodeToClass(code?: 'R' | 'Y' | 'G') {
    return code === 'G' ? 'is-green' : code === 'Y' ? 'is-yellow' : 'is-red';
  }
  lightEmoji(code?: 'R' | 'Y' | 'G') {
    return code === 'G' ? '🟢' : code === 'Y' ? '🟡' : '🔴';
  }

  // ===== Apply =====
  applyPattern(item: GetAllSignControlBox) {
    let payload: ApplySignBox = { id: item.id };
    this.signBoxControlService.applySignBox(payload).subscribe((data) => {
      console.log('Applied:', data);
    });
  }

  // ===== Edit =====
  onEdit(item: GetAllSignControlBox) {
    console.log(item);
    this.router.navigate(
      ['/trafficController/edit-sign-box', item.id],
      { state: { signbox: item } } // may or may not include directions
    );
  }
}
