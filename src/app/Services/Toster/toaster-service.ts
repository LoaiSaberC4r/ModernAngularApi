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
            catchError(() => of(void 0))
          );
        })
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

  extractMessages(data: any): BackendErrorResponse {
    const messages: string[] = [];
    const fieldMap: Record<string, string[]> = {};
    let isSuccess = false;

    // Use .error for HttpErrorResponse if available
    const e = data?.error ?? data;

    console.log('🔍 Toaster: Extracting Backend Messages from:', { data, e });

    const targets = [data, e];
    targets.forEach((obj) => {
      if (obj && typeof obj === 'object') {
        if ('isSuccess' in obj) isSuccess = !!obj.isSuccess;

        const m = obj.message || obj.description || obj.detail || obj.Title || obj.title;
        if (
          m &&
          typeof m === 'string' &&
          m !== 'Validation Error' &&
          !m.startsWith('Http failure response') &&
          !m.includes('already in a transaction') // skip the raw stack trace line if it matches title
        ) {
          messages.push(m);
        }
      }
    });

    // 1. Handle "errors" as an array or object
    if (Array.isArray(e?.errors)) {
      e.errors.forEach((err: any) => {
        if (err && typeof err === 'object') {
          if (err.message) messages.push(String(err.message));
          else {
            for (const [f, msgs] of Object.entries(err)) {
              const list = Array.isArray(msgs) ? msgs : [String(msgs)];
              fieldMap[String(f)] = list.map(String);
              list.forEach((m) => messages.push(String(m)));
            }
          }
        } else if (typeof err === 'string') {
          messages.push(err);
        }
      });
    } else if (e?.errors && typeof e.errors === 'object') {
      for (const [field, arr] of Object.entries(e.errors)) {
        const list = Array.isArray(arr) ? arr : [String(arr)];
        fieldMap[String(field)] = list.map(String);
        list.forEach((m) => messages.push(String(m)));
      }
    }

    // 2. Handle "errorMessages" (legacy)
    if (Array.isArray(e?.errorMessages) && e.errorMessages.length) {
      const errs = e.errorMessages.map((x: any) => String(x));
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

    // Special case for technical exceptions in 'detail'
    if (messages.length === 0 && e?.detail && typeof e.detail === 'string') {
      const cleanMsg = e.detail.split('\r\n')[0].split('\n')[0]; // first line only
      messages.push(cleanMsg);
    }

    const uniq = Array.from(new Set(messages.map((x) => String(x).trim()).filter(Boolean)));
    return { messages: uniq, fieldMap, isSuccess };
  }
}
