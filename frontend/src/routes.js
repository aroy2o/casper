import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { useAppSelector } from "./app/hooks";
import { Dashboard } from "./pages/Dashboard";
import { UploadAudit } from "./pages/UploadAudit";
import { PriceExplorer } from "./pages/PriceExplorer";
import { TenderBrowser } from "./pages/TenderBrowser";
import TenderDetail from "./pages/TenderDetail";
import { Settings } from "./pages/Settings";
import { Login } from "./pages/Login";
import { Analytics } from "./pages/Analytics";
import { ReportHistory } from "./pages/ReportHistory";
import { ExtensionAuditHistory } from "./pages/ExtensionAuditHistory";
import TenderComparison from "./pages/TenderComparison";
import { Security } from "./pages/Security";
import { RetentionAdmin } from "./pages/RetentionAdmin";
import { FairCostEstimator } from "./pages/FairCostEstimator";
const ProtectedPage = ({ children }) => {
    const { isAuthenticated } = useAppSelector((state) => state.auth);
    const location = useLocation();
    if (!isAuthenticated) {
        return _jsx(Navigate, { to: "/login", replace: true, state: { from: location.pathname } });
    }
    return _jsx(Layout, { children: children });
};
export const AppRoutes = () => {
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsx(Route, { path: "/", element: _jsx(ProtectedPage, { children: _jsx(Dashboard, {}) }) }), _jsx(Route, { path: "/upload", element: _jsx(ProtectedPage, { children: _jsx(UploadAudit, {}) }) }), _jsx(Route, { path: "/prices", element: _jsx(ProtectedPage, { children: _jsx(PriceExplorer, {}) }) }), _jsx(Route, { path: "/tenders", element: _jsx(ProtectedPage, { children: _jsx(TenderBrowser, {}) }) }), _jsx(Route, { path: "/tenders/:id", element: _jsx(ProtectedPage, { children: _jsx(TenderDetail, {}) }) }), _jsx(Route, { path: "/analytics", element: _jsx(ProtectedPage, { children: _jsx(Analytics, {}) }) }), _jsx(Route, { path: "/settings", element: _jsx(ProtectedPage, { children: _jsx(Settings, {}) }) }), _jsx(Route, { path: "/reports", element: _jsx(ProtectedPage, { children: _jsx(ReportHistory, {}) }) }), _jsx(Route, { path: "/extension-audits", element: _jsx(ProtectedPage, { children: _jsx(ExtensionAuditHistory, {}) }) }), _jsx(Route, { path: "/compare", element: _jsx(ProtectedPage, { children: _jsx(TenderComparison, {}) }) }), _jsx(Route, { path: "/security", element: _jsx(ProtectedPage, { children: _jsx(Security, {}) }) }), _jsx(Route, { path: "/retention", element: _jsx(ProtectedPage, { children: _jsx(RetentionAdmin, {}) }) }), _jsx(Route, { path: "/estimate", element: _jsx(ProtectedPage, { children: _jsx(FairCostEstimator, {}) }) })] }));
};
