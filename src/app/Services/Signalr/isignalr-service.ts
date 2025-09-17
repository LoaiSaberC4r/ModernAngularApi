
import { Injectable, inject, signal  } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { ChatMessage, ReceiveMessage } from '../../Domain/SignalR/ChatMessage';
import { UnitAction } from '../../Domain/SignalR/UnitAction';
import { environment } from '../../Shared/environment/environment';
import { HubConnectionStatus } from '../../Domain/SignalR/HubConnectionStatus';


@Injectable({
  providedIn: 'root'
})
export class ISignalrService { 
    readonly status = signal<HubConnectionStatus>('disconnected');
  readonly lastError = signal<string | null>(null);
  readonly messages = signal<ChatMessage>({ user: '', message: {} as ReceiveMessage, at: new Date() });
  readonly unitActions = signal<UnitAction[]>([]);
    private connection?: signalR.HubConnection;
 private buildConnection(): signalR.HubConnection {
    const hubUrl = `${environment.signalrUrl}`;

    const builder = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        // accessTokenFactory: this.getAccessToken, // فعِّل لو عندك Auth
        transport: signalR.HttpTransportType.WebSockets, // الأفضل للأداء
        withCredentials: true,
      })
      .withAutomaticReconnect({
        nextRetryDelayInMilliseconds: (retryContext) => {
          // محاولات تلقائية: 0.5s, 1s, 2s, 4s, ... (حد أقصى 10s)
          const base = 500;
          const cap = 10_000;
          const attempt = retryContext.previousRetryCount;
          const delay = Math.min(base * 2 ** attempt, cap);
          return delay;
        },
      })
      .configureLogging(signalR.LogLevel.Information);

    return builder.build();
  }

  // ======= Public API =======

  async connect(): Promise<void> {
    if (this.connection && this.connection.state !== signalR.HubConnectionState.Disconnected) {
      return;
    }
    this.connection = this.buildConnection();

    // Wire client callbacks coming from server:
this.connection.on('ReceiveMessage', (user: string, payload: unknown) => {
  let parsed: ReceiveMessage;

  if (typeof payload === 'string') {
    try {
      parsed = JSON.parse(payload) as ReceiveMessage;
    } catch (e) {
      this.lastError.set('Bad JSON from hub: ' + (e as Error).message);
      return;
    }
  } else {
    parsed = payload as ReceiveMessage;
  }

  this.messages.set({ user, message: parsed, at: new Date() });
});

    this.connection.on('ReceiveUnitAction', (roomId: string, actionId: string, operatorData: string) => {
      this.unitActions.update((list) => [{ roomId, actionId, operatorData, at: new Date() }, ...list].slice(0, 200));
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

  // === Invocations matching C# Hub methods ===

  async sendMessage(user: string, message: string): Promise<void> {
    await this.ensureConnected();
    await this.connection!.invoke('SendMessage', user, message);
  }

  async sendUnitAction(roomId: string, actionId: string, operatorData: string): Promise<void> {
    await this.ensureConnected();
    await this.connection!.invoke('SendUnitAction', roomId, actionId, operatorData);
  }

  async joinGroup(groupName: string): Promise<void> {
    await this.ensureConnected();
    await this.connection!.invoke('JoinGroup', groupName);
  }

  async leaveGroup(groupName: string): Promise<void> {
    await this.ensureConnected();
    await this.connection!.invoke('LeaveGroup', groupName);
  }

  // ======= Helpers =======
  private async ensureConnected(): Promise<void> {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
      await this.connect();
    }
  
} 
}
