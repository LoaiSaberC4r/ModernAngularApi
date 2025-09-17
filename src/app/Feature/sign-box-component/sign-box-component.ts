import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { ISignBoxControlService } from '../../Services/SignControlBox/isign-box-controlService';
import { ISignalrService } from '../../Services/Signalr/isignalr-service';

import { SearchParameters } from '../../Domain/ResultPattern/SearchParameters';
import { Pagination } from '../../Domain/ResultPattern/Pagination';
import { GetAllSignControlBox } from '../../Domain/Entity/SignControlBox/GetAllSignControlBox';
import { ResultError } from '../../Domain/ResultPattern/Error';

import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { PopUpSignBox } from '../../Domain/PopUpSignBox/PopUpSignBox';

// --- أنواع رسائل الهَب (لو عندكها جاهزة في دومينك، استوردها بدل التعريف ده)
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
  selector: 'app-sign-box-component',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sign-box-component.html',
  styleUrls: ['./sign-box-component.css'],
})
export class SignBoxComponent implements OnInit, OnDestroy {
  private readonly signalr = inject(ISignalrService);
  private readonly signBoxControlService = inject(ISignBoxControlService);

  readonly status = this.signalr.status;
  readonly lastError = this.signalr.lastError;
  readonly messages = this.signalr.messages;

  searchParameter: SearchParameters = {};
  hasPreviousPage = false;
  hasNextPage = false;

  // بيانات الجدول
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
    // استماع لرسائل SignalR
    toObservable(this.signalr.messages)
      .pipe(takeUntilDestroyed())
      .subscribe(({ message }) => {
        if (!message) return;
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

        if (this.popupData?.Id === id) {
          this.popupLive = message;
          const row = this.signBoxEntity.value.data.find((x) => x.id === id);
          if (row) {
            this.popupData = {
              ...this.popupData,
              name: row.name ?? this.popupData.name,
              Latitude: row.latitude ?? this.popupData.Latitude,
              Longitude: row.longitude ?? this.popupData.Longitude,
            };
          }
        }
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
      L1: live?.L1 ?? 'R',
      L2: live?.L2 ?? 'R',
      T1: live?.T1 ?? 0,
      T2: live?.T2 ?? 0,
    } as PopUpSignBox;
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
}
