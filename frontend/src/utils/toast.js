const TOAST_EVENT = "casper-toast";
export const showToast = (type, message) => {
    const payload = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type,
        message
    };
    window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: payload }));
};
export const toastEventName = TOAST_EVENT;
