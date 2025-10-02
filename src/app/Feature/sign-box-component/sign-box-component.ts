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
import { PopUpDirection, PopUpSignBox, TrafficColor } from '../../Domain/PopUpSignBox/PopUpSignBox';
import { Subscription, timer } from 'rxjs';

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

  isDisconnected = false;
  private disconnectTimerSub?: Subscription;

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
    toObservable(this.signalr.messages)
      .pipe(takeUntilDestroyed())
      .subscribe(({ message }) => {
        console.log(message);
        if (!message) return;
        const id = message.ID;

        this.disconnectTimerSub?.unsubscribe();
        this.isDisconnected = false;

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

    toObservable(this.signalr.status)
      .pipe(takeUntilDestroyed())
      .subscribe((s) => {
        if (s === 'disconnected') {
          this.disconnectTimerSub?.unsubscribe();
          this.disconnectTimerSub = timer(4000).subscribe(() => {
            try {
              const current =
                typeof this.signalr.status === 'function'
                  ? (this.signalr.status() as any)
                  : (this.signalr.status as any);
              if (current === 'disconnected') {
                this.isDisconnected = true;
              }
            } catch {
              this.isDisconnected = true;
            }
          });
        } else {
          this.disconnectTimerSub?.unsubscribe();
          this.isDisconnected = false;
        }
      });
  }

  ngOnInit(): void {
    this.signalr.connect().catch(console.error);
    this.loadData();
  }

  ngOnDestroy(): void {
    this.signalr.disconnect().catch(() => {});
    this.disconnectTimerSub?.unsubscribe();
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
}
