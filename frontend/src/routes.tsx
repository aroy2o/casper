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

const ProtectedPage = ({ children }: { children: JSX.Element }): JSX.Element => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Layout>{children}</Layout>;
};

export const AppRoutes = (): JSX.Element => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedPage>
            <Dashboard />
          </ProtectedPage>
        }
      />
      <Route
        path="/upload"
        element={
          <ProtectedPage>
            <UploadAudit />
          </ProtectedPage>
        }
      />
      <Route
        path="/prices"
        element={
          <ProtectedPage>
            <PriceExplorer />
          </ProtectedPage>
        }
      />
      <Route
        path="/tenders"
        element={
          <ProtectedPage>
            <TenderBrowser />
          </ProtectedPage>
        }
      />
      <Route
        path="/tenders/:id"
        element={
          <ProtectedPage>
            <TenderDetail />
          </ProtectedPage>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedPage>
            <Analytics />
          </ProtectedPage>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedPage>
            <Settings />
          </ProtectedPage>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedPage>
            <ReportHistory />
          </ProtectedPage>
        }
      />
      <Route
        path="/extension-audits"
        element={
          <ProtectedPage>
            <ExtensionAuditHistory />
          </ProtectedPage>
        }
      />
      <Route
        path="/compare"
        element={
          <ProtectedPage>
            <TenderComparison />
          </ProtectedPage>
        }
      />
      <Route
        path="/security"
        element={
          <ProtectedPage>
            <Security />
          </ProtectedPage>
        }
      />
      <Route
        path="/retention"
        element={
          <ProtectedPage>
            <RetentionAdmin />
          </ProtectedPage>
        }
      />
      <Route
        path="/estimate"
        element={
          <ProtectedPage>
            <FairCostEstimator />
          </ProtectedPage>
        }
      />
    </Routes>
  );
};
