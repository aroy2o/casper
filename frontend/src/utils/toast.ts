export type ToastType = "error" | "success" | "info";

export interface ToastPayload {
  id: string;
  type: ToastType;
  message: string;
}

const TOAST_EVENT = "casper-toast";

export const showToast = (type: ToastType, message: string): void => {
  const payload: ToastPayload = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    message
  };
  window.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT, { detail: payload }));
};

export const toastEventName = TOAST_EVENT;
