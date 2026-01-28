import { Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';
import { ToastComponent } from '../../Feature/TosterComponent/toast-component/toast-component';
import { ToastOptions, ToastPayload } from '../../Domain/ResultPattern/ToastType';
import { Subject, concatMap, of, timer } from 'rxjs';
import { catchError, mapTo, switchMap, take } from 'rxjs/operators';

interface BackendErrorResponse {
  messages: string[];
  fieldMap: Record<string, string[]>;
  isSuccess: boolean;
}

@Injectable({ providedIn: 'root' })
export class ToasterService {
  private readonly defaultDuration = 5000;

  private readonly queue$ = new Subject<ToastPayload>();

  constructor(private snack: MatSnackBar) {
    this.queue$
      .pipe(
        concatMap((payload) => {
          const duration = payload.options?.durationMs ?? this.defaultDuration;

          const cfg: MatSnackBarConfig = {
            duration,
            horizontalPosition: 'right',
            verticalPosition: 'top',
            panelClass: ['toast-shell'],
            data: payload,
          };

          const ref = this.snack.openFromComponent(ToastComponent, cfg);

          return ref.afterDismissed().pipe(
            take(1),
            switchMap(() => timer(120).pipe(mapTo(void 0))),
            catchError(() => of(void 0)),
          );
        }),
      )
      .subscribe();
  }

  success(message: string, options: ToastOptions = {}): void {
    this.enqueue({ message, type: 'success', options });
  }

  warning(message: string, options: ToastOptions = {}): void {
    this.enqueue({ message, type: 'warning', options });
  }

  error(message: string, options: ToastOptions = {}): void {
    this.enqueue({ message, type: 'error', options });
  }

  errorMany(messages: string[], options: ToastOptions = {}): void {
    (messages ?? [])
      .map((m) => String(m).trim())
      .filter(Boolean)
      .forEach((m) => this.enqueue({ message: m, type: 'error', options }));
  }

  warningMany(messages: string[], options: ToastOptions = {}): void {
    (messages ?? [])
      .map((m) => String(m).trim())
      .filter(Boolean)
      .forEach((m) => this.enqueue({ message: m, type: 'warning', options }));
  }

  private enqueue(payload: ToastPayload): void {
    console.log('🍞 Enqueueing Toast:', payload);
    this.queue$.next(payload);
  }

  errorFromBackend(err: any, options: ToastOptions = {}): void {
    const { messages } = this.extractMessages(err);
    if (messages.length > 0) {
      this.errorMany(messages, options);
    } else {
      this.error('Unknown error occurred', options);
    }
  }

  successFromBackend(resp: any, options: ToastOptions = {}): void {
    const { messages, isSuccess } = this.extractMessages(resp);
    const likelySuccess = isSuccess || resp === null || resp === undefined || resp === true;

    if (messages.length > 0) {
      messages.forEach((m) => this.success(m, options));
    } else if (likelySuccess && options.fallback) {
      this.success(options.fallback, options);
    }
  }

  extractMessages(data: any): BackendErrorResponse {
    const messages: string[] = [];
    const fieldMap: Record<string, string[]> = {};
    let isSuccess = false;

    const e = data?.error ?? data;

    console.log('🔍 Toaster: Extracting Backend Messages from:', { data, e });

    const targets = [data, e];

    if (data === true || data === 'OK' || data === 'Success') isSuccess = true;

    targets.forEach((obj) => {
      if (obj && typeof obj === 'object') {
        if ('isSuccess' in obj) isSuccess = !!obj.isSuccess;
        else if ('Success' in obj) isSuccess = !!obj.Success;
        else if ('success' in obj) isSuccess = !!obj.success;
        if (obj.status >= 200 && obj.status < 300) isSuccess = true;
      }
    });

    targets.forEach((obj) => {
      if (obj && typeof obj === 'object') {
        const m = obj.message || obj.description || obj.detail || obj.Title || obj.title;
        if (
          m &&
          typeof m === 'string' &&
          m !== 'Validation Error' &&
          !m.startsWith('Http failure response') &&
          !m.includes('already in a transaction')
        ) {
          messages.push(this.cleanMessage(m));
        }
      }
    });

    if (Array.isArray(e?.errors)) {
      e.errors.forEach((err: any) => {
        if (err && typeof err === 'object') {
          if (err.message) {
            messages.push(this.cleanMessage(String(err.message)));
          } else {
            for (const [f, msgs] of Object.entries(err)) {
              const list = Array.isArray(msgs) ? msgs : [String(msgs)];
              fieldMap[String(f)] = list.map((m) => this.cleanMessage(String(m)));
              list.forEach((m) => messages.push(this.cleanMessage(String(m))));
            }
          }
        } else if (typeof err === 'string') {
          messages.push(this.cleanMessage(err));
        }
      });
    } else if (e?.errors && typeof e.errors === 'object') {
      for (const [field, arr] of Object.entries(e.errors)) {
        const list = Array.isArray(arr) ? arr : [String(arr)];
        fieldMap[String(field)] = list.map((m) => this.cleanMessage(String(m)));
        list.forEach((m) => messages.push(this.cleanMessage(String(m))));
      }
    }

    if (Array.isArray(e?.errorMessages) && e.errorMessages.length) {
      const errs = e.errorMessages.map((x: any) => this.cleanMessage(String(x)));
      const props = Array.isArray(e?.propertyNames)
        ? e.propertyNames.map((x: any) => String(x))
        : [];

      if (props.length === errs.length && props.length) {
        for (let i = 0; i < props.length; i++) {
          const field = props[i] || 'General';
          const msg = errs[i] || '';
          fieldMap[field] = [...(fieldMap[field] || []), msg];
          messages.push(msg);
        }
      } else {
        errs.forEach((m: string) => messages.push(m));
      }
    }

    if (messages.length === 0 && e?.detail && typeof e.detail === 'string') {
      messages.push(this.cleanMessage(e.detail));
    }

    // New format support: { errors: [ { message: "..." } ] }
    if (Array.isArray(e?.errors)) {
      e.errors.forEach((err: any) => {
        const msg = err?.message || err?.Message;
        if (msg && typeof msg === 'string') {
          messages.push(this.cleanMessage(msg));
        }
      });
    }

    const uniq = Array.from(new Set(messages.map((x) => String(x).trim()).filter(Boolean)));
    return { messages: uniq, fieldMap, isSuccess };
  }

  private cleanMessage(m: string): string {
    if (!m) return '';
    if (m.includes('\n') || m.includes('\r')) {
      return m.split('\n')[0].split('\r')[0].trim();
    }
    if (m.includes(': at ')) {
      return m.split(': at ')[0].trim();
    }
    return m.trim();
  }
}
