import { Injectable, signal } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../Shared/environment/environment';

import { HubConnectionStatus } from '../../Domain/SignalR/HubConnectionStatus';
import { ChatMessage } from '../../Domain/SignalR/ChatMessage';
import { TrafficBroadcast } from '../../Domain/SignalR/TrafficBroadcast';

@Injectable({ providedIn: 'root' })
export class ISignalrService {
  readonly status = signal<HubConnectionStatus>('disconnected');
  readonly lastError = signal<string | null>(null);

  readonly messages = signal<ChatMessage<TrafficBroadcast>>({
    user: '',
    message: {} as TrafficBroadcast,
    at: new Date(),
  });

  private connection?: signalR.HubConnection;

  private buildConnection(): signalR.HubConnection {
    const hubUrl = `${environment.signalrUrl}`;
    return new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        transport: signalR.HttpTransportType.WebSockets,
        withCredentials: true,
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (ctx) => {
          const base = 500,
            cap = 10_000,
            attempt = ctx.previousRetryCount;
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

    this.connection.on('ReceiveMessage', (user: string, payload: unknown) => {
      let parsed: TrafficBroadcast;
      if (typeof payload === 'string') {
        try {
          parsed = JSON.parse(payload) as TrafficBroadcast;
        } catch (e) {
          this.lastError.set('Bad JSON from hub: ' + (e as Error).message);
          return;
        }
      } else {
        parsed = payload as TrafficBroadcast;
      }
      this.messages.set({ user, message: parsed, at: new Date() });
    });

    this.connection.onreconnecting((err) => {
      this.status.set('reconnecting');
      this.lastError.set(err?.message ?? null);
    });
    this.connection.onreconnected(() => {
      this.status.set('connected');
      this.lastError.set(null);
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
      await this.connection.stop();
    } finally {
      this.status.set('disconnected');
    }
  }

  // باقي الاستدعاءات كما هي...
  private async ensureConnected(): Promise<void> {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
      await this.connect();
    }
  }
}
