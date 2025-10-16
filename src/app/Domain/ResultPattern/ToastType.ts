export type ToastType = 'success' | 'warning' | 'error';

export interface ToastOptions {
  durationMs?: number; // المدة بالمللي ثانية (افتراضي 3500)
  actionText?: string; // نص زر إجراء (اختياري)
  closeOnNavigation?: boolean; // اغلاق عند التنقل (افتراضي true)
}

export interface ToastPayload {
  message: string;
  type: ToastType;
  options?: ToastOptions;
}
