import { ChangeDetectionStrategy, Component, Inject } from '@angular/core';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { ToastPayload } from '../../../Domain/ResultPattern/ToastType';
@Component({
  selector: 'app-toast-component',
  imports: [MatIconModule, CommonModule],
  templateUrl: './toast-component.html',
  styleUrl: './toast-component.css',
})
export class ToastComponent {
  constructor(
    public ref: MatSnackBarRef<ToastComponent>,
    @Inject(MAT_SNACK_BAR_DATA) public data: ToastPayload
  ) {}
}
