import { Component, DestroyRef, inject, OnDestroy, OnInit } from '@angular/core';
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
import { PopUpSignBox } from '../../Domain/PopUpSignBox/PopUpSignBox';
import { ApplySignBox } from '../../Domain/Entity/SignControlBox/GetAllSignControlBoxWithLightPattern';

import { LanguageService } from '../../Services/Language/language-service';
import { debounceTime, Subject, Subscription, timer } from 'rxjs';
import { IAreaService } from '../../Services/Area/iarea-service';
import { IGovernateService } from '../../Services/Governate/igovernate-service';
import { GetAllGovernate } from '../../Domain/Entity/Governate/GetAllGovernate';
import { GetAllArea } from '../../Domain/Entity/Area/GetAllArea';

import { HubConnectionStatus } from '../../Domain/SignalR/HubConnectionStatus';
import { ToasterService } from '../../Services/Toster/toaster-service';

export interface ReceiveMessage {
  L1?: 'R' | 'Y' | 'G';
  L2?: 'R' | 'Y' | 'G';
  L3?: 'R' | 'Y' | 'G';
  L4?: 'R' | 'Y' | 'G';
  T1?: number;
  T2?: number;
  T3?: number;
  T4?: number;

  /**
   * ✅ IMPORTANT:
   * الباك عندك بيستخدم ID كـ CabinetId
   */
  ID: number;
}

@Component({
  selector: 'app-sign-box-controller',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterModule],
  templateUrl: './sign-box-controller.html',
  styleUrl: './sign-box-controller.css',
})
export class SignBoxController implements OnInit, OnDestroy {
  private readonly signalr = inject(ISignalrService);
  private readonly signBoxControlService = inject(ISignBoxControlService);
  private readonly router = inject(Router);
  public readonly langService = inject(LanguageService);
  private readonly areaService = inject(IAreaService);
  private readonly governateService = inject(IGovernateService);
  private readonly toaster = inject(ToasterService);
  private readonly destroyRef = inject(DestroyRef);

  get isAr() {
    return this.langService.current === 'ar';
  }

  private static readonly INACTIVITY_MS = 10000;
  private static readonly SWEEP_MS = 1000;

  private sweepSub?: Subscription;

  readonly status = this.signalr.status;
  readonly lastError = this.signalr.lastError;

  // ✅ بدل messages القديمة
  readonly cabinetPing = this.signalr.cabinetPing;
  readonly trafficBroadcast = this.signalr.trafficBroadcast;

  searchParameter: SearchParameters = {};
  private searchChanged$ = new Subject<void>();
  private disconnectTimerSub?: Subscription;

  hasPreviousPage = false;
  hasNextPage = false;

  selectedGovernorateId: number | null = null;
  selectedAreaId: number | null = null;

  governates: GetAllGovernate[] = [];
  areas: GetAllArea[] = [];
  private _reqSeq = 0;

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

  activeFilter: 'ALL' | 'ACTIVE' | 'INACTIVE' = 'ALL';
  showActiveFilter = false;
  get activeFilterLabel(): string {
    if (this.activeFilter === 'ALL') return this.isAr ? 'الكل' : 'All';
    if (this.activeFilter === 'ACTIVE') return this.isAr ? 'نشِط فقط' : 'Active Only';
    return this.isAr ? 'غير نشِط فقط' : 'Inactive Only';
  }

  // ===== Popup (لو هتكمّله بعدين) =====
  popupVisible = false;
  popupX = 0;
  popupY = 0;
  popupData: PopUpSignBox | null = null;
  popupLive: ReceiveMessage | null = null;

  /**
   * latestByCabinetId: آخر Broadcast لكل CabinetId
   */
  latestById: Record<number, ReceiveMessage> = {};

  /**
   * lastSeen: آخر وقت وصل فيه أي event للكابينة
   */
  private lastSeen: Record<number, number> = {};

  // Toast reconnect/disconnect
  private _wasDisconnected = false;

  constructor() {
    // =========================
    // 1) Cabinet Ping => Active
    // =========================
    toObservable(this.signalr.cabinetPing)
      .pipe(takeUntilDestroyed())
      .subscribe((msg) => {
        if (!msg) return;

        const cabId = msg.message?.id;
        if (!cabId || cabId <= 0) return;

        this.touchCabinet(cabId);
        this.recomputeActives();
      });

    // =========================
    // 2) Broadcast => Active + cache
    // =========================
    toObservable(this.signalr.trafficBroadcast)
      .pipe(takeUntilDestroyed())
      .subscribe((msg) => {
        if (!msg?.message) return;

        const m = msg.message as any;
        const cabId = Number(m.ID ?? m.id);
        if (!Number.isFinite(cabId) || cabId <= 0) return;

        const normalized: ReceiveMessage = {
          ID: cabId,
          L1: m.L1 ?? m.l1,
          T1: Number(m.T1 ?? m.t1 ?? 0) || 0,
          L2: m.L2 ?? m.l2,
          T2: Number(m.T2 ?? m.t2 ?? 0) || 0,
          L3: m.L3 ?? m.l3,
          T3: Number(m.T3 ?? m.t3 ?? 0) || 0,
          L4: m.L4 ?? m.l4,
          T4: Number(m.T4 ?? m.t4 ?? 0) || 0,
        };

        this.latestById[cabId] = normalized;
        this.touchCabinet(cabId);
        this.recomputeActives();

        // لو عندك popup مفتوح لنفس الكابينة، حدّثه (اختياري)
        // if (this.popupData && (this.popupData as any).cabinetId === cabId) {
        //   this.popupLive = normalized;
        // }
      });

    // =========================
    // Search debounce
    // =========================
    this.searchChanged$
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe(() => this.loadData());

    // =========================
    // SignalR status -> toaster
    // =========================
    toObservable(this.signalr.status)
      .pipe(takeUntilDestroyed())
      .subscribe((s: HubConnectionStatus) => {
        if (s === 'disconnected') {
          if (!this._wasDisconnected) {
            this._wasDisconnected = true;
            this.toaster.warning(
              this.isAr ? '⚠️ انقطع الاتصال بالـ Live' : '⚠️ Live connection disconnected'
            );
          }

          this.disconnectTimerSub?.unsubscribe();
          this.disconnectTimerSub = timer(4000).subscribe(() => {
            if (this._wasDisconnected) {
              this.toaster.error(this.isAr ? '❌ تعذّر إعادة الاتصال' : '❌ Failed to reconnect');
            }
          });
        } else if (s === 'connected') {
          this.disconnectTimerSub?.unsubscribe();
          if (this._wasDisconnected) {
            this._wasDisconnected = false;
            this.toaster.success(
              this.isAr ? '✅ تم إعادة الاتصال بالـ Live' : '✅ Live reconnected'
            );
          }
        }
      });

    // =========================
    // lastError -> toaster
    // =========================
    toObservable(this.signalr.lastError)
      .pipe(takeUntilDestroyed())
      .subscribe((err: any) => {
        if (!err) return;
        const msg = this.extractBackendMessage(err);
        if (msg) this.toaster.error(msg);
      });
  }

  ngOnInit(): void {
    this.signalr.connect().catch((e) => {
      this.toaster.error(this.isAr ? '❌ فشل الاتصال بالـ Live' : '❌ Failed to connect to Live');
      console.error(e);
    });

    this.loadData();
    this.loadGovernates();

    // كل ثانية: شيل Active من اللي بقالها أكتر من 10 ثواني
    this.sweepSub = timer(SignBoxController.SWEEP_MS, SignBoxController.SWEEP_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.recomputeActives();
      });
  }

  ngOnDestroy(): void {
    this.signalr.disconnect().catch(() => {});
    this.disconnectTimerSub?.unsubscribe();
    this.sweepSub?.unsubscribe();
  }

  loadData(): void {
    const seq = ++this._reqSeq;

    this.signBoxControlService.getAll(this.searchParameter).subscribe({
      next: (data) => {
        if (seq !== this._reqSeq) return;

        // ✅ أول ما الداتا تيجي: اعمل reconcile للـ active حسب lastSeen
        this.signBoxEntity = {
          ...data,
          value: {
            ...data.value,
            data: data.value.data.map((x) => ({
              ...x,
              active: this.isActiveByCabinetId(x.cabinetId),
            })),
          },
        };

        this.hasPreviousPage = data.value.hasPreviousPage;
        this.hasNextPage = data.value.hasNextPage;
      },
      error: (err) => {
        const msg =
          this.extractBackendMessage(err) ||
          (this.isAr ? 'حدث خطأ أثناء تحميل البيانات' : 'Failed to load data');
        this.toaster.error(msg);
        console.error(err);
      },
    });
  }

  setActiveFilter(filter: 'ALL' | 'ACTIVE' | 'INACTIVE') {
    this.activeFilter = filter;
    this.showActiveFilter = false;
  }

  get filteredData(): GetAllSignControlBox[] {
    let base = this.signBoxEntity.value.data.filter((item) => {
      if (this.activeFilter === 'ACTIVE') return item.active === true;
      if (this.activeFilter === 'INACTIVE') return item.active === false;
      return true;
    });

    if (this.selectedGovernorateId !== null) {
      base = base.filter((x) => x.governorateId === this.selectedGovernorateId);
    }

    if (this.selectedAreaId !== null) {
      base = base.filter((x) => x.areaId === this.selectedAreaId);
    }

    const rawSearch = (this.searchParameter.searchText ?? '').trim();
    if (!rawSearch) return base;

    const search = this.normalizeDigits(rawSearch).toLowerCase();
    const byText = (v?: string | number) => (v ?? '').toString().toLowerCase().includes(search);

    return base.filter((item) => {
      const matchByCabinet = byText(item.cabinetId);
      const matchById = byText(item.id);
      const matchByName = byText(item.name);
      const matchByIp = byText(item.ipAddress);
      return matchByCabinet || matchById || matchByName || matchByIp;
    });
  }

  private normalizeDigits(input: string): string {
    const map: Record<string, string> = {
      '٠': '0',
      '١': '1',
      '٢': '2',
      '٣': '3',
      '٤': '4',
      '٥': '5',
      '٦': '6',
      '٧': '7',
      '٨': '8',
      '٩': '9',
      '۰': '0',
      '۱': '1',
      '۲': '2',
      '۳': '3',
      '۴': '4',
      '۵': '5',
      '۶': '6',
      '۷': '7',
      '۸': '8',
      '۹': '9',
    };
    return input.replace(/[٠-٩۰-۹]/g, (d) => map[d] ?? d);
  }

  // =========================
  // ✅ Active logic helpers
  // =========================
  private touchCabinet(cabinetId: number): void {
    this.lastSeen[cabinetId] = Date.now();
  }

  private isActiveByCabinetId(cabinetId: unknown): boolean {
    const id = Number(cabinetId);
    if (!Number.isFinite(id) || id <= 0) return false;

    const seen = this.lastSeen[id] ?? 0;
    return !!seen && Date.now() - seen <= SignBoxController.INACTIVITY_MS;
  }

  /**
   * ✅ Recompute actives بدون ما تعتمد على "آخر رسالة = آخر Active"
   * ده يحل مشكلة إن Active يفصل بعد 10 ثواني تلقائيًا
   */
  private recomputeActives(): void {
    const cur = this.signBoxEntity;

    if (!cur?.value?.data?.length) return;

    this.signBoxEntity = {
      ...cur,
      value: {
        ...cur.value,
        data: cur.value.data.map((x) => ({
          ...x,
          active: this.isActiveByCabinetId(x.cabinetId),
        })),
      },
    };
  }

  // ===== Popup placeholders (كما هي) =====
  showPopup(row: GetAllSignControlBox, event: MouseEvent) {}
  movePopup(event: MouseEvent) {}
  hidePopup() {}
  private updatePopupPosition(event: MouseEvent) {}

  mapCodeToClass(code?: 'R' | 'Y' | 'G') {
    return code === 'G' ? 'is-green' : code === 'Y' ? 'is-yellow' : 'is-red';
  }

  lightEmoji(code?: 'R' | 'Y' | 'G') {
    return code === 'G' ? '🟢' : code === 'Y' ? '🟡' : '🔴';
  }

  applyPattern(item: GetAllSignControlBox) {
    const payload: ApplySignBox = { id: item.id };

    this.signBoxControlService.applySignBox(payload).subscribe({
      next: () => {
        this.toaster.success(
          this.isAr ? '✅ تم تطبيق النمط بنجاح' : '✅ Pattern applied successfully'
        );
      },
      error: (err) => {
        const msg =
          this.extractBackendMessage(err) ||
          (this.isAr ? 'فشل تطبيق النمط' : 'Failed to apply pattern');
        this.toaster.error(msg);
        console.error(err);
      },
    });
  }

  onEdit(item: GetAllSignControlBox) {
    this.router.navigate(['/trafficController/edit-sign-box', item.id], {
      state: { signbox: item },
    });
  }

  onSearchEnter(): void {
    this.searchChanged$.next();
    this.loadData();
  }

  getGovernorateName(id: number | null): string {
    if (!id) return '';
    return this.governates.find((g) => g.id === id)?.name ?? '';
  }

  getAreaName(id: number | null): string {
    if (!id) return '';
    return this.areas.find((a) => a.id === id)?.name ?? '';
  }

  private loadGovernates(): void {
    this.governateService.getAll({}).subscribe({
      next: (res) => {
        this.governates = Array.isArray(res?.value) ? res.value : [];
      },
      error: (err) => {
        const msg =
          this.extractBackendMessage(err) ||
          (this.isAr ? 'فشل تحميل المحافظات' : 'Failed to load governorates');
        this.toaster.error(msg);
        console.error(err);
      },
    });
  }

  private loadAreasByGovernorate(governorateId: number): void {
    this.areaService.getAll(governorateId).subscribe({
      next: (res) => {
        this.areas = Array.isArray(res?.value) ? res.value : [];
      },
      error: (err) => {
        const msg =
          this.extractBackendMessage(err) ||
          (this.isAr ? 'فشل تحميل الأحياء' : 'Failed to load areas');
        this.toaster.error(msg);
        console.error(err);
      },
    });
  }

  onGovernorateChangeValue(id: number | null): void {
    this.selectedGovernorateId = id;
    this.selectedAreaId = null;
    if (id != null && Number.isFinite(id)) {
      this.loadAreasByGovernorate(id);
    } else {
      this.areas = [];
    }
  }

  onAreaChangeValue(id: number | null): void {
    this.selectedAreaId = id;
  }

  // ==========================
  // Backend message extractor
  // ==========================
  private extractBackendMessage(err: any): string {
    const e = err?.error ?? err;

    if (e?.errors && typeof e.errors === 'object') {
      const firstKey = Object.keys(e.errors)[0];
      const arr = e.errors[firstKey];
      const firstMsg = Array.isArray(arr) ? arr[0] : String(arr);
      return String(firstMsg || '');
    }

    if (Array.isArray(e?.errorMessages) && e.errorMessages.length) {
      return String(e.errorMessages[0] || '');
    }

    if (e?.message) return String(e.message);
    if (e?.title) return String(e.title);
    if (e?.detail) return String(e.detail);
    if (typeof e === 'string') return e;

    return '';
  }
}
