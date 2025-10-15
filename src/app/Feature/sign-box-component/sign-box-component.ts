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
import { Subscription, Subject, timer } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { LanguageService } from '../../Services/Language/language-service';

import { TrafficBroadcast } from '../../Domain/SignalR/TrafficBroadcast';
import { HubConnectionStatus } from '../../Domain/SignalR/HubConnectionStatus';

type TrafficColorText = 'Green' | 'Yellow' | 'Red' | 'Off' | string;

@Component({
  selector: 'app-sign-box-component',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sign-box-component.html',
  styleUrls: ['./sign-box-component.css'],
})
export class SignBoxComponent implements OnInit, OnDestroy {
  private static readonly INACTIVITY_MS = 10000; // 5s
  private static readonly SWEEP_MS = 1000;      // 1s “tick” لإجبار إعادة التقييم

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

  // “Tick” خفيف عشان يحرّك التغيير كل ثانية
  private sweepSub?: Subscription;
  private _tick = 0;

  // آخر وقت شوهد لكل CabinetId (ms)
  private lastSeen: Record<number, number> = {};
  // آخر بث محفوظ لكل CabinetId للـ Popup
  latestByCabinetId: Record<number, TrafficBroadcast> = {};

  searchParameter: SearchParameters = {};
  private searchChanged$ = new Subject<void>();

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

  // ===== Popup =====
  popupVisible = false;
  popupX = 0;
  popupY = 0;
  popupData: (PopUpSignBox & { cabinetId?: number }) | null = null;
  popupLive: TrafficBroadcast | null = null;

  constructor() {
    // بث SignalR
    toObservable(this.signalr.messages)
      .pipe(takeUntilDestroyed())
      .subscribe(({ message }) => {
        if (!message) return;

        const key = this.toKey((message as any).ID);
        if (key === null) return;

        this.latestByCabinetId[key] = message;
        this.lastSeen[key] = Date.now(); // آخر مشاهدة

        // لو البوب-أب على نفس الكابينة حدّثه
        if (this.popupData?.cabinetId === key) {
          const row = this.signBoxEntity.value.data.find(x => this.toKey(x.cabinetId) === key);
          if (row) this.popupData = this.toPopup(row, message);
          this.popupLive = message;
        }
      });

    // حالة الاتصال
    toObservable(this.signalr.status)
      .pipe(takeUntilDestroyed())
      .subscribe((s: HubConnectionStatus) => {
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

    // Debounce للبحث
    this.searchChanged$
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe(() => this.loadData());
  }

  ngOnInit(): void {
    this.signalr.connect().catch(console.error);
    this.loadData();

    // “Tick” كل ثانية لإعادة تقييم isActive() في التمبلِت
    this.sweepSub = timer(SignBoxComponent.SWEEP_MS, SignBoxComponent.SWEEP_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => { this._tick++; });
  }

  ngOnDestroy(): void {
    this.signalr.disconnect().catch(() => {});
    this.disconnectTimerSub?.unsubscribe();
    this.sweepSub?.unsubscribe();
  }

  // ========= بيانات =========
  loadData(): void {
    this.signBoxControlService.getAll(this.searchParameter).subscribe((data) => {
      // مفيش set لـ active نهائيًا — النشاط يُحسب لحظيًا من lastSeen
      this.signBoxEntity = { ...data, value: { ...data.value, data: [...data.value.data] } };
      this.hasPreviousPage = data.value.hasPreviousPage;
      this.hasNextPage = data.value.hasNextPage;
    });
  }

  onSearchEnter(): void {
    this.searchChanged$.next();
  }

  setActiveFilter(filter: 'ALL' | 'ACTIVE' | 'INACTIVE') {
    this.activeFilter = filter;
    this.showActiveFilter = false;
  }

  trackById = (_: number, item: GetAllSignControlBox) => item?.id;

  // ===== حساب “نشِط” لحظيًا =====
  private isActiveByCabinetId(cabinetId: unknown): boolean {
    const k = this.toKey(cabinetId);
    if (k === null) return false;
    const seen = this.lastSeen[k] ?? 0;
    return !!seen && (Date.now() - seen) <= SignBoxComponent.INACTIVITY_MS;
  }

/*************  ✨ Windsurf Command ⭐  *************/
  /**
   * Get filtered data according to search query and active filter.
   *
   * This function will first filter the data by the active filter (if any),
   * then filter the result by the search query (if any).
   *
   * The search query will be matched against the name, id, and cabinet id of each item.
   * The active filter will filter items by their activity status (active/inactive).
   *
   * @returns {GetAllSignControlBox[]} The filtered data.
   */
/*******  6608a014-18bb-4f87-b0fb-bfb71e3e7e2c  *******/
  get filteredData(): GetAllSignControlBox[] {
    const q = (this.searchParameter.searchText ?? '').trim().toLowerCase();

    const byActivity = (item: GetAllSignControlBox) => {
      const active = this.isActiveByCabinetId(item.cabinetId);
      if (this.activeFilter === 'ACTIVE') return active;
      if (this.activeFilter === 'INACTIVE') return !active;
      return true;
    };

    const base = this.signBoxEntity.value.data.filter(byActivity);
    if (!q) return base;

    return base.filter((item) => {
      const name = (item?.name ?? '').toLowerCase();
      const idStr = (item?.id ?? '').toString().toLowerCase();
      const cabIdStr = (item?.cabinetId ?? '').toString().toLowerCase();
      return name.includes(q) || idStr.includes(q) || cabIdStr.includes(q);
    });
  }

  // ===== Popup =====
  showPopup(row: GetAllSignControlBox, event: MouseEvent) {
    const k = this.toKey(row.cabinetId);
    const live = k !== null ? this.latestByCabinetId[k] ?? null : null;

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
      const bottomOverflow = rect.bottom > window.innerHeight;

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

  // ===== Helpers =====
  private toKey(n: unknown): number | null {
    const k = Number(n);
    return Number.isFinite(k) ? k : null;
  }

  private normalizeColor(c?: TrafficColorText): TrafficColor | undefined {
    switch ((c ?? '').toLowerCase()) {
      case 'g':
      case 'green':
        return 'G';
      case 'y':
      case 'yellow':
        return 'Y';
      case 'r':
      case 'red':
        return 'R';
      case 'off':
      case '':
      default:
        return undefined;
    }
  }

  private toPopup(row: GetAllSignControlBox, live?: TrafficBroadcast): PopUpSignBox & { cabinetId?: number } {
    const directions: PopUpDirection[] = (row.directions ?? []).slice(0, 4).map((d, idx) => {
      const ln = `L${idx + 1}` as keyof TrafficBroadcast;
      const tn = `T${idx + 1}` as keyof TrafficBroadcast;

      const lightCode = live ? this.normalizeColor((live as any)[ln]) : undefined;
      const time = live ? Number((live as any)[tn] ?? 0) : 0;

      return { name: d.name, lightCode, time } as PopUpDirection;
    });

    return {
      Id: row.id,
      name: row.name ?? '—',
      Latitude: row.latitude ?? '—',
      Longitude: row.longitude ?? '—',
      directions,
      cabinetId: this.toKey(row.cabinetId) ?? undefined,
    };
  }

  // ====== واجهة (يستخدمها التمبلِت) ======
  isActive(item: GetAllSignControlBox): boolean {
    return this.isActiveByCabinetId(item.cabinetId);
  }
}
