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

  // بيانات الجدول (هاتها من API في loadData)
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

  // ===== Popup state =====
  popupVisible = false;
  popupX = 0;
  popupY = 0;
  popupData: PopUpSignBox | null = null; // بيانات العرض (اسم/IP/Lat/Lng + آخر قيم)
  popupLive: ReceiveMessage | null = null; // آخر L1/L2/T1/T2 لهذا الـ ID

  // نخزن آخر رسالة لكل صندوق حسب ID
  latestById: Record<number, ReceiveMessage> = {};

  constructor() {
    // استماع لرسائل SignalR
    toObservable(this.signalr.messages)
      .pipe(takeUntilDestroyed())
      .subscribe(({ message }) => {
        if (!message) return;
        const id = message.ID;

        // 1) خزّن آخر حالة لهذا الـ ID
        this.latestById[id] = message;

        // 2) حدّث حالة الـ Active في الجدول (immutable)
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

        // 3) لو الـ popup مفتوح لنفس الـ ID → حدّث المعروض فورًا
        if (this.popupData?.Id === id) {
          this.popupLive = message;
          // عدل بيانات popupData الأساسية (اسم/إحداثيات) إن لزم
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

    // Debug (اختياري)
    toObservable(this.signalr.status)
      .pipe(takeUntilDestroyed())
      .subscribe((s) => console.log('[Hub Status]', s));

    toObservable(this.signalr.lastError)
      .pipe(takeUntilDestroyed())
      .subscribe((err) => err && console.warn('[Hub Error]', err));
  }

  ngOnInit(): void {
    this.signalr
      .connect()
      .then(() => console.log('[SignalR] Connected'))
      .catch((err) => console.error('[SignalR] Connect error:', err));

    this.loadData();
  }

  ngOnDestroy(): void {
    this.signalr.disconnect().catch(() => {});
  }

  // تحميل البيانات (بحث/أول مرة)
  loadData(): void {
    this.signBoxControlService.getAll(this.searchParameter).subscribe((data) => {
      this.signBoxEntity = data;
      this.hasPreviousPage = data.value.hasPreviousPage;
      this.hasNextPage = data.value.hasNextPage;
    });
  }

  // تنفيذ البحث عند Enter
  onSearchEnter(): void {
    console.log('Search:', this.searchParameter.searchText);
    this.loadData();
  }

  // ===== Popup Events =====
  showPopup(row: GetAllSignControlBox, event: MouseEvent) {
    const live = this.latestById[row.id] ?? null;

    // ابنِ كائن العرض مباشرة (بدون JSON.parse)
    this.popupData = {
      Id: row.id,
      name: row.name ?? '—',
      Latitude: row.latitude ?? '—',
      Longitude: row.longitude ?? '—',
      // لو عايز تحتفظ بنسخة من آخر القيم داخل popupData نفسها (اختياري):
      L1: live?.L1 ?? 'R',
      L2: live?.L2 ?? 'R',
      T1: typeof live?.T1 === 'number' ? live!.T1 : 0,
      T2: typeof live?.T2 === 'number' ? live!.T2 : 0,
    } as PopUpSignBox;

    this.popupLive = live; // للعرض الحي
    this.popupVisible = true;
    this.updatePopupPosition(event);
  }

  movePopup(event: MouseEvent) {
    if (this.popupVisible) {
      this.updatePopupPosition(event);
    }
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
    let x = event.clientX + offset;
    let y = event.clientY - ph - offset;

    if (x + pw > window.innerWidth) x = event.clientX - pw - offset;
    if (y < 0) y = event.clientY + offset;

    this.popupX = x + window.scrollX;
    this.popupY = y + window.scrollY;
  }

  // ===== ماب للألوان والإيموجي =====
  mapCodeToClass(code?: 'R' | 'Y' | 'G') {
    return code === 'G' ? 'is-green' : code === 'Y' ? 'is-yellow' : 'is-red';
  }
  lightEmoji(code?: 'R' | 'Y' | 'G') {
    return code === 'G' ? '🟢' : code === 'Y' ? '🟡' : '🔴';
  }
}
