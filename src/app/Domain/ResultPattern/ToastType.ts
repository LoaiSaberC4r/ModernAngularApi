export type ToastType = 'success' | 'warning' | 'error';

export interface ToastOptions {
  durationMs?: number;
  actionText?: string;
  closeOnNavigation?: boolean;
  fallback?: string;
}

export interface ToastPayload {
  message: string;
  type: ToastType;
  options?: ToastOptions;
}
