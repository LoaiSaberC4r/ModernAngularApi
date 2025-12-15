import { Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';
import { ToastComponent } from '../../Feature/TosterComponent/toast-component/toast-component';
import { ToastOptions, ToastPayload } from '../../Domain/ResultPattern/ToastType';
import { Subject, concatMap, of, timer } from 'rxjs';
import { catchError, mapTo, switchMap, take } from 'rxjs/operators';

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
    this.queue$.next(payload);
  }
}
