import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { io, Socket } from "socket.io-client";
import type { AppDispatch, RootState } from "../../app/store";

export interface AlertItem {
  _id: string;
  type: "new_tender_flagged" | "price_spike" | "audit_complete" | "scrape_error";
  message: string;
  tenderId: string | null;
  material: string | null;
  isRead: boolean;
  createdAt: string;
}

interface AlertsState {
  items: AlertItem[];
  unreadCount: number;
  connected: boolean;
}

const initialState: AlertsState = {
  items: [],
  unreadCount: 0,
  connected: false
};

let socket: Socket | null = null;

const alertsSlice = createSlice({
  name: "alerts",
  initialState,
  reducers: {
    setConnected: (state, action: PayloadAction<boolean>) => {
      state.connected = action.payload;
    },
    pushAlert: (state, action: PayloadAction<AlertItem>) => {
      state.items = [action.payload, ...state.items].slice(0, 20);
      if (!action.payload.isRead) {
        state.unreadCount += 1;
      }
    },
    setAlerts: (state, action: PayloadAction<AlertItem[]>) => {
      state.items = action.payload;
      state.unreadCount = action.payload.filter((item) => !item.isRead).length;
    },
    markRead: (state, action: PayloadAction<string>) => {
      state.items = state.items.map((item) => (item._id === action.payload ? { ...item, isRead: true } : item));
      state.unreadCount = state.items.filter((item) => !item.isRead).length;
    },
    markAllRead: (state) => {
      state.items = state.items.map((item) => ({ ...item, isRead: true }));
      state.unreadCount = 0;
    }
  }
});

export const connectAlerts = (token: string) => (dispatch: AppDispatch, _getState: () => RootState): void => {
  if (socket) return;

  socket = io(import.meta.env.VITE_SOCKET_URL ?? "http://localhost:4000", {
    auth: { token: `Bearer ${token}` },
    transports: ["websocket"]
  });

  socket.on("connect", () => {
    dispatch(setConnected(true));
  });

  socket.on("disconnect", () => {
    dispatch(setConnected(false));
  });

  socket.on("alert", (alert: AlertItem) => {
    dispatch(pushAlert(alert));
  });
};

export const disconnectAlerts = () => (dispatch: AppDispatch): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  dispatch(setConnected(false));
};

export const { setConnected, pushAlert, setAlerts, markRead, markAllRead } = alertsSlice.actions;
export default alertsSlice.reducer;
