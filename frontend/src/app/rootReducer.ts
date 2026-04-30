import { combineReducers } from "@reduxjs/toolkit";
import { api } from "./api";
import authReducer from "../features/auth/authSlice";
import alertsReducer from "../features/alerts/alertsSlice";
import voiceReducer from "../features/voice/voiceSlice";
import analyticsReducer from "../features/analytics/analyticsSlice";
import translationReducer from "../features/translation/translationSlice";

export const rootReducer = combineReducers({
  [api.reducerPath]: api.reducer,
  auth: authReducer,
  alerts: alertsReducer,
  voice: voiceReducer,
  analytics: analyticsReducer,
  translation: translationReducer
});
