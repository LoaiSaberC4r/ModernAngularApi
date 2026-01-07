import { Injectable, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../Shared/environment/environment';

import { HubConnectionStatus } from '../../Domain/SignalR/HubConnectionStatus';
import { CabinetStatusMessage } from '../../Domain/SignalR/cabinet-status-message';

@Injectable({ providedIn: 'root' })
export class CabinetSignalrService {
  readonly status = signal<HubConnectionStatus>('disconnected');
  readonly lastError = signal<string | null>(null);

  readonly cabinetStatus = signal<CabinetStatusMessage | null>(null);

  private connection?: signalR.HubConnection;

  private joinedCabinetId: number | null = null;

  private buildConnection(): signalR.HubConnection {
    return new signalR.HubConnectionBuilder()
      .withUrl(environment.signalrHub, {
        transport: signalR.HttpTransportType.WebSockets,
        withCredentials: false,
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (ctx) => {
          const base = 500;
          const cap = 10_000;
          return Math.min(base * 2 ** ctx.previousRetryCount, cap);
        },
      })
      .configureLogging(signalR.LogLevel.Information)
      .build();
  }

  async connect(): Promise<void> {
    if (this.connection && this.connection.state !== signalR.HubConnectionState.Disconnected)
      return;

    this.connection = this.buildConnection();

    this.connection.on('cabinetStatus', (msg: CabinetStatusMessage) => {
      this.cabinetStatus.set(msg);
    });

    this.connection.onreconnecting((err) => {
      this.status.set('reconnecting');
      this.lastError.set(err?.message ?? null);
    });

    this.connection.onreconnected(async () => {
      this.status.set('connected');
      this.lastError.set(null);

      // re-join last cabinet after reconnect
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
        } catch {}
      }
      await this.connection.stop();
    } finally {
      this.status.set('disconnected');
      this.joinedCabinetId = null;
      this.cabinetStatus.set(null);
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
}
