import { createSlice } from "@reduxjs/toolkit";
import { io } from "socket.io-client";
const initialState = {
    items: [],
    unreadCount: 0,
    connected: false
};
let socket = null;
const alertsSlice = createSlice({
    name: "alerts",
    initialState,
    reducers: {
        setConnected: (state, action) => {
            state.connected = action.payload;
        },
        pushAlert: (state, action) => {
            state.items = [action.payload, ...state.items].slice(0, 20);
            if (!action.payload.isRead) {
                state.unreadCount += 1;
            }
        },
        setAlerts: (state, action) => {
            state.items = action.payload;
            state.unreadCount = action.payload.filter((item) => !item.isRead).length;
        },
        markRead: (state, action) => {
            state.items = state.items.map((item) => (item._id === action.payload ? { ...item, isRead: true } : item));
            state.unreadCount = state.items.filter((item) => !item.isRead).length;
        },
        markAllRead: (state) => {
            state.items = state.items.map((item) => ({ ...item, isRead: true }));
            state.unreadCount = 0;
        }
    }
});
export const connectAlerts = (token) => (dispatch, _getState) => {
    if (socket)
        return;
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
    socket.on("alert", (alert) => {
        dispatch(pushAlert(alert));
    });
};
export const disconnectAlerts = () => (dispatch) => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    dispatch(setConnected(false));
};
export const { setConnected, pushAlert, setAlerts, markRead, markAllRead } = alertsSlice.actions;
export default alertsSlice.reducer;
