import { jsx as _jsx } from "react/jsx-runtime";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { store } from "./app/store";
import { AppRoutes } from "./routes";
import { AutoTranslateProvider } from "./features/translation/AutoTranslateProvider";
import "./index.css";
ReactDOM.createRoot(document.getElementById("root")).render(_jsx(Provider, { store: store, children: _jsx(AutoTranslateProvider, { children: _jsx(BrowserRouter, { future: { v7_startTransition: true, v7_relativeSplatPath: true }, children: _jsx(AppRoutes, {}) }) }) }));
