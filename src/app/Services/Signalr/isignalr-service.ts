import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { environment } from '../../Shared/environment/environment';
import { HubConnectionStatus } from '../../Domain/SignalR/HubConnectionStatus';
import { ChatMessage } from '../../Domain/SignalR/ChatMessage';
import { TrafficBroadcast } from '../../Domain/SignalR/TrafficBroadcast';

type IncomingPayload = unknown;

@Injectable({ providedIn: 'root' })
export class ISignalrService {
  private static readonly INACTIVITY_MS = 10_000; // ✅ مصدر واحد للحقيقة

  private readonly destroyRef = inject(DestroyRef);

  readonly status = signal<HubConnectionStatus>('disconnected');
  readonly lastError = signal<string | null>(null);

  readonly cabinetPing = signal<ChatMessage<number> | null>(null);
  readonly trafficBroadcast = signal<ChatMessage<TrafficBroadcast> | null>(null);

  // ✅ Presence store inside the service
  private readonly _lastSeen = signal<Record<number, number>>({});
  private readonly _now = signal<number>(Date.now());

  // ✅ Expose as readonly computed (for debugging / UI if needed)
  readonly lastSeen = computed(() => this._lastSeen());

  // ✅ This is the “source” for active status
  isCabinetActive(cabinetId: unknown): boolean {
    const id = Number(cabinetId);
    if (!Number.isFinite(id) || id <= 0) return false;

    const seen = this._lastSeen()[id] ?? 0;
    return !!seen && this._now() - seen <= ISignalrService.INACTIVITY_MS;
  }

  private connection?: signalR.HubConnection;
  private joinedCabinetId: number | null = null;

  constructor() {
    // ✅ tick every 1s so computed activity updates automatically
    interval(1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this._now.set(Date.now()));
  }

  private buildConnection(): signalR.HubConnection {
    const hubUrl = `${environment.signalrUrl}`;

    return new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        transport: signalR.HttpTransportType.WebSockets,
        withCredentials: false,
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (ctx) => {
          const base = 500;
          const cap = 10_000;
          const attempt = ctx.previousRetryCount;
          return Math.min(base * 2 ** attempt, cap);
        },
      })
      .configureLogging(signalR.LogLevel.Information)
      .build();
  }

  async connect(): Promise<void> {
    if (this.connection && this.connection.state !== signalR.HubConnectionState.Disconnected)
      return;

    this.connection = this.buildConnection();

    this.connection.on('ReceiveMessage', (user: string, payload: IncomingPayload) => {
      const parsed = this.parsePayload(payload);
      if (!parsed) return;

      if (parsed.kind === 'cabinetId') {
        const msg: ChatMessage<number> = { user, message: parsed.value, at: new Date() };
        this.cabinetPing.set(msg);
        this.touchCabinet(parsed.value);
        return;
      }

      // Broadcast
      const broadcastMsg: ChatMessage<TrafficBroadcast> = {
        user,
        message: parsed.value,
        at: new Date(),
      };
      this.trafficBroadcast.set(broadcastMsg);

      // اعتبرها activity للكابينة
      const id = Number(parsed.value.ID);
      if (Number.isFinite(id) && id > 0) {
        this.touchCabinet(id);
        this.cabinetPing.set({ user, message: id, at: new Date() });
      }
    });

    this.connection.onreconnecting((err) => {
      this.status.set('reconnecting');
      this.lastError.set(err?.message ?? null);
    });

    this.connection.onreconnected(async () => {
      this.status.set('connected');
      this.lastError.set(null);

      if (this.joinedCabinetId != null) {
        try {
          await this.joinCabinet(this.joinedCabinetId);
        } catch {
          // ignore
        }
      }
    });

    this.connection.onclose((err) => {
      this.status.set('disconnected');
      if (err) this.lastError.set(err.message);
    });

    this.status.set('connecting');
    try {
      await this.connection.start();
      this.status.set('connected');
      this.lastError.set(null);
    } catch (e: unknown) {
      this.status.set('disconnected');
      this.lastError.set((e as Error)?.message ?? 'Failed to connect');
      throw e;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.connection) return;

    try {
      if (this.joinedCabinetId != null) {
        try {
          await this.leaveCabinet(this.joinedCabinetId);
        } catch {
          // ignore
        }
      }

      await this.connection.stop();
    } finally {
      this.status.set('disconnected');
      this.joinedCabinetId = null;
    }
  }

  private async ensureConnected(): Promise<void> {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
      await this.connect();
    }
  }

  async joinCabinet(cabinetId: number): Promise<void> {
    const id = Number(cabinetId);
    if (!Number.isFinite(id) || id <= 0) return;

    await this.ensureConnected();
    if (!this.connection) return;

    if (this.joinedCabinetId === id) return;

    if (this.joinedCabinetId != null && this.joinedCabinetId !== id) {
      await this.leaveCabinet(this.joinedCabinetId);
    }

    await this.connection.invoke('JoinCabinet', id);
    this.joinedCabinetId = id;
  }

  async leaveCabinet(cabinetId: number): Promise<void> {
    const id = Number(cabinetId);
    if (!Number.isFinite(id) || id <= 0) return;

    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
      if (this.joinedCabinetId === id) this.joinedCabinetId = null;
      return;
    }

    if (this.joinedCabinetId !== id) return;

    await this.connection.invoke('LeaveCabinet', id);
    this.joinedCabinetId = null;
  }

  get currentJoinedCabinetId(): number | null {
    return this.joinedCabinetId;
  }

  // ===============================
  // ✅ Presence helper
  // ===============================
  private touchCabinet(id: number): void {
    const cur = this._lastSeen();
    this._lastSeen.set({ ...cur, [id]: Date.now() });
  }

  // ===============================
  // Parsing Helpers (critical part)
  // ===============================
  private parsePayload(
    payload: IncomingPayload
  ): { kind: 'cabinetId'; value: number } | { kind: 'broadcast'; value: TrafficBroadcast } | null {
    const raw = this.tryJson(payload);

    if (typeof raw === 'number') {
      const id = Number(raw);
      if (Number.isFinite(id) && id > 0) return { kind: 'cabinetId', value: id };
      return null;
    }

    if (typeof raw === 'string') {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) return { kind: 'cabinetId', value: n };
      return null;
    }

    if (raw && typeof raw === 'object') {
      const maybeId = Number((raw as any).ID ?? (raw as any).id);
      if (!Number.isFinite(maybeId) || maybeId <= 0) return null;

      const normalized: TrafficBroadcast = { ...(raw as any), ID: maybeId } as TrafficBroadcast;
      return { kind: 'broadcast', value: normalized };
    }

    return null;
  }

  private tryJson(input: unknown): unknown {
    if (typeof input !== 'string') return input;
    const s = input.trim();
    if (!s) return input;

    if (
      (s.startsWith('{') && s.endsWith('}')) ||
      (s.startsWith('[') && s.endsWith(']')) ||
      /^-?\d+(\.\d+)?$/.test(s)
    ) {
      try {
        return JSON.parse(s);
      } catch (e) {
        this.lastError.set('Bad JSON from hub: ' + (e as Error).message);
        return null;
      }
    }

    return s;
  }
}
