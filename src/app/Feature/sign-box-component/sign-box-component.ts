import {
  Component,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  ViewChild,
  DestroyRef,
} from '@angular/core';
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
import { SignalRStatusDto } from '../../Domain/SignalR/SignalRStatusDto';
import { ActivatedRoute, Router } from '@angular/router';

import { GetAllGovernate } from '../../Domain/Entity/Governate/GetAllGovernate';
import { GetAllArea } from '../../Domain/Entity/Area/GetAllArea';
import { IAreaService } from '../../Services/Area/iarea-service';
import { IGovernateService } from '../../Services/Governate/igovernate-service';
import { OverlayModule } from '@angular/cdk/overlay';
import { ToasterService } from '../../Services/Toster/toaster-service';
import { CabinetSignalrService } from '../../Services/Signalr/cabinet-signalr.service';

type TrafficColorText = 'Green' | 'Yellow' | 'Red' | 'Off' | string;

@Component({
  selector: 'app-sign-box-component',
  standalone: true,
  imports: [CommonModule, FormsModule, OverlayModule],
  templateUrl: './sign-box-component.html',
  styleUrls: ['./sign-box-component.css'],
})
export class SignBoxComponent implements OnInit, OnDestroy {
  private static readonly INACTIVITY_MS = 10000;
  private static readonly SWEEP_MS = 1000;

  private readonly signalr = inject(ISignalrService);
  private readonly signBoxControlService = inject(ISignBoxControlService);
  public readonly langService = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly cabinetSignalr = inject(CabinetSignalrService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly areaService = inject(IAreaService);
  private readonly governateService = inject(IGovernateService);

  private readonly toaster = inject(ToasterService);

  // ===== Hover Join/Leave =====
  private popupHoverTimer?: ReturnType<typeof setTimeout>;
  private hoveredCabinetId: number | null = null;

  @ViewChild('popupRef') popupRef?: ElementRef<HTMLDivElement>;

  get isAr() {
    return this.langService.current === 'ar';
  }

  // ===== SignalR state =====
  readonly status = this.signalr.status;
  readonly lastError = this.signalr.lastError;

  private disconnectTimerSub?: Subscription;
  private sweepSub?: Subscription;

  // Activity + cache
  /* lastSeen: آخر وقت وصل فيه أي event للكابينة */
  private lastSeen: Record<number, number> = {};
  /* gpsStatus: حالة الـ GPS القادمة من SignalR */
  private gpsStatus: Record<number, boolean> = {};
  latestByCabinetId: Record<number, TrafficBroadcast> = {};

  // Search
  searchParameter: SearchParameters = {};
  private searchChanged$ = new Subject<void>();

  hasPreviousPage = false;
  hasNextPage = false;

  // Filters
  selectedGovernorateId: number | null = null;
  selectedAreaId: number | null = null;

  governates: GetAllGovernate[] = [];
  areas: GetAllArea[] = [];

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

  highlightCabinetId?: number;

  constructor() {
    /**
     * ✅ 1) أي Activity (Ping أو Broadcast) => lastSeen[cabinetId] = now
     * cabinetPing بيرجع ChatMessage<number> | null
     */
    toObservable(this.signalr.cabinetPing)
      .pipe(takeUntilDestroyed())
      .subscribe((msg) => {
        if (!msg?.message) return;
        const val = msg.message;
        const id = val.id;

        if (id && id > 0) {
          this.lastSeen[id] = Date.now();
          this.gpsStatus[id] = val.isGps;
        }
      });

    /**
     * ✅ 2) Broadcast كامل => خزّنه + lastSeen + حدّث Popup لو مفتوح
     * trafficBroadcast بيرجع ChatMessage<TrafficBroadcast> | null
     */
    toObservable(this.signalr.trafficBroadcast)
      .pipe(takeUntilDestroyed())
      .subscribe((msg) => {
        if (!msg?.message) return;

        const key = this.toKey((msg.message as any).ID);
        if (key === null) return;

        this.latestByCabinetId[key] = msg.message;
        this.lastSeen[key] = Date.now();

        if (this.popupData?.cabinetId === key) {
          const row = this.signBoxEntity.value.data.find((x) => this.toKey(x.cabinetId) === key);
          if (row) this.popupData = this.toPopup(row, msg.message);
          this.popupLive = msg.message;
        }
      });

    toObservable(this.cabinetSignalr.cabinetStatus)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg) => {
        if (!msg) return;
        console.log(msg.id);
        console.log(msg.l1);
        console.log(msg.t1);
        console.log(msg.l2);
        console.log(msg.t2);
        console.log(msg.l3);
        console.log(msg.t3);
        console.log(msg.l4);
        console.log(msg.t4);
        const key = this.toKey(msg.id);
        if (key === null) return;

        const asBroadcast: TrafficBroadcast = {
          ID: msg.id,
          L1: msg.l1,
          T1: msg.t1,
          L2: msg.l2,
          T2: msg.t2,
          L3: msg.l3,
          T3: msg.t3,
          L4: msg.l4,
          T4: msg.t4,
        } as TrafficBroadcast;

        this.latestByCabinetId[key] = asBroadcast;
        this.lastSeen[key] = Date.now();

        if (this.popupData?.cabinetId === key) {
          const row = this.signBoxEntity.value.data.find((x) => this.toKey(x.cabinetId) === key);
          if (row) this.popupData = this.toPopup(row, asBroadcast);
          this.popupLive = asBroadcast;
        }
      });

    this.searchChanged$
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe(() => this.loadData());
  }

  ngOnInit(): void {
    this.signalr.connect().catch((err) => {
      const msg =
        this.getBackendMessage(err) ??
        (this.isAr ? 'تعذر الاتصال بـ SignalR' : 'Failed to connect to SignalR');
      this.toaster.error(msg);
      console.error(err);
    });

    this.loadData();
    this.loadGovernates();

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const cabId = Number(params.get('cabinetId') || 0);
      const refreshMark = params.get('refresh');
      if (cabId || refreshMark !== null) {
        this.loadData(() => {
          if (cabId) this.highlightRow(cabId);
        });
      }
    });

    this.sweepSub = timer(SignBoxComponent.SWEEP_MS, SignBoxComponent.SWEEP_MS)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.popupData?.cabinetId != null) {
          const cab = this.popupData.cabinetId!;
          const seen = this.lastSeen[cab] ?? 0;
          const isLiveNow =
            this.isSignalRConnected && Date.now() - seen <= SignBoxComponent.INACTIVITY_MS;

          if (!isLiveNow && this.popupLive) {
            this.popupLive = null;
          }
        }
      });
  }

  ngOnDestroy(): void {
    // cancel hover join timer + leave joined group (best effort)
    this.cancelHoverJoin();

    const joined = this.signalr.currentJoinedCabinetId ?? null;
    if (joined != null) {
      this.signalr.leaveCabinet(joined).catch(() => {});
    }

    this.signalr.disconnect().catch(() => {});
    this.disconnectTimerSub?.unsubscribe();
    this.sweepSub?.unsubscribe();
  }

  loadData(after?: () => void): void {
    this.signBoxControlService.getAll(this.searchParameter).subscribe({
      next: (data) => {
        if ((data as any)?.isFailure && !(data as any)?.isSuccess) {
          const msg =
            this.getBackendMessage(data) ??
            (this.isAr ? 'فشل تحميل البيانات' : 'Failed to load data');
          this.toaster.error(msg);
          return;
        }

        this.signBoxEntity = { ...data, value: { ...data.value, data: [...data.value.data] } };
        this.hasPreviousPage = data.value.hasPreviousPage;
        this.hasNextPage = data.value.hasNextPage;
        after?.();
      },
      error: (err) => {
        const msg =
          this.getBackendMessage(err) ??
          (this.isAr ? 'حدث خطأ أثناء تحميل البيانات' : 'An error occurred while loading data');
        this.toaster.error(msg);
        console.error(err);
      },
    });
  }

  private loadGovernates(): void {
    this.governateService.getAll({}).subscribe({
      next: (res) => {
        if ((res as any)?.isFailure && !(res as any)?.isSuccess) {
          const msg =
            this.getBackendMessage(res) ??
            (this.isAr ? 'فشل تحميل المحافظات' : 'Failed to load governorates');
          this.toaster.error(msg);
          return;
        }

        this.governates = Array.isArray(res?.value) ? res.value : [];
      },
      error: (err) => {
        const msg =
          this.getBackendMessage(err) ??
          (this.isAr
            ? 'حدث خطأ أثناء تحميل المحافظات'
            : 'An error occurred while loading governorates');
        this.toaster.error(msg);
        console.error(err);
      },
    });
  }

  private loadAreasByGovernorate(governorateId: number): void {
    this.areaService.getAll(governorateId).subscribe({
      next: (res) => {
        if ((res as any)?.isFailure && !(res as any)?.isSuccess) {
          const msg =
            this.getBackendMessage(res) ??
            (this.isAr ? 'فشل تحميل الأحياء' : 'Failed to load areas');
          this.toaster.error(msg);
          return;
        }

        this.areas = Array.isArray(res?.value) ? res.value : [];
      },
      error: (err) => {
        const msg =
          this.getBackendMessage(err) ??
          (this.isAr ? 'حدث خطأ أثناء تحميل الأحياء' : 'An error occurred while loading areas');
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

  onSearchEnter(): void {
    this.searchChanged$.next();
    this.loadData();
  }

  setActiveFilter(filter: 'ALL' | 'ACTIVE' | 'INACTIVE') {
    this.activeFilter = filter;
    this.showActiveFilter = false;
  }

  trackById = (_: number, item: GetAllSignControlBox) => item?.id;

  private isActiveByCabinetId(cabinetId: unknown): boolean {
    const k = this.toKey(cabinetId);
    if (k === null) return false;
    const seen = this.lastSeen[k] ?? 0;
    return !!seen && Date.now() - seen <= SignBoxComponent.INACTIVITY_MS;
  }

  get filteredData(): GetAllSignControlBox[] {
    const q = (this.searchParameter.searchText ?? '').trim().toLowerCase();

    const byActivity = (item: GetAllSignControlBox) => {
      const active = this.isActiveByCabinetId(item.cabinetId);
      if (this.activeFilter === 'ACTIVE') return active;
      if (this.activeFilter === 'INACTIVE') return !active;
      return true;
    };

    let base = this.signBoxEntity.value.data.filter(byActivity);

    if (this.selectedGovernorateId !== null) {
      base = base.filter((x) => x.governorateId === this.selectedGovernorateId);
    }

    if (this.selectedAreaId !== null) {
      base = base.filter((x) => x.areaId === this.selectedAreaId);
    }

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

    const cached = this.dirNamesCache[row.id];

    const rowDirs = this.normalizeDirectionsArray(row);
    const missingNames =
      rowDirs.length === 0 ||
      rowDirs.every(
        (d) => !d.name || !d.name.trim() || /^اتجاه\s+\d+|^Direction\s+\d+/.test(d.name)
      );

    if (cached && cached.length) {
      const hydrated = {
        ...row,
        directions: cached.map((d) => ({ order: d.order, name: d.name })),
      } as any;
      this.popupData = this.toPopup(hydrated, live ?? undefined);
    } else {
      this.popupData = this.toPopup(row, live ?? undefined);
    }

    this.popupLive = live;
    this.popupVisible = true;
    this.updatePopupPosition(event);

    // ===== Hover Join/Leave Logic (200ms) =====
    this.cancelHoverJoin();
    this.hoveredCabinetId = this.popupData?.cabinetId ?? null;

    if (this.hoveredCabinetId != null) {
      this.popupHoverTimer = setTimeout(async () => {
        if (!this.popupVisible) return;
        if (this.popupData?.cabinetId !== this.hoveredCabinetId) return;

        try {
          console.log(this.hoveredCabinetId + 'join');
          await this.cabinetSignalr.joinCabinet(this.hoveredCabinetId);
          console.log(this.hoveredCabinetId);
        } catch (err) {
          const msg =
            this.getBackendMessage(err) ??
            (this.isAr ? 'تعذر الانضمام إلى مجموعة الكابينة' : 'Failed to join cabinet group');
          this.toaster.error(msg);
          console.error(err);
        }
      }, 200);
    }

    if (!cached && missingNames) {
      this.signBoxControlService.getById(row.id).subscribe({
        next: (full) => {
          const dirs = this.normalizeDirectionsArray(full);
          if (dirs.length) {
            this.dirNamesCache[row.id] = dirs.map((d) => ({ order: d.order, name: d.name }));
            const hydrated = { ...row, directions: dirs } as any;

            if (this.popupVisible && this.popupData?.Id === row.id) {
              this.popupData = this.toPopup(hydrated, live ?? undefined);
            }
          }
        },
        error: (err) => {
          const msg =
            this.getBackendMessage(err) ??
            (this.isAr ? 'تعذر تحميل تفاصيل الاتجاهات' : 'Failed to load directions details');
          this.toaster.error(msg);
          console.error(err);
        },
      });
    }
  }

  movePopup(event: MouseEvent) {
    if (this.popupVisible) this.updatePopupPosition(event);
  }

  hidePopup() {
    const cab = this.popupData?.cabinetId ?? null;

    this.popupVisible = false;
    this.popupData = null;
    this.popupLive = null;

    this.cancelHoverJoin();
    this.hoveredCabinetId = null;

    if (cab != null) {
      this.cabinetSignalr.leaveCabinet(cab).catch(() => {});
    }
  }

  private cancelHoverJoin(): void {
    if (this.popupHoverTimer) {
      clearTimeout(this.popupHoverTimer);
      this.popupHoverTimer = undefined;
    }
  }

  private updatePopupPosition(event: MouseEvent) {
    const offset = 10;
    const x = event.clientX + offset;
    const y = event.clientY + offset;

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

      if (preferLeft || rightOverflow) nx = event.clientX - rect.width - offset;
      if (nx < offset) nx = offset;
      if (nx + rect.width > window.innerWidth - offset) {
        nx = window.innerWidth - rect.width - offset;
      }

      if (bottomOverflow) ny = event.clientY - rect.height - offset;
      if (ny < offset) ny = offset;
      if (ny + rect.height > window.innerHeight - offset) {
        ny = window.innerHeight - rect.height - offset;
      }

      this.popupX = nx;
      this.popupY = ny;
    });
  }

  // ===== Helpers =====
  toKey(n: unknown): number | null {
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

  private toPopup(
    row: GetAllSignControlBox,
    live?: TrafficBroadcast
  ): PopUpSignBox & { cabinetId?: number } {
    const directions: PopUpDirection[] = (row.directions ?? []).slice(0, 4).map((d: any, idx) => {
      const ln = `L${idx + 1}` as keyof TrafficBroadcast;
      const tn = `T${idx + 1}` as keyof TrafficBroadcast;

      const lightCode = live ? this.normalizeColor((live as any)[ln]) : undefined;
      const time = live ? Number((live as any)[tn] ?? 0) : 0;

      const rawName = (d?.name ?? d?.Name ?? d?.directionName ?? '').toString().trim();
      const name = rawName || (this.isAr ? `اتجاه ${idx + 1}` : `Direction ${idx + 1}`);

      return { name, lightCode, time } as PopUpDirection;
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

  isActive(item: GetAllSignControlBox): boolean {
    return this.isActiveByCabinetId(item.cabinetId);
  }

  onEdit(item: GetAllSignControlBox) {
    this.router.navigate(['/trafficController/edit-sign-box', item.id], {
      state: { signbox: item },
    });
  }

  private highlightRow(cabinetId: number) {
    this.highlightCabinetId = cabinetId;

    setTimeout(() => {
      const el = document.getElementById(`row-cab-${cabinetId}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 0);

    setTimeout(() => (this.highlightCabinetId = undefined), 3000);
  }

  getGovernorateName(id: number | null): string {
    if (!id) return '';
    return this.governates.find((g) => g.id === id)?.name ?? '';
  }

  getAreaName(id: number | null): string {
    if (!id) return '';
    return this.areas.find((a) => a.id === id)?.name ?? '';
  }

  /** (SignalR) */
  get isSignalRConnected(): boolean {
    const s =
      typeof this.signalr.status === 'function'
        ? (this.signalr.status() as any)
        : (this.signalr.status as any);
    return s === 'connected';
  }

  get isDisconnected(): boolean {
    return !this.isSignalRConnected;
  }

  /** حالة الـ Live الظاهرة في البوب-أب */
  get popupIsLive(): boolean {
    const cab = this.popupData?.cabinetId;
    if (!cab) return false;
    const seen = this.lastSeen[cab] ?? 0;
    return this.isSignalRConnected && Date.now() - seen <= SignBoxComponent.INACTIVITY_MS;
  }

  private dirNamesCache: Record<number, Array<{ order: number; name: string }>> = {};

  private extractDirectionName(d: any, fallbackIndex: number): { order: number; name: string } {
    const orderRaw = d?.order ?? d?.Order ?? fallbackIndex + 1;
    const order = Number(orderRaw ?? fallbackIndex + 1);

    const rawName = (
      d?.name ??
      d?.Name ??
      d?.directionName ??
      d?.DirectionName ??
      d?.title ??
      d?.Title ??
      ''
    )
      .toString()
      .trim();

    const name =
      rawName ||
      (this.isAr
        ? `اتجاه ${order || fallbackIndex + 1}`
        : `Direction ${order || fallbackIndex + 1}`);
    return { order, name };
  }

  private normalizeDirectionsArray(
    src: any
  ): Array<{ order: number; name: string; templateId?: number | null }> {
    const raw = src?.directions ?? src?.Directions ?? [];
    if (!Array.isArray(raw)) return [];
    const list = raw.map((d: any, i: number) => {
      const { order, name } = this.extractDirectionName(d, i);
      const templateId = Number(d?.templateId ?? d?.TemplateId ?? 0) || null;
      return { order, name, templateId };
    });
    return list.sort((a, b) => (a.order || 0) - (b.order || 0));
  }

  private getBackendMessage(source: any): string | null {
    if (!source) return null;

    if (typeof source === 'string') {
      const msg = source.trim();
      return msg || null;
    }

    if (source.error) {
      const err = source.error;

      if (typeof err === 'string' && err.trim()) return err.trim();

      const em = err.message || err.Message || err.title || err.Title;
      if (typeof em === 'string' && em.trim()) return em.trim();

      if (err.errors && typeof err.errors === 'object') {
        const firstKey = Object.keys(err.errors)[0];
        const firstVal = firstKey ? err.errors[firstKey]?.[0] : null;
        if (typeof firstVal === 'string' && firstVal.trim()) return firstVal.trim();
      }

      if (Array.isArray(err.errorMessages) && err.errorMessages.length) {
        const first = String(err.errorMessages[0] ?? '').trim();
        if (first) return first;
      }
    }

    const direct =
      source.message ||
      source.Message ||
      source.title ||
      source.Title ||
      (source.error?.message ?? null);

    if (typeof direct === 'string' && direct.trim()) return direct.trim();

    if (source.error && typeof source.error === 'object') {
      const er = source.error as ResultError;
      const m1 = (er as any)?.message || (er as any)?.Message;
      if (typeof m1 === 'string' && m1.trim()) return m1.trim();
    }

    return null;
  }

  severityLabelAr: Record<string, string> = {
    CRITICAL: 'حرج',
    WARN: 'تحذير',
    INFO: 'معلومة',
  };

  expandedId: number | null = null;
  toggleExpand(item: any) {
    this.expandedId = this.expandedId === item.cabinetId ? null : item.cabinetId;
  }
  isExpanded(item: any) {
    return this.expandedId === item.cabinetId;
  }

  statusMap: Record<
    number,
    Array<{
      component: string;
      severity: 'CRITICAL' | 'WARN' | 'INFO';
      message: string;
      messageAr: string;
      lastUpdate: string;
    }>
  > = {};

  getStatus(item: any) {
    const list = this.statusMap[item.cabinetId] ?? [];

    // Inject GPS Status if available
    const gps = this.gpsStatus[item.cabinetId];

    if (gps === true) {
      return [
        ...list,
        {
          component: 'GPS',
          severity: 'INFO',
          message: 'GPS Failer',
          messageAr: 'GPS متوقف',
          lastUpdate: 'Now',
        },
      ];
    } else if (gps === false) {
      return [
        ...list,
        {
          component: 'GPS',
          severity: 'WARN',
          message: '',
          messageAr: '',
          lastUpdate: 'Now',
        },
      ];
    }

    return list;
  }

  statusSummary(item: any) {
    const arr = this.getStatus(item);
    const critical = arr.filter((s) => s.severity === 'CRITICAL').length;
    const warn = arr.filter((s) => s.severity === 'WARN').length;
    const info = arr.filter((s) => s.severity === 'INFO').length;
    return { critical, warn, info, total: arr.length };
  }

  rowSeverity(item: any): 'CRITICAL' | 'WARN' | 'INFO' | 'OK' {
    const s = this.statusSummary(item);
    if (s.critical > 0) return 'CRITICAL';
    if (s.warn > 0) return 'WARN';
    if (s.info > 0) return 'INFO';
    return 'OK';
  }

  rowSeverityLabelAr(sev: 'CRITICAL' | 'WARN' | 'INFO' | 'OK'): string {
    switch (sev) {
      case 'CRITICAL':
        return 'حرج';
      case 'WARN':
        return 'تحذير';
      case 'INFO':
        return 'معلومة';
      default:
        return 'سليم';
    }
  }

  statusBadgeTitle(item: any): string {
    const s = this.statusSummary(item);
    if (s.total === 0) return this.isAr ? 'لا مشاكل' : 'No issues';
    return this.isAr
      ? `حرج: ${s.critical} • تحذير: ${s.warn} • معلومة: ${s.info}`
      : `Critical: ${s.critical} • Warning: ${s.warn} • Info: ${s.info}`;
  }
}
