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
import { ActivatedRoute, Router } from '@angular/router';

import { GetAllGovernate } from '../../Domain/Entity/Governate/GetAllGovernate';
import { GetAllArea } from '../../Domain/Entity/Area/GetAllArea';
import { IAreaService } from '../../Services/Area/iarea-service';
import { IGovernateService } from '../../Services/Governate/igovernate-service';
import { OverlayModule } from '@angular/cdk/overlay';

type TrafficColorText = 'Green' | 'Yellow' | 'Red' | 'Off' | string;

@Component({
  selector: 'app-sign-box-component',
  standalone: true,
  imports: [CommonModule, FormsModule, OverlayModule, CommonModule],
  templateUrl: './sign-box-component.html',
  styleUrls: ['./sign-box-component.css'],
})
export class SignBoxComponent implements OnInit, OnDestroy {
  private static readonly INACTIVITY_MS = 10000; // 10s threshold
  private static readonly SWEEP_MS = 1000; // 1s sweep

  private readonly signalr = inject(ISignalrService);
  private readonly signBoxControlService = inject(ISignBoxControlService);
  public readonly langService = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly areaService = inject(IAreaService);
  private readonly governateService = inject(IGovernateService);

  @ViewChild('popupRef') popupRef?: ElementRef<HTMLDivElement>;

  get isAr() {
    return this.langService.current === 'ar';
  }

  readonly status = this.signalr.status;
  readonly lastError = this.signalr.lastError;
  readonly messages = this.signalr.messages;

  isDisconnected = false;
  private disconnectTimerSub?: Subscription;

  private sweepSub?: Subscription;

  /** آخر وقت استلام لكل CabinetId (ms) */
  private lastSeen: Record<number, number> = {};
  /** آخر رسالة Live لكل CabinetId */
  latestByCabinetId: Record<number, TrafficBroadcast> = {};

  searchParameter: SearchParameters = {};
  private searchChanged$ = new Subject<void>();

  hasPreviousPage = false;
  hasNextPage = false;

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
  /** آخر بث تم استخدامه داخل البوب-أب */
  popupLive: TrafficBroadcast | null = null;

  highlightCabinetId?: number;

  constructor() {
    // رسائل SignalR
    toObservable(this.signalr.messages)
      .pipe(takeUntilDestroyed())
      .subscribe(({ message }) => {
        if (!message) return; 
        console.log(message);

        const key = this.toKey((message as any).ID);
        if (key === null) return;

        this.latestByCabinetId[key] = message;
        this.lastSeen[key] = Date.now();

        // تحديث البوب-أب لو مفتوح على نفس الكابينة
        if (this.popupData?.cabinetId === key) {
          const row = this.signBoxEntity.value.data.find((x) => this.toKey(x.cabinetId) === key);
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

    // بحث
    this.searchChanged$
      .pipe(debounceTime(200), takeUntilDestroyed())
      .subscribe(() => this.loadData());
  }

  ngOnInit(): void {
    this.signalr.connect().catch(console.error);

    this.loadData();
    this.loadGovernates();

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const cabId = Number(params.get('cabinetId') || 0);
      const refreshMark = params.get('refresh');
      if (cabId || refreshMark !== null) {
        this.loadData(() => {
          if (cabId) this.highlightRow(cabId);
        });
      }
    });

    // Sweep: كل ثانية نتحقق من الخمول ونفعل إنعكاسه على البوب-أب
    this.sweepSub = timer(SignBoxComponent.SWEEP_MS, SignBoxComponent.SWEEP_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        // لو البوب-أب مفتوح وإنتهت مهلة الـ 10 ثواني، نوقف الحالة Live فيه
        if (this.popupData?.cabinetId != null) {
          const cab = this.popupData.cabinetId!;
          const seen = this.lastSeen[cab] ?? 0;
          const isLiveNow =
            this.isSignalRConnected && Date.now() - seen <= SignBoxComponent.INACTIVITY_MS;
          if (!isLiveNow && this.popupLive) {
            // اصفر البث الظاهر في البوب-أب عشان يتحول لشكل Not Live
            this.popupLive = null;
          }
        }
        // (مجرد تاتش خفيفة لضمان الـ CD حصلت)
      });
  }

  ngOnDestroy(): void {
    this.signalr.disconnect().catch(() => {});
    this.disconnectTimerSub?.unsubscribe();
    this.sweepSub?.unsubscribe();
  }

  loadData(after?: () => void): void { 
    console.log(this.searchParameter);
    this.signBoxControlService.getAll(this.searchParameter).subscribe((data) => {
      this.signBoxEntity = { ...data, value: { ...data.value, data: [...data.value.data] } };
      this.hasPreviousPage = data.value.hasPreviousPage;
      this.hasNextPage = data.value.hasNextPage;
      after?.();
    });
  }

  private loadGovernates(): void {
    this.governateService.getAll({}).subscribe((res) => {
      this.governates = Array.isArray(res?.value) ? res.value : [];
    });
  }

  private loadAreasByGovernorate(governorateId: number): void {
    this.areaService.getAll(governorateId).subscribe((res) => {
      this.areas = Array.isArray(res?.value) ? res.value : [];
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

  /** نشِط بناءً على آخر استقبال خلال 10 ثواني */
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
        error: () => {},
      });
    }
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

  /** نشِط للصف */
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

  /** متصل فعليًا (SignalR) */
  get isSignalRConnected(): boolean {
    const s =
      typeof this.signalr.status === 'function'
        ? (this.signalr.status() as any)
        : (this.signalr.status as any);
    return s === 'connected';
  }

  /** حالة الـ Live الظاهرة في البوب-أب (مرتبطة بآخر استقبال خلال 10 ثواني + الاتصال) */
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

  severityLabelAr: Record<'CRITICAL' | 'WARN' | 'INFO', string> = {
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
  > = {
    15478: [
      {
        component: 'Controller',
        severity: 'CRITICAL',
        message: 'Controller offline – no heartbeat in 5m',
        messageAr: 'وحدة التحكم غير متصلة — لا نبض خلال 5 دقائق',
        lastUpdate: '2025-10-16 11:48',
      },
      {
        component: 'Power',
        severity: 'WARN',
        message: 'Battery voltage low (11.3V)',
        messageAr: 'جهد البطارية منخفض (11.3V)',
        lastUpdate: '2025-10-16 11:46',
      },
      {
        component: 'Loop-Sensor L2',
        severity: 'INFO',
        message: 'High occupancy detected',
        messageAr: 'ارتفاع الإشغال على الحلقة الثانية',
        lastUpdate: '2025-10-16 11:45',
      },
    ],
    10001: [],
    10002: [
      {
        component: 'Pedestrian',
        severity: 'WARN',
        message: 'Push button stuck (north crossing)',
        messageAr: 'زر المشاة عالق (المعبر الشمالي)',
        lastUpdate: '2025-10-16 10:12',
      },
    ],
  };

  getStatus(item: any) {
    return this.statusMap[item.cabinetId] ?? [];
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
