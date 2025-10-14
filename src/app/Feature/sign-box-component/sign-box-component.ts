import { Component, ElementRef, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
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
import { LanguageService } from '../../Services/Language/language-service';

import { TrafficBroadcast } from '../../Domain/SignalR/TrafficBroadcast';
import { ChatMessage } from '../../Domain/SignalR/ChatMessage';
import { HubConnectionStatus } from '../../Domain/SignalR/HubConnectionStatus';

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
  public langService = inject(LanguageService);
  @ViewChild('popupRef') popupRef?: ElementRef<HTMLDivElement>;

  get isAr() {
    return this.langService.current === 'ar';
  }

  readonly status = this.signalr.status;
  readonly lastError = this.signalr.lastError;
  readonly messages = this.signalr.messages;

  isDisconnected = false;
  private disconnectTimerSub?: Subscription;

  searchParameter: SearchParameters = {};
  hasPreviousPage = false;
  hasNextPage = false;

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
  get activeFilterLabel(): string {
    if (this.activeFilter === 'ALL') return this.isAr ? 'الكل' : 'All';
    if (this.activeFilter === 'ACTIVE') return this.isAr ? 'نشِط فقط' : 'Active Only';
    return this.isAr ? 'غير نشِط فقط' : 'Inactive Only';
  }

  // ===== Popup state =====
  popupVisible = false;
  popupX = 0;
  popupY = 0;
  popupData: PopUpSignBox | null = null;
  popupLive: TrafficBroadcast | null = null;

  // آخر بث لكل صندوق حسب الـ ID
  latestById: Record<number, TrafficBroadcast> = {};

  constructor() {
    // استقبل البث وحدث الجدول والـpopup
    toObservable(this.signalr.messages)
      .pipe(takeUntilDestroyed())
      .subscribe(({ message }) => {
        console.log(message);
        if (!message) return;

        const id = message.ID;

        this.latestById[id] = message;

        const cur = this.signBoxEntity;
        this.signBoxEntity = {
          ...cur,
          value: {
            ...cur.value,
            data: cur.value.data.map((x) => ({ ...x, active: x.id === id })),
          },
        };

        if (this.popupData?.Id === id) {
          const row = this.signBoxEntity.value.data.find((x) => x.id === id);
          if (row) this.popupData = this.toPopup(row, message);
          this.popupLive = message;
          this.isDisconnected = false;
        }

        this.disconnectTimerSub?.unsubscribe();
        this.isDisconnected = false;
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
              if (current === 'disconnected') this.isDisconnected = true;
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
    this.popupData = this.toPopup(row, live ?? undefined);
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
    const offset = 10;

    let x = event.clientX + offset;
    let y = event.clientY + offset;

    this.popupX = x;
    this.popupY = y;

    requestAnimationFrame(() => {
      const el = this.popupRef?.nativeElement;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      let nx = x;
      let ny = y;

      const preferLeft = this.isAr;

      const rightOverflow = rect.right > window.innerWidth;
      const leftOverflow = rect.left < 0;
      const bottomOverflow = rect.bottom > window.innerHeight;
      const topOverflow = rect.top < 0;

      if (preferLeft || rightOverflow) {
        nx = event.clientX - rect.width - offset;
      }
      if (nx < offset) nx = offset;
      if (nx + rect.width > window.innerWidth - offset) {
        nx = window.innerWidth - rect.width - offset;
      }

      if (bottomOverflow) {
        ny = event.clientY - rect.height - offset;
      }
      if (ny < offset) ny = offset;
      if (ny + rect.height > window.innerHeight - offset) {
        ny = window.innerHeight - rect.height - offset;
      }

      this.popupX = nx;
      this.popupY = ny;
    });
  }

  // يبني الـpopup من بيانات الصف + آخر بث متاح
  private toPopup(row: GetAllSignControlBox, live?: TrafficBroadcast): PopUpSignBox {
    // لاحظ: بنستخدم lightCode/time عشان نطابق تعريف PopUpDirection عندك
    const directions: PopUpDirection[] = (row.directions ?? []).slice(0, 4).map((d, idx) => {
      const ln = `L${idx + 1}` as keyof TrafficBroadcast;
      const tn = `T${idx + 1}` as keyof TrafficBroadcast;
      return {
        name: d.name,
        lightCode: live ? (live[ln] as TrafficColor) : 'R',
        time: live ? (live[tn] as number) : 0,
      } as PopUpDirection;
    });

    return {
      Id: row.id,
      name: row.name ?? '—',
      Latitude: row.latitude ?? '—',
      Longitude: row.longitude ?? '—',
      directions,
    };
  }

  mapCodeToClass(code?: TrafficColor) {
    return code === 'G' ? 'is-green' : code === 'Y' ? 'is-yellow' : 'is-red';
  }
  lightEmoji(code?: TrafficColor) {
    return code === 'G' ? '🟢' : code === 'Y' ? '🟡' : '🔴';
  }
}
