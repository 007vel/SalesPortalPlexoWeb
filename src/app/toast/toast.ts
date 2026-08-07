import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

const DURATION_MS = 2600;

@Injectable({ providedIn: 'root' })
export class Toast {
  private readonly snackBar = inject(MatSnackBar);

  show(message: string): void {
    this.snackBar.open(message, undefined, { duration: DURATION_MS });
  }
}
