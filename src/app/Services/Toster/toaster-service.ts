import { Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';
import { ToastComponent } from '../../Feature/TosterComponent/toast-component/toast-component';
import { ToastOptions, ToastPayload } from '../../Domain/ResultPattern/ToastType';

@Injectable({
  providedIn: 'root',
})
export class ToasterService {
  private readonly defaultDuration = 5000;

  constructor(private snack: MatSnackBar) {}

  success(message: string, options: ToastOptions = {}): void {
    this.open({ message, type: 'success', options });
  }

  warning(message: string, options: ToastOptions = {}): void {
    this.open({ message, type: 'warning', options });
  }

  error(message: string, options: ToastOptions = {}): void {
    this.open({ message, type: 'error', options });
  }

  private open(payload: ToastPayload): void {
    const cfg: MatSnackBarConfig = {
      duration: payload.options?.durationMs ?? this.defaultDuration,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: ['toast-shell'],
      data: payload,
    };

    this.snack.openFromComponent(ToastComponent, cfg);
  }
}
